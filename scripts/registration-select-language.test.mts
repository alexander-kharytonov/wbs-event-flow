import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  applicationAnswersSchema,
  applicationInputSchema,
  applicationIssue,
} from "../features/events/application-input";
import type { EventSnapshot } from "../features/events/schemas/event-snapshot";
import { locales } from "../lib/i18n/locale";
import { loadMessages } from "../lib/i18n/messages";

// Match the form's module resolution so both use the same next-intl context.
const { createTranslator, NextIntlClientProvider } = createRequire(
  import.meta.url,
)("next-intl") as typeof import("next-intl");

mock.module("server-only", { namedExports: {} });
const { getRegistrationSelectPlaceholders } = await import(
  "../features/events/server/registration-select-placeholders"
);

// Isolate the server action and router; render the real form, MUI and UI provider.
mock.module("../features/events/submit-application-action.ts", {
  namedExports: { submitApplication: async () => ({}) },
});
mock.module("next/navigation", {
  namedExports: { useRouter: () => ({ refresh() {} }) },
});
const { RegistrationApplicationForm } = await import(
  "../features/events/components/registration-application-form"
);
const fields: EventSnapshot["registrationForm"]["fields"] = [true, false].map(
  (required, index) => ({
    id: `field-${index}`,
    type: "SINGLE_CHOICE",
    label: `Authored question ${index}`,
    description: `Authored description ${index}`,
    required,
    options: [{ id: `option-${index}`, label: `Authored answer ${index}` }],
  }),
);
const expected = {
  en: ["Choose an option", "No selection"],
  de: ["Option auswählen", "Keine Auswahl"],
  pl: ["Wybierz opcję", "Brak wyboru"],
  uk: ["Виберіть варіант", "Не вибрано"],
  ru: ["Выберите вариант", "Не выбрано"],
};
const publicId = "00000000-0000-4000-8000-000000000001";
const eventRevisionId = "00000000-0000-4000-8000-000000000002";

for (const eventLanguage of locales) {
  const selectPlaceholders =
    await getRegistrationSelectPlaceholders(eventLanguage);

  for (const uiLanguage of locales) {
    test(`Event ${eventLanguage}, UI ${uiLanguage}: required/optional selects, authored content and submission payload`, async () => {
      const messages = await loadMessages(uiLanguage);
      const uiT = createTranslator({
        locale: uiLanguage,
        messages,
        namespace: "events",
      });
      const render = (initialValues: Record<string, string[]> = {}) =>
        renderToStaticMarkup(
          createElement(
            NextIntlClientProvider,
            {
              // biome-ignore lint/correctness/noChildrenProp: next-intl requires this prop in its type; React receives the child as the third argument.
              children: null,
              locale: uiLanguage,
              timeZone: "UTC",
              messages,
            },
            createElement(RegistrationApplicationForm, {
              publicId,
              eventRevisionId,
              fields,
              selectPlaceholders,
              eventContext: null,
              initialValues,
            }),
          ),
        );
      const empty = render();
      const selects = [
        ...empty.matchAll(/<div[^>]*role="combobox"[^>]*>([\s\S]*?)<\/div>/g),
      ];
      assert.equal(selects.length, 2);
      assert.ok(selects[0][1].includes(expected[eventLanguage][0]));
      assert.ok(selects[1][1].includes(expected[eventLanguage][1]));
      assert.match(selects[0][0], /aria-required="true"/);
      assert.ok(empty.includes(uiT("submitApplication")));
      assert.ok(
        empty
          .match(/<button[^>]*type="submit"[^>]*>/)?.[0]
          .includes('disabled=""'),
      );

      for (const field of fields) {
        assert.ok(empty.includes(field.label));
        assert.ok(empty.includes(field.description ?? ""));
      }
      const filled = render({
        fullName: ["Test applicant"],
        email: ["invalid-email"],
        "answer:field-0": ["option-0"],
        "answer:field-1": ["option-1"],
      });
      assert.ok(filled.includes("Authored answer 0"));
      assert.ok(filled.includes("Authored answer 1"));
      // A nonempty malformed email remains submittable for explicit validation.
      const submit = filled.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
      assert.ok(submit);
      assert.ok(!submit.includes("disabled="));
      assert.match(filled, /name="answer:field-0"[^>]*value="option-0"/);
      assert.match(filled, /name="answer:field-1"[^>]*value="option-1"/);

      const schema = applicationAnswersSchema({ registrationForm: { fields } });
      const missing = schema.safeParse({ "field-0": [""], "field-1": [""] });
      assert.equal(missing.success, false);

      if (!missing.success) {
        assert.equal(missing.error.issues.length, 1);
        const issue = applicationIssue(missing.error.issues[0]);
        assert.equal(issue.code, "chooseAtLeastOne");
        assert.equal(
          uiT(issue.code, issue.values),
          messages.events.chooseAtLeastOne,
        );
      }
      const optionalEmpty = render({
        fullName: ["Test applicant"],
        email: ["test@example.com"],
        "answer:field-0": ["option-0"],
      });
      assert.ok(
        !optionalEmpty
          .match(/<button[^>]*type="submit"[^>]*>/)?.[0]
          .includes("disabled="),
      );
      const invalidEmail = applicationInputSchema.safeParse({
        publicId,
        eventRevisionId,
        fullName: "Test applicant",
        email: "invalid-email",
        answers: {},
      });
      assert.equal(invalidEmail.success, false);

      if (!invalidEmail.success) {
        assert.equal(
          applicationIssue(invalidEmail.error.issues[0]).code,
          "invalidEmail",
        );
      }
      const answers = { "field-0": ["option-0"], "field-1": [""] };
      const input = applicationInputSchema.parse({
        publicId,
        eventRevisionId,
        fullName: "Test applicant",
        email: "TEST@example.com",
        answers,
      });
      assert.equal(input.eventRevisionId, eventRevisionId);
      assert.equal(input.email, "test@example.com");
      const parsed = schema.parse(input.answers);
      assert.deepEqual(parsed["field-0"].selectedOptions.create, [
        { optionId: "option-0" },
      ]);
      assert.deepEqual(parsed["field-1"].selectedOptions.create, []);
      assert.equal(
        schema.safeParse({ "field-0": ["foreign-option"] }).success,
        false,
      );
      assert.equal(
        schema.safeParse({ "field-0": ["option-0", "option-0"] }).success,
        false,
      );
    });
  }
}
