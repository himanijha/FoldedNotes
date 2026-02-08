"use client";

import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Fredoka, Nunito } from "next/font/google";
import clientPromise from "@/lib/mongodb";
import { EMOTIONS } from "@/types/emotion";
import styles from "@/styles/Generate.module.css";
import homeStyles from "@/styles/Home.module.css";

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

const AudioRecorder = dynamic(
    () => import("../components/AudioRecorder"),
    { ssr: false }
);

/** Filter chips: All + each emotion + Misc */
const EMOTION_FILTERS = ["All", ...EMOTIONS, "Misc"];

function useCurrentTime() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        setNow(new Date());
        const id = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(id);
    }, []);

    return {
        date: now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        }),
        time: now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        }),
    };
}

export default function HomePage({ recordings = [] }: { recordings?: any[] }) {
    const { date, time } = useCurrentTime();
    const router = useRouter();
    const [popupOpen, setPopupOpen] = useState(false);
    const [popupText, setPopupText] = useState("");
    const [avatarLetter, setAvatarLetter] = useState("Y");
    const [emotionFilter, setEmotionFilter] = useState("All");

    useEffect(() => {
        const anonId = typeof window !== "undefined" ? localStorage.getItem("anon_id") : null;
        if (!anonId) {
            router.push("/login");
        }
    }, [router]);

    useEffect(() => {
        setAvatarLetter(typeof window !== "undefined" && localStorage.getItem("auth_token") ? "U" : "Y");
    }, []);

    const openRecordingPopup = (text: string) => {
        setPopupText(text);
        setPopupOpen(true);
    };

    const closeRecordingPopup = () => {
        setPopupText("");
        setPopupOpen(false);
    };

    const filteredRecordings =
        emotionFilter === "All"
            ? recordings
            : (Array.isArray(recordings) ? recordings : []).filter((rec: { emotion?: string | null }) => {
                  const e = rec.emotion;
                  if (emotionFilter === "Misc") return !e || e === "Misc";
                  return e === emotionFilter;
              });

    return (
        <>
            <Head>
                <title>FoldedNotes – Home</title>
                <meta name="description" content="Anonymous voice notes — no account, no trace." />
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

                <header className={homeStyles.headerBar}>
                    <div className={`${homeStyles.headerDate} ${homeStyles.headerDateLeft}`}>
                        <time>{date}</time>
                        <span className={homeStyles.headerTime}>{time}</span>
                    </div>

                    <Link href="/" className={homeStyles.headerLogo}>
                        <span>Folded</span>
                        <span>Notes</span>
                    </Link>

                    <div className={homeStyles.headerProfile}>
                        {avatarLetter === "Y" ? (
                            <span className={homeStyles.anonymousBadge} aria-hidden>Anonymous</span>
                        ) : (
                            <span className={homeStyles.headerAvatar} aria-hidden title="Profile">{avatarLetter}</span>
                        )}
                        <Link href="/settings" className={homeStyles.headerProfileLink} aria-label="Settings">
                            Settings
                        </Link>
                    </div>
                </header>

                <main className={homeStyles.mainFull}>
                    <aside className={homeStyles.homeColNotesWithFilters}>
                        <h2 className={homeStyles.homeColTitle}>Notes</h2>
                        <p className={homeStyles.anonymousTagline}>Your private notes — no account, no trace.</p>
                        <div className={homeStyles.filterRow}>
                            {EMOTION_FILTERS.map((emotion) => (
                                <button
                                    key={emotion}
                                    type="button"
                                    className={emotionFilter === emotion ? homeStyles.filterChipActive : homeStyles.filterChip}
                                    onClick={() => setEmotionFilter(emotion)}
                                >
                                    {emotion}
                                </button>
                            ))}
                        </div>
                        {Array.isArray(filteredRecordings) && filteredRecordings.length > 0 ? (
                            <ul className={homeStyles.feedList}>
                                {filteredRecordings.map((rec: { _id: string; text?: string; date?: string; emotion?: string }, i: number) => {
                                    const size = i === 0 ? "large" : (i % 2 === 0 ? "medium" : "small");
                                    return (
                                    <li key={rec._id}>
                                        <button
                                            type="button"
                                            className={homeStyles.feedCard}
                                            data-emotion={rec.emotion || "Misc"}
                                            data-size={size}
                                            onClick={() => openRecordingPopup(rec.text || "No content")}
                                        >
                                            <div className={homeStyles.feedCardMeta}>
                                                {rec.date && (
                                                    <span className={homeStyles.feedCardDate}>
                                                        {new Date(rec.date).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                )}
                                                {rec.emotion && rec.emotion !== "Misc" && (
                                                    <span className={homeStyles.feedCardEmotion}>
                                                        {rec.emotion}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={homeStyles.feedCardText}>
                                                {rec.text
                                                    ? rec.text.slice(0, 120) + (rec.text.length > 120 ? "…" : "")
                                                    : "No content"}
                                            </p>
                                        </button>
                                    </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className={homeStyles.feedEmpty}>
                                {emotionFilter === "All"
                                    ? "Your notes will show up here. Tap the record button to add one."
                                    : `No notes with ${emotionFilter}. Try "All" or another emotion.`}
                            </p>
                        )}
                    </aside>

                    <button
                        type="button"
                        className={homeStyles.recordFab}
                        onClick={() => router.push("/")}
                        aria-label="Record a note"
                    >
                        <svg
                            className={homeStyles.recordFabIcon}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                    </button>
                </main>

                {/* Recording Popup */}
                {popupOpen && (
                    <div
                        className={homeStyles.recordPopupOverlay}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) closeRecordingPopup();
                        }}
                    >
                        <div className={homeStyles.recordPopupCard}>
                            <button
                                className={homeStyles.recordPopupClose}
                                onClick={closeRecordingPopup}
                                aria-label="Close recording popup"
                            >
                                &times;
                            </button>
                            <h2 className={homeStyles.recordPopupTitle}>Recording</h2>
                            <p>{popupText}</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// Fetch feed of all messages from MongoDB
export async function getServerSideProps() {
    try {
        const client = await clientPromise;
        const db = client.db("FoldedNotes");
        const notes = db.collection("notes");

        const recordings = await notes
            .find({})
            .sort({ date: -1 })
            .limit(100)
            .toArray();

        return {
            props: {
                recordings: JSON.parse(JSON.stringify(recordings)),
            },
        };
    } catch (err) {
        console.error("Home getServerSideProps (MongoDB):", err);
        return {
            props: {
                recordings: [],
            },
        };
    }
}
