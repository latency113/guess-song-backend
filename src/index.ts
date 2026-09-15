import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./routes/auth";
import { gameRoutes } from "./routes/game";
import { leaderboardRoutes } from "./routes/leaderboard";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const JWT_SECRET = process.env.JWT_SECRET || "music_intro_quiz_secret_key_2026_argon2";

const app = new Elysia()
  .use(
    cors({
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  )
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Music Intro Quiz API",
          version: "1.0.0",
          description: "API for Song Guessing Game with Intro previews, Argon2 Auth, and Leaderboard"
        }
      }
    })
  )
  .get("/", () => ({
    status: "online",
    name: "RandomMusicWeb API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      game: "/api/game",
      leaderboard: "/api/leaderboard",
      swagger: "/swagger"
    }
  }))
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(gameRoutes)
  .use(leaderboardRoutes);

if (!process.env.VERCEL) {
  app.listen(PORT);
  console.log(`🎵 Music Quiz API (Elysia) is running on http://localhost:${PORT}`);
  console.log(`📚 Swagger Docs available at http://localhost:${PORT}/swagger`);
}

export default app;
