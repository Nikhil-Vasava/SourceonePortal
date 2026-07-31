# Design system prompt — "Calm Neon Glass"

Paste this into any AI coding tool to reproduce the same look and feel in another app.
Everything below is self-contained: exact tokens, component rules, and motion physics.

---

## THE PROMPT

> Build the UI using the "Calm Neon Glass" design system defined below. It is a dark,
> glassmorphic interface for internal operational tools that people use all day.
> Atmosphere should be **felt, not seen** — dim, calm, and legible before it is pretty.
> Follow every value exactly. Do not add decoration that is not specified.

### 1. Design principles

1. **Data legibility beats atmosphere.** Any effect that reduces readability of numbers or labels loses. Glass is for chrome, never behind dense data.
2. **Unseen details compound.** Press feedback, focus rings, aligned digits — users never consciously notice them, and that is the point.
3. **Motion is feedback, not decoration.** This is a tool used dozens of times a day. Animate only to confirm input or prevent jarring change. Never animate anything triggered by keyboard.
4. **Calm.** No animated backgrounds, no gradient meshes in motion, no dot or line grids, no glow that competes with content.

### 2. Color tokens

```css
:root {
  /* accent */
  --accent:       #22d3ee;                      /* cyan — primary actions, active state */
  --accent-2:     #a78bfa;                      /* violet — secondary grouping only */
  --accent-soft:  rgba(34, 211, 238, .12);      /* tinted fills */
  --accent-line:  rgba(34, 211, 238, .40);      /* tinted borders */

  /* surfaces */
  --bg:            #0A1118;                     /* deep blue-teal ink */
  --card:          rgba(255, 255, 255, .03);    /* glass panel */
  --glass-border:  rgba(255, 255, 255, .06);
  --glass-edge:    rgba(255, 255, 255, .10);    /* top edge = light catching the lip */
  --sticky:        #101a22;                     /* SOLID — frozen table columns */
  --border:        rgba(255, 255, 255, .09);
  --border-strong: rgba(255, 255, 255, .16);

  /* text — all AA compliant on --bg */
  --text:  #e8ecf6;   /* 16.05:1 */
  --muted: #98a2b8;   /*  7.41:1 */
  --faint: #7d8798;   /*  5.23:1 — do not go dimmer, AA breaks below this */

  /* status */
  --green:      #34d399;  --green-soft: rgba(52, 211, 153, .12);
  --red:        #fb7185;  --red-soft:   rgba(251, 113, 133, .12);

  --radius: 14px;

  /* motion — built-in CSS curves are too weak */
  --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

  /* elevation */
  --glass:      0 1px 0 rgba(255,255,255,.06) inset, 0 8px 32px rgba(0,0,0,.45);
  --shadow-pop: 0 16px 48px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06);
  --glow:       0 0 20px rgba(34, 211, 238, .28);
  --ring:       0 0 0 3px rgba(34, 211, 238, .22);
}
```

### 3. Background and atmosphere

Glass only works if something sits behind it to blur. Put ambient light on the root:

```css
body {
  background-color: var(--bg);
  background-image:
    radial-gradient(ellipse 80% 50% at 15% -10%, rgba(45, 212, 218, .08), transparent 60%),
    radial-gradient(ellipse 60% 60% at 90% 40%, rgba(56, 130, 246, .05), transparent 65%),
    radial-gradient(ellipse 70% 40% at 50% 110%, rgba(20, 184, 166, .06), transparent 60%);
  background-attachment: fixed;   /* glows never scroll */
  background-repeat: no-repeat;
  position: relative;
}
```

Never exceed those opacities. Place the third glow behind the primary action area.

**Grain** — kills gradient banding on cheap monitors:

```css
body::before {
  content: ""; position: fixed; inset: 0; z-index: 0;
  pointer-events: none; opacity: .025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
}
/* everything interactive sits above the grain */
header, main, .content, footer { position: relative; z-index: 1; }
```

### 4. Glass surface (one shared class — never repeat these values)

```css
.glass {
  background: rgba(255, 255, 255, .03);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-edge);   /* the lip that sells the thickness */
}
```

Apply to: page header, content panels/cards, dropdown menus, sticky action bar.
**Limit blur to ~4 surfaces per screen** — it is the most expensive property here.

**Never glass:** frozen table columns, or any element that scrolling content passes beneath. Those get solid `--sticky`, or the content shows through and becomes unreadable.

### 5. Typography

- Stack: `"Inter", "Segoe UI", -apple-system, Roboto, sans-serif`, with `-webkit-font-smoothing: antialiased`
- Page title 17px/600 · Panel title 13.5px/600 · Body 13.5–14px/400 · Table header 11px/600 uppercase, `letter-spacing: .45px`, color `--faint`
- Negative tracking on headings: `letter-spacing: -.01em`
- **`font-variant-numeric: tabular-nums` on every table, badge and numeric input.** Money and stock figures must align digit to digit.

### 6. Motion rules

| Element | Duration |
| --- | --- |
| Press feedback | 140ms |
| Hover / colour change | 100–140ms |
| Dropdown, popover | 160ms |
| Panel entrance (rare screens only) | 220ms |

