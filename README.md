# Passage

Share audiobook bookmarks from Still / Audiobookshelf. Listen happens on your Audiobookshelf server. Passage keeps quotes and links — not public audio.

## Setup

1. Install [ffmpeg](https://ffmpeg.org/) and put it on your PATH.
2. Copy `.env.example` to `.env` and set a long `AUTH_SECRET`.
3. Install and migrate:

```bash
npm install
npx prisma db push
npm run dev
```

4. Open http://localhost:3000, request a magic link, then copy the URL from the terminal (unless `AUTH_RESEND_KEY` is set).
5. In Settings, connect `https://audiobooks.itwasmattgregg.com` with an Audiobookshelf API key.
6. Import bookmarks, edit a transcript, optionally export an MP3, then publish a share card.

Optional:

- `AUTH_RESEND_KEY` — send real sign-in emails
- `OPENAI_API_KEY` — fill transcripts with Whisper
