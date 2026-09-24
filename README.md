# Passage

Passage turns Audiobookshelf bookmarks into audio clips.

If you mark a moment in [Still](https://apps.apple.com/app/still-for-audiobookshelf/id6754208326) or any other Audiobookshelf client, Passage can import that timestamp, cut a short MP3 around it, and optionally transcribe the line. You can keep the clip for yourself and share a card that sends people back to your Audiobookshelf server to listen in context.

Passage does not host audiobook audio on the public internet. Clips stay private (preview, download, transcribe). The public page is the quote, book details, and a listen link.

## What it does

- Connects to your Audiobookshelf server with an API key
- Imports bookmarks (title, author, chapter, timestamp)
- Lets you trim the window around a bookmark — including starting after it
- Cuts a private MP3 with ffmpeg and plays a seekable preview
- Optionally fills a transcript with OpenAI Whisper
- Publishes a share card with **Open in Audiobookshelf** and an optional no-account `/share/...?t=` link

## Setup

You need [Node.js](https://nodejs.org/), [ffmpeg](https://ffmpeg.org/) on your PATH, and a running Audiobookshelf server.

1. Copy `.env.example` to `.env` and set a long `AUTH_SECRET`.
2. Install and create the database:

```bash
npm install
npx prisma db push
npm run dev
```

3. Open http://localhost:3000 and request a magic-link login. In development the URL is printed in the terminal unless you set `AUTH_RESEND_KEY`.
4. In **Settings**, paste your Audiobookshelf URL and an API key from Audiobookshelf **Settings → Users → API Keys**.
5. Import bookmarks, open one, trim the clip, export an MP3 if you want it, then publish a share card.

Optional environment variables:

- `AUTH_RESEND_KEY` — send real sign-in emails
- `EMAIL_FROM` — From address for those emails
- `OPENAI_API_KEY` — fill transcripts with Whisper
