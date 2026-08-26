# DESIGN.md — VeloClub

## Color Strategy: Restrained with committed accents
Tinted neutrals dominate. Violet accent (#381DA0) used purposefully on interactive elements. Emerald (#06D6A0) for positive/paid states. Coral (#EF476F) for danger/overdue. Amber (#FFB703) for warnings/pending.

**No brand gradients inside the app.** The violet is applied flat — buttons,
headers, the loading screen, the route transition, active states. A gradient from
violet to blue used to be the house style; it is not any more.

Three exceptions, and they are the only ones:
- **The landing page** keeps its hero, its fade to white and the glassmorphism.
- **Charts** keep the gradient under the line: that is the area fill, not brand.
- **Scroll masks, shadows and ambient halos** are written with `gradient` in CSS
  but do not paint the brand. Flattening one of those turns the screen off.

## Elevation
- Level 0: `#F7F7FB` — page background
- Level 1: `#FFFFFF` with `border: 1px solid rgba(120,80,200,0.10)` — cards, panels
- Level 2: `rgba(56,29,160,0.06)` tint — active states, selected rows
- Level 3: `box-shadow: 0 8px 32px rgba(56,29,160,0.13)` — floating elements, modals

## Typography
**Geist Sans is the only family in the platform.** Headings and body are the same
typeface — what separates them is weight and letter-spacing, never a second font.
It is loaded from the `geist/font/sans` package in `app/layout.tsx`, not from
Google Fonts.

- Headings: Geist Sans, 600, tight letter-spacing (-0.02em)
- Body/UI: Geist Sans, 400/500/600
- Numbers/metrics: Geist Sans with `tabular-nums`; Geist Mono (`font-mono`) for
  code and figures that must align in columns
- Min body: 13px, min label: 10px, min touch target: 44px

**Never write a bare font name** in a `style` or a class. If it isn't loaded the
browser falls back to the system sans and the screen looks different on every
computer — which is exactly what happened when this file said Space Grotesk and
Plus Jakarta Sans, fonts that were never loaded anywhere.

## Component Conventions
- Border radius: 12px (small), 16px (card), 24px (large card/modal), 40px (pill/nav)
- Buttons primary: bg #381DA0, white text, radius 12px, no border
- Buttons ghost: transparent bg, border rgba(120,80,200,0.20), radius 12px
- State pills: small rounded-full, bg color at 12% opacity, text at full color
- Input: border 1.5px rgba(120,80,200,0.18), radius 10px, bg white, 14px
- Plan selector: segmented control (not dropdown select)
- Status indicators: colored left bar 3px or colored background tint — NO side-stripe >1px

## Motion
- Standard enter: opacity 0→1 + y 12→0, 220-280ms, cubic-bezier(0.23,1,0.32,1)
- Stagger children: 60-80ms between items
- Panel slide: x 100%→0, 320ms, cubic-bezier(0.32,0.72,0,1) (iOS spring)
- Button tap: scale 0.97, 120ms
- Progress bar: width animate on viewport enter, 600-700ms ease-out
- AnimatePresence on all show/hide transitions
