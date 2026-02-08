import type { NextApiRequest, NextApiResponse } from "next";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await client.connect();
    const db = client.db("FoldedNotes");

    const recordings = await db
      .collection("notes")
      .find({ user: "username" })
      .sort({ createdAt: -1 }) // ✅ most recent first
      .toArray();

    res.status(200).json(recordings);
  } catch (err) {
    res.status(500).json({ error: "Failed to load recordings" });
  } finally {
    await client.close();
  }
}
