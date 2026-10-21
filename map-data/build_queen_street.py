#!/usr/bin/env python3
"""Queen Street corridor package - the first playable area.

Han, 2026-10-16: instead of all regions, use a small area, such as
the hottest street in Auckland. That street is Queen Street: the
CBD's major commercial thoroughfare (the 'Golden Mile'), 1.7 km
from Customs Street at the waterfront south to Karangahape Road.

Fetches OSM data (Overpass) for a corridor around Queen Street,
clips terrain from the Auckland zone grid, draws the street onto a
preview, and writes a corridor summary. Needs numpy, pillow, pyproj.
"""
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer

HERE = Path(__file__).resolve().parent
ZONE = HERE / "zones" / "auckland"
OUT = ZONE / "queen-street"
OUT.mkdir(parents=True, exist_ok=True)

# Corridor bbox (lon/lat): about 1.8 km x 2.7 km around Queen Street.
SOUTH, WEST, NORTH, EAST = -36.8620, 174.7550, -36.8380, 174.7750

OVERPASS_Q = f"""
[out:json][timeout:120];
(
  way["highway"]({SOUTH},{WEST},{NORTH},{EAST});
  way["building"]({SOUTH},{WEST},{NORTH},{EAST});
  relation["building"]({SOUTH},{WEST},{NORTH},{EAST});
  node["name"]["tourism"]({SOUTH},{WEST},{NORTH},{EAST});
  node["name"]["amenity"~"theatre|cinema|townhall|marketplace"]({SOUTH},{WEST},{NORTH},{EAST});
);
out body;
>;
out skel qt;
"""


def fetch_osm():
    p = OUT / "osm_corridor.json"
    if not p.exists():
        req = urllib.request.Request(
            "https://overpass-api.de/api/interpreter",
            data=("data=" + urllib.request.quote(OVERPASS_Q)).encode(),
            headers={"User-Agent": "EspilZealandiaResearch/1.0",
                     "Content-Type": "application/x-www-form-urlencoded"})
        print("fetching Overpass corridor data...")
        with urllib.request.urlopen(req, timeout=300) as r:
            p.write_bytes(r.read())
    print("osm file:", p.stat().st_size, "bytes")
    return json.loads(p.read_text())


