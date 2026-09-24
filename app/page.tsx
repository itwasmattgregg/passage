import Link from "next/link";
import { importBookmarks } from "@/app/actions";
import { Nav } from "@/components/nav";
import { formatTimestamp } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [connection, bookmarks] = await Promise.all([
    prisma.absConnection.findUnique({ where: { userId: user.id } }),
    prisma.bookmarkShare.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <>
      <Nav email={user.email} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl">Bookmarks</h1>
            <p className="mt-2 text-muted">
              Marks you save in Still land here after you import from Audiobookshelf.
            </p>
          </div>
          {connection ? (
            <form action={importBookmarks}>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-dark)]"
              >
                Import from Audiobookshelf
              </button>
            </form>
          ) : (
            <Link
              href="/settings"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-dark)]"
            >
              Connect Audiobookshelf
            </Link>
          )}
        </div>

        {params.imported ? (
          <p className="mt-6 rounded-lg border border-line bg-card px-4 py-3 text-sm">
            Bookmarks imported.
          </p>
        ) : null}

        {bookmarks.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
            <p className="font-serif text-2xl">Nothing on the shelf yet</p>
            <p className="mt-2 text-muted">
              Bookmark a moment in Still, then import it here.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id}>
                <Link
                  href={`/clips/${bookmark.id}`}
                  className="block rounded-2xl border border-line bg-card px-5 py-4 transition hover:border-accent/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-serif text-xl leading-snug">{bookmark.bookTitle}</h2>
                    <span className="shrink-0 text-sm text-muted">
                      {formatTimestamp(bookmark.timeSeconds)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[bookmark.author, bookmark.chapterTitle, bookmark.bookmarkTitle]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {bookmark.quote ? (
                    <p className="mt-3 line-clamp-2 text-sm italic text-ink/80">
                      “{bookmark.quote}”
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-wider text-muted">
                    {bookmark.publishedAt ? "Published" : "Draft"}
                    {bookmark.absShareSlug ? " · share link" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
