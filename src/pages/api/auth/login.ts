import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb.js";
import { verifyPassword, createToken } from "@/lib/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body ?? {};
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("FoldedNotes");
    const users = db.collection("users");

    const dbUser = await users.findOne({ email: normalizedEmail });
    if (!dbUser || !dbUser.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, dbUser.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const userId = String(dbUser._id);
    const token = createToken({ userId, email: dbUser.email });
    return res.status(200).json({
      ok: true,
      token,
      userId,
      email: dbUser.email,
      pronouns: dbUser.pronouns ?? undefined,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
}
