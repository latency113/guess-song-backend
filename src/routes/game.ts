import { Elysia, t } from "elysia";
import { db } from "../db";
import type { GameScoreRecord } from "../db";
import type { SongItem } from "../services/itunes";
import { getSongsForCategory } from "../services/itunes";
import { getSongYouTubeId } from "../services/youtube";

export interface GameRoundQuestion {
  roundIndex: number;
  previewUrl: string;
  youtubeId?: string;
  correctSongId: string; // Used for client/server answer checking
  artistName?: string;
  choices: {
    id: string;
    title: string;
    artist: string;
    artworkUrl?: string;
  }[];
}

export function extractPrimaryArtist(artist: string): string {
  if (!artist) return "";
  const parts = artist.split(/\s*(?:feat\.|ft\.|featuring|&|\bwith\b|\bx\b|\bX\b|และ)\s*/i);
  return parts[0]?.trim() || artist.trim();
}

export function normalizeTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(/\s*\(feat\.[^)]*\)/gi, "")
    .replace(/\s*\[feat\.[^\]]*\]/gi, "")
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s*\[.*?\]/g, "")
    .replace(/\s*-\s*.*$/g, "")
    .toLowerCase()
    .trim();
}

export const CATEGORIES = [
  {
    id: "THAI_HITS",
    title: "เพลงไทยยอดฮิต (Thai Hits)",
    description: "เพลงฮิตติดหู T-Pop และเพลงไทยร่วมสมัยสุดปัง",
    icon: "🇹🇭",
    color: "from-pink-500 to-rose-600"
  },
  {
    id: "THAI_INDIE_ROCK",
    title: "ไทยอินดี้ & ร็อก (Thai Rock/Indie)",
    description: "เพลงร็อกและเพลงอินดี้ระดับตำนานที่ท่อนอินโทรคุ้นเคย",
    icon: "🎸",
    color: "from-amber-500 to-orange-600"
  },
  {
    id: "GLOBAL_POP",
    title: "เพลงสากลยอดนิยม (Global Pop)",
    description: "Billboard Hot 100 และเพลงสากลยอดฮิตระดับโลก",
    icon: "🌎",
    color: "from-cyan-500 to-blue-600"
  },
  {
    id: "GLOBAL_CLASSIC",
    title: "สากลคลาสสิก (Global Classics)",
    description: "เพลงสากลระดับตำนานยุค 80s, 90s และต้นยุค 2000s",
    icon: "👑",
    color: "from-purple-500 to-indigo-600"
  }
];

