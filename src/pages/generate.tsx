import Head from "next/head";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Fredoka, Nunito } from "next/font/google";
import styles from "@/styles/Generate.module.css";
import { getStoredTranscript } from "@/components/GenerateFromTranscript";

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

const GenerateFromTranscript = dynamic(
  () => import("@/components/GenerateFromTranscript"),
  { ssr: false }
);

export default function GeneratePage() {
  const [stored, setStored] = useState<{ text: string; language_code?: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStored(getStoredTranscript());
  }, []);

  return (
    <>
      <Head>
        <title>FoldedNotes – Generate audio</title>
        <meta name="description" content="Generate audio from your transcript." />
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
              <span className={styles.headingWord}>Folded</span>
              <span className={styles.headingWord}>Notes</span>
            </h1>
            <p className={styles.tagline}>
              <span className={styles.taglineMic} aria-hidden />
              Give your note a voice
            </p>
          </div>

          {!mounted ? (
            <p>Loading…</p>
          ) : stored?.text ? (
            <GenerateFromTranscript
              initialTranscript={stored.text}
              initialLanguageCode={stored.language_code}
            />
          ) : (
            <div className={styles.emptyState}>
              <p>No note yet! Record something first, then come back.</p>
              <Link href="/" className={styles.againButton} style={{ textDecoration: "none" }}>
                <span className={styles.pencilIcon} aria-hidden />
                Record a message
              </Link>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
