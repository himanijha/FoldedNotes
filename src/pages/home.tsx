import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Fredoka, Nunito } from "next/font/google";
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

function formatHeaderDate() {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatHeaderTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const CATEGORIES = ["Hope", "Tips", "Stories", "Support", "Gratitude"];

export default function HomePage() {
  const [recordPopupOpen, setRecordPopupOpen] = useState(false);

  return (
    <>
      <Head>
        <title>FoldedNotes – Home</title>
        <meta name="description" content="Record and manage your messages." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div
        className={`${styles.page} ${styles.pageHome} ${fredoka.variable} ${nunito.variable}`}
      >
        <div className={styles.bgBlobs} aria-hidden>
          <span className={styles.blob1} />
          <span className={styles.blob2} />
          <span className={styles.blob3} />
          <span className={styles.blob4} />
          <span className={styles.blob5} />
        </div>
        <div className={styles.rainbowArc} aria-hidden />

        <header className={styles.headerBar}>
          <div className={styles.headerDate}>
            <time dateTime={new Date().toISOString()}>
              {formatHeaderDate()}
            </time>
            <span className={styles.headerTime}>{formatHeaderTime()}</span>
          </div>
          <Link href="/" className={styles.headerLogo}>
            <span className={styles.headingWord}>Folded</span>
            <span className={styles.headingWord}>Notes</span>
          </Link>
          <div className={styles.headerHardware} aria-hidden>
            <span className={styles.hardwareIcon} title="Microphone" />
          </div>
        </header>

        <main className={styles.mainFull}>
          <aside className={styles.homeColRecordings}>
            <h2 className={styles.homeColTitle}>My recordings</h2>
            <div className={styles.recordingsList}>
              <p className={styles.recordingsEmpty}>
                No recordings yet. Tap to record in the panel on the right.
              </p>
            </div>
          </aside>

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

          <div className={styles.homeColRecord}>
            <button
              type="button"
              className={styles.recordTrigger}
              onClick={() => setRecordPopupOpen(true)}
              aria-label="Open record"
            >
              <span className={styles.recordTriggerMic} aria-hidden />
              <span>Tap to record</span>
            </button>
          </div>
        </main>

        {recordPopupOpen && (
          <div
            className={styles.recordPopupOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-popup-title"
          >
            <button
              type="button"
              className={styles.recordPopupBackdrop}
              onClick={() => setRecordPopupOpen(false)}
              aria-label="Close"
            />
            <div className={styles.recordPopupCard}>
              <button
                type="button"
                className={styles.recordPopupClose}
                onClick={() => setRecordPopupOpen(false)}
                aria-label="Close"
              />
              <h2 id="record-popup-title" className={styles.recordPopupTitle}>
                Record a note
              </h2>
              <AudioRecorder />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
