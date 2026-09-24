import { auth } from "@/auth";
import { clampClipDuration, clampSecondsBefore, extractClipMp3, transcribeMp3 } from "@/lib/clip";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const clip = await prisma.bookmarkShare.findFirst({
    where: { id, userId: session.user.id },
  });
  const connection = await prisma.absConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!clip || !connection) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    secondsBefore?: number;
    clipDuration?: number;
  };
  const secondsBefore = Number.isFinite(body.secondsBefore)
    ? clampSecondsBefore(body.secondsBefore!)
    : clip.secondsBefore;
  const clipDuration = Number.isFinite(body.clipDuration)
    ? clampClipDuration(body.clipDuration!)
    : clip.clipDuration;

  try {
    const { outputPath } = await extractClipMp3({
      serverUrl: connection.serverUrl,
      apiToken: connection.apiToken,
      libraryItemId: clip.libraryItemId,
      timeSeconds: clip.timeSeconds,
      secondsBefore,
      clipDuration,
      userId: session.user.id,
      clipId: clip.id,
    });
    const text = await transcribeMp3(outputPath);
    await prisma.bookmarkShare.update({
      where: { id: clip.id },
      data: { quote: text, clipPath: outputPath },
    });
    return Response.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
