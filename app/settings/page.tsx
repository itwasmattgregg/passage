import { saveAbsConnection } from "@/app/actions";
import { Nav } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  const connection = await prisma.absConnection.findUnique({ where: { userId: user.id } });
  const params = await searchParams;

  return (
    <>
      <Nav email={user.email} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-serif text-4xl">Settings</h1>
        <p className="mt-2 max-w-xl text-muted">
          Connect the Audiobookshelf server that Still already uses. Create an API
          key under Settings → Users → API Keys.
        </p>

        {params.saved ? (
          <p className="mt-6 rounded-lg border border-line bg-card px-4 py-3 text-sm">
            Connected. You can import bookmarks from the home page.
          </p>
        ) : null}
        {params.error === "missing" ? (
          <p className="mt-6 text-sm text-accent">Both fields are required.</p>
        ) : null}
        {params.error === "connect" ? (
          <p className="mt-6 text-sm text-accent">Connect Audiobookshelf first.</p>
        ) : null}
        {params.error && params.error !== "missing" && params.error !== "connect" ? (
          <p className="mt-6 text-sm text-accent">{params.error}</p>
        ) : null}

        <form action={saveAbsConnection} className="mt-8 max-w-xl space-y-4">
          <label className="block text-sm">
            Server URL
            <input
              type="url"
              name="serverUrl"
              required
              defaultValue={connection?.serverUrl ?? "https://audiobooks.itwasmattgregg.com"}
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            API token
            <input
              type="password"
              name="apiToken"
              required
              defaultValue={connection?.apiToken ?? ""}
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-dark)]"
          >
            Save and test
          </button>
        </form>
      </main>
    </>
  );
}
