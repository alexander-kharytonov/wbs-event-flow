import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOut } from "./sign-out";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth.api.getSession({ headers: await headers() });
  const { error } = await searchParams;

  return (
    <main>
      <h1>Event Flow</h1>
      {error && (
        <p role="alert">
          The verification link is invalid or expired. Sign in to request a new
          verification email.
        </p>
      )}
      {session ? (
        <>
          <p>
            Signed in as {session.user.name} ({session.user.email}).
          </p>
          <p>Email verified. Organizer setup is not available yet.</p>
          <SignOut />
        </>
      ) : (
        <nav>
          <Link href="/register">Register as an organizer</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      )}
    </main>
  );
}
