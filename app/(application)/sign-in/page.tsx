import { AuthForm } from "@/features/auth/components/auth-form";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { verification, error } = await searchParams;

  return (
    <AuthForm
      mode="sign-in"
      notice={
        verification === "required" || error
          ? "Verify your email before continuing. Sign in to request a new verification link."
          : undefined
      }
    />
  );
}
