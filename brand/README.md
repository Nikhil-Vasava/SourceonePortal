# Source One Ventures — brand assets

## Files

```
brand/
├── svg/                        flat vector (primary set)
│   ├── logo-mark.svg           globe mark only
│   ├── logo-primary.svg        stacked lockup
│   └── logo-horizontal.svg     horizontal lockup
├── 3d/
│   ├── logo-mark-3d.svg        3D-styled mark (gloss, shading, drop shadow)
│   ├── logo-primary-3d.svg     3D-styled stacked lockup
│   └── logo-3d-interactive.html  real-time WebGL globe — drag to rotate, exports PNG
└── png/                        transparent PNG exports, 64–2048px
```

Also copied into `public/`: `favicon.ico`, `logo-mark.svg`, `logo-horizontal.svg`, `logo-512.png`.

## Colors

| Role | Hex | Use |
| --- | --- | --- |
| Navy | `#12315a` | wordmark, globe rim, body text |
| Ocean blue | `#cfe3f5` | globe fill |
| Green | `#2e7d4f` | inbound arrow, "VENTURES", accents |
| Land green | `#2f6b45` | continents |
| Kraft brown | `#c8944b` | outbound arrow, secondary accent |
| Deep navy | `#0f3961` | 3D shading, shadows |

## Meaning

Green arrow = recovered material coming in. Kraft-brown arrow = processed goods going out. The two form a closed loop around the globe — circular trade, worldwide.

## Usage rules

- Minimum size for the full lockup: 120px wide. Below that use `logo-mark.svg`.
- Clear space around the logo: at least the radius of the globe on all sides.
- Do not recolor the arrows, rotate the mark, or stretch either lockup.
- On dark backgrounds use the flat SVGs as-is (the globe is a light disc) or reverse the wordmark to `#d3e3f5`.
- Prefer SVG everywhere. Use PNG only where vectors aren't supported.

## Regenerating PNGs

```bash
pip install cairosvg
python -c "import cairosvg; cairosvg.svg2png(url='brand/svg/logo-mark.svg', write_to='out.png', output_width=1024)"
```
