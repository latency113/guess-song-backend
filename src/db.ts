import { PrismaClient, CategoryType } from "@prisma/client";
import { isGenuineThaiSong } from "./utils/thaiSongFilter";

const prisma = new PrismaClient();

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface GameScoreRecord {
  id: string;
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  guestName?: string | null;
  category: "THAI_HITS" | "THAI_INDIE_ROCK" | "GLOBAL_POP" | "GLOBAL_CLASSIC";
  mode?: string | null;
  score: number;
  correctCount: number;
  totalRounds: number;
  timeTakenSec: number;
  createdAt: Date | string;
}

export const db = {
  prisma,

  async findUserByUsername(username: string): Promise<UserRecord | null> {
    try {
      return await prisma.user.findFirst({
        where: {
          username: {
            equals: username.trim(),
            mode: "insensitive"
          }
        }
      });
    } catch (e) {
      console.error("findUserByUsername error:", e);
      return null;
    }
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    try {
      return await prisma.user.findUnique({
        where: { id }
      });
    } catch (e) {
      console.error("findUserById error:", e);
      return null;
    }
  },

  async createUser(data: {
    username: string;
    passwordHash: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<UserRecord> {
    const avatar = data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`;
    return await prisma.user.create({
      data: {
        username: data.username.trim(),
        passwordHash: data.passwordHash,
        displayName: data.displayName?.trim() || data.username.trim(),
        avatarUrl: avatar
      }
    });
  },

  async saveGameRecord(record: {
    userId?: string;
    guestName?: string;
    category: GameScoreRecord["category"];
    mode?: string;
    score: number;
    correctCount: number;
    totalRounds: number;
    timeTakenSec: number;
  }): Promise<GameScoreRecord> {
    let user = null;
    if (record.userId) {
      user = await prisma.user.findUnique({ where: { id: record.userId } });
    }

    const saved = await prisma.gameRecord.create({
      data: {
        userId: record.userId || null,
        guestName: record.userId ? null : (record.guestName || "Player"),
        category: record.category as CategoryType,
        mode: record.mode || "disguised",
        score: record.score,
        correctCount: record.correctCount,
        totalRounds: record.totalRounds,
        timeTakenSec: record.timeTakenSec
      },
      include: {
        user: true
      }
    });

    return {
      id: saved.id,
      userId: saved.userId,
      username: saved.user?.username || null,
      displayName: saved.user?.displayName || saved.guestName || "Player",
      guestName: saved.guestName,
      category: saved.category as GameScoreRecord["category"],
      mode: saved.mode || "disguised",
      score: saved.score,
      correctCount: saved.correctCount,
      totalRounds: saved.totalRounds,
      timeTakenSec: saved.timeTakenSec,
      createdAt: saved.createdAt
    };
  },

  async getLeaderboard(category?: string, limit: number = 25, mode?: string): Promise<GameScoreRecord[]> {
    try {
      const whereClause: any = {};
      if (category && category !== "ALL") {
        whereClause.category = category as CategoryType;
      }
      if (mode && mode !== "ALL") {
        whereClause.mode = mode;
      }

      const records = await prisma.gameRecord.findMany({
        where: whereClause,
        orderBy: [
          { score: "desc" },
          { timeTakenSec: "asc" },
          { createdAt: "asc" }
        ],
        include: {
          user: true
        }
      });

      // Deduplicate so each player appears only ONCE with their highest score
      const seenPlayers = new Set<string>();
      const deduplicated: GameScoreRecord[] = [];

      for (const r of records) {
        // Group by player (and mode if viewing ALL modes, or by player)
        const playerKey = r.userId
          ? `user_${r.userId}`
          : `guest_${(r.guestName || "Player").trim().toLowerCase()}`;

        if (!seenPlayers.has(playerKey)) {
          seenPlayers.add(playerKey);
          deduplicated.push({
            id: r.id,
            userId: r.userId,
            username: r.user?.username || null,
            displayName: r.user?.displayName || r.guestName || "Player",
            guestName: r.guestName,
            category: r.category as GameScoreRecord["category"],
            mode: r.mode || "disguised",
            score: r.score,
            correctCount: r.correctCount,
            totalRounds: r.totalRounds,
            timeTakenSec: r.timeTakenSec,
            createdAt: r.createdAt
          });
          if (deduplicated.length >= limit) break;
        }
      }

      return deduplicated;
    } catch (e) {
      console.error("getLeaderboard error:", e);
      return [];
    }
  },

  async getUserStats(userId: string) {
    try {
      const userRecords = await prisma.gameRecord.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });

      const totalGames = userRecords.length;
      const totalScore = userRecords.reduce((sum, r) => sum + r.score, 0);
      const highestScore = userRecords.reduce((max, r) => Math.max(max, r.score), 0);
      const totalCorrect = userRecords.reduce((sum, r) => sum + r.correctCount, 0);
      const totalRounds = userRecords.reduce((sum, r) => sum + r.totalRounds, 0);
      const accuracy = totalRounds > 0 ? Math.round((totalCorrect / totalRounds) * 100) : 0;

      return {
        totalGames,
        totalScore,
        highestScore,
        accuracy,
        recentGames: userRecords.slice(0, 5)
      };
    } catch (e) {
      console.error("getUserStats error:", e);
      return {
        totalGames: 0,
        totalScore: 0,
        highestScore: 0,
        accuracy: 0,
        recentGames: []
      };
    }
  },

  async getGlobalStats() {
    try {
      const [totalGames, totalUsers, maxScoreResult] = await Promise.all([
        prisma.gameRecord.count(),
        prisma.user.count(),
        prisma.gameRecord.aggregate({
          _max: { score: true }
        })
      ]);

      return {
        totalGames,
        highestScore: maxScoreResult._max.score || 0,
        totalUsers
      };
    } catch (e) {
      console.error("getGlobalStats error:", e);
      return {
        totalGames: 0,
        highestScore: 0,
        totalUsers: 0
      };
    }
  },

  async saveSongs(
    songs: Array<{
      title: string;
      artist: string;
      category: CategoryType;
      previewUrl: string;
      artworkUrl?: string;
      releaseYear?: number;
      popularity?: number;
    }>
  ): Promise<number> {
    if (!songs || songs.length === 0) return 0;

    try {
      // Filter out duplicate songs within the incoming batch
      const uniqueIncoming = new Map<string, (typeof songs)[0]>();
      for (const s of songs) {
        if (!s.previewUrl || !s.title || !s.artist) continue;
        const key = `${s.title.toLowerCase().trim()}:::${s.artist.toLowerCase().trim()}`;
        if (!uniqueIncoming.has(key)) {
          uniqueIncoming.set(key, s);
        }
      }

      const candidateList = Array.from(uniqueIncoming.values()).filter((s) => {
        // Enforce authentic Thai songs in Thai categories
        if (s.category === "THAI_HITS" || s.category === "THAI_INDIE_ROCK") {
          return isGenuineThaiSong(s.title, s.artist);
        }
        return true;
      });
      if (candidateList.length === 0) return 0;

      // Find existing songs by previewUrl
      const existingSongs = await prisma.song.findMany({
        where: {
          previewUrl: { in: candidateList.map((s) => s.previewUrl) }
        },
        select: { previewUrl: true }
      });
      const existingSet = new Set(existingSongs.map((s) => s.previewUrl));

      const toInsert = candidateList
        .filter((s) => !existingSet.has(s.previewUrl))
        .map((s) => ({
          title: s.title.trim(),
          artist: s.artist.trim(),
          category: s.category,
          previewUrl: s.previewUrl,
          artworkUrl: s.artworkUrl || null,
          releaseYear: s.releaseYear || null,
          popularity: s.popularity || 0
        }));

      if (toInsert.length === 0) return 0;

      const result = await prisma.song.createMany({
        data: toInsert
      });
      return result.count;
    } catch (e) {
      console.error("saveSongs error:", e);
      return 0;
    }
  },

  async getRandomSongs(category: CategoryType, count: number = 30): Promise<any[]> {
    try {
      const songs = await prisma.$queryRaw<any[]>`
        SELECT id, title, artist, category, "previewUrl", "artworkUrl", "releaseYear", popularity, "youtubeId"
        FROM "Song"
        WHERE category = ${category}::"CategoryType"
        ORDER BY RANDOM()
        LIMIT ${count}
      `;
      return songs;
    } catch (e) {
      console.error("getRandomSongs raw query error, falling back:", e);
      try {
        const allCategorySongs = await prisma.song.findMany({
          where: { category },
          take: Math.max(count * 3, 60)
        });
        return allCategorySongs.sort(() => 0.5 - Math.random()).slice(0, count);
      } catch (err2) {
        console.error("getRandomSongs fallback error:", err2);
        return [];
      }
    }
  },

  async getArtistGroupedSongsForGame(category: CategoryType, artistsCount: number = 10): Promise<any[]> {
    try {
      const songs = await prisma.$queryRaw<any[]>`
        WITH eligible_artists AS (
          SELECT artist
          FROM "Song"
          WHERE category = ${category}::"CategoryType"
          GROUP BY artist
          HAVING COUNT(DISTINCT title) >= 4
          ORDER BY RANDOM()
          LIMIT ${artistsCount}
        )
        SELECT s.id, s.title, s.artist, s.category, s."previewUrl", s."artworkUrl", s."releaseYear", s."youtubeId"
        FROM "Song" s
        JOIN eligible_artists ea ON s.artist = ea.artist
        WHERE s.category = ${category}::"CategoryType"
      `;
      return songs;
    } catch (e) {
      console.error("getArtistGroupedSongsForGame error:", e);
      return [];
    }
  },

  async getSongStats(): Promise<Record<string, number>> {
    try {
      const counts = await prisma.song.groupBy({
        by: ["category"],
        _count: { id: true }
      });
      const result: Record<string, number> = {};
      for (const c of counts) {
        result[c.category] = c._count.id;
      }
      return result;
    } catch (e) {
      console.error("getSongStats error:", e);
      return {};
    }
  }
};
