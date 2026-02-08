import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb.js";

export default async function handler(req, res) {
    try {
        if (req.method === "POST") {
            const { user, text, emotion } = req.body;
            console.log("Received POST:", { user, text, emotion }); // ✅ log request

            if (!text || !user) {
                return res.status(400).json({ error: "Missing user or text" });
            }

            const client = await clientPromise;
            const db = client.db("FoldedNotes");

            const doc = {
                user: "username",
                date: new Intl.DateTimeFormat("en-CA").format(new Date()),
                text: text,
                public: false,
                emotion: emotion ?? null,
            };

            const result = await db.collection("notes").insertOne(doc);
            console.log("Inserted document:", result.insertedId); // ✅ log success

            return res.status(200).json({ ok: true, insertedId: result.insertedId });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("API /notes error:", err); // ✅ log the actual error
        return res.status(500).json({ error: "Failed to save note" });
    }
}


