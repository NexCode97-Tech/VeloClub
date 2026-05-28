# DESIGN.md — VeloClub

## Color Strategy: Restrained with committed accents
Tinted neutrals dominate. Violet accent (#7C3AED) used purposefully on interactive elements. Emerald (#06D6A0) for positive/paid states. Coral (#EF476F) for danger/overdue. Amber (#FFB703) for warnings/pending.

## Elevation
- Level 0: `#F7F7FB` — page background
- Level 1: `#FFFFFF` with `border: 1px solid rgba(120,80,200,0.10)` — cards, panels
- Level 2: `rgba(124,58,237,0.06)` tint — active states, selected rows
- Level 3: `box-shadow: 0 8px 32px rgba(124,58,237,0.13)` — floating elements, modals

## Typography
- Headings: Space Grotesk, bold/extrabold
- Body/UI: Plus Jakarta Sans, 400/500/600
- Numbers/metrics: Space Grotesk, extrabold
- Min body: 13px, min label: 10px, min touch target: 44px

## Component Conventions
- Border radius: 12px (small), 16px (card), 24px (large card/modal), 40px (pill/nav)
- Buttons primary: bg #7C3AED, white text, radius 12px, no border
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
