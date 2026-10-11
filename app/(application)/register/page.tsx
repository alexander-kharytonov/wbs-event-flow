import { AuthForm } from "@/features/auth/components/auth-form";
import { getServerEnv } from "@/lib/env";
import { safeReturnPath } from "@/lib/safe-return-path";
import { redirectVerifiedUser } from "@/lib/session";

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { returnTo, error } = await searchParams;
  await redirectVerifiedUser(returnTo);

  return (
    <AuthForm
      googleEnabled={Boolean(getServerEnv().GOOGLE_CLIENT_ID)}
      oauthError={typeof error === "string" ? error : undefined}
      mode="register"
      returnTo={safeReturnPath(returnTo)}
    />
  );
}
