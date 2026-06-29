# Muniwork

Public site and front end for Muniwork.

## Current Scope

- Astro + Netlify + Tailwind CSS + Basecoat Rhea
- Root-level organization profile pages only
- Shared template for municipalities and counties

## Runtime

- Node `22.13.0` or compatible. Volta uses the `package.json` pin automatically;
  run `nvm use` from the project root if you use nvm.

## UI conventions

- Use Tailwind CSS for layout, spacing, typography, and one-off adjustments.
- Prefer Basecoat components before building common UI from scratch.
- Use the Basecoat Rhea style bundle through `basecoat-css/rhea`.
- Reach for Basecoat `card`, `badge`, `alert`, `button`, `breadcrumb`,
  `input`, `table`, `tabs`, `accordion`, `field`, `select`, and `empty`
  patterns as the app grows.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

For local development, copy `.env.example` to `.env` and fill in the values from
Supabase before starting Astro. `SUPABASE_SERVICE_ROLE_KEY` is server-only; do
not expose it in browser code or prefix it with a public client variable name.
