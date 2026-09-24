"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAbsShareLink,
  publishClip,
  saveClip,
  unpublishClip,
} from "@/app/actions";
import { formatTimestamp } from "@/lib/format";
import { absShareListenUrl, itemListenUrl } from "@/lib/links";

type Clip = {
  id: string;
  slug: string;
  libraryItemId: string;
  timeSeconds: number;
  bookTitle: string;
  author: string | null;
  narrator: string | null;
  isbn: string | null;
  chapterTitle: string | null;
  bookmarkTitle: string | null;
  quote: string | null;
  secondsBefore: number;
  clipDuration: number;
  publishedAt: Date | string | null;
  absShareSlug: string | null;
};

export function ClipEditor({
  clip,
  serverUrl,
  whisperConfigured,
  error,
}: {
  clip: Clip;
  serverUrl: string;
  whisperConfigured: boolean;
  error?: string;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState(clip.quote ?? "");
  const [secondsBefore, setSecondsBefore] = useState(clip.secondsBefore);
  const [clipDuration, setClipDuration] = useState(clip.clipDuration);
  const [status, setStatus] = useState<string | null>(error ?? null);
  const [busy, setBusy] = useState<"transcribe" | null>(null);
  const [previewQuery, setPreviewQuery] = useState(
    `before=${clip.secondsBefore}&duration=${clip.clipDuration}`,
  );
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewSeconds, setPreviewSeconds] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  const windowStart = Math.max(0, clip.timeSeconds - secondsBefore);
  const clipQuery = useMemo(
    () => `before=${secondsBefore}&duration=${clipDuration}`,
    [secondsBefore, clipDuration],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewQuery(clipQuery), 400);
    return () => window.clearTimeout(timer);
  }, [clipQuery]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate, previewSrc]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setPreviewSrc(null);
    setPreviewSeconds(null);
    setPreviewError(null);
    setPreviewLoading(true);

    fetch(`/api/clips/${clip.id}/preview?${previewQuery}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.text()) || "Could not build the preview.");
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewSrc(objectUrl);
        setPreviewLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPreviewLoading(false);
        setPreviewError(error instanceof Error ? error.message : "Could not build the preview.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [clip.id, previewQuery]);

  const listenUrl = itemListenUrl(serverUrl, clip.libraryItemId, clip.timeSeconds);
  const shareUrl = clip.absShareSlug
    ? absShareListenUrl(serverUrl, clip.absShareSlug, clip.timeSeconds)
    : null;
  const passageUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${clip.slug}` : `/p/${clip.slug}`;

  async function transcribe() {
    setBusy("transcribe");
    setStatus(null);
    const response = await fetch(`/api/clips/${clip.id}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secondsBefore, clipDuration }),
    });
    const data = (await response.json()) as { text?: string; error?: string };
    setBusy(null);
    if (!response.ok) {
      setStatus(data.error ?? "Transcription failed.");
      return;
    }
    setQuote(data.text ?? "");
    setStatus("Transcript filled. Edit it, then save.");
    router.refresh();
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setStatus(`${label} copied.`);
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-muted">
          {[clip.author, clip.narrator ? `read by ${clip.narrator}` : null, clip.chapterTitle]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-tight">{clip.bookTitle}</h1>
        <p className="mt-2 text-muted">
          Bookmark at {formatTimestamp(clip.timeSeconds)}
          {clip.bookmarkTitle ? ` · ${clip.bookmarkTitle}` : ""}
        </p>
      </section>

      {status ? (
        <p className="rounded-lg border border-line bg-card px-4 py-3 text-sm">{status}</p>
      ) : null}

      <form action={saveClip} className="space-y-6">
        <input type="hidden" name="id" value={clip.id} />
        <label className="block text-sm">
          Transcript
          <textarea
            name="quote"
            value={quote}
            onChange={(event) => setQuote(event.target.value)}
            rows={6}
            placeholder="Type the line, or transcribe the clip."
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-serif text-lg leading-relaxed outline-none focus:border-accent"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm">
            Start relative to bookmark
            <input
              type="number"
              name="secondsBefore"
              min={-120}
              max={120}
              step={1}
              value={secondsBefore}
              onChange={(event) => setSecondsBefore(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent"
            />
            <span className="mt-1 block text-muted">
              Positive starts earlier. Negative starts later.
            </span>
          </label>
          <label className="block text-sm">
            Clip length (seconds)
            <input
              type="number"
              name="clipDuration"
              min={1}
              max={120}
              step={1}
              value={clipDuration}
              onChange={(event) => setClipDuration(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent"
            />
          </label>
        </div>
        <p className="text-sm text-muted">
          Window: {formatTimestamp(windowStart)} → {formatTimestamp(windowStart + clipDuration)}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={transcribe}
            disabled={busy === "transcribe"}
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm"
          >
            {busy === "transcribe" ? "Transcribing…" : whisperConfigured ? "Transcribe" : "Transcribe (needs API key)"}
          </button>
          <a
            href={`/api/clips/${clip.id}/export?${clipQuery}`}
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm"
          >
            Export MP3
          </a>
        </div>
      </form>

      <section className="rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-sm font-medium">Private preview</p>
        <p className="mt-1 text-sm text-muted">
          A freshly cut MP3 at the window above — not your Audiobookshelf
          player, and not that book’s saved speed. ffmpeg must be installed.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Preview speed
            <select
              value={playbackRate}
              onChange={(event) => setPlaybackRate(Number(event.target.value))}
              className="rounded-lg border border-line bg-card px-2 py-1"
            >
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
            </select>
          </label>
          {previewSeconds != null ? (
            <span className="text-muted">Loaded length: {previewSeconds.toFixed(1)}s</span>
          ) : null}
          {previewQuery !== clipQuery || previewLoading ? (
            <span className="text-muted">Updating preview…</span>
          ) : null}
        </div>
        {previewError ? <p className="mt-3 text-sm text-accent">{previewError}</p> : null}
        {previewSrc ? (
          <audio
            ref={audioRef}
            key={previewSrc}
            controls
            preload="auto"
            className="mt-3 w-full"
            src={previewSrc}
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = playbackRate;
              setPreviewSeconds(event.currentTarget.duration);
            }}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Listen links</h2>
        <p className="text-sm text-muted">
          Friends with an account open the book on your server. Optional share
          links skip login and start at this timestamp.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={listenUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Open in Audiobookshelf
          </a>
          <button
            type="button"
            onClick={() => copy(listenUrl, "Item link")}
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm"
          >
            Copy item link
          </button>
          {shareUrl ? (
            <button
              type="button"
              onClick={() => copy(shareUrl, "Share link")}
              className="rounded-lg border border-line bg-card px-4 py-2 text-sm"
            >
              Copy no-account link
            </button>
          ) : null}
        </div>
        <form action={createAbsShareLink} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={clip.id} />
          <label className="text-sm">
            Share for
            <input
              type="number"
              name="days"
              min={1}
              max={30}
              defaultValue={7}
              className="ml-2 w-16 rounded-lg border border-line bg-card px-2 py-1.5"
            />{" "}
            days
          </label>
          <button type="submit" className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm">
            {clip.absShareSlug ? "Make a new share link" : "Create no-account share"}
          </button>
        </form>
      </section>

      <section className="flex flex-wrap items-center gap-2 border-t border-line pt-6">
        <form action={publishClip}>
          <input type="hidden" name="id" value={clip.id} />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {clip.publishedAt ? "View share card" : "Publish share card"}
          </button>
        </form>
        {clip.publishedAt ? (
          <>
            <button
              type="button"
              onClick={() => copy(passageUrl, "Passage link")}
              className="rounded-lg border border-line bg-card px-4 py-2 text-sm"
            >
              Copy Passage link
            </button>
            <form action={unpublishClip}>
              <input type="hidden" name="id" value={clip.id} />
              <button type="submit" className="rounded-lg px-4 py-2 text-sm text-muted">
                Unpublish
              </button>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
