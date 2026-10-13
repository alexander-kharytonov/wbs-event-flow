import { useRef, useState } from "react";
import type { ApplicationIssue } from "@/features/events/application-input";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

// Stable UI keys are distinct from the submitted declaration positions.
// Participant answers remain in the parent form's single values store.
export function useApplicationGuests(
  values: Record<string, string[]>,
  fields: EventSnapshot["registrationForm"]["fields"],
  errors: Record<string, ApplicationIssue>,
  setErrors: (errors: Record<string, ApplicationIssue>) => void,
) {
  const [guestKeys, setGuestKeys] = useState<number[]>([]);
  const nextGuestKey = useRef(0);
  const guestValues = () =>
    guestKeys.map((key) => ({
      name: values[`guest:${key}:name`]?.[0] ?? "",
      email: values[`guest:${key}:email`]?.[0] ?? "",
      answers: Object.fromEntries(
        fields.map((field) => [
          field.id,
          values[`guest:${key}:answers:${field.id}`] ?? [],
        ]),
      ),
    }));
  const mapGuestErrors = (errors: Record<string, ApplicationIssue>) =>
    Object.fromEntries(
      Object.entries(errors).map(([key, value]) => {
        const match = /^guest:(\d+):(.*)$/.exec(key);

        return [
          match ? `guest:${guestKeys[Number(match[1])]}:${match[2]}` : key,
          value,
        ];
      }),
    );

  function addGuest() {
    const key = nextGuestKey.current++;
    setGuestKeys((current) => [...current, key]);
  }

  function removeGuest(key: number) {
    setGuestKeys((current) => current.filter((value) => value !== key));
    setErrors(
      Object.fromEntries(
        Object.entries(errors).filter(
          ([name]) => !name.startsWith(`guest:${key}:`),
        ),
      ),
    );
  }

  return { guestKeys, guestValues, mapGuestErrors, addGuest, removeGuest };
}
