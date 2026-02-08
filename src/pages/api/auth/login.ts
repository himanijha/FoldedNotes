import type { NextApiRequest, NextApiResponse } from "next";

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

    const token = `demo_${Buffer.from(email).toString("base64")}_${Date.now()}`;
    return res.status(200).json({ ok: true, token });
}
