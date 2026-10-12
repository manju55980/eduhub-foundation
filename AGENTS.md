<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# EduHub — agent guide

EduHub is developed in Cursor. Read these before changing the app:

- [specs/constitution.md](specs/constitution.md) — engineering principles
- [specs/product.md](specs/product.md) — what to build, and what is unresolved
- [specs/architecture.md](specs/architecture.md) — current repository shape and schema
- [specs/coding-standards.md](specs/coding-standards.md) — code quality and implementation conventions

Read the matching guide before working in that area:

- [specs/guides/supabase.md](specs/guides/supabase.md) — Supabase configuration, data access, auth, and RLS
- [specs/guides/frontend.md](specs/guides/frontend.md) — routes, feature folders, and UI

Do not implement a feature that is not described in the specs. If a product or architecture decision changes, update the relevant spec in the same change.

## Feature Workflow
- Before implementing a major feature, create or update its spec under `specs/features/instructor/`, `specs/features/student/`, or `specs/features/admin/`.
- Base the spec on existing requirements, architecture, code, and database schema.
- Keep planning separate from implementation. Do not change application code during     planning.
- Implement only after the feature spec is reviewed and approved.
- For small tasks already covered by an approved spec, implement directly without creating another document.
- If requirements or important decisions are unclear, ask focused questions before finalizing the spec or implementing. Do not guess or introduce unnecessary requirements. Use existing specs and established project patterns for routine technical decisions.



## Scope Control
- Work only within this repository.
- Keep changes focused on the current task.
- Do not modify unrelated features or files unless required by the task.

## Checks

```sh
npm run dev
npm run lint
npm test
npm run build
```
