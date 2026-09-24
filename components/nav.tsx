import Link from "next/link";
import { logout } from "@/app/actions";

export function Nav({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-serif text-xl tracking-tight text-ink">
          Passage
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/" className="hover:text-ink">
            Bookmarks
          </Link>
          <Link href="/settings" className="hover:text-ink">
            Settings
          </Link>
          {email ? <span className="hidden sm:inline">{email}</span> : null}
          <form action={logout}>
            <button type="submit" className="hover:text-ink">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
