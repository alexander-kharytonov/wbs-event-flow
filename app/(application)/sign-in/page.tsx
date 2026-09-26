import { AuthForm } from "@/features/auth/components/auth-form";
import { safeReturnPath } from "@/lib/safe-return-path";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { verification, error, returnTo } = await searchParams;

  return (
    <AuthForm
      mode="sign-in"
      returnTo={safeReturnPath(returnTo)}
      notice={
        verification === "required" || error
          ? "Verify your email before continuing. Sign in to request a new verification link."
          : undefined
      }
    />
  );
}
