"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  applicationSessionCookie,
  applicationSessionPath,
  isApplicationMutationOrigin,
  readApplicationSession,
} from "@/features/events/server/application-session";
import {
  type WithdrawalResult,
  withdrawAnonymousApplication,
  withdrawOwnApplication,
} from "@/features/events/server/withdraw-application";
import { getServerEnv } from "@/lib/env";
import { requireVerifiedUser } from "@/lib/session";

export async function withdrawApplication(input: unknown) {
  const user = await requireVerifiedUser();
  const result = await withdrawOwnApplication(user.id, input);

  if (result.success) {
    revalidatePath("/e/[publicId]", "page");
    revalidatePath("/dashboard/events/[id]", "layout");
  }

  return result;
}

export async function withdrawPrivateApplication(
  input: unknown,
): Promise<WithdrawalResult> {
  const parsed = z
    .strictObject({ applicationId: z.uuid(), publicId: z.uuid() })
    .safeParse(input);

  if (!parsed.success) {
    return { message: "withdrawUnavailable" } as const;
  }
  const capability = await readApplicationSession(parsed.data.applicationId);

  if (!capability || !isApplicationMutationOrigin(await headers())) {
    return { message: "withdrawUnavailable" } as const;
  }
  const result = await withdrawAnonymousApplication(capability, parsed.data);

  if (result.success) {
    (await cookies()).set(applicationSessionCookie(), "", {
      path: applicationSessionPath(parsed.data.applicationId),
      maxAge: 0,
      httpOnly: true,
      sameSite: "strict",
      secure:
        getServerEnv().NODE_ENV === "production" ||
        getServerEnv().BETTER_AUTH_URL.startsWith("https:"),
    });
    revalidatePath("/application/view/[applicationId]", "page");
    revalidatePath("/dashboard/events/[id]", "layout");
  }

  return result;
}
