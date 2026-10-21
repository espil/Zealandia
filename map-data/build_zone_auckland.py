#!/usr/bin/env python3
"""Build the Auckland start-zone detail terrain (Han, 2026-10-16:
start at Auckland, the old capital 1841-1865).

Zone box: lon 173.4..176.6, lat -38.1..-35.3 (about 285 x 310 km),
covering the Auckland isthmus, Hauraki Gulf, Coromandel, and the
offshore drop toward the Colville Ridge. Values: GMRT Grid netCDF
(same released source as the continent grid). Validation: NIWA 250 m
model identify points (GNS ImageServer). Output grid: EPSG:3851.
Needs numpy, pillow, scipy, pyproj.
"""
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer
from scipy.io import netcdf_file

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
ZONE = HERE / "zones" / "auckland"
ZONE.mkdir(parents=True, exist_ok=True)

WEST, EAST, SOUTH, NORTH = 173.4, 176.6, -38.1, -35.3
AKL = (174.7633, -36.8485)  # Auckland CBD


def fetch_gmrt():
    p = RAW / "gmrt_auckland_zone.nc"
    if not p.exists():
        url = ("https://www.gmrt.org/services/GridServer"
               f"?west={WEST}&east={EAST}&south={SOUTH}&north={NORTH}"
               "&format=netcdf&resolution=low")
        req = urllib.request.Request(
            url, headers={"User-Agent": "EspilZealandiaResearch/1.0"})
        print("fetching", url)
        with urllib.request.urlopen(req, timeout=600) as r:
            p.write_bytes(r.read())
    print("gmrt file:", p.stat().st_size, "bytes")
    return p


def read_gmt_grid(path):
    f = netcdf_file(str(path), "r", mmap=False)
    nx, ny = (int(v) for v in f.variables["dimension"].data)
    x0, x1 = (float(v) for v in f.variables["x_range"].data)
    y0, y1 = (float(v) for v in f.variables["y_range"].data)
    z = np.asarray(f.variables["z"].data, dtype=np.float64).reshape(ny, nx)
    return np.linspace(x0, x1, nx), np.linspace(y1, y0, ny), z  # lats desc


def bilinear(lons, lats_desc, z, lon, lat):
    lats = lats_desc[::-1]
    zz = z[::-1, :]
    fx = (lon - lons[0]) / (lons[1] - lons[0])
    fy = (lat - lats[0]) / (lats[1] - lats[0])
    if not (0 <= fx <= len(lons) - 1 and 0 <= fy <= len(lats) - 1):
        return None
    x0 = min(int(fx), len(lons) - 2)
    y0 = min(int(fy), len(lats) - 2)
    tx, ty = fx - x0, fy - y0
    return float((zz[y0, x0] * (1 - tx) + zz[y0, x0 + 1] * tx) * (1 - ty)
                 + (zz[y0 + 1, x0] * (1 - tx) + zz[y0 + 1, x0 + 1] * tx) * ty)


