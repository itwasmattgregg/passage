"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { AbsError, authorNames, chapterAt, createAbsClient, type AbsMe } from "@/lib/abs";
import {
  clampClipDuration,
  clampSecondsBefore,
  DEFAULT_CLIP_DURATION,
  DEFAULT_SECONDS_BEFORE,
} from "@/lib/clip";
import { normalizeServerUrl } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createSlug } from "@/lib/slug";

async function currentUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/login?error=missing");
  }
  await signIn("resend", { email, redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function saveAbsConnection(formData: FormData) {
  const userId = await currentUserId();
  const serverUrl = normalizeServerUrl(String(formData.get("serverUrl") ?? ""));
  const apiToken = String(formData.get("apiToken") ?? "").trim();

  if (!serverUrl || !apiToken) {
    redirect("/settings?error=missing");
  }

  try {
    await createAbsClient(serverUrl, apiToken).getMe();
  } catch (error) {
    const message = error instanceof AbsError ? error.message : "Could not reach Audiobookshelf.";
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }

  await prisma.absConnection.upsert({
    where: { userId },
    create: { userId, serverUrl, apiToken },
    update: { serverUrl, apiToken },
  });

  redirect("/settings?saved=1");
}

export async function importBookmarks() {
  const userId = await currentUserId();
  const connection = await prisma.absConnection.findUnique({ where: { userId } });
  if (!connection) {
    redirect("/settings?error=connect");
  }

  const abs = createAbsClient(connection.serverUrl, connection.apiToken);
  const me = (await abs.getMe()) as AbsMe & { user?: { bookmarks?: AbsMe["bookmarks"] } };
  const bookmarks = me.bookmarks ?? me.user?.bookmarks ?? [];
  const items = new Map<string, Awaited<ReturnType<typeof abs.getItem>>>();

  for (const bookmark of bookmarks) {
    if (!items.has(bookmark.libraryItemId)) {
      items.set(bookmark.libraryItemId, await abs.getItem(bookmark.libraryItemId));
    }
    const item = items.get(bookmark.libraryItemId);
    if (!item) continue;

    const timeSeconds = Math.round(bookmark.time);
    const existing = await prisma.bookmarkShare.findUnique({
      where: {
        userId_libraryItemId_timeSeconds: {
          userId,
          libraryItemId: bookmark.libraryItemId,
          timeSeconds,
        },
      },
    });

    const metadata = {
      mediaId: item.media?.id ?? null,
      bookmarkTitle: bookmark.title ?? null,
      bookTitle: item.media?.metadata?.title ?? "Untitled book",
      author: authorNames(item),
      narrator: item.media?.metadata?.narrators?.join(", ") ?? null,
      isbn: item.media?.metadata?.isbn ?? null,
      asin: item.media?.metadata?.asin ?? null,
      chapterTitle: chapterAt(item, timeSeconds),
    };

    if (existing) {
      await prisma.bookmarkShare.update({
        where: { id: existing.id },
        data: metadata,
      });
    } else {
      await prisma.bookmarkShare.create({
        data: {
          userId,
          libraryItemId: bookmark.libraryItemId,
          timeSeconds,
          slug: createSlug(),
          secondsBefore: DEFAULT_SECONDS_BEFORE,
          clipDuration: DEFAULT_CLIP_DURATION,
          ...metadata,
        },
      });
    }
  }

  revalidatePath("/");
  redirect("/?imported=1");
}

export async function saveClip(formData: FormData) {
  const userId = await currentUserId();
  const id = String(formData.get("id") ?? "");
  const quote = String(formData.get("quote") ?? "");
  const secondsBefore = Number(formData.get("secondsBefore") ?? DEFAULT_SECONDS_BEFORE);
  const clipDuration = Number(formData.get("clipDuration") ?? DEFAULT_CLIP_DURATION);

  const clip = await prisma.bookmarkShare.findFirst({ where: { id, userId } });
  if (!clip) {
    redirect("/");
  }

  await prisma.bookmarkShare.update({
    where: { id },
    data: {
      quote,
      secondsBefore: Number.isFinite(secondsBefore)
        ? clampSecondsBefore(secondsBefore)
        : clip.secondsBefore,
      clipDuration: Number.isFinite(clipDuration)
        ? clampClipDuration(clipDuration)
        : clip.clipDuration,
    },
  });

  revalidatePath(`/clips/${id}`);
  revalidatePath("/");
  revalidatePath(`/p/${clip.slug}`);
}

export async function publishClip(formData: FormData) {
  const userId = await currentUserId();
  const id = String(formData.get("id") ?? "");
  const clip = await prisma.bookmarkShare.findFirst({ where: { id, userId } });
  if (!clip) {
    redirect("/");
  }

  await prisma.bookmarkShare.update({
    where: { id },
    data: { publishedAt: clip.publishedAt ?? new Date() },
  });

  revalidatePath(`/p/${clip.slug}`);
  revalidatePath("/");
  redirect(`/p/${clip.slug}`);
}

export async function unpublishClip(formData: FormData) {
  const userId = await currentUserId();
  const id = String(formData.get("id") ?? "");
  const clip = await prisma.bookmarkShare.findFirst({ where: { id, userId } });
  if (!clip) {
    redirect("/");
  }

  await prisma.bookmarkShare.update({
    where: { id },
    data: { publishedAt: null },
  });

  revalidatePath(`/p/${clip.slug}`);
  revalidatePath("/");
  revalidatePath(`/clips/${id}`);
}

export async function createAbsShareLink(formData: FormData) {
  const userId = await currentUserId();
  const id = String(formData.get("id") ?? "");
  const days = Number(formData.get("days") ?? 7);
  const clip = await prisma.bookmarkShare.findFirst({ where: { id, userId } });
  const connection = await prisma.absConnection.findUnique({ where: { userId } });

  if (!clip || !connection) {
    redirect("/settings");
  }
  if (!clip.mediaId) {
    redirect(`/clips/${id}?error=${encodeURIComponent("This bookmark is missing a media id. Re-import and try again.")}`);
  }

  const abs = createAbsClient(connection.serverUrl, connection.apiToken);
  const expiresAt = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : 0;
  const share = await abs.createMediaShare({
    mediaItemId: clip.mediaId,
    slug: createSlug(),
    expiresAt,
  });

  await prisma.bookmarkShare.update({
    where: { id },
    data: {
      listenMode: "abs_share",
      absShareSlug: share.slug,
      absShareExpires: expiresAt ? new Date(expiresAt) : null,
    },
  });

  revalidatePath(`/clips/${id}`);
  revalidatePath(`/p/${clip.slug}`);
  revalidatePath("/");
}
