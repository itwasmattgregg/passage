import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

async function sendVerificationRequest({
  identifier,
  url,
}: {
  identifier: string;
  url: string;
}) {
  if (process.env.AUTH_RESEND_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Passage <onboarding@resend.dev>",
        to: identifier,
        subject: "Sign in to Passage",
        html: `<p>Open this link to sign in to Passage:</p><p><a href="${url}">${url}</a></p>`,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send the sign-in email.");
    }
    return;
  }

  console.log("\n=== Passage magic link ===");
  console.log(`To: ${identifier}`);
  console.log(url);
  console.log("==========================\n");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY || "dev-unused",
      from: process.env.EMAIL_FROM ?? "Passage <noreply@localhost>",
      sendVerificationRequest,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login?sent=1",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
