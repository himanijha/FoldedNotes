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
            // user id from query (logged-in user's _id or anon_id) – retrieve all notes where note.user === this id
            const userId = typeof req.query.user === "string" ? req.query.user.trim() : null;
            const filter = userId ? { user: userId } : {};
            const cursor = db
                .collection("notes")
                .find(filter)
                .sort({ date: -1 });
            const raw = await cursor.toArray();
            const notes = Array.isArray(raw)
                ? raw.map(({ _id, ...doc }) => ({
                    ...doc,
                    id: _id != null ? String(_id) : undefined,
                    _id: _id != null ? String(_id) : undefined,
                }))
                : [];
            return res.status(200).json({ notes });
        }

        if (req.method === "POST") {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const user = body.user;
            const userIdBody = body.userId;
            const text = body.text;
            const emotion = body.emotion;
            const userId = typeof userIdBody === "string" && userIdBody.trim()
                ? userIdBody.trim()
                : typeof user === "string" && user.trim()
                    ? user.trim()
                    : "anonymous";
            console.log("Notes POST body:", { userId, textLength: typeof text === "string" ? text.length : 0, emotion });

            if (!text || typeof text !== "string") {
                return res.status(400).json({ error: "Missing text" });
            }
            const textTrimmed = text.trim();
            if (!textTrimmed) {
                return res.status(400).json({ error: "Missing text" });
            }

            const client = await clientPromise;
            const db = client.db("FoldedNotes");

            const now = new Date();
            const dateDay = new Intl.DateTimeFormat("en-CA").format(now);
            const doc = {
                user: userId,
                date: now.toISOString(),
                dateDay,
                text: textTrimmed,
                public: false,
                emotion: emotion ?? null,
            };

            const result = await db.collection("notes").insertOne(doc);
            console.log("Notes POST inserted:", result.insertedId);
            const note = {
                _id: result.insertedId.toString(),
                text: doc.text,
                date: doc.date,
                dateDay: doc.dateDay,
                emotion: doc.emotion,
            };
            return res.status(200).json({ ok: true, insertedId: result.insertedId, note });
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


