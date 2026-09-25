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
- Do not add tests unless explicitly requested.