def main():
    data = fetch_osm()
    elements = data["elements"]
    nodes = {e["id"]: e for e in elements if e["type"] == "node"}
    ways = [e for e in elements if e["type"] == "way"]
    rels = [e for e in elements if e["type"] == "relation"]

    buildings = [w for w in ways if "building" in w.get("tags", {})]
    with_height = [w for w in buildings
                   if "height" in w["tags"] or "building:levels" in w["tags"]]
    roads = [w for w in ways if "highway" in w.get("tags", {})]
    queen = [w for w in roads if w.get("tags", {}).get("name") == "Queen Street"]
    named = {}
    for w in ways:
        nm = w.get("tags", {}).get("name")
        if nm:
            named.setdefault(nm, 0)
            named[nm] += 1
    poi_nodes = [e for e in elements if e["type"] == "node" and "name" in e.get("tags", {})]
    print(f"buildings: {len(buildings)} (+{len(rels)} relations), with height/levels: {len(with_height)}")
    print(f"road ways: {len(roads)}, Queen Street ways: {len(queen)}, named POI nodes: {len(poi_nodes)}")

    # Queen Street length from way geometry.
    def way_pts(w):
        return [(nodes[n]["lon"], nodes[n]["lat"]) for n in w["nodes"] if n in nodes]
    total_m = 0.0
    queen_lines = []
    for w in queen:
        pts = way_pts(w)
        queen_lines.append(pts)
        for (lo1, la1), (lo2, la2) in zip(pts, pts[1:]):
            dx = (lo2 - lo1) * 111320 * math.cos(math.radians((la1 + la2) / 2))
            dy = (la2 - la1) * 110540
            total_m += math.hypot(dx, dy)
    print(f"Queen Street total mapped length in corridor: {total_m:.0f} m")

    landmarks_wanted = ["Sky Tower", "Aotea Square", "Auckland Town Hall",
                        "Civic Theatre", "Commercial Bay", "Auckland Ferry Terminal",
                        "Waitematā Station", "Britomart", "Albert Park",
                        "Auckland Art Gallery Toi o Tāmaki", "St James Theatre",
                        "The Civic", "Aotea Centre", "Event Cinemas"]
    found = {}
    for e in elements:
        nm = e.get("tags", {}).get("name")
        if nm and any(w.lower() in nm.lower() for w in landmarks_wanted):
            found[nm] = e.get("tags", {}).get("tourism") or e.get("tags", {}).get("amenity") or e["type"]
    print("landmarks found in OSM:", json.dumps(found, indent=1, ensure_ascii=False))

    # --- Terrain surface from the Auckland zone grid ---
    # The zone grid is 286 m/px, so the corridor is only a few native
    # cells. The corridor surface is bilinearly resampled from it: the
    # Queen Street gully is a broad feature, so the valley shape and
    # the street gradient stay true, but this is a SMOOTH surface, not
    # street-level detail. Documented upgrade: LINZ DEM (8 m / LiDAR).
    meta = json.loads((ZONE / "auckland_meta.json").read_text())
    ext = meta["nzcs_extent_m"]
    grid = np.load(ZONE / "auckland_elevation_m.npy")
    H, W = grid.shape
    fwd = Transformer.from_crs(4326, 3851, always_xy=True)
    cs = [fwd.transform(lo, la) for lo, la in
          [(WEST, SOUTH), (WEST, NORTH), (EAST, SOUTH), (EAST, NORTH)]]
    cx0 = min(c[0] for c in cs); cx1 = max(c[0] for c in cs)
    cy0 = min(c[1] for c in cs); cy1 = max(c[1] for c in cs)

    def zone_sample_m(x, y):
        fx = (x - ext["xmin"]) / (ext["xmax"] - ext["xmin"]) * (W - 1)
        fy = (ext["ymax"] - y) / (ext["ymax"] - ext["ymin"]) * (H - 1)
        if not (0 <= fx <= W - 1 and 0 <= fy <= H - 1):
            return -32768.0
        x0 = min(int(fx), W - 2); y0 = min(int(fy), H - 2)
        tx, ty = fx - x0, fy - y0
        return float((grid[y0, x0] * (1 - tx) + grid[y0, x0 + 1] * tx) * (1 - ty)
                     + (grid[y0 + 1, x0] * (1 - tx) + grid[y0 + 1, x0 + 1] * tx) * ty)

    STEP = 25  # metres per output pixel
    ow = int((cx1 - cx0) / STEP); oh = int((cy1 - cy0) / STEP)
    xs = cx0 + (np.arange(ow) + 0.5) * STEP
    ys = cy1 - (np.arange(oh) + 0.5) * STEP
    crop = np.array([[zone_sample_m(x, y) for x in xs] for y in ys], dtype=np.float32)
    np.save(OUT / "queen_street_terrain_m.npy", crop)
    nod = crop <= -32768
    valid = crop[~nod]
    print(f"terrain surface: {crop.shape} at {STEP} m/px (resampled from the 286 m zone grid), "
          f"elev {float(valid.min()):.0f}..{float(valid.max()):.0f} m, nodata {100*float(nod.mean()):.2f}%")

    # Elevation profile along Queen Street (nodes sorted north->south).
    all_pts = sorted({p for line in queen_lines for p in line},
                     key=lambda p: -p[1])
    profile = []
    dist = 0.0
    for i, (lo, la) in enumerate(all_pts):
        if i:
            dx = (lo - all_pts[i - 1][0]) * 111320 * math.cos(math.radians(la))
            dy = (la - all_pts[i - 1][1]) * 110540
            dist += math.hypot(dx, dy)
        x, y = fwd.transform(lo, la)
        profile.append({"lon": lo, "lat": la, "dist_m": round(dist),
                        "elev_m": round(zone_sample_m(x, y))})
    (OUT / "queen_street_profile.json").write_text(json.dumps(profile, indent=1))
    print(f"street profile: {len(profile)} pts, 0 m elev {profile[0]['elev_m']} m -> "
          f"{profile[-1]['dist_m']} m elev {profile[-1]['elev_m']} m")

    # Preview: hypsometric crop + Queen Street drawn in bright yellow.
    def colorize(a, nodata):
        h, w = a.shape
        out = np.zeros((h, w, 3), dtype=np.uint8)
        bands = [(-60, (16, 44, 84)), (-15, (40, 96, 120)), (0, (96, 150, 110)),
                 (15, (150, 178, 120)), (35, (188, 175, 128)), (60, (170, 140, 104)),
                 (100, (150, 118, 96)), (250, (232, 228, 222))]
        prev = -1e9
        for hi_c, col in bands:
            mask = (a > prev) & (a <= hi_c)
            out[mask] = col
            prev = hi_c
        gy_, gx_ = np.gradient(np.where(nodata, 0, a))
        shade = np.clip(0.8 + (gx_ * 0.4 + gy_ * 0.4) / 25.0, 0.6, 1.25)
        out = (out * shade[..., None]).clip(0, 255).astype(np.uint8)
        out[nodata] = (0, 0, 0)
        return out

    base = Image.fromarray(colorize(crop, nod)).resize(
        (540, int(540 * crop.shape[0] / crop.shape[1])), Image.BILINEAR)
    draw = ImageDraw.Draw(base)
    def to_px(lon, lat):
        x, y = fwd.transform(lon, lat)
        return ((x - cx0) / (cx1 - cx0) * base.width,
                (cy1 - y) / (cy1 - cy0) * base.height)
    for pts in queen_lines:
        draw.line([to_px(lo, la) for lo, la in pts], fill=(255, 214, 64), width=5)
    # Entry (waterfront, north end) and hub (Aotea Square) markers.
    for lon, lat, col in [(174.7669, -36.8433, (255, 90, 90)),
                          (174.7635, -36.8523, (120, 220, 255))]:
        x, y = to_px(lon, lat)
        draw.ellipse([x - 9, y - 9, x + 9, y + 9], fill=col, outline=(255, 255, 255), width=2)
    base.save(OUT / "queen_street_preview.jpg", quality=90)
    print("preview saved:", base.size)

    summary = {
        "area": "Queen Street corridor, Auckland CBD - first playable area (Han, 2026-10-16: small area, the hottest street)",
        "street": {"name": "Queen Street", "facts": "Major commercial thoroughfare of Auckland CBD, the 'Golden Mile'; 1.7 km, Customs Street (waterfront) to Karangahape Road; established 1840s",
                   "mapped_length_in_corridor_m": round(total_m)},
        "hidden_feature": "Waihorotiu Stream ('Queen Street River') ran down the Queen Street gully to Waitemata Harbour; now channelled in brick sewers under Queen Street for about 150 years - a factual under-street route for the dungeon layer",
        "corridor_bbox_lonlat": {"west": WEST, "east": EAST, "south": SOUTH, "north": NORTH},
        "osm": {"buildings": len(buildings), "building_relations": len(rels),
                "buildings_with_height_or_levels": len(with_height),
                "road_ways": len(roads), "queen_street_ways": len(queen),
                "named_poi_nodes": len(poi_nodes), "landmarks_found": found},
        "terrain": {"surface_px": [int(crop.shape[1]), int(crop.shape[0])],
                    "pixel_m": 25,
                    "note": "Bilinearly resampled from the 286 m/px Auckland zone grid: a smooth valley surface with a true street gradient (see queen_street_profile.json), not street-level detail. Upgrade path: LINZ DEM 8 m / Auckland LiDAR DEM.",
                    "elevation_min_m": float(valid.min()), "elevation_max_m": float(valid.max()),
                    "street_profile_points": len(profile)},
        "game_points": {
            "entry_waterfront": {"lon": 174.7669, "lat": -36.8433, "note": "North end at Customs Street / Te Komititanga, by Waitemata Station and Commercial Bay - descent landing"},
            "hub_aotea_square": {"lon": 174.7635, "lat": -36.8523, "note": "Mid-street square by the Town Hall and Aotea Centre - natural player hub"},
            "south_gate_karangahape": {"lon": 174.7622, "lat": -36.8573, "note": "South end at the Karangahape Road ridge - exit toward K Road when the world expands"}},
    }
    (OUT / "corridor_summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    print("DONE")


if __name__ == "__main__":
    main()
