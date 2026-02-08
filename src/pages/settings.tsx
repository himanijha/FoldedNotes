import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Fredoka, Nunito } from "next/font/google";
import styles from "@/styles/Home.module.css";
import settingsStyles from "@/styles/Settings.module.css";

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
          <Link href="/" className={styles.heading}>
            <span className={styles.headingWord}>Folded</span>
            <span className={styles.headingWord}>Notes</span>
          </Link>
          <div className={settingsStyles.settingsCard}>
            <h2 className={settingsStyles.settingsTitle}>Haptic Settings</h2>

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
