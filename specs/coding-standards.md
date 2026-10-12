# Coding standards

Implementation conventions for EduHub. Engineering principles are in `constitution.md`. Product scope is in `product.md`.

## Quality

Prefer simple, readable, maintainable code.

- Keep files small and focused: one screen or one concern per file.
- Use clear names: `PascalCase` components, `camelCase` functions, `kebab-case` filenames, `useThing` hooks.
- Prefer plain components, hooks, and functions. Do not add an abstraction unless it removes real duplication.
- Separate UI, data access, and authorization. Route files compose; they do not own business rules.

## Stack limits

- Reuse existing UI primitives and `cn()` from `src/lib/utils.ts`. See `guides/frontend.md`.
- Do not add a state library, a second ORM, a second database access path, or a component framework on top of what is already installed.
- Add a dependency only when the current stack cannot do the job.
- Do not duplicate the generated Supabase client setup. See `guides/supabase.md`.
- Match the surrounding style: strict TypeScript, Prettier (print width 100, double quotes, trailing commas).

## Unfinished behavior

- Do not add mock courses, users, grades, or charts.
- Do not stub workflows with fake data or non-working controls.
- Do not invent behavior that `product.md` lists as unresolved.
