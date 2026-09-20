import { Elysia, t } from "elysia";
import { db } from "../db";
import type { GameScoreRecord } from "../db";
import type { SongItem } from "../services/itunes";
import { getSongsForCategory, fetchSongsByQuery } from "../services/itunes";
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
  const parts = artist.split(/\s*(?:feat\.|ft\.|featuring|&|\bwith\b|\bx\b|\bX\b|และ|,|\/)\s*/i);
  return parts[0]?.trim() || artist.trim();
}

export function cleanVersionNoise(s: string): string {
  if (!s) return "";
  return s
    .replace(/\s*[\(\[](?:feat\.|ft\.|featuring)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*[\(\[](?:live|acoustic|piano|strings|demo|remix|instrumental|special|version|single|ost|เพลงประกอบ|ซนซน|cover)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*-\s*(?:live|acoustic|piano|strings|demo|remix|instrumental|special|single|version).*$/gi, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export function parseTitleParts(raw: string): string[] {
  const cleaned = cleanVersionNoise(raw);
  const parts = new Set<string>();

  const normCleaned = cleaned.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (normCleaned) parts.add(normCleaned);

  // Thai (English) or English (Thai)
  const match = cleaned.match(/^([^\(\[\{\-]+)[\(\[\{]([^\)\]\}]+)[\)\]\}]/);
  if (match && match[1] && match[2]) {
    const p1 = match[1].toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    const p2 = match[2].toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    if (p1) parts.add(p1);
    if (p2) parts.add(p2);
  }

  // PartA / PartB or PartA - PartB
  const slashMatch = cleaned.match(/^([^\/\-]+)[\/\-]([^\/\-]+)$/);
  if (slashMatch && slashMatch[1] && slashMatch[2]) {
    const p1 = slashMatch[1].toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    const p2 = slashMatch[2].toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    if (p1) parts.add(p1);
    if (p2) parts.add(p2);
  }

  return Array.from(parts);
}

export function areTitlesSameSong(t1: string, t2: string): boolean {
  if (!t1 || !t2) return false;
  const parts1 = parseTitleParts(t1);
  const parts2 = parseTitleParts(t2);

  for (const p1 of parts1) {
    for (const p2 of parts2) {
      if (p1 === p2) return true;
      // High-similarity substring match for long titles
      if (p1.length >= 6 && p2.length >= 6) {
        if (p1.includes(p2) || p2.includes(p1)) {
          const minLen = Math.min(p1.length, p2.length);
          const maxLen = Math.max(p1.length, p2.length);
          if (minLen / maxLen >= 0.85) return true;
        }
      }
    }
  }
  return false;
}

export function normalizeTitle(title: string): string {
  if (!title) return "";
  return cleanVersionNoise(title)
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

      // 1. Fetch songs for candidate artists in this category
      let songs = await db.getArtistGroupedSongsForGame(validCategory as any, Math.max(roundsToCreate * 2, 40));

      // 2. Fallback to standard song retrieval if needed
      if (!songs || songs.length < 4) {
        songs = await getSongsForCategory(validCategory);
      }

      if (!songs || songs.length < 4) {
        set.status = 500;
        return { error: "ไม่สามารถดึงข้อมูลเพลงได้เพียงพอสำหรับการเล่นเกม" };
      }

      // Pre-load a fallback pool of general category songs in case an artist has fewer than 4 songs
      let fallbackPool: SongItem[] = songs;
      if (fallbackPool.length < 20) {
        const extraFallback = await db.getRandomSongs(validCategory as any, 30);
        fallbackPool = [...fallbackPool, ...extraFallback];
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

      // Deduplicate songs per artist to ensure distinct titles (including bilingual/variant deduplication)
      const eligibleArtists = new Map<string, SongItem[]>();
      for (const [artistKey, songList] of artistGroups.entries()) {
        const uniqueSongs: SongItem[] = [];
        for (const s of songList) {
          if (!s.title) continue;
          const isDuplicate = uniqueSongs.some((existing) => areTitlesSameSong(existing.title, s.title));
          if (!isDuplicate) {
            uniqueSongs.push(s);
          }
        }

        // 1. If artist has fewer than 4 songs, check if DB has other tracks matching this artist
        if (uniqueSongs.length < 4 && artistKey.length >= 2) {
          try {
            const dbExtras = await db.prisma.song.findMany({
              where: {
                artist: { contains: artistKey, mode: "insensitive" }
              },
              take: 20
            });
            for (const s of dbExtras) {
              const primary = extractPrimaryArtist(s.artist).toLowerCase();
              if (primary !== artistKey) continue;
              if (!uniqueSongs.some((existing) => areTitlesSameSong(existing.title, s.title))) {
                uniqueSongs.push({
                  id: s.id,
                  title: s.title,
                  artist: s.artist,
                  category: s.category as any,
                  previewUrl: s.previewUrl,
                  artworkUrl: s.artworkUrl || undefined,
                  releaseYear: s.releaseYear || undefined,
                  youtubeId: s.youtubeId || undefined
                });
              }
            }
          } catch {}
        }

        // 2. If still fewer than 4 songs, dynamically fetch from iTunes API
        if (uniqueSongs.length < 4) {
          try {
            const country = validCategory.startsWith("THAI") ? "th" : "us";
            const moreSongs = await fetchSongsByQuery(artistKey, validCategory, country, 15);
            if (moreSongs.length > 0) {
              // Asynchronously save to DB for future games
              db.saveSongs(moreSongs).catch((e) => console.error("Auto-save enriched songs error:", e));
              for (const ms of moreSongs) {
                const msPrimary = extractPrimaryArtist(ms.artist).toLowerCase();
                if (msPrimary !== artistKey) continue;
                if (!uniqueSongs.some((existing) => areTitlesSameSong(existing.title, ms.title))) {
                  uniqueSongs.push(ms);
                }
              }
            }
          } catch (e) {
            // Ignore search errors and proceed with available songs
          }
        }

        // Only consider an artist eligible if they have AT LEAST 4 distinct songs
        // This ensures all 4 choices are guaranteed to be from this same artist!
        if (uniqueSongs.length >= 4) {
          eligibleArtists.set(artistKey, uniqueSongs);
        }
      }

      const rawRoundsData: {
        correctSong: SongItem;
        distractors: SongItem[];
        artistName?: string;
      }[] = [];

      if (eligibleArtists.size > 0) {
        // Shuffle the eligible artist keys so each game has completely randomized artist pool
        const shuffledArtistKeys = Array.from(eligibleArtists.keys()).sort(() => 0.5 - Math.random());
        const usedCorrectSongIds = new Set<string>();

        // Ensure distinct artists across rounds by iterating through shuffled keys
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

          // Pick 3 distractors from the same artist's remaining songs, ensuring:
          // 1. None of the distractors is the same song as the correct song (including bilingual variants)
          // 2. None of the distractors are duplicate/bilingual matches of each other
          const remainingSameArtist = artistSongPool
            .filter((s) => s.id !== correctSong.id && !areTitlesSameSong(s.title, correctSong.title))
            .sort(() => 0.5 - Math.random());

          const distractors: SongItem[] = [];
          for (const cand of remainingSameArtist) {
            if (distractors.length >= 3) break;
            if (!distractors.some((d) => areTitlesSameSong(d.title, cand.title))) {
              distractors.push(cand);
            }
          }

          // If somehow fewer than 3 distractors, backfill from other songs
          let isSameArtistAll = true;
          if (distractors.length < 3) {
            isSameArtistAll = false;
            const chosenDistractorIds = new Set(distractors.map((d) => d.id));
            for (const cand of fallbackPool.sort(() => 0.5 - Math.random())) {
              if (distractors.length >= 3) break;
              if (
                cand.id !== correctSong.id &&
                !chosenDistractorIds.has(cand.id) &&
                !areTitlesSameSong(cand.title, correctSong.title) &&
                !distractors.some((d) => areTitlesSameSong(d.title, cand.title))
              ) {
                distractors.push(cand);
                chosenDistractorIds.add(cand.id);
              }
            }
          }

          rawRoundsData.push({
            correctSong,
            distractors,
            artistName: isSameArtistAll ? extractPrimaryArtist(correctSong.artist) : undefined
          });
        }
      } else {
        // Fallback: Pick distractors from the category without revealing artist
        const shuffled = [...songs].sort(() => 0.5 - Math.random());
        const rawSelected = shuffled.slice(0, roundsToCreate);
        for (const correctSong of rawSelected) {
          const others = songs
            .filter((s) => s.id !== correctSong.id && !areTitlesSameSong(s.title, correctSong.title))
            .sort(() => 0.5 - Math.random());
          const distractors: SongItem[] = [];
          for (const cand of others) {
            if (distractors.length >= 3) break;
            if (!distractors.some((d) => areTitlesSameSong(d.title, cand.title))) {
              distractors.push(cand);
            }
          }
          rawRoundsData.push({
            correctSong,
            distractors,
            artistName: undefined
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
