# Design System — entri

> Direction: **Marginalia (dialed back)** — a warm notebook, taken seriously.
> The one thing a student should remember after first use: *"It kept my own notes —
> it didn't replace them with a robot's version."* Every decision below serves that.

## Product Context
- **What this is:** An AI study-notes app. Photograph handwritten notes → Claude vision
  extraction (never silently "fixes" them) → FSRS daily exam tuned to your exam date →
  grounded RAG chat over your own material.
- **Who it's for:** Students preparing for exams — the panicked-before-exam persona who
  needs to trust that what they're memorising is real, and needs a daily habit that holds.
- **Space/industry:** Study / spaced-repetition learning tools. Peers: StudyFetch, Knowt,
  Quizlet, Anki, RemNote, Mochi, Duolingo (gamified end).
- **Project type:** Web app (Next.js SPA) with a marketing/onboarding surface.
- **Differentiation thesis:** retention + trust, not feature count. The category competes on
  gamified dopamine (Duolingo/Knowt) or clean minimalism (Mochi). **Nobody designs around
  trust.** entri's lane: the design makes provenance visible — a thread back to your own
  handwriting — so trust is *designed, not claimed*.

## Aesthetic Direction
- **Direction:** Marginalia — warm notebook (dialed back ~20% from full skeuomorphism).
- **Decoration level:** intentional. Subtle paper grain, ruled lines and the red margin rule
  used contextually (notebook/marketing surfaces), not behind dense data.
- **Mood:** Warm, encouraging, human — but serious study software you trust with your notes.
  Anti-gamified, anti-sterile. The app feels like *your* notebook, not a robot's clean copy.
- **Reference sites:** Mochi (mochi.cards — calm/restrained, the taste benchmark), Knowt
  (knowt.com — the loud mass-market baseline to beat), RemNote (remnote.com — dense
  power-user heritage). Researched 2026-06-11.

### Skeuomorphic discipline (the dialed-back rules — keep it tasteful, never kitsch)
- **The signature move is the highlighter swipe.** A skewed (~-6°), rough-edged marigold
  highlight (SVG `feTurbulence` + `feDisplacementMap` so the edge looks hand-drawn, NOT a
  flat rectangle). Reserved for the verified source line and occasional hero emphasis.
  Never decorative, never more than one per view.
- **Rotation ≤ 1°**, and only on the provenance page-slip and the AI-inferred sticky note.
  The primary study card sits **square** — app stability and legibility win there.
- **Paper grain** at opacity ≈ 0.035 (light). Ruled-line and red-margin treatments appear on
  the notebook/marketing/provenance surfaces only — **dense data screens (readiness, lists)
  use a clean surface**, no ruling.
- **Washi tape / paper-clip** appears on the daily-review card only (the signature moment).
  Do not scatter it across the UI.
- **AI-inferred content is always visibly tentative:** taupe, dashed or sticky-note styling,
  tape, slight tilt — never disguised as confirmed. This is a trust requirement, not a style
  choice.

## Typography
- **Display/Hero:** **Fraunces** — warm soft-serif with optical sizing; scholarly but human.
  Lean into italic for voice/emphasis. Weights 500–700. (Category defaults to geometric sans;
  this is a deliberate departure that gives entri a face.)
- **Body:** **Instrument Sans** — humanist sans, highly legible on dense cards. Weights 400/500/600.
- **UI/Labels:** Instrument Sans (same as body).
- **Data/Tables:** Instrument Sans with `font-variant-numeric: tabular-nums` for all metrics
  (readiness %, intervals, streaks, counts). Large readiness figures may use Fraunces tabular.
- **Code/Mono:** **IBM Plex Mono** — source citations, field labels, kickers, eyebrows.
- **Loading:** Google Fonts —
  `Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600`
  + `Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400` + `IBM+Plex+Mono:wght@400;500`.
  Self-host for production if FCP matters.
- **Scale** (rem @ 16px base):
  - caption/mono: 0.75rem (12px)
  - small / UI: 0.875rem (14px)
  - body: 1rem (16px)
  - lead / source-quote: 1.125–1.375rem (18–22px)
  - h3: 1.375rem (22px)
  - question / h2-small: 1.75–1.875rem (28–30px)
  - h2: clamp(1.625rem, 4vw, 2.375rem) (26–38px)
  - display/hero: clamp(2.875rem, 8vw, 5.5rem) (46–88px)
  - Display tracking: -0.02em to -0.025em. Body line-height 1.6; display 0.96–1.2.

## Color
- **Approach:** restrained-warm with semantic provenance. One signature accent (marigold),
  one trust ink (teal/green), color is meaningful — especially for provenance states.