export const gameRoutes = new Elysia({ prefix: "/api/game" })
  .get("/categories", () => {
    return {
      categories: CATEGORIES
    };
  })
  .post(
    "/create-session",
    async ({ body, set }: any) => {
      const { category, roundsCount = 10 } = body;
      const validCategory = (category as SongItem["category"]) || "THAI_HITS";
      const roundsToCreate = Math.min(roundsCount, 30);

      // 1. Fetch songs for distinct artists having at least 4 songs
      let songs = await db.getArtistGroupedSongsForGame(validCategory as any, Math.max(roundsToCreate + 5, 15));

      // 2. Fallback to standard song retrieval if needed
      if (!songs || songs.length < 4) {
        songs = await getSongsForCategory(validCategory);
      }

      if (!songs || songs.length < 4) {
        set.status = 500;
        return { error: "ไม่สามารถดึงข้อมูลเพลงได้เพียงพอสำหรับการเล่นเกม" };
      }

      // Group songs by primary artist (case-insensitive)
      const artistGroups = new Map<string, SongItem[]>();
      for (const s of songs) {
        if (!s.previewUrl || !s.title || !s.artist) continue;
        const prime = extractPrimaryArtist(s.artist).toLowerCase();
        if (!artistGroups.has(prime)) {
          artistGroups.set(prime, []);
        }
        artistGroups.get(prime)!.push(s);
      }

      // Deduplicate songs per artist to ensure distinct titles
      const eligibleArtists = new Map<string, SongItem[]>();
      for (const [artistKey, songList] of artistGroups.entries()) {
        const seenTitles = new Set<string>();
        const uniqueSongs: SongItem[] = [];
        for (const s of songList) {
          const norm = normalizeTitle(s.title);
          if (norm.length > 0 && !seenTitles.has(norm)) {
            seenTitles.add(norm);
            uniqueSongs.push(s);
          }
        }
        if (uniqueSongs.length >= 4) {
          eligibleArtists.set(artistKey, uniqueSongs);
        }
      }

      const rawRoundsData: {
        correctSong: SongItem;
        distractors: SongItem[];
        artistName: string;
      }[] = [];

      // If we have artists with >= 4 distinct songs, pick exclusively from them!
      if (eligibleArtists.size > 0) {
        const shuffledArtistKeys = Array.from(eligibleArtists.keys()).sort(() => 0.5 - Math.random());
        const usedCorrectSongIds = new Set<string>();

        for (let i = 0; i < roundsToCreate; i++) {
          const artistKey = shuffledArtistKeys[i % shuffledArtistKeys.length];
          if (!artistKey) continue;
          const artistSongPool = eligibleArtists.get(artistKey);
          if (!artistSongPool || artistSongPool.length < 4) continue;

          // Pick an unused correct song from this artist
          const availableCorrect = artistSongPool.filter((s) => !usedCorrectSongIds.has(s.id));
          const pool = availableCorrect.length > 0 ? availableCorrect : artistSongPool;
          const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
          const correctSong = shuffledPool[0] || artistSongPool[0];
          if (!correctSong) continue;

          usedCorrectSongIds.add(correctSong.id);

          // Pick 3 distractors from the same artist's remaining songs
          const normCorrect = normalizeTitle(correctSong.title);
          const remainingSameArtist = artistSongPool
            .filter((s) => s.id !== correctSong.id && normalizeTitle(s.title) !== normCorrect)
            .sort(() => 0.5 - Math.random());

          const distractors = remainingSameArtist.slice(0, 3);

          rawRoundsData.push({
            correctSong,
            distractors,
            artistName: extractPrimaryArtist(correctSong.artist)
          });
        }
      } else {
        // Fallback: Pick distractors from the category if no single artist has 4 songs
        const shuffled = [...songs].sort(() => 0.5 - Math.random());
        const rawSelected = shuffled.slice(0, roundsToCreate);
        for (const correctSong of rawSelected) {
          const others = songs.filter(
            (s) => s.id !== correctSong.id && normalizeTitle(s.title) !== normalizeTitle(correctSong.title)
          );
          const distractors = [...others].sort(() => 0.5 - Math.random()).slice(0, 3);
          rawRoundsData.push({
            correctSong,
            distractors,
            artistName: extractPrimaryArtist(correctSong.artist)
          });
        }
      }

      // Resolve official YouTube Video IDs in parallel for 0:00 - 0:10 true intro playback
      const resolvedQuestions = await Promise.all(
        rawRoundsData.map(async (item) => {
          const ytId =
            item.correctSong.youtubeId ||
            (await getSongYouTubeId(item.correctSong.id, item.correctSong.title, item.correctSong.artist));
          return {
            ...item,
            correctSong: {
              ...item.correctSong,
              youtubeId: ytId || undefined
            }
          };
        })
      );

      const rounds: GameRoundQuestion[] = resolvedQuestions.map((item, index) => {
        const { correctSong, distractors, artistName } = item;

        // Combine and shuffle choices (1 correct + 3 distractors of the SAME artist)
        const choices = [
          {
            id: correctSong.id,
            title: correctSong.title,
            artist: correctSong.artist,
            artworkUrl: correctSong.artworkUrl
          },
          ...distractors.map((d) => ({
            id: d.id,
            title: d.title,
            artist: d.artist,
            artworkUrl: d.artworkUrl
          }))
        ].sort(() => 0.5 - Math.random());

        return {
          roundIndex: index + 1,
          previewUrl: correctSong.previewUrl,
          youtubeId: correctSong.youtubeId,
          correctSongId: correctSong.id,
          artistName,
          choices
        };
      });

      return {
        sessionId: `sess_${Date.now()}`,
        category: validCategory,
        totalRounds: rounds.length,
        timePerRoundSec: 10,
        rounds
      };
    },
    {
      body: t.Object({
        category: t.String(),
        roundsCount: t.Optional(t.Number())
      })
    }
  )
  .post(
    "/finish",
    async ({ body, headers, jwt }: any) => {
      const { category, mode = "disguised", score, correctCount, totalRounds, timeTakenSec, guestName } = body;

      let userId: string | undefined;
      const authHeader = headers["authorization"];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.replace("Bearer ", "").trim();
          const payload = await jwt.verify(token);
          if (payload && payload.id) {
            userId = payload.id;
          }
        } catch {
          // Token invalid, treat as guest
        }
      }

      const savedRecord = await db.saveGameRecord({
        userId,
        guestName: userId ? undefined : (guestName?.trim() || "Guest Player"),
        category: category as GameScoreRecord["category"],
        mode,
        score,
        correctCount,
        totalRounds,
        timeTakenSec
      });

      // Get current rank for this record in this category and mode
      const leaderboard = await db.getLeaderboard(category, 100, mode);
      const rank = leaderboard.findIndex((r) => r.id === savedRecord.id) + 1;

      return {
        message: "บันทึกคะแนนเรียบร้อยแล้ว",
        record: savedRecord,
        rank: rank > 0 ? rank : undefined
      };
    },
    {
      body: t.Object({
        category: t.String(),
        mode: t.Optional(t.String()),
        score: t.Number(),
        correctCount: t.Number(),
        totalRounds: t.Number(),
        timeTakenSec: t.Number(),
        guestName: t.Optional(t.String())
      })
    }
  );
