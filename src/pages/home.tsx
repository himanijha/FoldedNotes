"use client";

import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Fredoka, Nunito } from "next/font/google";
import { mergeAudioBlobs, segmentsToBlobs } from "@/lib/audio";
import homeStyles from "@/styles/Home.module.css";

type NoteRecord = { _id: string; text?: string; date?: string; emotion?: string };
type VoiceOption = { voice_id: string; name: string; description?: string };

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
    const [selectedNote, setSelectedNote] = useState<NoteRecord | null>(null);
    const [bubbleOrigin, setBubbleOrigin] = useState<{ x: number; y: number } | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [avatarLetter, setAvatarLetter] = useState("Y");
    const [voices, setVoices] = useState<VoiceOption[]>([]);
    const [defaultVoiceId, setDefaultVoiceId] = useState<string>("");
    const [popupVoiceId, setPopupVoiceId] = useState<string>("");
    const [voiceListOpen, setVoiceListOpen] = useState(false);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [noteAudioUrl, setNoteAudioUrl] = useState<string | null>(null);
    const noteAudioUrlRef = useRef<string | null>(null);
    const [showRecordOverlay, setShowRecordOverlay] = useState(false);
    const [writeNoteText, setWriteNoteText] = useState("");
    const [writeNotePosting, setWriteNotePosting] = useState(false);
    const [writeNoteError, setWriteNoteError] = useState<string | null>(null);

    useEffect(() => {
        const anonId = typeof window !== "undefined" ? localStorage.getItem("anon_id") : null;
        if (!anonId) {
            router.push("/login");
        }
    }, [router]);

    useEffect(() => {
        setAvatarLetter(typeof window !== "undefined" && localStorage.getItem("auth_token") ? "U" : "Y");
    }, []);

    useEffect(() => {
        fetch("/api/voices")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data.voices) && data.voices.length > 0) {
                    setVoices(data.voices);
                    setDefaultVoiceId(data.voices[0].voice_id);
                }
            })
            .catch(() => {});
    }, []);

    const openNotePopup = (rec: NoteRecord, event: React.MouseEvent<HTMLButtonElement>) => {
        const el = event.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        setBubbleOrigin({ x, y });
        setIsClosing(false);
        setSelectedNote(rec);
        setPopupVoiceId(defaultVoiceId || voices[0]?.voice_id || "");
        setVoiceListOpen(false);
        setNoteAudioUrl(null);
        if (noteAudioUrlRef.current) {
            URL.revokeObjectURL(noteAudioUrlRef.current);
            noteAudioUrlRef.current = null;
        }
    };

    const requestCloseNotePopup = () => {
        setIsClosing(true);
    };

    const closeNotePopup = () => {
        setSelectedNote(null);
        setBubbleOrigin(null);
        setIsClosing(false);
        setVoiceListOpen(false);
        setNoteAudioUrl(null);
        if (noteAudioUrlRef.current) {
            URL.revokeObjectURL(noteAudioUrlRef.current);
            noteAudioUrlRef.current = null;
        }
    };

    const handleNotePopupAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
        if (e.animationName !== "notePopupFlipOut") return;
        setSelectedNote(null);
        setBubbleOrigin(null);
        setIsClosing(false);
        setNoteAudioUrl(null);
        if (noteAudioUrlRef.current) {
            URL.revokeObjectURL(noteAudioUrlRef.current);
            noteAudioUrlRef.current = null;
        }
    };

    const generateAndPlayNote = async () => {
        const voiceId = popupVoiceId || defaultVoiceId;
        if (!selectedNote?.text || !voiceId) return;
        setGeneratingAudio(true);
        try {
            const res = await fetch("/api/speech", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: selectedNote.text,
                    voiceMain: voiceId,
                    voice_theme: selectedNote.emotion || "Misc",
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to generate audio");
            const segments = data.segments as { audioBase64: string; contentType: string }[] | undefined;
            if (!Array.isArray(segments) || segments.length === 0) throw new Error("No audio");
            const blobs = segmentsToBlobs(segments);
            const merged = await mergeAudioBlobs(blobs);
            const url = URL.createObjectURL(merged);
            if (noteAudioUrlRef.current) URL.revokeObjectURL(noteAudioUrlRef.current);
            noteAudioUrlRef.current = url;
            setNoteAudioUrl(url);
        } catch {
            // show error in UI if desired
        } finally {
            setGeneratingAudio(false);
        }
    };

    // Auto-generate audio when a note popup opens or voice changes
    useEffect(() => {
        if (!selectedNote?.text) return;
        const voiceId = popupVoiceId || defaultVoiceId;
        if (!voiceId) return;
        generateAndPlayNote();
    }, [selectedNote?._id, popupVoiceId || defaultVoiceId]);

    const displayRecordings = Array.isArray(recordings) ? recordings : [];

    return (
        <>
            <Head>
                <title>FoldedNotes – Home</title>
                <meta name="description" content="Anonymous voice notes — no account, no trace." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className={`${homeStyles.page} ${fredoka.variable} ${nunito.variable}`}>
                <div className={homeStyles.rainbowArc} aria-hidden />

                <header className={homeStyles.headerBar}>
                    <div className={`${homeStyles.headerDate} ${homeStyles.headerDateLeft}`}>
                        <time>{date}</time>
                        <span className={homeStyles.headerTime}>{time}</span>
                    </div>

                    <Link href="/home" className={homeStyles.headerLogo}>
                        <span>Folded</span>
                        <span>Notes</span>
                    </Link>

                    <div className={homeStyles.headerProfile}>
                        {avatarLetter === "Y" ? (
                            <span className={homeStyles.anonymousBadge} aria-hidden>Anonymous</span>
                        ) : (
                            <span className={homeStyles.headerAvatar} aria-hidden title="Profile">{avatarLetter}</span>
                        )}
                        <span className={homeStyles.headerCurrent} aria-current="page">Home</span>
                        <Link href="/settings" className={homeStyles.headerProfileLink} aria-label="Settings">
                            Settings
                        </Link>
                    </div>
                </header>

                <main className={homeStyles.mainFull}>
                    <aside className={homeStyles.noteSidebar} aria-label="Notes">
                        <h2 className={homeStyles.homeColTitle}>Notes</h2>
                        <p className={homeStyles.anonymousTagline}>Your private notes — no account, no trace.</p>
                        <div className={homeStyles.noteSidebarPaper} aria-label="Write a note">
                            <div className={homeStyles.noteSidebarTape} aria-hidden />
                            <label htmlFor="write-note-input" className={homeStyles.writeNoteLabel}>
                                Write a note
                            </label>
                            <textarea
                                id="write-note-input"
                                className={homeStyles.writeNoteInput}
                                placeholder="Jot something down…"
                                value={writeNoteText}
                                onChange={(e) => setWriteNoteText(e.target.value)}
                                rows={5}
                                disabled={writeNotePosting}
                                aria-describedby={writeNoteError ? "write-note-error" : undefined}
                            />
                            {writeNoteError && (
                                <p id="write-note-error" className={homeStyles.writeNoteError} role="alert">
                                    {writeNoteError}
                                </p>
                            )}
                            <button
                                type="button"
                                className={homeStyles.writeNotePost}
                                onClick={async () => {
                                    const text = writeNoteText.trim();
                                    if (!text || writeNotePosting) return;
                                    setWriteNotePosting(true);
                                    setWriteNoteError(null);
                                    try {
                                        let emotion = "Misc";
                                        try {
                                            const classifyRes = await fetch("/api/classify", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ text }),
                                            });
                                            const classifyData = await classifyRes.json().catch(() => ({}));
                                            if (classifyRes.ok && classifyData.emotion) {
                                                emotion = classifyData.emotion;
                                            }
                                        } catch {
                                            /* use Misc if Gemini classification fails */
                                        }
                                        const res = await fetch("/api/notes", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ user: "username", text, emotion }),
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (!res.ok) throw new Error(data.error || "Failed to post");
                                        setWriteNoteText("");
                                        router.replace(router.asPath);
                                    } catch (err) {
                                        setWriteNoteError(err instanceof Error ? err.message : "Failed to post note");
                                    } finally {
                                        setWriteNotePosting(false);
                                    }
                                }}
                                disabled={!writeNoteText.trim() || writeNotePosting}
                            >
                                {writeNotePosting ? "Posting…" : "Pin to feed"}
                            </button>
                        </div>
                    </aside>

                    <aside className={homeStyles.homeColNotesWithFilters}>
                        <div className={homeStyles.feedAndRecord}>
                            <button
                                type="button"
                                className={homeStyles.recordFab}
                                onClick={() => setShowRecordOverlay(true)}
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
                                    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                                    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                                    <line x1="12" y1="19" x2="12" y2="22" />
                                </svg>
                            </button>
                            {displayRecordings.length > 0 ? (
                                <ul className={homeStyles.feedList}>
                                    {displayRecordings.map((rec: NoteRecord, i: number) => {
                                        const n = displayRecordings.length;
                                        const angle = n > 0 ? ((i + 0.5) / n) * 2 * Math.PI : 0;
                                        const radius = 180;
                                        const xPx = Math.round(radius * Math.cos(angle));
                                        const yPx = Math.round(-radius * Math.sin(angle));
                                        return (
                                            <li
                                                key={rec._id}
                                                style={
                                                    {
                                                        "--cluster-x": `${xPx}px`,
                                                        "--cluster-y": `${yPx}px`,
                                                        zIndex: i + 1,
                                                    } as React.CSSProperties
                                                    }
                                            >
                                                <button
                                                    type="button"
                                                    className={homeStyles.feedCard}
                                                    data-emotion={rec.emotion || "Misc"}
                                                    onClick={(e) => openNotePopup(rec, e)}
                                                    aria-label="Open folded note"
                                                >
                                                    <span className={homeStyles.feedCardEnvelope} aria-hidden>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                            <path d="M22 6l-10 7L2 6" />
                                                        </svg>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className={homeStyles.feedEmpty}>
                                    Your notes will show up here. Tap the record button to add one.
                                </p>
                            )}
                        </div>
                    </aside>
                </main>

                {/* Record overlay: tap mic to record a new note inline */}
                {showRecordOverlay && (
                    <div
                        className={homeStyles.recordOverlay}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Record a note"
                    >
                        <button
                            type="button"
                            className={homeStyles.recordOverlayClose}
                            onClick={() => setShowRecordOverlay(false)}
                            aria-label="Close"
                        >
                            &times;
                        </button>
                        <div className={homeStyles.recordOverlayContent}>
                            <AudioRecorder
                                onSubmitted={() => {
                                    setShowRecordOverlay(false);
                                    router.replace(router.asPath);
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Note popup: flip & expand, then generate & play */}
                {selectedNote && (
                    <div
                        className={`${homeStyles.notePopupOverlay} ${isClosing ? homeStyles.notePopupOverlayClosing : ""}`}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) requestCloseNotePopup();
                        }}
                    >
                        <div
                            className={`${homeStyles.notePopupCard} ${isClosing ? homeStyles.notePopupCardClosing : ""}`}
                            data-emotion={selectedNote.emotion || "Misc"}
                            style={
                                bubbleOrigin && typeof window !== "undefined"
                                    ? {
                                          "--bubble-dx": `${bubbleOrigin.x - window.innerWidth / 2}px`,
                                          "--bubble-dy": `${bubbleOrigin.y - window.innerHeight / 2}px`,
                                      } as Record<string, string>
                                    : undefined
                            }
                            onAnimationEnd={handleNotePopupAnimationEnd}
                        >
                            <div className={homeStyles.notePopupHeader}>
                                <button
                                    className={homeStyles.notePopupClose}
                                    onClick={requestCloseNotePopup}
                                    aria-label="Close note"
                                >
                                    &times;
                                </button>
                                {selectedNote.emotion && selectedNote.emotion !== "Misc" && (
                                    <h1 className={homeStyles.notePopupTitleTag} data-emotion={selectedNote.emotion}>
                                        {selectedNote.emotion}
                                    </h1>
                                )}
                            </div>
                            <div className={homeStyles.notePopupScroll}>
                                <h2 className={homeStyles.notePopupLabel}>Your words</h2>
                                <div className={homeStyles.notePopupTextBlock}>
                                    {selectedNote.text || "No content"}
                                </div>
                                <div className={homeStyles.notePopupMeta}>
                                    {selectedNote.date && (
                                        <span className={homeStyles.notePopupDate}>
                                            {new Date(selectedNote.date).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className={homeStyles.notePopupVoiceRow}>
                                <span className={homeStyles.notePopupVoiceLabel}>Voice</span>
                                <div className={homeStyles.notePopupVoiceWrap}>
                                    <button
                                        type="button"
                                        className={homeStyles.notePopupVoiceButton}
                                        onClick={() => setVoiceListOpen((o) => !o)}
                                        aria-expanded={voiceListOpen}
                                        aria-haspopup="listbox"
                                    >
                                        {voices.find((v) => v.voice_id === (popupVoiceId || defaultVoiceId))?.name ?? "Choose voice"}
                                        <span className={homeStyles.notePopupVoiceChevron} aria-hidden>▾</span>
                                    </button>
                                    {voiceListOpen && (
                                        <ul
                                            className={homeStyles.notePopupVoiceList}
                                            role="listbox"
                                            aria-label="Select voice"
                                        >
                                            {voices.map((v) => (
                                                <li key={v.voice_id} role="option">
                                                    <button
                                                        type="button"
                                                        className={homeStyles.notePopupVoiceOption}
                                                        onClick={() => {
                                                            setPopupVoiceId(v.voice_id);
                                                            setVoiceListOpen(false);
                                                        }}
                                                    >
                                                        {v.name}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            {generatingAudio && (
                                <p className={homeStyles.notePopupGenerating}>Generating audio…</p>
                            )}
                            {noteAudioUrl && (
                                <div className={homeStyles.notePopupAudio}>
                                    <audio src={noteAudioUrl} controls preload="metadata" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// Fetch feed of all messages from MongoDB (dynamic import so client bundle never loads mongodb)
export async function getServerSideProps() {
    try {
        const { default: clientPromise } = await import("@/lib/mongodb") as { default: Promise<import("mongodb").MongoClient> };
        const client = await clientPromise;
        const db = client.db("FoldedNotes");
        const notes = db.collection("notes");

        const recordings = await notes
            .find({})
            .sort({ date: -1 })
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
