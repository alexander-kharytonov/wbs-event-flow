import { AuthForm } from "@/features/auth/components/auth-form";
import { safeReturnPath } from "@/lib/safe-return-path";
import { redirectVerifiedUser } from "@/lib/session";

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { returnTo } = await searchParams;
  await redirectVerifiedUser(returnTo);

  return <AuthForm mode="register" returnTo={safeReturnPath(returnTo)} />;
}
