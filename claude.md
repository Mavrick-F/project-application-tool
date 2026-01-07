# Memphis MPO Project Application Tool - Claude Context

## Project Overview

This is a web-based mapping tool for the Memphis Metropolitan Planning Organization's Regional Transportation Plan (RTP) 2055. It allows users to draw transportation project alignments or mark locations on an interactive map, then automatically performs spatial analysis to identify intersecting or nearby infrastructure and planning features. The tool generates a PDF report summarizing the findings.

**Current Status:** v0.8.2 (active development, not production-ready)

**Primary User:** Engineers from MPO partner agencies will use tool to create pdf reports which they submit as part of project applications. MPO staff will use the pdf reports to evalute project applications.

**Recent Major Updates:**

**v0.8.2 (2026-01-07):**
- Redesigned color scheme to eliminate conflicts and make red project line stand out
- Increased project line thickness from 8px to 12px (50% thicker)
- No more red/orange/crimson layers competing with project line
- Separated ALICE ZCTAs (purple) from Freight Zones (now teal/turquoise)

**v0.8.1 (2026-01-07):**
- Optimized PDF generation with filtered layer rendering
- Reduced PDF generation time from ~20 seconds to ~5-10 seconds (60-75% faster)
- PDF maps now show only matched features instead of all 10,000+ features
- Eliminated visual clutter in exported PDF maps

**v0.8.0:**
- Added 4 critical datasets: High Injury Corridors, Crash Locations (KSI), Greenprint Bike Network, ALICE ZCTAs
- Implemented proximity counting for crash aggregation by severity
- Added threshold-based filtering for ALICE economic indicators (≥45% threshold)
- Consolidated Greenprint routes into single layer with conditional styling (Regional/Intermediate/Local)
- Enhanced tooltips and reports to show percentages and additional details
- Improved UI (removed polygon selection box, better spacing in PDF reports)

## Architecture & Tech Stack

This is a **modular JavaScript application (v0.8.2)** with 7 separate files:

**Core Application Files:**
- **index.html** (~140 lines) - HTML structure and script tags only
- **styles.css** (~400 lines) - All CSS styling
- **datasets.js** (~400 lines) - CONFIG and DATASETS configuration
- **map.js** (~300 lines) - Map initialization, layer management, drawing controls
- **analysis.js** (~550 lines) - Spatial analysis functions
- **pdf.js** (~450 lines) - PDF generation and export
- **app.js** (~900 lines) - Application initialization, event handlers, UI management

**External Libraries:**
- **Leaflet.js** (v1.9.4) - Interactive mapping
- **Leaflet.Draw** (v1.0.4) - Drawing controls
- **Turf.js** (v6.5.0) - Geospatial analysis
- **jsPDF** (v2.5.1) - PDF generation
- **html2canvas** (v1.4.1) - Map screenshot capture

**No build process, no bundler** - Everything runs in the browser.

## File Structure

```
project-application-tool/
├── index.html                    # HTML structure & script tags (~140 lines)
├── styles.css                    # All CSS styling (~400 lines)
├── datasets.js                   # Configuration data (~400 lines)
├── map.js                        # Map & drawing controls (~300 lines)
├── analysis.js                   # Spatial analysis (~550 lines)
├── pdf.js                        # PDF generation (~450 lines)
├── app.js                        # App initialization & events (~900 lines)
├── data/                         # GeoJSON datasets (16 total)
│   ├── mata-routes.json          # Transit routes (LineString)
│   ├── strahnet.geojson          # Strategic highway network (LineString)
│   ├── truck_routes.json         # Freight routes (LineString, color-coded)
│   ├── HIN_Corridors.geojson     # High Injury Corridors (LineString)
│   ├── midsouth_greenprint.geojson # Bike network (LineString, dashed, 3 types)
│   ├── opportunity-zones.json    # Census tracts (Polygon)
│   ├── alice_zctas.geojson       # ALICE economic indicators (Polygon)
│   ├── freight_clusters.geojson  # Freight zones (Polygon)
│   ├── parks.json                # Public parks (Polygon)
│   ├── historic_polygons.geojson # Historic districts (Polygon)
│   ├── bridges.json              # Bridge locations (Point)
│   ├── ksi_crashes.geojson       # Crash locations (Point, with counting)
│   ├── major_employers.geojson   # Employment centers (Point)
│   ├── tourist_attractions.geojson # Tourist destinations (Point)
│   ├── historic_points.geojson   # Historic sites (Point)
│   └── epa_superfund_sites.geojson # EPA cleanup sites (Point)
├── assets/
│   └── rtp-2055-logo.jpg         # RTP header logo for PDF
├── VERSION.md                    # Version history
├── README.md
└── claude.md                     # This file - context for Claude Code
```

