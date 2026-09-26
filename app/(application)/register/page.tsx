import { AuthForm } from "@/features/auth/components/auth-form";
import { safeReturnPath } from "@/lib/safe-return-path";

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { returnTo } = await searchParams;

  return <AuthForm mode="register" returnTo={safeReturnPath(returnTo)} />;
}
