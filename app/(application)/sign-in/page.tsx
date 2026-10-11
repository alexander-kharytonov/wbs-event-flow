import { AuthForm } from "@/features/auth/components/auth-form";
import { getServerEnv } from "@/lib/env";
import { safeReturnPath } from "@/lib/safe-return-path";
import { redirectVerifiedUser } from "@/lib/session";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { verification, error, returnTo } = await searchParams;
  await redirectVerifiedUser(returnTo);

  return (
    <AuthForm
      mode="sign-in"
      googleEnabled={Boolean(getServerEnv().GOOGLE_CLIENT_ID)}
      oauthError={typeof error === "string" ? error : undefined}
      returnTo={safeReturnPath(returnTo)}
      notice={verification === "required" ? "signInNotice" : undefined}
    />
  );
}
