# AI agent instructions for this repo

Purpose: Next.js 15 + React 19 + Tailwind v4 app that renders a filterable/sortable material table from static data.

## Architecture
- App Router. `src/app/layout.tsx` wires global CSS/fonts; `src/app/page.tsx` is a client component owning state for filters, hidden properties, and sorting.
- Data is static in `src/data/materials.ts`; there are no APIs or server actions.
- Components:
  - `FilterSection.tsx`: Inputs for `Materialname` and `Hersteller` plus an action to add property filters.
  - `PropertyFilter.tsx`: UI for a single property filter (text | dropdown | range); reports changes via `onFilterChange`.
  - `MaterialTable.tsx`: Renders the table, supports column sort and property sort, and toggling visibility of properties.

## Data model and types
- Path alias: `@/*` -> `src/*` (see `tsconfig.json`). Types live in `src/types/index.ts` and are imported via `@/types`.
- Material shape used across the app:
  `{ Materialname: string; Hersteller: string; Eigenschaften: { name: string; wert: string; einheit?: string }[]; Link: { text: string; url: string }[] }`.
- Filtering/sorting types: `SortState`, `PropertySortState`, and discriminated union `PropertyFilter` for text|dropdown|range.
- Numeric comparisons parse `Eigenschaften[].wert` with `parseFloat`; numeric values in data must be numeric strings.

## State and behavior (page.tsx)
- On mount, compute `propertyNames` from `materialData` (`Set` -> sorted array).
- Derived `materials` via `useMemo` applying:
  - Text filters: case-insensitive includes on `Materialname` and `Hersteller`.
  - Property filters: evaluates per selected property by type.
  - Sorting: column sort uses `localeCompare`; property sort prefers numeric compare else string.
- Sorting modes are exclusive: setting one clears the other.

## UI patterns and conventions
- Keep heavy derivations in `useMemo`; wire handlers with `useCallback`.
- Property visibility: `MaterialTable` hides tags whose names are in `hiddenProperties` via a dropdown of checkboxes.
- Add new properties by editing `src/data/materials.ts`. Control the filter UI type via `propertyFilterTypeMap` passed to `PropertyFilter`.

## Dev workflow
- Dev: `npm run dev` (Turbopack) -> http://localhost:3000
- Build/Start: `npm run build` then `npm start`
- Lint: `npm run lint` (extends `next/core-web-vitals`, `next/typescript`).

## Notable quirk
- `FilterSection` keeps its own property filters and emits them, but `page.tsx` currently only uses text filters and renders separate `PropertyFilter` rows. Be mindful of duplication if you unify these.
