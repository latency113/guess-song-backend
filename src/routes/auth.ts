import { Elysia, t } from "elysia";
import { db } from "../db";
import { hashPassword, verifyPassword } from "../services/password";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post(
    "/register",
    async ({ body, set, jwt }: any) => {
      const { username, password, displayName } = body;

      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3) {
        set.status = 400;
        return { error: "Username ต้องมีความยาวอย่างน้อย 3 ตัวอักษร" };
      }

      if (password.length < 6) {
        set.status = 400;
        return { error: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" };
      }

      const existing = await db.findUserByUsername(trimmedUsername);
      if (existing) {
        set.status = 409;
        return { error: "Username นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น" };
      }

      // Hash password using Argon2id
      const passwordHash = await hashPassword(password);
      const user = await db.createUser({
        username: trimmedUsername,
        passwordHash,
        displayName: displayName?.trim() || trimmedUsername
      });

      // Generate JWT Token
      const token = await jwt.sign({
        id: user.id,
        username: user.username,
        displayName: user.displayName
      });

      return {
        message: "สมัครสมาชิกสำเร็จ",
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        }
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        displayName: t.Optional(t.String())
      })
    }
  )
  .post(
    "/login",
    async ({ body, set, jwt }: any) => {
      const { username, password } = body;

      const user = await db.findUserByUsername(username.trim());
      if (!user) {
        set.status = 401;
        return { error: "ไม่พบชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
      }

      // Verify Argon2 password
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        set.status = 401;
        return { error: "ไม่พบชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
      }

      const token = await jwt.sign({
        id: user.id,
        username: user.username,
        displayName: user.displayName
      });

      const stats = await db.getUserStats(user.id);

      return {
        message: "เข้าสู่ระบบสำเร็จ",
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        },
        stats
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String()
      })
    }
  )
  .get("/me", async ({ headers, set, jwt }: any) => {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบก่อนทำรายการ" };
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const payload = await jwt.verify(token);

    if (!payload || !payload.id) {
      set.status = 401;
      return { error: "Session หมดอายุหรือ Token ไม่ถูกต้อง" };
    }

    const user = await db.findUserById(payload.id);
    if (!user) {
      set.status = 404;
      return { error: "ไม่พบข้อมูลผู้ใช้" };
    }

    const stats = await db.getUserStats(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl
      },
      stats
    };
  });
