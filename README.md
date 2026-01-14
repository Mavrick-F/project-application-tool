# Memphis MPO Project Application Tool

![Version](https://img.shields.io/badge/version-0.9.3-blue) ![Status](https://img.shields.io/badge/status-feature%20complete-brightgreen)

A web-based mapping tool for analyzing transportation project proposals against regional planning datasets. Built for the Memphis Metropolitan Planning Organization's Regional Transportation Plan (RTP) 2055.

🔗 **Development Preview:** [https://mavrick-f.github.io/project-application-tool/](https://mavrick-f.github.io/project-application-tool/)

## Overview

Users draw project alignments or mark specific locations on an interactive map. The tool automatically identifies intersecting or nearby transportation infrastructure and planning features, then generates a PDF report summarizing the findings.

**Current Status:** v0.9.3 - Feature complete with YAML-based configuration system for easy dataset management. Ready for v1.0 release.

## Features

### Drawing & Analysis
- **Line Drawing** - Draw corridor alignments for linear projects (roads, trails, transit routes)
- **Point Marking** - Mark specific locations for intersection improvements or spot projects
- **Real-time Analysis** - Results update automatically as you draw
- **Multiple Analysis Types:**
  - Corridor matching (parallel routes, minimum 300ft overlap)
  - Length summation (e.g., miles of reliable vs unreliable roads)
  - Intersection detection (polygons)
  - Proximity detection (nearby points)
  - Counting and aggregation (e.g., crash severity counts)

### PDF Reports
- Static map showing project location with all reference layers
- Complete analysis results organized by category
- Project length, metadata, and timestamp

## Integrated Datasets (20 total)

**Transportation (7):**
- Bridges - Bridge inventory with condition-based colors (Green/Yellow/Red)
- Crash Locations (KSI) - Fatal and Suspected Serious Injury crashes (counting by severity)
- Greenprint Bike Network - Regional/Intermediate/Local routes (dashed, color-coded)
- High Injury Corridors - Safety priority corridors
- MATA Routes - Transit network
- STRAHNET Routes - Strategic Highway Network
- Travel Time Reliability - Road segments with reliability percentages and mean LOTTR

**Economic Development (6):**
- ALICE ZCTAs - Economic distress indicators (≥45% threshold, shows % below ALICE)
- Freight Clusters - Designated freight activity zones (teal)
- Freight Routes - Regional/local freight routes (warm tones: brown/tan)
- Major Employers - Significant employment centers
- Opportunity Zones - Census tract designations
- Tourist Destinations - Regional attractions

**Environmental/Cultural (7):**
- Critical Wetlands - Freshwater forested/shrub wetlands (filtered from all wetlands)
- EPA Superfund Sites - Environmental cleanup locations
- Flood Zones - 100-year flood plains (dashed border)
- Historic Points (NHRP) - Individual historic sites
- Historic Polygons (NHRP) - Historic district boundaries
- Parks - Public park boundaries
- Wetlands - All wetland areas (olive green)


## Usage

### For End Users

1. **Draw Your Project**
   - Click "Draw Alignment (Line)" for corridor projects
   - Click "Mark Location (Point)" for specific locations
   - Click on map to place vertices or drop marker
   - Double-click to finish

2. **Review Results**
   - Analysis results appear automatically in sidebar
   - Results grouped by category (Transportation, Economic, Environmental)

3. **Generate Report**
   - Enter project name
   - Click "Download PDF Report"
   - PDF saves as `Project_Application_[ProjectName]_[Date].pdf`

4. **Start Over**
   - Click "Clear & Start Over" to reset

### Requirements
- Desktop browser (minimum 1024px width)
- Modern browser with JavaScript enabled (Chrome, Firefox, Safari, Edge)

## Development

### Local Setup

```bash
# Clone repository
git clone https://github.com/mavrick-f/project-application-tool.git
cd project-application-tool

# Serve locally
python -m http.server 5050

# Open http://localhost:5050
```

### Architecture

**File Structure:**
```
project-application-tool/
├── index.html                    # Main HTML (stays at root)
├── datasets.yaml                 # Dataset configuration (self-documenting)
├── assets/                       # Logos and images
├── data/                         # GeoJSON datasets
├── src/                          # Application code
│   ├── datasets.js              # CONFIG + YAML loader
│   ├── map.js                   # Map init, layers, drawing
│   ├── analysis.js              # Spatial analysis functions
│   ├── pdf.js                   # PDF generation
│   ├── app.js                   # Init and event handlers
│   └── styles.css               # All CSS styling
```

**Configuration System (v0.9.3):**
- `datasets.yaml` - YAML-based configuration (replaces hardcoded JavaScript)
- Self-documenting with inline comments explaining every field
- Planners can add datasets by copying/modifying YAML entries
- Zero code changes required for new datasets

**External libraries** (via CDN):
- Leaflet.js (v1.9.4) - Interactive mapping
- Leaflet.Draw (v1.0.4) - Drawing controls
- Turf.js (v6.5.0) - Geospatial analysis
- jsPDF (v2.5.1) - PDF generation
- html2canvas (v1.4.1) - Map capture
- js-yaml (v4.1.0) - YAML parsing

### Adding New Datasets

**Configuration-driven** - add datasets by updating `datasets.yaml`:

1. **Open `datasets.yaml`** in the root directory
2. **Find a similar dataset** (matching your geometry type)
3. **Copy and modify** the YAML entry:
4. **Save and refresh** - no code changes needed

**Available config options:**
- `geometryType`: Point, LineString, Polygon, MultiLineString
- `analysisMethod`: corridor, intersection, proximity, proximityCount, binaryProximity, corridorLengthByStatus
- `styleByProperty` - Conditional colors/styles based on field values
- `staticLabel` - Show constant text instead of field value
- `filterByThreshold` - Filter by field value with translucent below-threshold display
- `lazyLoad` - Load Feature Services on-demand (not at startup)
- `featureServiceUrl` - ArcGIS Feature Service URL (alternative to filePath)

The YAML file includes extensive inline comments documenting every field and valid values.

### Data Requirements

All datasets must be:
- Valid GeoJSON with `geometry` and `properties`
- WGS84 coordinate system (EPSG:4326)
- Property fields matching DATASETS config (case-sensitive)

Expected Memphis bounds: lng -90.1 to -89.6, lat 34.9 to 35.3

### Optimizing GeoJSON Files

Use `optimize_geojson.py` to reduce file sizes for large datasets (recommended before adding to `data/` folder):

```bash
# Basic optimization (default tolerance 0.0001)
python optimize_geojson.py input.json

# Custom output file
python optimize_geojson.py input.json output.json

# Aggressive simplification (larger tolerance = smaller files but less detail)
python optimize_geojson.py input.json output.json --tolerance 0.001
```

**What it does:**
- Reduces coordinate precision to decrease file size
- Simplifies line and polygon geometries
- Analyzes before/after file sizes
- Supports all geometry types (Point, LineString, Polygon, Multi-* variants)

**Example:** A 1.4MB file reduced to 500KB with minimal visual impact.

**Typical workflow:**
1. Export GeoJSON from GIS tool (ArcGIS, QGIS, etc.)
2. Run `optimize_geojson.py input.json data/my_dataset.json`
3. Add dataset entry to `datasets.yaml`
4. Refresh browser to see new data on map

## Known Limitations

- **Desktop only** - Requires 1024px minimum width (complex mapping UI)
- **No data persistence** - Refresh clears all work (by design)
- **PDF capture timing** - Must wait for all layers to render (~5-10 seconds with many features)
- **No undo/redo** - During drawing (Leaflet.Draw limitation) (Just draw a new line)
- **Synchronous analysis** - May briefly freeze UI on very large projects with many overlaps

## Intentional Design Decisions

- **No backend server** - Client-side only (IT infrastructure constraints)
- **No build process** - Vanilla JS for maintainability by non-developers
- **Local GeoJSON** - Kept datasets local (is size alows) for simplicity and reliability
- **Configuration over code** - Add features via config, not custom logic

## Browser Support

Tested and working on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Acknowledgments

Built by Mavrick Fitzgerald using Claude Code. Uses open-source mapping libraries. Basemap by CARTO and OpenStreetMap contributors.

---

**Memphis Metropolitan Planning Organization** | Regional Transportation Plan 2055

