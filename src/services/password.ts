// Argon2id password hashing service using native Bun password API

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536, // 64 MB
    timeCost: 2,       // 2 iterations
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch (error) {
    console.error("Argon2 verify error:", error);
    return false;
  }
}
