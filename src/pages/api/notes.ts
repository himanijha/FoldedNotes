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
            const cursor = db
                .collection("notes")
                .find({})
                .sort({ date: -1 })
                .limit(100);
            const raw = await cursor.toArray();
            const notes = raw.map(({ _id, ...doc }) => ({
                ...doc,
                id: _id?.toString(),
            }));
            return res.status(200).json({ notes });
        }

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


