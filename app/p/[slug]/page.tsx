import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTimestamp } from "@/lib/format";
import { absShareListenUrl, itemListenUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clip = await prisma.bookmarkShare.findUnique({ where: { slug } });
  if (!clip?.publishedAt) {
    return { title: "Passage" };
  }
  return {
    title: `${clip.bookTitle} — Passage`,
    description: clip.quote || `A bookmark at ${formatTimestamp(clip.timeSeconds)}`,
  };
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clip = await prisma.bookmarkShare.findUnique({
    where: { slug },
    include: { user: { include: { absConnection: true } } },
  });

  if (!clip?.publishedAt) {
    notFound();
  }

  const serverUrl = clip.user.absConnection?.serverUrl ?? "https://audiobooks.itwasmattgregg.com";
  const listenUrl = itemListenUrl(serverUrl, clip.libraryItemId, clip.timeSeconds);
  const shareUrl =
    clip.absShareSlug && clip.listenMode === "abs_share"
      ? absShareListenUrl(serverUrl, clip.absShareSlug, clip.timeSeconds)
      : null;

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-5 py-16">
      <Link href="/" className="font-serif text-lg text-muted">
        Passage
      </Link>
      <p className="mt-10 text-sm uppercase tracking-[0.18em] text-muted">A marked place</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight">{clip.bookTitle}</h1>
      <p className="mt-2 text-muted">
        {[clip.author, clip.narrator ? `read by ${clip.narrator}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="mt-1 text-sm text-muted">
        {clip.chapterTitle ? `${clip.chapterTitle} · ` : ""}
        {formatTimestamp(clip.timeSeconds)}
      </p>

      {clip.quote ? (
        <blockquote className="mt-8 border-l-2 border-accent pl-4 font-serif text-2xl leading-snug">
          {clip.quote}
        </blockquote>
      ) : null}

      <div className="mt-10 flex flex-col gap-3">
        <a
          href={listenUrl}
          className="rounded-lg bg-accent px-4 py-3 text-center text-sm font-medium text-white"
        >
          Open in Audiobookshelf
        </a>
        {shareUrl ? (
          <a
            href={shareUrl}
            className="rounded-lg border border-line bg-card px-4 py-3 text-center text-sm"
          >
            Listen without an account
          </a>
        ) : null}
      </div>
    </main>
  );
}
