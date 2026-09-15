import { PrismaClient, CategoryType } from "@prisma/client";

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
      score: saved.score,
      correctCount: saved.correctCount,
      totalRounds: saved.totalRounds,
      timeTakenSec: saved.timeTakenSec,
      createdAt: saved.createdAt
    };
  },

  async getLeaderboard(category?: string, limit: number = 25): Promise<GameScoreRecord[]> {
    try {
      const whereClause = category && category !== "ALL" ? { category: category as CategoryType } : {};
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
        // When viewing a specific category, group by player. When ALL, group by player too.
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
  }
};
