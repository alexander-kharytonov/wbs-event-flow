import { useRef, useState } from "react";
import type { EventFormState } from "@/features/events/event-input-schema";

// A lost response must retry the exact mounted form submission, including its
// temporary cover and transient password. Confirmed outcomes release it.
export function useEventCreationRetry() {
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [submittedCoverId, setSubmittedCoverId] = useState<string | null>(null);
  const creationKey = useRef<string | null>(null);
  const submittedCreation = useRef<FormData | null>(null);

  function prepare(formData: FormData) {
    creationKey.current ??= crypto.randomUUID();
    formData.set("creationKey", creationKey.current);
    submittedCreation.current ??= formData;
    setSubmittedCoverId(
      String(submittedCreation.current.get("temporaryCoverId") || "") || null,
    );

    return submittedCreation.current;
  }

  function settle(next: EventFormState) {
    setCreationUncertain(Boolean(next.creationUncertain));

    if (!next.creationUncertain) submittedCreation.current = null;
  }

  return { creationUncertain, submittedCoverId, prepare, settle };
}
