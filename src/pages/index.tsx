import Head from "next/head";
import dynamic from "next/dynamic";
import { Fredoka, Nunito } from "next/font/google";
import styles from "../styles/Landing.module.css";
import { useEffect, useState } from "react";


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

export default function Home() {
  return (
    <>
      <Head>
        <title>FoldedNotes – Leave a message of hope</title>
        <meta
          name="description"
          content="Leave anonymous messages of hope, tips, and stories for others."
        />
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
              Record a message of hope, a tip, or something you went
              through for anyone who needs to hear it.
            </p>
          </div>

          <AudioRecorder />
        </main>
      </div>
    </>
  );
}