- **Everything under 300ms.** No exceptions in UI chrome.
- **Enter/exit → `--ease-out`.** Never `ease-in` — it delays the first frame, exactly when the user is watching.
- **Every pressable element:** `transform: scale(0.97)` on `:active`. Rows use `0.995`.
- **Never animate from `scale(0)`** — start at `scale(0.97)` with `opacity: 0`.
- **Never `transition: all`** — name the properties.
- **Popovers scale from their trigger** (`transform-origin: top center` for a dropdown below an input). Modals stay centred.
- **Gate hover behind `@media (hover: hover) and (pointer: fine)`** — touch devices fire hover on tap and leave states stuck.

```css
button:active, .chip:active { transform: scale(0.97); }
:focus-visible { outline: none; box-shadow: var(--ring); border-radius: 8px; }

@keyframes popIn { from { opacity: 0; transform: scale(0.97) translateY(-2px); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: 80ms !important; }
  button:active { transform: none; }
}
```

### 7. Components

**Buttons** — 10px/20px padding, 9px radius, 13.5px/600.
Primary: `--accent` background, `#04212a` text (dark text on neon, never white), `--glow` shadow. Hover `#67e8f9` with a wider glow. Disabled: `rgba(255,255,255,.09)` fill, `--faint` text, no glow, no press transform.
Ghost: `--accent` text on `--accent-soft`, `--accent-line` border.

**Inputs** — `rgba(0,0,0,.28)` fill (darker than the glass so fields read as recessed), `--border-strong` border, 9px radius. Focus: `--accent-line` border + `--ring`, fill deepens to `.4`. Add `color-scheme: dark` so native date pickers and scrollbars render dark.

**Pills (single select)** — 999px radius, `rgba(0,0,0,.22)` fill, `--muted` text. Active: `--accent-soft` fill, `--accent` border and text, `--glow`.

**Segmented control** — `rgba(0,0,0,.3)` track, 3px padding, 9px radius. Active segment: `--accent-soft` + `0 0 0 1px var(--accent-line)` + soft glow.

**Toggle chips (multi-select)** — bordered box with a native checkbox (`accent-color: var(--accent)`). On: `--accent-soft` fill, `--accent-line` border, `--glow`.

**List rows** — 9px/12px padding, `rgba(255,255,255,.05)` divider. Selected: `--accent-soft` + `inset 2px 0 0 var(--accent)` left bar. Partial/indeterminate: violet equivalent using `--accent-2`.

**Dropdown** — `rgba(13,22,30,.96)` (near-opaque; results must stay readable), 24px blur, `--shadow-pop`, `transform-origin: top center`, `popIn` 160ms.

**Data table**
- `border-collapse: collapse`, `white-space: nowrap`, wrapper with `overflow-x: auto`
- Freeze identity columns with `position: sticky` + `left` offsets + **solid** `--sticky` background; last frozen column gets `box-shadow: 8px 0 12px -8px rgba(0,0,0,.9)` as the depth cue
- `thead` z-index above `tbody` sticky cells
- Numeric cells right-aligned; key figures in `--accent` with `text-shadow: 0 0 12px rgba(34,211,238,.35)`; zero/negative in `--red`
- Parent grid columns need `minmax(0, 1fr)` or the table stretches the page instead of scrolling

**Sticky action bar** — fixed bottom, `rgba(10,17,24,.72)` + 24px blur, top border `--glass-edge`. Left side states what is about to happen in plain words ("Sending 412 units · 6 products · to 13 stores"); primary action right. Keeps the commit action reachable regardless of scroll.

**Status messages** — tinted fill + matching 22% border: success `--green`/`--green-soft`, error `--red`/`--red-soft`. 9px radius.

**Scrollbars**

```css
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.12); border-radius: 8px;
  border: 2px solid transparent; background-clip: content-box;
}
```

### 8. Layout

- Content max-width 1900px, 24px gutters
- Sidebar + content: `grid-template-columns: 340px minmax(0, 1fr)`, 20px gap, collapse to one column under 900px
- Panel padding: 13px/18px header, 16px/18px body
- Numbered step badges (21px circle, `--accent-soft` fill, `--accent-line` border) when a screen is a sequence

### 9. UX patterns

- **Progressive disclosure:** number the steps and disable the commit action until every prerequisite is satisfied.
- **State the consequence:** the action bar spells out exactly what will happen, in units the user thinks in.
- **Never fail silently:** show which items were skipped and why, in a scrollable table with a reason column — not a bare count.
- **Empty states explain the next move:** "No products added yet — search above to add."
- **Long jobs report themselves:** show what was included, what was skipped, what failed, and how to retry.

### 10. Do not

- Add animated gradients, floating blobs, dot grids or line grids
- Exceed the stated glow opacities, or add glow to more than the active element
- Use glass behind scrolling data
- Use white text on the neon accent — use the dark ink `#04212a`
- Let `--faint` go dimmer than `#7d8798` (breaks AA)
- Use `transition: all`, `ease-in`, or durations over 300ms on chrome
- Animate anything triggered by a keyboard shortcut

---

## Adapting to a light theme

Keep every motion rule, the token structure, spacing and component anatomy. Swap only:
base `#f6f7f9`, panels solid white with `--shadow-sm`, borders `#e6e8ec` / `#d6d9e0`, text `#14161a` / `#6b7280` / `#9ca3af`, accent `#4f46e5` with white text, and drop the glows, grain and glass blur entirely — frosted glass over a light background reads as dirty grey.

---

*Motion and polish rules derive from Emil Kowalski's design engineering principles (github.com/emilkowalski/skills, MIT).*