**Light (default):**
- **Paper / canvas:** `#F7F1E6`  · paper-2 (raised): `#FBF6EC` · app surface/card: `#F0E9DF`
- **Border / rule line:** `#D9CDB8` · blue ruling: `#CADAE8`
- **Text:** ink `#1E1913` · ink-soft `#52493C` · muted `#766B54` (AA ~4.7:1 on paper)
- **Signature accent — marigold:** `#E0913A` (the highlighter metaphor) · strong/hover `#C2741F`
- **Highlighter fill:** `#FFD27A` (semi-transparent swipe)
- **Trust / verified / correct — deep teal:** `#1F5A4C` · soft `#DCEAE2`
- **AI-inferred — taupe:** `#A6987F` for the *treatment* (dashed border / sticky bg) only; for
  AI-inferred **text**, use taupe-ink `#6C6353` (AA ~4.9:1 on the inferred card)
- **Semantic:** success `#1F5A4C` · warning `#C2741F` · error (brick) `#A93D27` · info `#3E6B8A`
  (errors stay in the warm family — brick, not pure red.)

**Dark (warm near-black paper, not cold slate):**
- paper `#181511` · paper-2 `#201B15` · surface `#2A251F` · border `#352D22` · blue ruling `#2A3540`
- ink `#F0E8DA` · ink-soft `#C2B6A2` · muted `#9A8B72` (AA on dark paper)
- marigold `#EBA459` / hover `#F0B568` · highlighter (low-opacity) `#7A5E1F`
- teal `#5BA188` · teal-soft `#1C2A24` · taupe `#9C8E78` (treatment) / taupe-ink `#B3A589` (text)
  · brick `#D26450` · info `#6B9BC0`
- **Strategy:** redesign surfaces (don't invert), reduce accent saturation ~10–15%.

## Spacing
- **Base unit:** 8px (4px sub-unit for fine adjustments).
- **Density:** comfortable — study content needs breathing room; cards stay focused.
- **Scale:** 2xs(2) xs(4) sm(8) sm+(12) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** hybrid. **App** (daily review, readiness, lists) = grid-disciplined, square
  cards, clean surfaces. **Marketing / onboarding / provenance** = notebook-editorial
  (ruled paper, red margin, grain, asymmetry).
- **Grid:** single focused column for review/reading; 2–3 col stat rows on dashboard;
  collapse to 1 col under 640px.
- **Max content width:** reading/review 600–720px; dashboard up to 920px.
- **Border radius:** tight and paper-like — sm:4px, md:8px. **No pill/bubble radii.**
  Borders 1–1.5px in warm line color. Shadows soft and low (paper lift), not glossy.

## Motion
- **Approach:** intentional. Motion aids comprehension and adds earned warmth — never slot-machine.
- **Signature motion:** the **highlighter swipe reveals left-to-right** (~300ms ease-out) when a
  source line is shown. Card flip on answer reveal. Sticky/tape settle subtly on mount.
  Streak / readiness get a small *earned* celebration (≤500ms), restrained.
- **Easing:** enter `ease-out` · exit `ease-in` · move `ease-in-out`.
- **Duration:** micro 50–100ms · short 150–250ms · medium 250–400ms · long 400–700ms.
- Respect `prefers-reduced-motion`: drop the swipe animation + celebrations, keep instant states.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-11 | Initial design system created | /design-consultation. Researched StudyFetch/Knowt/Mochi/RemNote/Duolingo. |
| 2026-06-11 | Posture: warm, encouraging, human | User choice over calm-minimal and gamified. |
| 2026-06-11 | Eureka: design provenance into the system | Category competes on dopamine or minimalism; trust is the unguarded lane. Card keeps a visible thread to the user's handwriting. |
| 2026-06-11 | Signature accent = marigold highlighter, not green | Ownable; on-thesis (study = highlighting your own notes); departs from Knowt/Duolingo green and Mochi monochrome. |
| 2026-06-11 | Type: Fraunces (display) + Instrument Sans (body) | Warm soft-serif gives a scholarly-but-human face in a sans-default category. |
| 2026-06-11 | Direction: Marginalia, dialed back ~20% | The notebook-as-interface makes "it kept my own notes" literal; skeuomorphism disciplined (square main card, light grain, tape only on the signature moment) for production safety + legibility. |
| 2026-06-14 | Darkened `muted` + split `taupe` into treatment vs `taupe-ink` text | /normalize + /audit: original muted (#9C8E78 ~2.9:1) and taupe text failed WCAG AA. Treatment color (dashed/sticky) keeps the "tentative" semantic; text colors raised to ≥4.5:1. No pill/bubble radii rule re-enforced (status chips → rounded-sm). |
