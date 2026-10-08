<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

- Preserve a blank line before `if`, `return`, and `export` statements when they follow another statement in the same block.
- Prefer readable, explicit code over clever or overly compact code.
- Do not add abstractions, dependencies, compatibility layers, fallbacks, or infrastructure unless they are required by the current task.
- Do not add demo data, seed data, mock application data, placeholder users, or fake business entities unless explicitly requested.
- Do not implement functionality beyond the scope of the current task.
- If the task requires an architectural or product decision that is not documented or explicitly requested, stop and report the decision that is needed instead of guessing.
- Create directories and architectural layers only when current code requires them. Do not create empty structure for anticipated future features.
- Do not add tests unless explicitly requested.

## Product and domain documentation

- Before changing product behavior, domain rules, persistence, authorization, publication, registration, applications, or lifecycle semantics, read the relevant sections of `PRODUCT.md` and `DOMAIN.md`.
- Local CSS changes or implementation-only refactors do not require reading both documents in full.
- Before changing forms, field styles, or empty collection views, read the `Form feedback and shared UI` section of `PRODUCT.md` and inspect the existing shared components referenced below. This applies to local UI changes too; it does not require reading unrelated product/domain sections.
- When a task intentionally changes a documented invariant, update the corresponding documentation in the same task. If a task unexpectedly conflicts with `DOMAIN.md`, report the conflict instead of silently violating the invariant.

## Project structure

- Keep `app/` focused on Next.js routing and route-local code.
- Put shared reusable UI in `components/`; create specialized subdirectories only when current shared components require them.
- Put feature-specific code in `features/<feature>/`, including feature forms.
- Put shared React providers in `providers/`.
- Put shared hooks in `hooks/` when shared hooks exist; keep feature-specific hooks with their feature.
- Keep infrastructure integrations in `lib/`.
- Do not create abstractions or directories beyond current feature needs unless explicitly requested.
- Prefer `@/*` imports over deep relative imports.

## UI and UX

- Build user-facing interfaces as polished product UI, not as debug or scaffold UI.
- Use clear visual hierarchy, spacing, grouping, and responsive layouts.
- Prefer appropriate MUI components and icons over raw text-only layouts when they improve usability.
- Design empty, loading, error, and populated states intentionally.
- Keep related actions close to the content they affect.
- Avoid oversized controls, excessive empty space, and visually dominant secondary controls.
- Keep layouts usable on both desktop and mobile.
- Reuse established visual patterns before introducing new ones.
- Do not create a design system or abstractions unless current UI repetition requires them.

### Shared fields, empty states, and form feedback

- Use `components/ui/empty-state.tsx` for empty collection views, supplying its icon, title, description, and optional action. Reuse the component instead of creating a local empty-state card.
- Keep common text-field and select appearance in `providers/theme-provider.tsx`. Local layout and sizing are allowed; do not duplicate or override the shared border, background, focus, error, or disabled styles for individual forms.
- Follow the form behavior defined in `PRODUCT.md`. Use `noValidate` on forms, disable submission while required values are missing or the submission is pending, and run explicit client validation on submit. A non-empty but incorrectly formatted value must remain submittable so validation can explain the error; existing authorization, lifecycle, and workflow guards still apply.
- Reuse existing shared input schemas for client validation when they are safe to import into the client. Keep server validation and authorization authoritative; never import server-only code or private data into a client form.
- Use `hooks/use-form-feedback.ts` where its field-error/message model fits. Otherwise preserve the same behavior within the existing form workflow: show field errors inline, clear the affected error when its value changes, and show errors without a matching field in an Alert above the submission action. Preserve errors on unrelated fields.
- Inspect the neighboring form/list pattern before implementation. Verify empty, populated, validation-error, and pending states, along with desktop/mobile layout where applicable. Report browser checks that were not performed; code checks alone do not establish visual correctness. This does not authorize adding tests beyond the project rule above.
