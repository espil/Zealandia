# Zealandia Map Data - the sunken continent as game terrain

Prepared 2026-10-16 for the Espil Online: Zealandia app. Han's direction:
the dungeon location is the old map of New Zealand, the land that sank -
so the terrain is built from the released scientific map data for
Te Riu-a-Maui / Zealandia, not invented geography.

## The released data behind this

• **GNS Science, Te Riu-a-Maui / Zealandia maps (released June 2020).**
Mortimer, Smith Lyttle and Black published the continent's bathymetric
map (GNS Science Poster 7, doi:10.21420/BME3-MV62) and tectonic map
(Poster 8, doi:10.21420/M90C-5J03) at 1:8,500,000 in the NZCS
projection. The bathymetric poster shows the continent "as if the oceans
had been drained of water" - exactly the view the game uses. Digital
versions are free from GNS; data sources are listed in GNS Science
Report 2020/01, and the GIS layers are in the TEZ explorer
(data.gns.cri.nz/tez). The bathymetry on those maps derives from the
GEBCO grid and regional multibeam data.

• **NIWA New Zealand Region Bathymetry, 250 m model** (Mitchell et al.
2012, NIWA Chart Miscellaneous Series No. 92), served by GNS Science as
a public ArcGIS ImageServer
(gis.gns.cri.nz, basemaps/NIWA_BathymetricElevationModel_NZCS).
Its identify endpoint was used here as the validation oracle. Spot
checks (250 m native cells): Aoraki / Mt Cook 3,333 m, Cook Strait
-96 m, Challenger Plateau -973 m, Campbell Plateau -501 m.
Caution for future work: this service's bulk TIFF export is unreliable -
repeated exports came back as tiled TIFFs with missing tiles (zero tile
offsets, garbage values in the gaps, about 4 to 8 percent of cells).
Rejected exports are kept in raw/ under REJECTED names so nobody
builds on them by mistake. Do not bulk-export from it without a
per-tile integrity check.

• **GMRT Grid** (Global Multi-Resolution Topography, Marine Geoscience
Data System, Lamont-Doherty Earth Observatory; Ryan et al. 2009) -
the elevation values actually shipped in this package, fetched as
netCDF subsets from the GMRT GridServer (gmrt.org) on 2026-10-16.
GMRT is a public synthesis of multibeam sonar, GEBCO, and contributed
regional surveys. Its GridServer downloads were byte-clean where the
ArcGIS TIFF exports were not. Cross-checks against the NIWA model:
plateau depths agree closely (Challenger Plateau -960 m here vs
-973 m NIWA; Campbell Plateau -511 m vs -501 m). The full-extent
subsets came back at GMRT's low resolution for an area this size
(about 6 km cells), so sharp peaks are smoothed - Aoraki samples
1,778 m here vs 3,333 m in NIWA's native grid, and Cook Strait is
land-bridged in the grid. A finer core pass over the New Zealand
heartland was attempted the same day; the GMRT server answered 504
timeouts, so it is a documented later step (retry GMRT, or build the
detail grid from NIWA small-area exports once the first dungeon zone
is chosen). See "known_limits" in processed/zealandia_meta.json.

## What is in this folder

• `raw/` - the fetched source grids (GMRT netCDF subsets; NIWA quadrant
exports kept for the record, plus the rejected full-extent export).
• `processed/zealandia_elevation_m.npy` - the game terrain grid:
2,048 x 2,117 float32 elevations in metres, EPSG:3851 over the full
NIWA map extent (3,783 km x 3,911 km, about 1,847 m per pixel).
NoData = -32768 (grid corners outside the data footprint).
• `processed/zealandia_heightmap_16bit.png` - the same grid as a
16-bit heightmap for the game engine. Normalisation: 0 = -11,000 m,
65,535 = +4,000 m; recover metres = value / 65535 * 15000 - 11000.
• `processed/zealandia_risen_preview.png` / `_small.jpg` - the
continent drained and coloured by height: deep ocean trenches form
the map's outer canyons, the plateaus (Challenger, Campbell, Chatham
Rise) become the lowlands, and today's New Zealand stays the mountain
spine. This is the dungeon's world map.
• `processed/zealandia_meta.json` - extent, projection, corners,
elevation range, and the named-zone table with sampled elevations.
• `build_terrain.py` - the reproducible build (GMRT fetch, merge,
reproject to EPSG:3851, sample, render). Needs numpy, pillow, scipy,
pyproj.

## Named zones for the dungeon (real features, real depths)

The meta file carries 20 named features sampled from the grid:
Lord Howe Rise, Norfolk Ridge, Three Kings Ridge, Reinga Basin,
New Caledonia Trough, Challenger Plateau, Taranaki Basin, Colville
Ridge, Kermadec Ridge, Hikurangi Plateau, Chatham Rise, Bounty Trough,
Puysegur Trench, Great South Basin, Campbell Plateau, Macquarie
Ridge, Cook Strait, and the emerged North and South Islands with
Aoraki as the high point. Depths in the meta are the grid value at
each anchor coordinate (1.8 km pixels smooth sharp crests, so a
ridge anchor can sit on a flank - treat them as zone elevations,
not surveyed crest depths).

## How the game should use it

• Terrain height = elevation as-is, with the ocean removed: what is
-500 m on the chart (Campbell Plateau) becomes a plain 500 m below
the old sea-level datum, and the trenches below -4,000 m are the
natural walls at the continent's edge. One consistent datum keeps
every zone's relative height true to the real map.
• World scale: the grid is real metres in EPSG:3851. At the
Vancouver map's 1 unit = 1 m the continent would be 3,783 km wide,
so the app should scale (for example 1 unit = 100 m gives a
37.8 km-wide world) or stream a sub-region at full scale. That is a
game-design decision for the dungeon build, not a data problem.
• A native 250 m detail grid for a chosen dungeon sub-area can be
built later from the same sources (GMRT high resolution, or NIWA
identify-verified small exports) once Han picks the first zone.

## Attribution for the app (keep in shipping credits)

• GMRT Grid, Marine Geoscience Data System (mgds), Lamont-Doherty
Earth Observatory, Columbia University.
• NIWA New Zealand Region Bathymetry (Mitchell et al. 2012), via
GNS Science.
• Continent extent and feature names after Mortimer et al., GNS
Science Te Riu-a-Maui / Zealandia maps (2020); bathymetry there
derives in part from GEBCO.