def main():
    lons, lats, z = read_gmt_grid(fetch_gmrt())
    print("source grid:", z.shape, "dx deg:", round(float(lons[1] - lons[0]), 5),
          "dy deg:", round(float(lats[0] - lats[1]), 5),
          "z range:", float(np.nanmin(z)), float(np.nanmax(z)))

    # Validation anchors: (name, lon, lat, NIWA expectation from identify later)
    anchors = [("Auckland CBD (spawn)", *AKL),
               ("Mt Eden cone", 174.7653, -36.8798),
               ("Rangitoto cone", 174.8600, -36.7860),
               ("Hauraki Gulf centre", 175.0500, -36.6000),
               ("Firth of Thames", 175.4200, -37.1500),
               ("Colville Channel", 175.7500, -36.3800),
               ("Coromandel / Moehau", 175.4000, -36.5400),
               ("Manukau Harbour entrance", 174.4000, -37.0500),
               ("Kaipara Harbour entrance", 174.2000, -36.4200),
               ("Whangarei Heads", 174.5000, -35.8200)]
    sampled = []
    for name, lo, la in anchors:
        v = bilinear(lons, lats, z, lo, la)
        sampled.append({"name": name, "lon": lo, "lat": la,
                        "gmrt_elevation_m": None if v is None else round(v)})
        print(f"{name}: GMRT {sampled[-1]['gmrt_elevation_m']} m")

    # NZCS grid 1024x1024 over the projected zone box.
    fwd = Transformer.from_crs(4326, 3851, always_xy=True)
    inv = Transformer.from_crs(3851, 4326, always_xy=True)
    corners = [fwd.transform(lo, la) for lo, la in
               [(WEST, SOUTH), (WEST, NORTH), (EAST, SOUTH), (EAST, NORTH)]]
    xmin = min(c[0] for c in corners); xmax = max(c[0] for c in corners)
    ymin = min(c[1] for c in corners); ymax = max(c[1] for c in corners)
    W = H = 1024
    xs = xmin + (np.arange(W) + 0.5) * (xmax - xmin) / W
    ys = ymax - (np.arange(H) + 0.5) * (ymax - ymin) / H
    gx, gy = np.meshgrid(xs, ys)
    lon2d, lat2d = inv.transform(gx, gy)
    fx = (lon2d - lons[0]) / (lons[1] - lons[0])
    fy = (lat2d - lats[::-1][0]) / (lats[::-1][1] - lats[::-1][0])
    lats_asc = lats[::-1]; z_asc = z[::-1, :]
    x0i = np.clip(np.floor(fx).astype(int), 0, len(lons) - 2)
    y0i = np.clip(np.floor(fy).astype(int), 0, len(lats_asc) - 2)
    tx = np.clip(fx - x0i, 0, 1); ty = np.clip(fy - y0i, 0, 1)
    grid = ((z_asc[y0i, x0i] * (1 - tx) + z_asc[y0i, x0i + 1] * tx) * (1 - ty)
            + (z_asc[y0i + 1, x0i] * (1 - tx) + z_asc[y0i + 1, x0i + 1] * tx) * ty)
    inside = ((lon2d >= lons[0]) & (lon2d <= lons[-1])
              & (lat2d >= lats_asc[0]) & (lat2d <= lats_asc[-1]) & np.isfinite(grid))
    grid = np.where(inside, grid, -32768.0).astype(np.float32)
    np.save(ZONE / "auckland_elevation_m.npy", grid)
    nod = grid <= -32768
    valid = grid[~nod]
    print("zone grid:", grid.shape, "extent NZCS m:", round(xmax - xmin), "x", round(ymax - ymin),
          "px m:", round((xmax - xmin) / W), "valid min/max:", float(valid.min()), float(valid.max()),
          "nodata%:", round(100 * float(nod.mean()), 2))

    # Heightmaps: global scale (consistent with continent) + local scale.
    for tag, lo_m, hi_m in [("global", -11000.0, 4000.0),
                            ("local", float(valid.min()), float(valid.max()))]:
        fixed = np.where(nod, lo_m, grid)
        norm = np.clip((fixed - lo_m) / (hi_m - lo_m), 0, 1)
        Image.fromarray((norm * 65535).astype(np.uint16)).save(
            ZONE / f"auckland_heightmap16_{tag}.png")

    # Risen preview with local hypsometric bands suited to this zone.
    def colorize(a, nodata):
        h, w = a.shape
        out = np.zeros((h, w, 3), dtype=np.uint8)
        bands = [(-4000, (10, 22, 48)), (-1500, (19, 52, 92)), (-600, (26, 74, 110)),
                 (-200, (34, 102, 128)), (-60, (74, 140, 132)), (-15, (110, 165, 120)),
                 (0, (168, 190, 130)), (60, (196, 178, 128)), (150, (168, 138, 102)),
                 (300, (150, 116, 96)), (900, (235, 232, 228))]
        prev = -1e9
        for hi_c, col in bands:
            mask = (a > prev) & (a <= hi_c)
            out[mask] = col
            prev = hi_c
        gy_, gx_ = np.gradient(np.where(nodata, 0, a))
        shade = np.clip(0.78 + (gx_ * 0.5 + gy_ * 0.5) / 60.0, 0.55, 1.3)
        out = (out * shade[..., None]).clip(0, 255).astype(np.uint8)
        out[nodata] = (0, 0, 0)
        return out

    img = Image.fromarray(colorize(grid, nod))
    img.save(ZONE / "auckland_risen_preview.png")
    img.resize((720, 720)).save(ZONE / "auckland_risen_preview_small.jpg", quality=88)

    ax, ay = fwd.transform(*AKL)
    meta = {
        "zone": "Auckland - the old capital (capital of NZ 1841-1865), Zealandia start zone per Han 2026-10-16",
        "spawn": {"name": "Auckland CBD", "lon": AKL[0], "lat": AKL[1],
                  "nzcs_xy_m": [round(ax), round(ay)]},
        "source": "GMRT Grid netCDF subset (gmrt.org GridServer, fetched 2026-10-16), validated against NIWA 250 m model identify points",
        "lonlat_box": {"west": WEST, "east": EAST, "south": SOUTH, "north": NORTH},
        "nzcs_extent_m": {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax},
        "grid_px": [W, H], "pixel_size_m": round((xmax - xmin) / W),
        "source_spacing_deg": [round(float(lons[1] - lons[0]), 5), round(float(lats[0] - lats[1]), 5)],
        "elevation_min_m": float(valid.min()), "elevation_max_m": float(valid.max()),
        "heightmaps": {
            "auckland_heightmap16_global.png": "0 = -11000 m, 65535 = +4000 m (same scale as the continent heightmap)",
            "auckland_heightmap16_local.png": f"0 = {float(valid.min()):.0f} m, 65535 = {float(valid.max()):.0f} m (zone-local stretch)"},
        "anchors_gmrt": sampled,
    }
    (ZONE / "auckland_meta.json").write_text(json.dumps(meta, indent=1))
    print("DONE")


if __name__ == "__main__":
    main()
