import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";
import { hashPassword, createToken } from "@/lib/auth";
import { ObjectId } from "mongodb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, pronouns } = req.body ?? {};
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("FoldedNotes");
    const users = db.collection("users");

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const doc = {
      _id: new ObjectId(),
      email: normalizedEmail,
      passwordHash,
      pronouns: typeof pronouns === "string" ? pronouns : undefined,
      createdAt: new Date(),
    };
    await users.insertOne(doc);

    const userId = String(doc._id);
    const token = createToken({ userId, email: doc.email });
    return res.status(200).json({
      ok: true,
      token,
      userId,
      email: doc.email,
      pronouns: doc.pronouns ?? undefined,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Sign up failed" });
  }
}
