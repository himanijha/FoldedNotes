import type { NextApiRequest, NextApiResponse } from "next";

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

    // TODO: create user in your DB (e.g. MongoDB), store pronouns, hash password
    // For now, accept and return a stub token.
    const token = `demo_${Buffer.from(email).toString("base64")}_${Date.now()}`;
    return res.status(200).json({ ok: true, token });
}
