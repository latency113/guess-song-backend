import ytSearch from "yt-search";
import { db } from "../db";

const inMemoryYtCache = new Map<string, string>();

/**
 * Clean track title from feat/remix noise for better search accuracy
 */
function cleanQueryTitle(title: string): string {
  return title
    .replace(/\s*\(feat\.[^)]*\)/gi, "")
    .replace(/\s*\[feat\.[^\]]*\]/gi, "")
    .replace(/\s*\(from\s+[^)]*\)/gi, "")
    .replace(/\s*\[from\s+[^\]]*\]/gi, "")
    .trim();
}

/**
 * Resolves the official YouTube Video ID for a song (to play the true 0:00-0:10 intro)
 */
export async function getSongYouTubeId(
  songId?: string,
  title?: string,
  artist?: string
): Promise<string | null> {
  if (!title || !artist) return null;

  const cleanTitle = cleanQueryTitle(title);
  const cacheKey = `${cleanTitle.toLowerCase()}:::${artist.toLowerCase()}`;

  if (inMemoryYtCache.has(cacheKey)) {
    return inMemoryYtCache.get(cacheKey)!;
  }

  // 1. Check if DB has youtubeId
  if (songId) {
    try {
      const dbSong = await db.prisma.song.findUnique({
        where: { id: songId },
        select: { youtubeId: true }
      });
      if (dbSong?.youtubeId) {
        inMemoryYtCache.set(cacheKey, dbSong.youtubeId);
        return dbSong.youtubeId;
      }
    } catch {
      // Ignore DB read error
    }
  }

  // 2. Search YouTube for official audio / MV
  try {
    const query = `${artist} ${cleanTitle} official audio`;
    const searchRes = await ytSearch(query);

    if (searchRes && searchRes.videos && searchRes.videos.length > 0) {
      const topVideo = searchRes.videos[0];
      const videoId = topVideo.videoId;

      if (videoId) {
        inMemoryYtCache.set(cacheKey, videoId);

        // Update DB in background so subsequent games resolve in 0ms
        if (songId) {
          db.prisma.song
            .update({
              where: { id: songId },
              data: { youtubeId: videoId }
            })
            .catch(() => {});
        }

        return videoId;
      }
    }
  } catch (err) {
    console.error(`Error resolving YouTube ID for ${artist} - ${title}:`, err);
  }

  return null;
}
