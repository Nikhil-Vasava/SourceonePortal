"""
Redraws the globe's land masses as Australia and New Zealand.

The mark is an orthographic globe of radius 60. Coastlines are given as real
lon/lat and projected the same way a sphere actually projects, so the shapes sit
correctly against the existing graticule rather than being drawn by hand.

    x =  R·cos(lat)·sin(Δlon)
    y = -R·(cos(lat0)·sin(lat) − sin(lat0)·cos(lat)·cos(Δlon))     (SVG y is down)

Run:  python3 tools/redraw-globe.py
"""
import math, pathlib, re

# View centre — chosen so Australia sits centre-left and NZ clears the limb.
LON0, LAT0 = 141.0, -26.0
R = 60.0

# Simplified coastlines (lon, lat). Stylised for a logo, not a chart.
AUSTRALIA = [
    (142.5,-10.7),(141.6,-12.4),(141.0,-15.0),(140.8,-17.4),(139.4,-17.4),
    (137.9,-16.4),(136.7,-15.9),(136.2,-13.2),(134.4,-12.0),(132.6,-11.4),
    (131.2,-12.3),(130.0,-12.4),(129.6,-14.8),(128.0,-15.3),(126.0,-14.0),
    (124.4,-16.3),(122.2,-18.1),(121.0,-19.6),(119.0,-20.2),(116.5,-20.7),
    (114.9,-21.5),(113.7,-22.5),(113.4,-24.5),(114.2,-26.4),(114.9,-29.4),
    (115.0,-31.6),(115.7,-34.3),(117.5,-35.1),(120.0,-33.9),(123.5,-33.9),
    (126.5,-32.3),(129.5,-31.6),(132.0,-32.0),(134.2,-32.6),(135.9,-34.8),
    (137.0,-35.6),(137.8,-35.0),(138.5,-35.6),(139.8,-37.4),(141.6,-38.4),
    (143.5,-38.8),(145.0,-38.4),(146.4,-39.1),(148.4,-37.8),(150.0,-37.5),
    (150.9,-35.2),(152.5,-32.7),(153.6,-28.9),(153.1,-25.9),(151.4,-24.1),
    (149.5,-22.4),(148.0,-20.1),(146.2,-18.5),(145.5,-16.9),(144.5,-14.5),
    (143.5,-13.0),(142.9,-11.3),
]
TASMANIA = [
    (144.7,-40.7),(146.5,-41.0),(148.3,-40.9),(148.3,-42.5),(147.0,-43.5),
    (145.5,-43.4),(145.0,-42.2),(144.6,-41.3),
]
NZ_NORTH = [
    (172.7,-34.4),(173.9,-35.0),(174.6,-35.9),(175.5,-36.8),(176.2,-37.5),
    (177.2,-37.9),(178.5,-37.6),(178.3,-38.7),(177.2,-39.3),(176.9,-40.2),
    (176.0,-41.1),(175.3,-41.6),(174.9,-41.2),(175.0,-40.3),(174.6,-39.4),
    (173.9,-39.1),(174.4,-38.4),(174.9,-37.6),(174.4,-36.6),(173.2,-35.2),
]
NZ_SOUTH = [
    (172.6,-40.5),(173.9,-40.9),(174.3,-41.7),(173.6,-42.6),(172.7,-43.4),
    (171.6,-44.0),(171.2,-44.9),(170.7,-45.9),(169.3,-46.6),(167.6,-46.6),
    (166.5,-45.9),(167.5,-44.6),(169.0,-43.6),(170.6,-42.9),(171.6,-42.0),
]

def project(lon, lat):
    dl = math.radians(lon - LON0)
    la, la0 = math.radians(lat), math.radians(LAT0)
    x = R * math.cos(la) * math.sin(dl)
    y = -R * (math.cos(la0) * math.sin(la) - math.sin(la0) * math.cos(la) * math.cos(dl))
    return x, y

def to_path(pts, scale, dx, dy):
    """pts are already-projected (x, y); this only scales and offsets them."""
    q = [(x * scale + dx, y * scale + dy) for x, y in pts]
    return (f"M {q[0][0]:.1f} {q[0][1]:.1f} " +
            " ".join(f"L {x:.1f} {y:.1f}" for x, y in q[1:]) + " Z")

# New Zealand at true scale is a speck — it disappears entirely at the 36px the
# sidebar renders. Since the point of this globe is to show where the business
# operates, NZ is enlarged about its own centre so it survives small sizes.
# Deliberately not to scale: this is a logo, not a chart.
NZ_ENLARGE = 1.85

def enlarge(coords, factor):
    pts = [project(lon, lat) for lon, lat in coords]
    cx = sum(x for x, _ in pts) / len(pts)
    cy = sum(y for _, y in pts) / len(pts)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in pts]

groups = [AUSTRALIA, TASMANIA, NZ_NORTH, NZ_SOUTH]

# Fit the land inside the disc with a margin, and centre what we've drawn.
projected = [
    [project(lon, lat) for lon, lat in AUSTRALIA],
    [project(lon, lat) for lon, lat in TASMANIA],
    enlarge(NZ_NORTH, NZ_ENLARGE),
    enlarge(NZ_SOUTH, NZ_ENLARGE),
]

allpts = [p for g in projected for p in g]
xs = [p[0] for p in allpts]; ys = [p[1] for p in allpts]
w, h = max(xs) - min(xs), max(ys) - min(ys)
scale = (2 * 43.0) / max(w, h)          # 43 = usable radius; leaves ocean visible
dx = -(max(xs) + min(xs)) / 2 * scale
dy = -(max(ys) + min(ys)) / 2 * scale

paths = "\n".join(
    f'      <path d="{to_path(g, scale, dx, dy)}"/>' for g in projected
)
land_block = f'    <g id="land" fill="LANDFILL">\n{paths}\n    </g>'

# Rewrite the land group in every source SVG, preserving each file's fill colour.
for f in ["brand/svg/logo-mark.svg", "brand/svg/logo-horizontal.svg", "brand/svg/logo-primary.svg"]:
    p = pathlib.Path(f)
    s = p.read_text()
    m = re.search(r'    <g id="land" fill="(#[0-9a-fA-F]{6})">.*?</g>', s, re.S)
    if not m:
        print(f"  land group not found in {f}"); continue
    s = s[:m.start()] + land_block.replace("LANDFILL", m.group(1)) + s[m.end():]
    p.write_text(s)
    print(f"  redrew land in {f}")

print(f"\nprojection centre {LON0}E {abs(LAT0)}S · scale {scale:.3f}")
print(f"land extent: {w*scale:.1f} x {h*scale:.1f} inside a {R*2:.0f} disc")
