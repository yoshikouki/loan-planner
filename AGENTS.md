# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds entry `index.tsx`, UI in `src/components/`, hooks in `src/hooks/`, utilities in `src/utils/`; keep new code inside the nearest folder to limit cross-coupling.
- Unit tests sit beside code (e.g., `src/utils/loan.test.ts`); add more `*.test.ts` or `*.spec.tsx` files next to the feature they cover.
- Static assets belong in `public/`; build artefacts land in `dist/` and stay untracked.

## Build, Test, and Development Commands
- `npm install` (or `bun install`) syncs dependencies; rerun after touching `package.json` or `bun.lock`.
- `npm run dev` starts the Vite dev server with Hono routing on `http://localhost:5173`; hot reload reflects edits instantly.
- `npm run build && npm run preview` compiles the worker into `dist/` then serves it locally for smoke testing.
- `npm run deploy` builds and publishes via Wrangler; confirm environment bindings beforehand.
- `npm run cf-typegen` updates the `CloudflareBindings` types whenever Worker bindings change.
- Quality gates: `npm run lint`, `npm run format`, `npm run typecheck`, and `npm run test` (Vitest + esbuild-wasm); append `--watch` or `--coverage` as needed.

## Coding Style & Naming Conventions
- TypeScript + React with ES modules; prefer small pure components and export them explicitly.
- Biome enforces 2-space indentation, double quotes, trailing commas, and mandatory semicolons—run `npm run format` before committing.
- Components use PascalCase (`LoanPlanner`), hooks use `useCamelCase`, utilities take verb-first camelCase, and serialized keys stay in local `as const` maps.

## Testing Guidelines
- Vitest runs in a `jsdom` environment (`vitest.config.js`); scope suites with `describe` blocks that mirror folder names.
- Target deterministic logic first (calculations in `src/utils/loan.ts`, state workflows in hooks); mock browsers only when APIs are unavailable in jsdom.
- Run `npm run test` before PRs; keep coverage steady and prefer explicit assertions over snapshots.

## Commit & Pull Request Guidelines
- Follow the `<type>: <imperative summary>` pattern seen in history (`style: introduce theme tokens`); keep subjects short and types lowercase.
- Consolidate fixups locally so each commit stands alone.
- PRs should provide a summary, screenshots or GIFs for UI changes, a checklist of commands run, and links to related issues or deployment notes.

## Cloudflare Deployment Notes
- This app deploys to Cloudflare Workers; confirm `compatibility_date` in `wrangler.jsonc` and regenerate types with `npm run cf-typegen` before release.
- Store secrets with `wrangler secret put` and document new binding names in your PR—never commit credentials.
