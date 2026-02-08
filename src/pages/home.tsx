import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Fredoka, Nunito } from "next/font/google";
import clientPromise from "@/lib/mongodb";
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
                <div className={styles.bgBlobs} aria-hidden>
                    <span className={styles.blob1} />
                    <span className={styles.blob2} />
                    <span className={styles.blob3} />
                    <span className={styles.blob4} />
                    <span className={styles.blob5} />
                </div>
                <div className={styles.rainbowArc} aria-hidden />

                <header className={homeStyles.headerBar}>
                    <div className={homeStyles.headerDate}>
                        <time>{date}</time>
                        <span className={homeStyles.headerTime}>{time}</span>
                    </div>

                    <Link href="/" className={homeStyles.headerLogo}>
                        <span>Folded</span>
                        <span>Notes</span>
                    </Link>

                    <div />
                </header>

                <main className={homeStyles.mainFull}>
                    <aside className={homeStyles.homeColRecordings}>
                        <h2 className={homeStyles.homeColTitle}>My recordings</h2>
                        {Array.isArray(recordings) && recordings.length > 0 ? (
                            <div className={homeStyles.recordingsList}>
                                {recordings.map((rec) => (
                                    <button
                                        key={rec._id}
                                        type="button"
                                        className={homeStyles.recordingItem}
                                        onClick={() => openRecordingPopup(rec.text || "No content")}
                                    >
                                        {rec.text ? rec.text.slice(0, 50) + (rec.text.length > 50 ? "..." : "") : "No content"}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className={homeStyles.recordingsEmpty}>
                                🎙️ <br />
                                No recordings yet.
                                <br />
                                <span>Tap the record button to start.</span>
                            </p>
                        )}
                    </aside>

                    <section className={homeStyles.homeColCategories}>
                        <h2 className={homeStyles.homeColTitle}>Categories</h2>
                        <ul className={homeStyles.categoriesList}>
                            {CATEGORIES.map((name) => (
                                <li key={name} className={homeStyles.categoryItem}>
                                    {name}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className={homeStyles.homeColRecord}>
                        <button
                            type="button"
                            className={homeStyles.recordTrigger}
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
