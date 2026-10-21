#!/usr/bin/env python3
"""Build the Zealandia game terrain grid from released map data.

Sources (all public releases, see README.md in this folder):
- GMRT GridServer (Marine Geoscience Data System, Lamont-Doherty Earth
  Observatory) netCDF subsets - the elevation values used here. GMRT is a
  synthesis of multibeam sonar, GEBCO, and contributed regional data.
- NIWA NZ Region Bathymetry 250 m model via GNS Science ImageServer -
  used as the validation oracle through its identify endpoint (its bulk
  TIFF export drops tiles server-side; see README).
- Output grid is EPSG:3851 (NZCS2000), the projection of the official
  GNS Te Riu-a-Maui / Zealandia maps.

Run with a python that has numpy, pillow, scipy, pyproj.
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
OUT = HERE / "processed"
RAW.mkdir(exist_ok=True)
OUT.mkdir(exist_ok=True)

CHUNKS = [
    ("gmrt_zealandia_west.nc", 155.0, 180.0),
    ("gmrt_zealandia_east.nc", -180.0, -168.0),
]
SOUTH, NORTH = -58.0, -14.0


def fetch_chunks():
    paths = []
    for name, west, east in CHUNKS:
        p = RAW / name
        if not p.exists():
            url = (
                "https://www.gmrt.org/services/GridServer"
                f"?west={west}&east={east}&south={SOUTH}&north={NORTH}"
                "&format=netcdf&resolution=low"
            )
            print("fetching", url)
            with urllib.request.urlopen(url, timeout=600) as r:
                p.write_bytes(r.read())
        print(name, p.stat().st_size, "bytes")
        paths.append(p)
    return paths


def read_gmt_grid(path):
    """Return (lons, lats_desc, z2d) from a GMT-format netCDF grid.

    dimension = [nx, ny]; z is row-major starting at (xmin, ymax).
    """
    f = netcdf_file(str(path), "r", mmap=False)
    nx, ny = (int(v) for v in f.variables["dimension"].data)
    x0, x1 = (float(v) for v in f.variables["x_range"].data)
    y0, y1 = (float(v) for v in f.variables["y_range"].data)
    z = np.asarray(f.variables["z"].data, dtype=np.float64).reshape(ny, nx)
    lons = np.linspace(x0, x1, nx)
    lats = np.linspace(y1, y0, ny)  # descending, matches z row order
    return lons, lats, z


def main():
    paths = fetch_chunks()
    grids = [read_gmt_grid(p) for p in paths]
    for (lons, lats, z), (name, _, _) in zip(grids, CHUNKS):
        print(name, "grid", z.shape, "lon", lons.min(), lons.max(),
              "lat", lats.min(), lats.max(),
              "z nanmin/max:", np.nanmin(z), np.nanmax(z),
              "nan%:", round(100 * float(np.isnan(z).mean()), 3))

    # Merge chunks on a common lonlat lattice (chunk B longitudes +360).
    lat_ref = grids[0][1]
    merged_lon_parts, merged_z_parts = [], []
    for lons, lats, z in grids:
        assert np.allclose(lats, lat_ref), "chunk latitude lattices differ"
        merged_lon_parts.append(np.where(lons < 0, lons + 360.0, lons))
        merged_z_parts.append(z)
    order = np.argsort([p.min() for p in merged_lon_parts])
    mlons = np.concatenate([merged_lon_parts[i] for i in order])
    mz = np.concatenate([merged_z_parts[i] for i in order], axis=1)
    print("merged lonlat grid:", mz.shape, "lon", mlons.min(), mlons.max())

    # Sample onto the EPSG:3851 game grid (2048 x 2117, full NIWA extent).
    XMIN, YMIN, XMAX, YMAX = (
        1315947.87728211, 4997698.101281367, 5098697.87728211, 8908448.101281367)
    W, H = 2048, 2117
    xs = XMIN + (np.arange(W) + 0.5) * (XMAX - XMIN) / W
    ys = YMAX - (np.arange(H) + 0.5) * (YMAX - YMIN) / H
    gx, gy = np.meshgrid(xs, ys)
    inv = Transformer.from_crs(3851, 4326, always_xy=True)
    lon2d, lat2d = inv.transform(gx, gy)
    lon2d = np.where(lon2d < 0, lon2d + 360.0, lon2d)

    # Bilinear sample of the merged grid (lats descending -> flip to ascending).
    lats_asc = lat_ref[::-1]
    z_asc = mz[::-1, :]
    fx = (lon2d - mlons[0]) / (mlons[1] - mlons[0])
    fy = (lat2d - lats_asc[0]) / (lats_asc[1] - lats_asc[0])
    x0i = np.clip(np.floor(fx).astype(int), 0, len(mlons) - 2)
    y0i = np.clip(np.floor(fy).astype(int), 0, len(lats_asc) - 2)
    tx = np.clip(fx - x0i, 0, 1)
    ty = np.clip(fy - y0i, 0, 1)
    z00 = z_asc[y0i, x0i]; z01 = z_asc[y0i, x0i + 1]
    z10 = z_asc[y0i + 1, x0i]; z11 = z_asc[y0i + 1, x0i + 1]
    grid = ((z00 * (1 - tx) + z01 * tx) * (1 - ty)
            + (z10 * (1 - tx) + z11 * tx) * ty).astype(np.float32)
    inside = ((lon2d >= mlons[0]) & (lon2d <= mlons[-1])
              & (lat2d >= lats_asc[0]) & (lat2d <= lats_asc[-1])
              & np.isfinite(grid))
    grid = np.where(inside, grid, np.float32(-32768.0))
    np.save(OUT / "zealandia_elevation_m.npy", grid)

    nod = grid <= -32768
    valid = grid[~nod]
    print("game grid:", grid.shape, "nodata%:", round(100 * float(nod.mean()), 3),
          "valid min/max:", float(valid.min()), float(valid.max()))

    def sample(lon, lat):
        x, y = Transformer.from_crs(4326, 3851, always_xy=True).transform(lon, lat)
        if not (XMIN <= x <= XMAX and YMIN <= y <= YMAX):
            return None
        c = int((x - XMIN) / (XMAX - XMIN) * W)
        r = int((YMAX - y) / (YMAX - YMIN) * H)
        v = float(grid[max(0, min(H - 1, r)), max(0, min(W - 1, c))])
        return None if v <= -32768 else round(v)

    # 16-bit heightmap PNG, normalised -11000..+4000 m, NoData at floor.
    LO, HI = -11000.0, 4000.0
    fixed = np.where(nod, LO, grid)
    norm = np.clip((fixed - LO) / (HI - LO), 0, 1)
    Image.fromarray((norm * 65535).astype(np.uint16)).save(
        OUT / "zealandia_heightmap_16bit.png")

    # Risen-continent preview (hypsometric tint + hillshade, NoData black).
    def colorize(a, nodata):
        h, w = a.shape
        out = np.zeros((h, w, 3), dtype=np.uint8)
        bands = [(-11000, (8, 16, 38)), (-6000, (13, 32, 66)),
                 (-4000, (19, 52, 92)), (-2500, (26, 74, 110)),
                 (-1500, (34, 102, 128)), (-800, (74, 140, 132)),
                 (-300, (128, 168, 120)), (0, (178, 196, 138)),
                 (300, (196, 178, 128)), (800, (168, 138, 102)),
                 (1500, (140, 110, 92)), (4000, (235, 232, 228))]
        prev = -1e9
        for hi_c, col in bands:
            mask = (a > prev) & (a <= hi_c)
            out[mask] = col
            prev = hi_c
        gy_, gx_ = np.gradient(np.where(nodata, 0, a))
        shade = np.clip(0.75 + (gx_ * 0.6 + gy_ * 0.6) / 900.0, 0.55, 1.25)
        out = (out * shade[..., None]).clip(0, 255).astype(np.uint8)
        out[nodata] = (0, 0, 0)
        return out

    img = Image.fromarray(colorize(grid, nod))
    img.save(OUT / "zealandia_risen_preview.png")
    img.resize((768, int(768 * H / W))).save(
        OUT / "zealandia_risen_preview_small.jpg", quality=88)

    zones = [("Lord Howe Rise", 162.5, -30.0), ("Norfolk Ridge", 167.5, -29.0),
             ("Three Kings Ridge", 172.0, -31.5), ("Reinga Basin", 171.0, -35.0),
             ("Challenger Plateau", 168.5, -37.5), ("New Caledonia Trough", 163.5, -33.0),
             ("Taranaki Basin", 173.0, -39.5), ("Colville Ridge", 179.5, -34.5),
             ("Kermadec Ridge", 178.5, -30.5), ("North Island (emerged land)", 176.0, -38.5),
             ("Hikurangi Plateau", 179.5, -40.0), ("Chatham Rise", -178.0, -43.5),
             ("South Island (emerged land)", 169.5, -43.5), ("Bounty Trough", 174.5, -45.5),
             ("Puysegur Trench", 165.0, -46.5), ("Great South Basin", 168.5, -48.0),
             ("Campbell Plateau", 172.0, -50.5), ("Macquarie Ridge", 163.0, -53.0),
             ("Cook Strait", 174.3, -41.3), ("Aoraki / Mt Cook", 170.14, -43.59)]
    zlist = [{"name": nm, "lon": lo, "lat": la, "elevation_m": sample(lo, la)}
             for nm, lo, la in zones]
    for z in zlist:
        print(z["name"], ":", z["elevation_m"], "m")

    corners = {}
    for k, (x, y) in {"SW": (XMIN, YMIN), "SE": (XMAX, YMIN),
                      "NW": (XMIN, YMAX), "NE": (XMAX, YMAX)}.items():
        lo, la = inv.transform(x, y)
        corners[k] = [round(float(lo), 2), round(float(la), 2)]

    meta = {
        "source_values": "GMRT Grid (Marine Geoscience Data System, Lamont-Doherty Earth Observatory), netCDF subsets via gmrt.org GridServer, fetched 2026-10-16",
        "validation": "Spot values cross-checked against the NIWA NZ Region Bathymetry 250 m model (GNS Science ImageServer identify endpoint): Challenger Plateau NIWA -973 m, Campbell Plateau -501 m, Cook Strait -96 m, Aoraki 3333 m (identify, 250 m grid)",
        "citation_gmrt": "Ryan, W.B.F. et al. (2009) Global Multi-Resolution Topography synthesis. Geochem. Geophys. Geosyst. 10, Q03014",
        "citation_niwa": "Mitchell, J.S.; Mackay, K.A.; Neil, H.L.; Mackay, E.J.; Pallentin, A.; Notman, P. (2012) New Zealand Region Bathymetry, 1:4,000,000, 2nd Edition. NIWA Chart, Miscellaneous Series No. 92",
        "crs": "EPSG:3851 (NZGD2000 / NZCS2000, Lambert Conformal Conic, metres)",
        "extent_m": {"xmin": XMIN, "ymin": YMIN, "xmax": XMAX, "ymax": YMAX},
        "extent_corners_lonlat_approx": corners,
        "grid_px": [W, H],
        "pixel_size_m_approx": [round((XMAX - XMIN) / W), round((YMAX - YMIN) / H)],
        "elevation_min_m_valid": float(valid.min()),
        "elevation_max_m_valid": float(valid.max()),
        "nodata_fraction": round(float(nod.mean()), 4),
        "heightmap_normalization": {
            "png_0_m": -11000, "png_65535_m": 4000,
            "note": "recover metres = png/65535*15000-11000; NoData cells are set to the floor value in the PNG and black in the preview",
        },
        "zones": zlist,
    }
    (OUT / "zealandia_meta.json").write_text(json.dumps(meta, indent=1))
    print("DONE")


if __name__ == "__main__":
    main()
