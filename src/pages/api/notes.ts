import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb.js";

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            let client;
            try {
                client = await clientPromise;
            } catch (err) {
                console.error("MongoDB connection (GET):", err);
                return res.status(503).json({
                    error: "Database not configured",
                    notes: [],
                });
            }
            const db = client.db("FoldedNotes");
            const user = typeof req.query.user === "string" ? req.query.user.trim() : null;
            const filter = user ? { user } : {};
            const cursor = db
                .collection("notes")
                .find(filter)
                .sort({ date: -1 });
            const raw = await cursor.toArray();
            const notes = raw.map(({ _id, ...doc }) => ({
                ...doc,
                id: _id?.toString(),
            }));
            return res.status(200).json({ notes });
        }

        if (req.method === "POST") {
            const { user, text, emotion } = req.body;
            const userId = typeof user === "string" && user.trim() ? user.trim() : "anonymous";
            console.log("Received POST:", { user: userId, text, emotion });

            if (!text) {
                return res.status(400).json({ error: "Missing text" });
            }

            const client = await clientPromise;
            const db = client.db("FoldedNotes");

            const now = new Date();
            const doc = {
                user: userId,
                date: now.toISOString(),
                dateDay: new Intl.DateTimeFormat("en-CA").format(now),
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
        console.error("API /notes error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        const isConnection = /EREFUSED|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|querySrv/i.test(message);
        return res.status(500).json({
            error: "Failed to save note",
            ...(isConnection && {
                hint: "MongoDB connection failed. Check MONGODB_URI and network (e.g. DNS/firewall). For Atlas, try the non-SRV connection string if SRV is blocked.",
            }),
        });
    }
}


