FoldedNotes

Platform that people can call and leave anonymous message of hope, tips and any other struggles people went through.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Requirements (GitHub)

- **Side notes panel:** Allow users to write notes in a side panel and post them to the feed. (Implemented: "Write a note" section on the home page posts to the same notes feed via `POST /api/notes`.)

## Getting Started

### 1. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. ElevenLabs integration (Submit / process recording)

To use **Submit to process** (send the recording to ElevenLabs for transcription):

1. **Get an API key**
   - Sign up at [ElevenLabs](https://elevenlabs.io).
   - Go to [API keys](https://elevenlabs.io/app/settings/api-keys) and create a key.

2. **Add the key locally**
   - Copy `.env.example` to `.env.local`:
     ```bash
     cp .env.example .env.local
     ```
   - Edit `.env.local` and set:
     ```
     ELEVENLABS_API_KEY=your_actual_key_here
     ```

3. **Restart the dev server** so it picks up the new env.

4. **Flow in the app**
   - Record a message → Stop → **Submit to process**.
   - The app sends the audio to ElevenLabs Speech-to-Text (Scribe v2) and shows the transcript (and language) when done.

The API route is `POST /api/transcribe`. It expects JSON `{ "audioBase64": "<base64>", "contentType": "audio/webm" }` and returns `{ "text", "language_code", "words?" }`. Do not commit `.env.local` or your API key.

## Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
