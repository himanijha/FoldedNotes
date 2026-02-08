import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    let userIdObj: ObjectId;
    try {
      userIdObj = new ObjectId(payload.userId);
    } catch {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const client = await clientPromise;
    const db = client.db("FoldedNotes");
    const users = db.collection("users");
    const user = await users.findOne(
      { _id: userIdObj },
      { projection: { email: 1, pronouns: 1 } }
    );
    const email = user?.email ?? payload.email ?? "";
    const pronouns = user?.pronouns ?? "";
    return res.status(200).json({
      email,
      pronouns: pronouns || undefined,
      userId: payload.userId,
    });
  } catch (err) {
    console.error("Auth me error:", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
}