## Key Concepts

### Analysis Types

The tool performs four types of spatial analysis:

1. **Corridor Matching** (for line features like transit routes)
   - Creates 100ft buffer around drawn line
   - Checks for minimum 300ft of parallel/shared length
   - Used for: Transit routes, bike routes, freight corridors, high injury corridors

2. **Intersection Detection** (for polygon features)
   - Uses `turf.booleanIntersects()` for line-to-polygon
   - Uses `turf.booleanPointInPolygon()` for point-in-polygon
   - Supports threshold-based filtering (e.g., ALICE ZCTAs with ≥45% threshold)
   - Used for: Opportunity Zones, ALICE ZCTAs, historic districts, parks

3. **Proximity Analysis** (for point features)
   - Creates configurable buffer around drawn geometry
   - Lists all features within buffer
   - Used for: Bridges, major employers, tourist destinations, historic sites

4. **Proximity with Counting** (for aggregated point features)
   - Creates buffer around drawn geometry
   - Counts features and groups by specified category field
   - Returns total count and breakdown by category
   - Used for: Crash locations (groups by Fatal vs Suspected Serious Injury)

### Implemented Datasets (16 of ~19 required)

**Transportation:**
✅ **MATA Routes** - Transit network (corridor matching)
✅ **STRAHNET Routes** - Strategic highway network (corridor matching)
✅ **Freight Routes** - Regional/local freight routes (corridor matching, color-coded)
✅ **High Injury Corridors** - Safety priority corridors (corridor matching)
✅ **Greenprint Bike Network** - Regional/Intermediate/Local routes (corridor matching, dashed, color-coded)
✅ **Crash Locations (KSI)** - Fatal/Serious Injury crashes (proximity counting by severity)
✅ **Bridges** - NBI structures (proximity analysis)

**Economic Development:**
✅ **Opportunity Zones** - Census tracts (intersection detection)
✅ **ALICE ZCTAs** - Economic distress indicators (intersection, ≥45% threshold, shows %)
✅ **Freight Zones** - Freight activity areas (intersection detection)
✅ **Major Employers** - Employment centers (proximity analysis)
✅ **Tourist Destinations** - Attractions (proximity analysis)

**Historic & Cultural:**
✅ **NHRP Polygons** - Historic districts (proximity analysis)
✅ **NHRP Points** - Historic sites (proximity analysis)

**Environment & Recreation:**
✅ **Parks** - Public parks (proximity analysis)
✅ **EPA Superfund Sites** - Cleanup locations (proximity analysis)

### Required for v1.0 (3 additional datasets)

**Transportation:** Congested Segments (ArcGIS Feature Service integration)

**Environmental:** Wetlands, Streams (evaluate redundancy), Flood Zones (evaluate redundancy)

## Critical Development Priorities

### ✅ COMPLETED (v0.8.0)

**Advanced Analysis Features** - ✅ DONE
- ✅ Implemented proximity counting function (`analyzeProximityWithCounting`)
- ✅ Added threshold-based filtering for polygon datasets (`filterByThreshold`)
- ✅ Integrated crash counting by severity (Fatal vs Suspected Serious Injury)
- ✅ Implemented ALICE criteria with 45% threshold filtering
- ✅ Added percentage formatting for economic indicators
- ✅ Enhanced tooltips to show additional fields (deaths, injuries, percentages)

**Dataset Integration** - ✅ DONE (16 of 19 datasets)
- ✅ High Injury Corridors with safety corridor analysis
- ✅ Crash Locations (KSI) with proximity counting
- ✅ Greenprint Bike Network (Regional/Intermediate/Local) with conditional styling
- ✅ ALICE ZCTAs with threshold filtering and percentage display

