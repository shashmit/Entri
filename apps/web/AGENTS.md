<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# entri app conventions

- Design system: ALWAYS read `../../DESIGN.md` before UI work (Marginalia, dialed back).
  Tokens live in `app/globals.css` (`@theme inline` maps them to Tailwind: `bg-paper`,
  `text-ink`, `border-line`, `bg-marigold`, `text-teal`, `font-display`, etc.).
- Mobile-first: base styles are the phone layout; `md:` adds the sidebar shell, `lg:` the
  two-column dashboard grid.
- Dark mode: `data-theme="dark"` on `<html>` (user toggle, persisted in localStorage as
  `entri-theme`) — never `prefers-color-scheme` alone.
- AI-inferred content must always render visibly tentative (`.inferred-card`,
  `.chip-inferred` — dashed taupe). Never style it like confirmed material.
- One `.hl-swipe` highlighter per view, reserved for the verified source line.
- Data comes from the Hono API via `lib/api.ts` (`api.get/post/patch`, `apiStream`, and the
  `useGet` hook in `lib/use-api.ts`); response shapes live in `lib/api-types.ts`.
