import { readFile } from "node:fs/promises";
import { auth } from "@/auth";
import { serveAudioFile } from "@/lib/audio-response";
import { extractClipMp3, windowFromSearchParams } from "@/lib/clip";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Sign in required", { status: 401 });
  }

  const { id } = await params;
  const clip = await prisma.bookmarkShare.findFirst({
    where: { id, userId: session.user.id },
  });
  const connection = await prisma.absConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!clip || !connection) {
    return new Response("Not found", { status: 404 });
  }

  const window = windowFromSearchParams(new URL(request.url).searchParams, clip);

  try {
    const { outputPath, downloadName } = await extractClipMp3({
      serverUrl: connection.serverUrl,
      apiToken: connection.apiToken,
      libraryItemId: clip.libraryItemId,
      timeSeconds: clip.timeSeconds,
      secondsBefore: window.secondsBefore,
      clipDuration: window.clipDuration,
      userId: session.user.id,
      clipId: clip.id,
    });

    await prisma.bookmarkShare.update({
      where: { id: clip.id },
      data: { clipPath: outputPath },
    });

    const bytes = new Uint8Array(await readFile(outputPath));
    return serveAudioFile(request, bytes, downloadName, "attachment");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export the clip.";
    return new Response(message, { status: 500 });
  }
}
