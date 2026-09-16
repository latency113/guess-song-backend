import { Elysia, t } from "elysia";
import { db } from "../db";
import type { GameScoreRecord } from "../db";
import type { SongItem } from "../services/itunes";
import { getSongsForCategory } from "../services/itunes";

export interface GameRoundQuestion {
  roundIndex: number;
  previewUrl: string;
  correctSongId: string; // Used for client/server answer checking
  choices: {
    id: string;
    title: string;
    artist: string;
    artworkUrl?: string;
  }[];
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

      const songs = await getSongsForCategory(validCategory);

      if (!songs || songs.length < 4) {
        set.status = 500;
        return { error: "ไม่สามารถดึงข้อมูลเพลงได้เพียงพอสำหรับการเล่นเกม" };
      }

      // Shuffle songs to pick questions
      const shuffled = [...songs].sort(() => 0.5 - Math.random());
      const selectedSongs = shuffled.slice(0, Math.min(roundsCount, songs.length));

      const rounds: GameRoundQuestion[] = selectedSongs.map((correctSong, index) => {
        // Pick 3 distractors from the rest of the songs with distinct titles
        const otherSongs = songs.filter(
          (s) => s.id !== correctSong.id && s.title.toLowerCase().trim() !== correctSong.title.toLowerCase().trim()
        );
        const shuffledOthers = [...otherSongs].sort(() => 0.5 - Math.random());
        const distractors: typeof songs = [];
        const seenTitles = new Set<string>([correctSong.title.toLowerCase().trim()]);

        for (const candidate of shuffledOthers) {
          const normTitle = candidate.title.toLowerCase().trim();
          if (!seenTitles.has(normTitle)) {
            seenTitles.add(normTitle);
            distractors.push(candidate);
            if (distractors.length >= 3) break;
          }
        }

        // Combine and shuffle choices
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
          correctSongId: correctSong.id,
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
      const { category, score, correctCount, totalRounds, timeTakenSec, guestName } = body;

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
        score,
        correctCount,
        totalRounds,
        timeTakenSec
      });

      // Get current rank for this record
      const leaderboard = await db.getLeaderboard(category, 100);
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
        score: t.Number(),
        correctCount: t.Number(),
        totalRounds: t.Number(),
        timeTakenSec: t.Number(),
        guestName: t.Optional(t.String())
      })
    }
  );
