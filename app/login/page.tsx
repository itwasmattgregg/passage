import { requestMagicLink } from "@/app/actions";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const params = await searchParams;
  const sent = params.sent === "1";
  const missing = params.error === "missing";

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-muted">A quiet shelf</p>
      <h1 className="mt-3 font-serif text-5xl tracking-tight">Passage</h1>
      <p className="mt-4 text-muted leading-relaxed">
        Sign in with an email link. In development the link is printed in the
        terminal unless you add a Resend key.
      </p>

      {sent ? (
        <p className="mt-8 rounded-lg border border-line bg-card px-4 py-3 text-sm">
          Check your email — or the terminal running <code>npm run dev</code> —
          for the sign-in link.
        </p>
      ) : (
        <form action={requestMagicLink} className="mt-8 space-y-4">
          {missing ? <p className="text-sm text-accent">Enter an email address.</p> : null}
          <label className="block text-sm">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-dark)]"
          >
            Email me a link
          </button>
        </form>
      )}
    </main>
  );
}
