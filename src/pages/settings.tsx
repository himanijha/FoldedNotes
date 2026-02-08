import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { Fredoka, Nunito } from "next/font/google";
import { majorityEmotion, emotionColorsAsGradient, EMOTION_COLORS } from "@/lib/emotions";
import homeStyles from "@/styles/Home.module.css";
import settingsStyles from "@/styles/Settings.module.css";

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return {
    date: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
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

const WS_URL = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_WS_PROXY_URL || "ws://localhost:8080")
  : "";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type NoteItem = { id?: string; date?: string; dateDay?: string; emotion?: string; text?: string };

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

function buildLast7Days(emotionsByDate: Record<string, string[]>) {
  const days: { dateKey: string; label: string; emotions: string[] }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
    days.push({
      dateKey,
      label,
      emotions: emotionsByDate[dateKey] ?? [],
    });
  }
  return days;
}

export default function SettingsPage() {
  const router = useRouter();
  const { date, time } = useCurrentTime();
  const [intensity, setIntensity] = useState(7);
  const [rate, setRate] = useState(5);
  const [proxyConnected, setProxyConnected] = useState(false);
  const [hardwareConnected, setHardwareConnected] = useState(false);
  const [profileInitial, setProfileInitial] = useState("Y");
  const [username, setUsername] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const wsRef = useRef<WebSocket | null>(null);
  const intensityRef = useRef(7);
  const rateRef = useRef(5);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  intensityRef.current = intensity;
  rateRef.current = rate;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const hasAuth = !!token;
    setIsSignedIn(hasAuth);

    const applyProfile = (email: string, storedPronouns: string) => {
      const name = email ? email.split("@")[0] : "";
      setUsername(name);
      setPronouns(storedPronouns);
      setProfileInitial(name ? name.charAt(0).toUpperCase() : hasAuth ? "U" : "Y");
    };

    const email = localStorage.getItem("user_email") || "";
    const storedPronouns = localStorage.getItem("profile_pronouns") || "";
    if (email || storedPronouns) {
      applyProfile(email, storedPronouns);
    } else if (hasAuth && token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.email != null) {
            localStorage.setItem("user_email", data.email);
            if (data.pronouns != null) localStorage.setItem("profile_pronouns", data.pronouns);
            applyProfile(data.email, data.pronouns ?? "");
          } else {
            applyProfile("", "");
          }
        })
        .catch(() => applyProfile("", ""));
    } else {
      applyProfile("", "");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userId = localStorage.getItem("user_id") || localStorage.getItem("anon_id");
    if (!userId) {
      setNotes([]);
      return;
    }
    fetch(`/api/notes?user=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setNotes(Array.isArray(data.notes) ? data.notes : []))
      .catch(() => setNotes([]));
  }, [isSignedIn]);

  // Fetch AI summary when notes change
  useEffect(() => {
    const texts = notes
      .filter((n) => n.text && n.text.trim())
      .map((n) => n.text as string);
    if (texts.length === 0) {
      setWeeklySummary(null);
      return;
    }
    setLoadingSummary(true);
    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: texts.slice(0, 20) }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) setWeeklySummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [notes]);

  const handleLogout = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_email");
    localStorage.removeItem("profile_pronouns");
    setIsSignedIn(false);
    setProfileInitial("Y");
    setUsername("");
    setPronouns("");
    router.push("/login");
  };

  const emotionsByDate: Record<string, string[]> = {};
  notes.forEach((n) => {
    const key = n.dateDay ?? n.date?.slice(0, 10);
    if (key && n.emotion) {
      if (!emotionsByDate[key]) emotionsByDate[key] = [];
      emotionsByDate[key].push(n.emotion);
    }
  });

  const last7Days = buildLast7Days(emotionsByDate);
  const weekNoteCount = last7Days.filter((d) => d.emotions.length > 0).length;
  const weekNotesTotal = last7Days.reduce((sum, d) => sum + d.emotions.length, 0);
  const weekEmotions = last7Days.flatMap((d) => d.emotions);
  const emotionCounts: Record<string, number> = {};
  weekEmotions.forEach((e) => { emotionCounts[e] = (emotionCounts[e] ?? 0) + 1; });
  const dominantEmotion = weekEmotions.length > 0
    ? (Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
    : null;

  const calendarDays = buildCalendarDays(calendarMonth.year, calendarMonth.month);
  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const prevMonth = () => {
    setCalendarMonth((m) => {
      if (m.month === 0) return { year: m.year - 1, month: 11 };
      return { year: m.year, month: m.month - 1 };
    });
  };
  const nextMonth = () => {
    setCalendarMonth((m) => {
      if (m.month === 11) return { year: m.year + 1, month: 0 };
      return { year: m.year, month: m.month + 1 };
    });
  };

  const sendToHardware = (int: number, r: number) => {
    const data = `${int},${r}`;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  };

  // Rate: 1–10 → 1200–200 ms (pulse timing). Intensity: 1–10 → spike/dip (1 = small peak, 10 = tall peak; never flat)
  const heartPeriodMs = 1200 - (rate - 1) * (1000 / 9);
  const spikePeakY = 11 - (intensity - 1) * (9 / 9); // up peak (R)
  const dipY = 24 - spikePeakY; // down peak (S)

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setProxyConnected(true);
      sendToHardware(intensityRef.current, rateRef.current);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "hardware_ready") {
          setHardwareConnected(true);
          sendToHardware(intensityRef.current, rateRef.current);
        } else if (msg.type === "hardware_lost") {
          setHardwareConnected(false);
        }
      } catch {
        // ignore non-JSON
      }
    };

    ws.onclose = () => {
      setProxyConnected(false);
      setHardwareConnected(false);
    };
    ws.onerror = () => {
      setProxyConnected(false);
      setHardwareConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  return (
    <>
      <Head>
        <title>FoldedNotes – Settings</title>
        <meta name="description" content="Profile, haptic settings, and emotion tracker." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
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
            <Link href="/home" className={homeStyles.headerProfileLink} aria-label="Home">
              Home
            </Link>
            <div className={homeStyles.profileDropdownWrap} ref={profileDropdownRef}>
              <button
                type="button"
                className={`${homeStyles.headerAvatar} ${!isSignedIn ? homeStyles.headerAvatarAnon : ""}`}
                onClick={() => setProfileDropdownOpen((o) => !o)}
                aria-expanded={profileDropdownOpen}
                aria-haspopup="menu"
                aria-label="Profile menu"
                title={isSignedIn ? (username || "Profile") : "Anonymous"}
              >
                {isSignedIn ? profileInitial : "A"}
              </button>
              {profileDropdownOpen && (
                <div className={homeStyles.profileDropdownPanel} role="menu">
                  {isSignedIn ? (
                    <button
                      type="button"
                      className={homeStyles.profileDropdownItem}
                      role="menuitem"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                    >
                      Log out
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className={homeStyles.profileDropdownItem}
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={settingsStyles.settingsPage}>
          <div className={settingsStyles.settingsLayout}>
            <div className={settingsStyles.settingsColumn}>
              <div className={settingsStyles.profileCard} aria-label="Profile">
            <h2 className={settingsStyles.settingsTitle}>Profile</h2>
            <div className={settingsStyles.profileRow}>
              <span className={settingsStyles.profileAvatar} aria-hidden title={isSignedIn ? (username || "Profile") : "Anonymous"}>
                {isSignedIn ? profileInitial : "A"}
              </span>
              <div className={settingsStyles.profileInfo}>
                {isSignedIn && username ? (
                  <p className={settingsStyles.profileUsername}>{username}</p>
                ) : null}
                {isSignedIn && pronouns ? (
                  <p className={settingsStyles.profilePronouns}>{pronouns}</p>
                ) : null}
                {!isSignedIn && (
                  <>
                    <p className={settingsStyles.profileStatus}>Anonymous</p>
                    <p className={settingsStyles.profileHint}>
                      No account. Use the app as a guest. Sign in to save across devices.
                    </p>
                  </>
                )}
                {!isSignedIn ? (
                  <Link href="/login" className={settingsStyles.profileLink}>
                    Sign in or create account
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={settingsStyles.profileLink}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Log out
                  </button>
                )}
              </div>
            </div>
          </div>
          <section className={settingsStyles.emotionTrackerSection} aria-label="How you've been">
            <h2 className={settingsStyles.emotionTrackerTitle}>How you've been</h2>
            <div className={settingsStyles.emotionTrackerStrip}>
              {last7Days.map((d) => {
                const dayMajority = majorityEmotion(d.emotions);
                const dayColor = emotionColorsAsGradient(d.emotions);
                return (
                  <div
                    key={d.dateKey}
                    className={settingsStyles.emotionTrackerDay}
                    title={dayMajority ? `${d.dateKey}: ${dayMajority}` : d.dateKey}
                  >
                    <span
                      className={settingsStyles.emotionTrackerDot}
                      style={{
                        background: d.emotions.length > 0 ? dayColor : "rgba(0,0,0,0.08)",
                      }}
                      aria-hidden
                    />
                    <span className={settingsStyles.emotionTrackerLabel}>{d.label}</span>
                  </div>
                );
              })}
            </div>
            <p className={settingsStyles.emotionTrackerHint}>
              {weekNotesTotal === 0
                ? "Log notes on Home to see your mood here."
                : `${weekNotesTotal} note${weekNotesTotal !== 1 ? "s" : ""} this week`}
            </p>
          </section>
          <div className={settingsStyles.settingsCard}>
            <div className={settingsStyles.settingsTitleRow}>
              <h2 className={settingsStyles.settingsTitle}>Haptic Settings</h2>
              <span
                className={
                  proxyConnected && hardwareConnected
                    ? `${settingsStyles.settingsStatusTag} ${settingsStyles.settingsStatusTagConnected}`
                    : `${settingsStyles.settingsStatusTag} ${settingsStyles.settingsStatusTagDisconnected}`
                }
                role="status"
                title={!proxyConnected ? "Run: npm run ws-server" : proxyConnected && !hardwareConnected ? "Waiting for ESP32" : undefined}
              >
                {!proxyConnected && "Not connected"}
                {proxyConnected && !hardwareConnected && "Proxy only"}
                {proxyConnected && hardwareConnected && "Connected"}
              </span>
            </div>

            <div
              className={settingsStyles.heartWrap}
              style={{ "--heart-period-ms": `${heartPeriodMs}ms` } as React.CSSProperties}
              aria-hidden
            >
              <svg
                className={`${settingsStyles.heartIcon} ${settingsStyles.heartPulse}`}
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
                aria-label="Heartbeat"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <svg
                className={settingsStyles.pulseOnHeart}
                viewBox="0 0 100 24"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  className={settingsStyles.pulsePath}
                  d={`M0 12 L22 12 L28 ${spikePeakY} L34 12 L46 12 L52 ${dipY} L58 12 L100 12`}
                  fill="none"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                />
              </svg>
            </div>

            <div className={settingsStyles.settingsRow}>
              <label className={settingsStyles.settingsLabel} htmlFor="intensitySlider">
                Vibration intensity (1–10) <span className={settingsStyles.settingsValue}>{intensity}</span>
              </label>
              <input
                type="range"
                id="intensitySlider"
                className={settingsStyles.slider}
                min={1}
                max={10}
                value={intensity}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setIntensity(v);
                  sendToHardware(v, rate);
                }}
                aria-label="Vibration intensity 1 to 10"
              />
            </div>

            <div className={settingsStyles.settingsRow}>
              <label className={settingsStyles.settingsLabel} htmlFor="rateSlider">
                Pulse rate (1–10) <span className={settingsStyles.settingsValue}>{rate}</span>
              </label>
              <input
                type="range"
                id="rateSlider"
                className={settingsStyles.slider}
                min={1}
                max={10}
                value={rate}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setRate(v);
                  sendToHardware(intensity, v);
                }}
                aria-label="Pulse rate 1 to 10"
              />
            </div>
          </div>
            </div>
            <div className={settingsStyles.settingsColumn}>
          <section className={settingsStyles.reflectionSection} aria-label="Your reflection">
            <p className={settingsStyles.reflectionLead}>
              {weeklySummary ? "Reflection" : "Reflection"}
            </p>
            {loadingSummary ? (
              <p className={settingsStyles.reflectionEmpty}>Reflecting on your notes…</p>
            ) : weeklySummary ? (
              <p className={settingsStyles.reflectionSummary}>{weeklySummary}</p>
            ) : (
              <p className={settingsStyles.reflectionEmpty}>Log notes on Home. Your reflection will appear here.</p>
            )}
            {weeklySummary && (
              <p className={settingsStyles.reflectionMuted} aria-hidden>generated from your notes</p>
            )}
          </section>

          <section className={settingsStyles.calendarSection} aria-label="Memories calendar">
            <h2 className={settingsStyles.calendarTitle}>Memories</h2>
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
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
