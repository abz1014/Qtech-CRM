# DEPENDENCY_AUDIT.md — Q-Tech CRM (Read-Only Audit)

## npm audit: 20 vulnerabilities (1 critical, 12 high, 6 moderate, 1 low) — all fixable

| Sev | Package | Issue | Exposure |
|---|---|---|---|
| **Critical** | vitest | UI server arbitrary file read/execute | dev-only |
| **High** | react-router / react-router-dom / @remix-run/router | XSS via open redirect; untrusted-path external redirect | **PROD RUNTIME** — upgrade first |
| High | vite | dev server file disclosure | dev |
| High | rollup | path-traversal file write | build |
| High | lodash, minimatch, picomatch, glob, flatted, form-data, ws | transitive | dev/build |
| Moderate | esbuild, postcss, js-yaml, ajv, yaml, brace-expansion | transitive | dev |

**Action:** upgrade react-router-dom to patched release, then `npm audit fix` for the rest.

## Hygiene

| Finding | Severity |
|---|---|
| **Three lockfiles committed** (package-lock.json, bun.lock, bun.lockb) — nondeterministic installs; Vercel uses npm → delete the bun locks | Medium |
| `lovable-tagger` devDependency — Lovable scaffolding leftover, removable | Low |
| Playwright installed (`@playwright/test`, config, fixture) but **no test:e2e script** in package.json — dead tooling; wire up or remove | Low |
| React Query installed and mounted, unused — either adopt (recommended for the data-layer refactor) or remove | Low |
| zod + react-hook-form + @hookform/resolvers used only by LoginPage (81KB chunk) — adopt app-wide or drop | Low |
| Browserslist data 12 months old (build warning) — `npx update-browserslist-db@latest` | Low |

## Outdated majors (non-urgent except router)

react-router-dom 6→7 (security), tailwindcss 3→4, vite 5→7, zod 3→4, date-fns 3→4, recharts 2→3, next-themes 0.3→0.4.

**Dependency score: 5/10.**