### 🔴 REMAINING for v1.0

**ArcGIS Feature Service Integration:**
- Congested Segments dataset (large file requiring Feature Service)
- Custom query/aggregation logic for Feature Service requests

**Environmental Datasets:**
- Wetlands (with forested/shrub categorization)
- Streams (evaluate if redundant with wetlands)
- Flood Zones (evaluate if redundant with wetlands)

**User Experience Refinements:**
- Context-aware empty result messages
- Confirmation dialog for "Clear & Start Over"
- Real-time validation feedback
- Loading indicators for Feature Service requests

## Code Organization (index.html)

The single HTML file is organized as follows:

1. **HTML Structure** (~100 lines)
   - Sidebar for controls and dynamic results container
   - Map container
   - Welcome modal

2. **CSS Styles** (~500 lines)
   - Responsive layout (desktop only, 1024px min)
   - Custom Leaflet control styling
   - Dynamic result card styling

3. **JavaScript** (~2100 lines)
   - **Configuration** (`CONFIG`, line ~623): Basic app settings
   - **DATASETS Configuration** (line ~648): Complete dataset definitions with 12+ entries
   - **Generic Analysis Functions** (line ~1784+):
     - `analyzeCorridorMatch()` - For LineString datasets
     - `analyzeIntersection()` - For Polygon datasets
     - `analyzeProximity()` - For Point datasets
     - `analyzeAllDatasets()` - Master orchestration function
   - **Dynamic layer creation** (`addReferenceLayers()`, line ~1427)
   - **Dynamic results display** (`displayResults()`, line ~2362)
   - **Dynamic PDF generation** (`generatePDF()`, line ~2376)
   - Map initialization, drawing handlers, utilities

## Important Configuration

**Basic Config** (`CONFIG` object, line ~623):
```javascript
CONFIG = {
    minLineLength: 100,         // Minimum valid project length (feet)
    drawnLineStyle: { ... },    // Style for user-drawn lines
    logoPath: './assets/rtp-2055-logo.jpg'
}
```

**Dataset Configuration** (`DATASETS` object, line ~648):
Each dataset is fully defined with analysis parameters:
```javascript
datasetKey: {
  id: 'datasetKey',
  name: 'Display Name',
  category: 'Category',
  filePath: './data/file.json',
  geometryType: 'Point' | 'LineString' | 'Polygon',
  analysisMethod: 'corridor' | 'intersection' | 'proximity',
  bufferDistance: 100,        // For corridor analysis
  minSharedLength: 300,       // Minimum overlap
  proximityBuffer: 200,       // For proximity analysis
  properties: {
    displayField: 'FieldName',
    staticLabel: 'Text',      // Optional: override field
    additionalFields: []
  },
  specialHandling: { ... },
  style: { ... },
  styleByProperty: { ... },   // Optional: conditional styling
  resultStyle: 'list' | 'table',
  enabled: true
}
```

## GeoJSON Data Requirements

All datasets must:
- Be valid GeoJSON with `geometry` and `properties`
- Include required property fields (dataset-specific)
- Use WGS84 (EPSG:4326) coordinate system

**Property Requirements by Dataset:**
- Routes: `Name` (string) - route name/number
- Zones: `CENSUSTRAC` (string) - census tract ID
- Bridges: `STRUCTURE_` (string) - NBI ID, `Condition` (string) - condition rating

## Development Guidelines

### When Adding New Datasets

**Current approach (v0.6.0) - configuration-driven:**

1. **Add GeoJSON to `/data/`**
2. **Add entry to DATASETS object** (line ~648):
```javascript
newDataset: {
  id: 'newDataset',
  name: 'Display Name',
  filePath: './data/new-dataset.json',
  geometryType: 'Point',
  analysisMethod: 'proximity',
  proximityBuffer: 500,
  properties: { displayField: 'NAME' },
  style: { color: '#FF0000', radius: 4, ... },
  enabled: true
}
```
3. **That's it!** No code changes needed.

The system automatically handles:
- Data loading
- Layer creation and styling
- Tooltip generation
- Spatial analysis
- Results display
- PDF report inclusion

