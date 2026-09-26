import { AuthForm } from "@/features/auth/components/auth-form";
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
      returnTo={safeReturnPath(returnTo)}
      notice={
        verification === "required" || error
          ? "Sign in to continue. If your email needs verification, we’ll guide you through the next step."
          : undefined
      }
    />
  );
}
