import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ClipEditor } from "./clip-editor";

export default async function ClipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const [clip, connection] = await Promise.all([
    prisma.bookmarkShare.findFirst({ where: { id, userId: user.id } }),
    prisma.absConnection.findUnique({ where: { userId: user.id } }),
  ]);

  if (!clip || !connection) {
    notFound();
  }

  return (
    <>
      <Nav email={user.email} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Bookmarks
        </Link>
        <div className="mt-6">
          <ClipEditor
            clip={clip}
            serverUrl={connection.serverUrl}
            whisperConfigured={Boolean(process.env.OPENAI_API_KEY)}
            error={query.error}
          />
        </div>
      </main>
    </>
  );
}
