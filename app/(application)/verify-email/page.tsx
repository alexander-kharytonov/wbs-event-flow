import { VerificationForm } from "@/features/auth/components/verification-form";
import { safeReturnPath } from "@/lib/safe-return-path";
import { redirectVerifiedUser } from "@/lib/session";

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { returnTo, error, delivery } = await searchParams;
  const destination = safeReturnPath(returnTo);

  await redirectVerifiedUser(destination);

  return (
    <VerificationForm
      returnTo={destination}
      invalidLink={Boolean(error)}
      deliveryFailed={delivery === "failed"}
    />
  );
}
