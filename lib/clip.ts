import { spawn } from "node:child_process";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { createAbsClient, resolveTrackAt } from "@/lib/abs";
import { safeFileName } from "@/lib/format";

export const DEFAULT_SECONDS_BEFORE = 5;
export const DEFAULT_CLIP_DURATION = 25;

export function clampSecondsBefore(value: number) {
  return Math.min(120, Math.max(-120, value));
}

export function clampClipDuration(value: number) {
  return Math.min(120, Math.max(1, value));
}

export function windowFromSearchParams(
  searchParams: URLSearchParams,
  fallback: { secondsBefore: number; clipDuration: number },
) {
  const before = searchParams.get("before");
  const duration = searchParams.get("duration");
  return {
    secondsBefore:
      before != null && Number.isFinite(Number(before))
        ? clampSecondsBefore(Number(before))
        : fallback.secondsBefore,
    clipDuration:
      duration != null && Number.isFinite(Number(duration))
        ? clampClipDuration(Number(duration))
        : fallback.clipDuration,
  };
}

function clipRoot() {
  return path.join(process.cwd(), "data", "clips");
}

export function clipFilePath(userId: string, clipId: string, suffix = "") {
  return path.join(clipRoot(), userId, `${clipId}${suffix}.mp3`);
}

export function clipWindow(timeSeconds: number, secondsBefore: number, clipDuration: number) {
  const startAbs = Math.max(0, timeSeconds - secondsBefore);
  return { startAbs, duration: Math.max(1, clipDuration) };
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("ffmpeg is not installed or not on PATH."));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-400)}`));
    });
  });
}

export async function extractClipMp3(input: {
  serverUrl: string;
  apiToken: string;
  libraryItemId: string;
  timeSeconds: number;
  secondsBefore: number;
  clipDuration: number;
  userId: string;
  clipId: string;
}) {
  const abs = createAbsClient(input.serverUrl, input.apiToken);
  const item = await abs.getItem(input.libraryItemId);
  const { startAbs, duration } = clipWindow(
    input.timeSeconds,
    input.secondsBefore,
    input.clipDuration,
  );
  const track = resolveTrackAt(item, startAbs);
  const localDuration = Math.min(duration, track.remaining);
  const sourceUrl = abs.fileUrl(input.libraryItemId, track.ino);
  const outputPath = clipFilePath(
    input.userId,
    input.clipId,
    `-${input.secondsBefore}-${input.clipDuration}`,
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await unlink(outputPath).catch(() => undefined);

  await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(track.localStart),
    "-t",
    String(localDuration),
    "-headers",
    `Authorization: Bearer ${input.apiToken}\r\n`,
    "-i",
    sourceUrl,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "128k",
    "-write_xing",
    "1",
    outputPath,
  ]);

  return {
    outputPath,
    downloadName: `${safeFileName(item.media?.metadata?.title ?? "clip")}-${Math.floor(startAbs)}s.mp3`,
  };
}

export async function transcribeMp3(filePath: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Set OPENAI_API_KEY to transcribe automatically, or type the quote yourself.");
  }

  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(filePath);
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const body = new FormData();
  body.set("model", "whisper-1");
  body.set("file", blob, "clip.mp3");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Whisper failed: ${detail.slice(0, 240)}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