**Advanced features available:**
- `staticLabel` - Show constant text instead of field value
- `styleByProperty` - Conditional styling (e.g., color-code by type)
- `specialHandling` - Deduplication, suffix removal
- `additionalFields` - Multi-column table results
- `countByField` - Field to group results for counting analysis
- `filterByThreshold` - Numeric threshold filtering with translucent styling
- `formatPercentage` - Format specific fields as percentages

### Testing Locally

**IMPORTANT: Always use port 8080** (not 8000) to avoid corporate firewall issues:

```bash
# Standard procedure - use port 8080
python -m http.server 8080

# Then open: http://localhost:8080 or http://127.0.0.1:8080
```

**Why port 8080?** Port 8080 is a standard HTTP alternate port and is commonly whitelisted in corporate firewall configurations. Other ports (8000, 3000, 5000) may be blocked by Windows Firewall or corporate security policies.

**If port 8080 doesn't work:**
1. Try ports in this order: 8080 → 3000 → 5500 → 5173
2. Try both `http://localhost:8080` and `http://127.0.0.1:8080`
3. Check Windows Defender Firewall (allow Python)
4. Use Incognito/Private browsing to bypass extensions/cache

### Common Issues

- **PDF generation fails**: All map layers must load first
- **Route matching slow**: Very long lines are computationally intensive
- **Buffer distance confusion**: Analysis uses 100ft buffer for corridor matching, but requires 300ft minimum shared length
- **Refresh clears work**: No data persistence (by design for now)

## Spatial Analysis Details

### Corridor Matching Algorithm (Transit Routes)

```javascript
// Simplified logic
1. Buffer drawn line by 100 feet
2. For each route segment:
   - Check if segment intersects buffer
   - Calculate shared length with turf.lineOverlap()
   - Keep if shared length >= 300 feet
3. Deduplicate routes (remove IB/OB/EB/WB suffixes)
```

### Distance/Buffer Confusion

- **100ft buffer** = Width of corridor for initial intersection check
- **300ft minimum** = Required shared length for corridor match
- **300ft buffer** = Proximity threshold for point features (bridges)

These are different concepts that should not be confused.

## Things to Avoid

- **Don't add build tooling** - This is intentionally a single-file HTML app
- **Don't refactor to separate files** - Keep as single file for easy deployment
- **Don't add mobile support** - Desktop-only by requirement (complex mapping UI)
- **Don't add backend** - Client-side only, no server dependencies
- **Don't add authentication** - Public tool, no user accounts
- **Don't optimize prematurely** - Current datasets are small; wait for real performance issues

## Things to Prioritize

- ✅ **Configuration-driven architecture** - COMPLETED in v0.6.0
- ✅ **Specialized analysis logic** - COMPLETED in v0.8.0 (counting, thresholds, percentage formatting)
- ✅ **Critical dataset integration** - COMPLETED in v0.8.0 (16 of 19 datasets integrated)
- **ArcGIS Feature Service integration** - For large datasets (Congested Segments)
- **Environmental datasets** - Wetlands, Streams, Flood Zones (3 remaining)
- **User feedback messages** - Empty states, validation, confirmation dialogs

## Terminology

- **RTP** - Regional Transportation Plan
- **MPO** - Metropolitan Planning Organization
- **MATA** - Memphis Area Transit Authority
- **NBI** - National Bridge Inventory
- **NHRP** - National Register of Historic Places
- **ALICE** - Asset Limited, Income Constrained, Employed
- **STRAHNET** - Strategic Highway Network
- **EJ** - Environmental Justice

## Questions to Ask for Clarification

When working on new features, consider asking:

1. **For new datasets**: What geometry type? What buffer/threshold? Which properties to display?
2. **For threshold filtering**: What percentage or value threshold? Should below-threshold features be hidden or translucent?
3. **For large datasets**: Should this be hosted externally (ArcGIS Online) or local GeoJSON?
4. **For special logic**: Should features be counted, aggregated, or listed individually?
5. **For buffer distances**: Is this a proximity check, corridor matching, or intersection detection?

## Deployment

Deployed to GitHub Pages at: https://mavrick-f.github.io/project-application-tool/

Simply push to main branch - no build process needed.

## Contact & Feedback

- Built by Mavrick Fitzgerald using Claude Code
- Questions/feedback: GitHub Issues
- Built for Memphis MPO RTP 2055
