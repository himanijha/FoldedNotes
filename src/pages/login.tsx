import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { Fredoka, Nunito } from "next/font/google";
import styles from "@/styles/Generate.module.css";
import loginStyles from "@/styles/Login.module.css";

import clientPromise from "../lib/mongodb";

export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db("myDatabase");

    const notes = await db.collection("notes").find({}).toArray();
    res.status(200).json(notes);
}

const fredoka = Fredoka({
    variable: "--font-fredoka",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

const nunito = Nunito({
    variable: "--font-nunito",
    subsets: ["latin"],
    weight: ["400", "600", "700"],
});

const PRONOUN_OPTIONS = [
    { value: "", label: "Select pronouns" },
    { value: "they/them", label: "they/them" },
    { value: "she/her", label: "she/her" },
    { value: "he/him", label: "he/him" },
    { value: "other", label: "Other" },
    { value: "prefer-not", label: "Prefer not to say" },
];

function getAnonId(): string {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("anon_id");
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("anon_id", id);
    }
    return id;
}

function isValidEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

type FormErrors = {
    email?: string;
    password?: string;
    passwordConfirm?: string;
    pronouns?: string;
};

export default function Login() {
    const router = useRouter();
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [pronouns, setPronouns] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const next: FormErrors = {};
        if (!email.trim()) next.email = "Email is required";
        else if (!isValidEmail(email)) next.email = "Please enter a valid email";
        if (!password) next.password = "Password is required";
        setErrors(next);
        if (Object.keys(next).length > 0) return;

        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = res.ok ? await res.json().catch(() => ({})) : null;
            if (res.ok && data?.ok !== false) {
                if (data?.token) localStorage.setItem("auth_token", data.token);
                router.push("/");
                return;
            }
            setErrors({ password: "Invalid email or password" });
        } catch {
            setErrors({ password: "Something went wrong. Try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleSignUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const next: FormErrors = {};
        if (!email.trim()) next.email = "Email is required";
        else if (!isValidEmail(email)) next.email = "Please enter a valid email";
        if (!password) next.password = "Password is required";
        else if (password.length < 8) next.password = "Password must be at least 8 characters";
        if (password !== passwordConfirm) next.passwordConfirm = "Passwords don't match";
        if (!pronouns) next.pronouns = "Please select your pronouns";
        setErrors(next);
        if (Object.keys(next).length > 0) return;

        setLoading(true);
        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                    pronouns,
                }),
            });
            const data = res.ok ? await res.json().catch(() => ({})) : null;
            if (res.ok && data?.ok !== false) {
                if (data?.token) localStorage.setItem("auth_token", data.token);
                router.push("/");
                return;
            }
            setErrors({ email: data?.error || "Sign up failed. Try again." });
        } catch {
            setErrors({ email: "Something went wrong. Try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleContinueAnonymously = async () => {
        const anonId = getAnonId();
        try {
            await fetch("/start-call", {
                method: "POST",
                headers: { "x-anon-id": anonId },
            });
        } catch {
            // continue to home
        }
        router.push("/");
    };

    const switchMode = () => {
        setMode((m) => (m === "login" ? "signup" : "login"));
        setErrors({});
        setPassword("");
        setPasswordConfirm("");
    };

    return (
        <>
            <Head>
                <title>FoldedNotes – Welcome</title>
                <meta name="description" content="Your safe space for voice notes." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className={`${styles.page} ${fredoka.variable} ${nunito.variable}`}>
                <div className={styles.bgBlobs} aria-hidden>
                    <span className={styles.blob1} />
                    <span className={styles.blob2} />
                    <span className={styles.blob3} />
                    <span className={styles.blob4} />
                    <span className={styles.blob5} />
                </div>
                <div className={styles.rainbowArc} aria-hidden />

                <main className={loginStyles.card}>
                    <h1 className={loginStyles.logo}>
                        <span className={loginStyles.logoWord}>Folded</span>
                        <span className={loginStyles.logoWord}>Notes</span>
                    </h1>
                    <p className={loginStyles.subtitle}>
                        {mode === "login"
                            ? "Sign in to your account"
                            : "Create an account to save your notes"}
                    </p>

                    <div className={loginStyles.tabRow}>
                        <button
                            type="button"
                            className={`${loginStyles.tab} ${mode === "login" ? loginStyles.tabActive : ""}`}
                            onClick={() => mode !== "login" && switchMode()}
                        >
                            Log in
                        </button>
                        <button
                            type="button"
                            className={`${loginStyles.tab} ${mode === "signup" ? loginStyles.tabActive : ""}`}
                            onClick={() => mode !== "signup" && switchMode()}
                        >
                            Sign up
                        </button>
                    </div>

                    {mode === "login" ? (
                        <form className={loginStyles.form} onSubmit={handleLoginSubmit}>
                            <div className={loginStyles.field}>
                                <label className={loginStyles.label} htmlFor="login-email">
                                    Email
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    autoComplete="email"
                                    className={`${loginStyles.input} ${errors.email ? loginStyles.inputError : ""}`}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                {errors.email && (
                                    <p className={loginStyles.error}>{errors.email}</p>
                                )}
                            </div>
                            <div className={loginStyles.field}>
                                <label className={loginStyles.label} htmlFor="login-password">
                                    Password
                                </label>
                                <input
                                    id="login-password"
                                    type="password"
                                    autoComplete="current-password"
                                    className={`${loginStyles.input} ${errors.password ? loginStyles.inputError : ""}`}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                {errors.password && (
                                    <p className={loginStyles.error}>{errors.password}</p>
                                )}
                            </div>
                            <button
                                type="submit"
                                className={loginStyles.submitButton}
                                disabled={loading}
                            >
                                {loading ? "Signing in…" : "Log in"}
                            </button>
                        </form>
                    ) : (
                        <form className={loginStyles.form} onSubmit={handleSignUpSubmit}>
                            <div className={loginStyles.field}>
                                <label className={loginStyles.label} htmlFor="signup-email">
                                    Email
                                </label>
                                <input
                                    id="signup-email"
                                    type="email"
                                    autoComplete="email"
                                    className={`${loginStyles.input} ${errors.email ? loginStyles.inputError : ""}`}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                {errors.email && (
                                    <p className={loginStyles.error}>{errors.email}</p>
                                )}
                            </div>
                            <div className={loginStyles.field}>
                                <label className={loginStyles.label} htmlFor="signup-password">
                                    Password
                                </label>
                                <input
                                    id="signup-password"
                                    type="password"
                                    autoComplete="new-password"
                                    className={`${loginStyles.input} ${errors.password ? loginStyles.inputError : ""}`}
                                    placeholder="At least 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                {errors.password && (
                                    <p className={loginStyles.error}>{errors.password}</p>
                                )}
                            </div>
                            <div className={loginStyles.field}>
                                <label className={loginStyles.label} htmlFor="signup-password-confirm">
                                    Re-enter password
                                </label>
                                <input
                                    id="signup-password-confirm"
                                    type="password"
                                    autoComplete="new-password"
                                    className={`${loginStyles.input} ${errors.passwordConfirm ? loginStyles.inputError : ""}`}
                                    placeholder="••••••••"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                />
                                {errors.passwordConfirm && (
                                    <p className={loginStyles.error}>{errors.passwordConfirm}</p>
                                )}
                            </div>
                            <div className={loginStyles.field}>
                                <label className={loginStyles.label} htmlFor="signup-pronouns">
                                    Pronouns
                                </label>
                                <select
                                    id="signup-pronouns"
                                    className={`${loginStyles.select} ${errors.pronouns ? loginStyles.inputError : ""}`}
                                    value={pronouns}
                                    onChange={(e) => setPronouns(e.target.value)}
                                >
                                    {PRONOUN_OPTIONS.map((opt) => (
                                        <option key={opt.value || "empty"} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                {errors.pronouns && (
                                    <p className={loginStyles.error}>{errors.pronouns}</p>
                                )}
                            </div>
                            <button
                                type="submit"
                                className={loginStyles.submitButton}
                                disabled={loading}
                            >
                                {loading ? "Creating account…" : "Sign up"}
                            </button>
                        </form>
                    )}

                    <div className={loginStyles.divider}>or</div>
                    <button
                        type="button"
                        className={loginStyles.anonButton}
                        onClick={handleContinueAnonymously}
                    >
                        Continue anonymously
                    </button>
                    <p className={loginStyles.privacy}>
                        No account needed. A random ID stays only on this device.
                    </p>
                </main>
            </div>
        </>
    );
}
