"use client";

import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Fredoka, Nunito } from "next/font/google";
import { mergeAudioBlobs, segmentsToBlobs } from "@/lib/audio";
import { majorityEmotion, emotionColorsAsGradient } from "@/lib/emotions";
import homeStyles from "@/styles/Home.module.css";
import settingsStyles from "@/styles/Settings.module.css";

type NoteRecord = { _id: string; text?: string; date?: string; dateDay?: string; emotion?: string };

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const days: { day: number; dateKey: string }[] = [];
  for (let i = 0; i < startPad; i++) days.push({ day: 0, dateKey: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, dateKey: getDateKey(year, month, d) });
  }
  return days;
}
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
    const [isSignedIn, setIsSignedIn] = useState(false);
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
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    });
    const [myNotes, setMyNotes] = useState<NoteRecord[]>([]);
    const [allNotes, setAllNotes] = useState<NoteRecord[]>(() =>
        Array.isArray(recordings)
            ? recordings.map((r: { _id?: string; id?: string; text?: string; date?: string; dateDay?: string; emotion?: string }) => ({
                  _id: r._id ?? r.id ?? "",
                  text: r.text,
                  date: r.date,
                  dateDay: r.dateDay,
                  emotion: r.emotion,
              }))
            : []
    );
    const [circleFilter, setCircleFilter] = useState<"all" | "week" | "month">("all");

    useEffect(() => {
        if (typeof window === "undefined") return;
        const userId = localStorage.getItem("user_id");
        const anonId = localStorage.getItem("anon_id");
        if (!userId && !anonId) router.push("/login");
        const hasAuth = !!localStorage.getItem("auth_token");
        setIsSignedIn(hasAuth);
        setAvatarLetter(hasAuth ? "U" : "Y");
    }, [router]);

    const handleLogout = () => {
        if (typeof window === "undefined") return;
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_id");
        setIsSignedIn(false);
        setAvatarLetter("Y");
        router.push("/login");
    };

    const normalizeNote = (n: { id?: string; _id?: string; text?: string; date?: string; dateDay?: string; emotion?: string }): NoteRecord => ({
        _id: n.id || n._id || "",
        text: n.text,
        date: n.date,
        dateDay: n.dateDay,
        emotion: n.emotion,
    });

    const fetchMyNotes = () => {
        if (typeof window === "undefined") return;
        const userId = localStorage.getItem("user_id") || localStorage.getItem("anon_id");
        if (!userId) return;
        fetch(`/api/notes?user=${encodeURIComponent(userId)}`)
            .then((r) => r.json())
            .then((data) => {
                const list = Array.isArray(data.notes) ? data.notes : [];
                setMyNotes(list.map(normalizeNote));
            })
            .catch(() => setMyNotes([]));
    };

    const fetchAllNotes = () => {
        if (typeof window === "undefined") return;
        fetch("/api/notes")
            .then((r) => r.json())
            .then((data) => {
                const list = Array.isArray(data.notes) ? data.notes : [];
                setAllNotes(list.map(normalizeNote));
            })
            .catch(() => setAllNotes([]));
    };

    useEffect(() => {
        fetchMyNotes();
        fetchAllNotes();
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

    const allNotesForCircle: NoteRecord[] = allNotes;
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const circleNotes: NoteRecord[] = allNotesForCircle.filter((n) => {
        if (!n.date) return true;
        const d = new Date(n.date);
        if (circleFilter === "week") return d >= weekAgo;
        if (circleFilter === "month") return d >= monthAgo;
        return true;
    });

    const emotionsByDate: Record<string, string[]> = {};
    myNotes.forEach((n: NoteRecord) => {
        const key = n.dateDay ?? n.date?.slice(0, 10);
        if (key && n.emotion) {
            if (!emotionsByDate[key]) emotionsByDate[key] = [];
            emotionsByDate[key].push(n.emotion);
        }
    });
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayEmotions = emotionsByDate[todayKey] ?? [];
    const todayLabel = majorityEmotion(todayEmotions);
    const todayColor = emotionColorsAsGradient(todayEmotions);
    const calendarDays = buildCalendarDays(calendarMonth.year, calendarMonth.month);
    const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
    });
    const prevMonth = () => {
        setCalendarMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }));
    };
    const nextMonth = () => {
        setCalendarMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }));
    };

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
                        {isSignedIn && (
                            <button
                                type="button"
                                onClick={handleLogout}
                                className={homeStyles.headerProfileLink}
                                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                                aria-label="Log out"
                            >
                                Log out
                            </button>
                        )}
                    </div>
                </header>

                <main className={homeStyles.mainFull}>
                    <aside className={homeStyles.noteSidebar} aria-label="Notes">
                        <h2 className={homeStyles.homeColTitle}>Notes</h2>
                        {/* <p className={homeStyles.anonymousTagline}>Your private notes — no account, no trace.</p> */}
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
                                        const userId = typeof window !== "undefined" ? (localStorage.getItem("user_id") || localStorage.getItem("anon_id")) : null;
                                        const res = await fetch("/api/notes", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ user: userId || "anonymous", text, emotion }),
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (!res.ok) throw new Error(data.error || "Failed to post");
                                        setWriteNoteText("");
                                        fetchMyNotes();
                                        fetchAllNotes();
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
                        {/* <section className={homeStyles.emotionForDaySection} aria-label="Your emotion for the day">
                            <h2 className={homeStyles.emotionForDayTitle}>Your emotion for the day</h2>
                            {todayEmotion ? (
                                <span
                                    className={homeStyles.emotionForDayPill}
                                    data-emotion={todayEmotion}
                                    aria-label={`Today's mood: ${todayEmotion}`}
                                >
                                    {todayEmotion}
                                </span>
                            ) : (
                                <p className={homeStyles.emotionForDayEmpty}>
                                    Add a recording to add your mood for the day.
                                </p>
                            )}
                        </section> */}
                        <section className={homeStyles.myNotesSection} aria-label="Your notes">
                            <h2 className={homeStyles.myNotesTitle}>Your notes</h2>
                            {myNotes.length === 0 ? (
                                <p className={homeStyles.myNotesEmpty}>No notes yet. Write or record one to see it here.</p>
                            ) : (
                                <ul className={homeStyles.myNotesList}>
                                    {myNotes.map((note) => (
                                        <li key={note._id}>
                                            <button
                                                type="button"
                                                className={homeStyles.myNotesItem}
                                                onClick={(e) => openNotePopup(note, e)}
                                                data-emotion={note.emotion || "Misc"}
                                            >
                                                <span className={homeStyles.myNotesItemPreview}>
                                                    {note.text ? (note.text.length > 60 ? `${note.text.slice(0, 60)}…` : note.text) : "No content"}
                                                </span>
                                                {note.date && (
                                                    <span className={homeStyles.myNotesItemDate}>
                                                        {new Date(note.date).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
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
                            {circleNotes.length > 0 ? (
                                <ul className={homeStyles.feedList}>
                                    {circleNotes.map((rec: NoteRecord, i: number) => {
                                        const NOTES_PER_RING = 12;
                                        const SINGLE_RING_RADIUS = 180;
                                        const RING_RADII = [130, 190, 250];
                                        const n = circleNotes.length;
                                        let radius: number;
                                        let angle: number;
                                        if (n <= NOTES_PER_RING) {
                                            angle = n > 0 ? ((i + 0.5) / n) * 2 * Math.PI : 0;
                                            radius = SINGLE_RING_RADIUS;
                                        } else {
                                            const ringIndex = Math.min(
                                                Math.floor(i / NOTES_PER_RING),
                                                RING_RADII.length - 1
                                            );
                                            const startInRing = ringIndex * NOTES_PER_RING;
                                            const countInRing = Math.min(
                                                NOTES_PER_RING,
                                                n - startInRing
                                            );
                                            const positionInRing = i - startInRing;
                                            angle = countInRing > 0
                                                ? ((positionInRing + 0.5) / countInRing) * 2 * Math.PI
                                                : 0;
                                            radius = RING_RADII[ringIndex];
                                        }
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
                                                    aria-label="Open note"
                                                    title="Tap to open note"
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

                    <aside className={homeStyles.homeCalendarColumn} aria-label="Calendar and filters">
                        <section className={homeStyles.circleFilterSection} aria-label="Filter circle view">
                            <span className={homeStyles.circleFilterLabel}>Filters</span>
                            <div className={homeStyles.circleFilterRow}>
                                <button
                                    type="button"
                                    className={circleFilter === "all" ? homeStyles.circleFilterActive : homeStyles.circleFilterBtn}
                                    onClick={() => setCircleFilter("all")}
                                    aria-pressed={circleFilter === "all"}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    className={circleFilter === "week" ? homeStyles.circleFilterActive : homeStyles.circleFilterBtn}
                                    onClick={() => setCircleFilter("week")}
                                    aria-pressed={circleFilter === "week"}
                                >
                                    This week
                                </button>
                                <button
                                    type="button"
                                    className={circleFilter === "month" ? homeStyles.circleFilterActive : homeStyles.circleFilterBtn}
                                    onClick={() => setCircleFilter("month")}
                                    aria-pressed={circleFilter === "month"}
                                >
                                    This month
                                </button>
                            </div>
                        </section>
                        <section className={settingsStyles.calendarSection} aria-label="My Memories calendar">
                            <h2 className={settingsStyles.calendarTitle}>My Memories</h2>
                            <div className={settingsStyles.calendarMonthNav}>
                                <button
                                    type="button"
                                    className={settingsStyles.calendarNavBtn}
                                    onClick={prevMonth}
                                    aria-label="Previous month"
                                >
                                    ‹
                                </button>
                                <span className={settingsStyles.calendarMonthLabel}>{monthLabel}</span>
                                <button
                                    type="button"
                                    className={settingsStyles.calendarNavBtn}
                                    onClick={nextMonth}
                                    aria-label="Next month"
                                >
                                    ›
                                </button>
                            </div>
                            <div className={settingsStyles.calendarWeekdays} role="row">
                                {WEEKDAYS.map((d) => (
                                    <span key={d} className={settingsStyles.calendarWeekday} role="columnheader">
                                        {d}
                                    </span>
                                ))}
                            </div>
                            <div className={settingsStyles.calendarGrid} role="grid">
                                {calendarDays.map(({ day, dateKey }, i) => {
                                    const dayEmotions: string[] = dateKey && Array.isArray(emotionsByDate[dateKey]) ? emotionsByDate[dateKey] : [];
                                    const dayColor = emotionColorsAsGradient(dayEmotions);
                                    const dayMajority = majorityEmotion(dayEmotions);
                                    const hasNote = dayEmotions.length > 0;
                                    return (
                                        <div
                                            key={i}
                                            className={settingsStyles.calendarDay}
                                            data-has-note={hasNote ? "true" : undefined}
                                            data-emotion={dayMajority ?? undefined}
                                            role="gridcell"
                                        >
                                            {day > 0 && (
                                                <>
                                                    {hasNote && (
                                                        <span
                                                            className={settingsStyles.calendarEmotionBg}
                                                            style={{ background: dayColor }}
                                                            aria-hidden
                                                        />
                                                    )}
                                                    <span className={settingsStyles.calendarDayNum}>{day}</span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                        <section className={homeStyles.emotionForDaySection} aria-label="Your emotion for the day">
                            <h2 className={homeStyles.emotionForDayTitle}>Your emotion for the day</h2>
                            {todayEmotions.length > 0 && todayLabel ? (
                                <span
                                    className={homeStyles.emotionForDayPill}
                                    style={{ background: todayColor }}
                                    aria-label={`Today's mood: ${todayLabel}`}
                                >
                                    {todayLabel}
                                </span>
                            ) : (
                                <p className={homeStyles.emotionForDayEmpty}>
                                    Add a recording to add your mood for the day.
                                </p>
                            )}
                        </section>
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
                                    fetchMyNotes();
                                    fetchAllNotes();
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
