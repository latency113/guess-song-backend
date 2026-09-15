# Guess Song Backend (ElysiaJS + Bun + Prisma + Neon DB)

Backend API สำหรับเว็บเกมทายเพลงจากอินโทร (Intro Quiz) พัฒนาด้วย **ElysiaJS**, **Bun**, **Prisma ORM**, **Neon Serverless PostgreSQL** และความปลอดภัยรหัสผ่านด้วย **Argon2id**

---

## 🚀 การ Deploy ขึ้น Vercel

โปรเจกต์นี้รองรับการ Deploy ขึ้น **Vercel** ด้วย **Bun Runtime (`bunVersion: "1.x"`)** แบบ Zero-Configuration

### 1. นำเข้าโปรเจกต์ใน Vercel
1. เข้าไปที่ [Vercel Dashboard](https://vercel.com/new)
2. กด **Import Git Repository** เลือก repository `guess-song-backend`
3. ในส่วน **Framework Preset** Vercel จะตรวจพบว่าเป็น Other / Elysia อัตโนมัติ

### 2. ตั้งค่า Environment Variables ใน Vercel
ก่อนกด Deploy ให้เพิ่มค่าตัวแปรในแท็บ **Environment Variables**:

| Variable Name | Description | ตัวอย่างค่า |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL Connection String (Pooler URL) | `postgresql://neondb_owner:password@ep-...neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Secret key สำหรับเข้ารหัส JWT Token | `music_intro_quiz_secret_key_2026_argon2` |

### 3. Build & Output Settings
- **Build Command**: `prisma generate` (ตั้งไว้ใน `package.json` เรียบร้อยแล้ว)
- **Install Command**: `bun install`

---

## 💻 การรันในเครื่อง (Local Development)

```bash
# ติดตั้ง dependencies
bun install

# รัน migration หรือ sync schema เข้า Neon DB
bunx prisma db push

# เริ่มรันเซิร์ฟเวอร์
bun run dev
```

- API Server: `http://localhost:3001`
- Swagger Documentation: `http://localhost:3001/swagger`
