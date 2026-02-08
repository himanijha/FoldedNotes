import crypto from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;
const ITERATIONS = 100000;
const DIGEST = "sha512";
const TOKEN_SECRET = process.env.AUTH_SECRET || process.env.MONGODB_URI || "folded-notes-dev-secret";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LEN).toString("hex");
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, derived) => {
      if (err) return reject(err);
      resolve(`${salt}:${derived.toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return resolve(false);
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, derived) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived));
    });
  });
}

export function createToken(payload: { userId: string; email: string }): string {
  const data = JSON.stringify({
    userId: payload.userId,
    email: payload.email,
    exp: Date.now() + TOKEN_TTL_MS,
  });
  const b64 = Buffer.from(data, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(b64).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;
    const raw = Buffer.from(b64, "base64url").toString("utf8");
    const data = JSON.parse(raw);
    if (data.exp && Date.now() > data.exp) return null;
    return { userId: data.userId, email: data.email };
  } catch {
    return null;
  }
}
