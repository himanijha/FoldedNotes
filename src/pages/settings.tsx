import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Fredoka, Nunito } from "next/font/google";
import styles from "@/styles/Generate.module.css";
import settingsStyles from "@/styles/Settings.module.css";

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

const WS_URL = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_WS_PROXY_URL || "ws://localhost:8080")
  : "";

export default function SettingsPage() {
  const [intensity, setIntensity] = useState(7);
  const [rate, setRate] = useState(5);
  const [proxyConnected, setProxyConnected] = useState(false);
  const [hardwareConnected, setHardwareConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const intensityRef = useRef(7);
  const rateRef = useRef(5);
  intensityRef.current = intensity;
  rateRef.current = rate;

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
        <title>FoldedNotes – Haptic Settings</title>
        <meta name="description" content="Haptic vibration intensity and pulse rate." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
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
        <main className={styles.main}>
          <div className={styles.intro}>
            <h1 className={styles.heading}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <span className={styles.headingWord}>Folded</span>
                <span className={styles.headingWord}>Notes</span>
              </Link>
            </h1>
            <p className={styles.tagline}>Haptic settings – vibration and pulse rate</p>
          </div>
          <div className={settingsStyles.settingsCard}>
            <h2 className={settingsStyles.settingsTitle}>Haptic Settings</h2>

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

            <p
              className={
                proxyConnected
                  ? hardwareConnected
                    ? `${settingsStyles.status} ${settingsStyles.statusConnected}`
                    : `${settingsStyles.status} ${settingsStyles.statusDisconnected}`
                  : `${settingsStyles.status} ${settingsStyles.statusDisconnected}`
              }
              role="status"
            >
              {!proxyConnected && "Not connected (run: npm run ws-server)"}
              {proxyConnected && !hardwareConnected && "Proxy connected (waiting for ESP32…)"}
              {proxyConnected && hardwareConnected && "Proxy + ESP32 connected"}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
