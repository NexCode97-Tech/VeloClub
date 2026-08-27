# DESIGN.md — VeloClub

## Color Strategy: Restrained with committed accents
Tinted neutrals dominate. Violet accent (#381DA0) used purposefully on interactive elements. Emerald (#06D6A0) for positive/paid states. Coral (#EF476F) for danger/overdue. Amber (#FFB703) for warnings/pending.

**No brand gradients inside the app.** The violet is applied flat — buttons,
headers, the loading screen, the route transition, active states. A gradient from
violet to blue used to be the house style; it is not any more.

Four exceptions, and they are the only ones:
- **The landing page** keeps its hero, its fade to white and the glassmorphism.
- **Charts** keep the gradient under the line: that is the area fill, not brand.
- **Scroll masks, shadows and ambient halos** are written with `gradient` in CSS
  but do not paint the brand. Flattening one of those turns the screen off.
- **The sport emblem** in the sidebar selector. See below — it is the only place
  inside the app where a gradient is painted on purpose, and it was a decision,
  not an oversight. Do not flatten it.

## The sport selector
It sits above the navigation, separated by a rule. It is not another section:
it is the context everything else is read in. Switching sport does not open
another screen, it changes what every screen shows.

Every sport carries **one colour**, and the emblem is that colour with the
sport's icon on top. The colour does the work of the label: with two or three
sports you know where you are standing without reading.

| Sport | Colour |
|---|---|
| Patinaje | `#381DA0` |
| Natación | `#06D6A0` |
| Atletismo | `#EF8EE7` |
| Ciclismo | `#FFD100` |
| Fútbol | `#E11D48` |

**The emblem is the one gradient inside the app.** The hue turns 44° between the
two corners — `linear-gradient(135deg, warm, cold)` — which is what gives it the
slight relief. The two ends are not picked by eye: they come from rotating the
base colour's hue in OKLab (±22°) with the lightness left almost still (±0.05),
so every sport gets exactly the same treatment. Patinaje, for instance, resolves
to `#0042B3 → #490080`.

**The icon is not always white.** On mint and yellow, white sits below 2:1 and
disappears; there the icon is `#1A1028`. Pick whichever of the two contrasts
more against the emblem's own background — it is a calculation, not a taste
call, and at 26px it shows.

**Two things this costs, written down so nobody rediscovers them:**
- The gradient opens each colour into a range, and the ranges of neighbouring
  sports come close. Measured against simulated colour blindness, natación and
  atletismo land at ΔE 1,9 at their nearest ends — effectively the same colour
  for the ~8% of men with deuteranopia. It holds because the emblem always has
  the sport's name beside it, so colour is never the only signal.
- **Except in the collapsed sidebar**, where the panel shrinks to 68px and the
  labels go. If that state ships, the emblem needs the sport's first letters
  under it, or it should not collapse.

**A sport without an icon falls back to its initial** on the same emblem. A
platform that claims to serve any sport cannot depend on someone drawing a glyph
before it can accept a new one.

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
