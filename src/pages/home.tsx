import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Fredoka, Nunito } from "next/font/google";
import clientPromise from "@/lib/mongodb";
import styles from "@/styles/Home.module.css";

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

const CATEGORIES = ["Hope", "Tips", "Stories", "Support", "Gratitude"];

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

    const openRecordingPopup = (text: string) => {
        setPopupText(text);
        setPopupOpen(true);
    };

    const closeRecordingPopup = () => {
        setPopupText("");
        setPopupOpen(false);
    };

    return (
        <>
            <Head>
                <title>FoldedNotes – Home</title>
                <meta name="description" content="Record and manage your messages." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className={`${styles.page} ${fredoka.variable} ${nunito.variable}`}>
                {/* Background */}
                <div className={styles.rainbowArc} aria-hidden />

                {/* Header */}
                <header className={styles.headerBar}>
                    <div className={styles.headerDate}>
                        <time>{date}</time>
                        <span className={styles.headerTime}>{time}</span>
                    </div>

                    <Link href="/" className={styles.headerLogo}>
                        <span>Folded</span>
                        <span>Notes</span>
                    </Link>

                    <div />
                </header>

                {/* Main */}
                <main className={styles.mainFull}>
                    {/* Recordings */}
                    <aside className={styles.homeColRecordings}>
                        <h2 className={styles.homeColTitle}>My recordings</h2>
                        {Array.isArray(recordings) && recordings.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {recordings.map((rec) => (
                                    <button
                                        key={rec._id}
                                        onClick={() => openRecordingPopup(rec.text || "No content")}
                                        style={{
                                            padding: "12px 16px",
                                            borderRadius: "12px",
                                            border: "1px solid rgba(0,0,0,0.1)",
                                            background: "#f9f9f9",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                                        }}
                                    >
                                        {rec.text ? rec.text.slice(0, 50) + (rec.text.length > 50 ? "..." : "") : "No content"}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.recordingsEmpty}>
                                🎙️ <br />
                                No recordings yet.
                                <br />
                                <span>Tap the record button to start.</span>
                            </p>
                        )}
                    </aside>

                    {/* Categories */}
                    <section className={styles.homeColCategories}>
                        <h2 className={styles.homeColTitle}>Categories</h2>
                        <ul className={styles.categoriesList}>
                            {CATEGORIES.map((name) => (
                                <li key={name} className={styles.categoryItem}>
                                    {name}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Record CTA */}
                    <div className={styles.homeColRecord}>
                        <button
                            type="button"
                            className={styles.recordTrigger}
                            onClick={() => router.push("/")}
                        >
                            <div>
                                <strong>Tap to record</strong>
                                <small>Your thoughts, safely saved</small>
                            </div>
                        </button>
                    </div>
                </main>

                {/* Recording Popup */}
                {popupOpen && (
                    <div
                        className={styles.recordPopupOverlay}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) closeRecordingPopup();
                        }}
                    >
                        <div className={styles.recordPopupCard}>
                            <button
                                className={styles.recordPopupClose}
                                onClick={closeRecordingPopup}
                                aria-label="Close recording popup"
                            >
                                &times;
                            </button>
                            <h2 className={styles.recordPopupTitle}>Recording</h2>
                            <p>{popupText}</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// Fetch recordings from MongoDB
export async function getServerSideProps() {
    const client = await clientPromise;
    const db = client.db("FoldedNotes");
    const notes = db.collection("notes");

    const recordings = await notes
        .find({ user: "username" }) // replace with dynamic user later
        .sort({ date: -1 })
        .toArray();

    return {
        props: {
            recordings: JSON.parse(JSON.stringify(recordings)),
        },
    };
}
