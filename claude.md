# Memphis MPO Project Application Tool - Claude Context

## Project Overview

This is a web-based mapping tool for the Memphis Metropolitan Planning Organization's Regional Transportation Plan (RTP) 2055. It allows users to draw transportation project alignments or mark locations on an interactive map, then automatically performs spatial analysis to identify intersecting or nearby infrastructure and planning features. The tool generates a PDF report summarizing the findings.

**Current Status:** v0.7.0 (active development, not production-ready)

**Primary User:** Engineers from MPO partner agencies will use tool to create pdf reports which they submit as part of project applications. MPO staff will use the pdf reports to evalute project applications.

**Recent Major Update (v0.7.0):**
- Refactored monolithic 3200+ line index.html into 7 modular files
- Maintained all functionality with zero breaking changes
- Improved code maintainability and organization
- Added cache busting with `?v=0.7.0` query strings
- Updated all documentation

## Architecture & Tech Stack

This is a **modular JavaScript application (v0.7.0)** with 7 separate files:

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
├── data/                         # GeoJSON datasets (12 total)
│   ├── mata-routes.json          # Transit routes (LineString)
│   ├── strahnet.geojson          # Strategic highway network (LineString)
│   ├── truck_routes.json         # Freight routes (LineString, color-coded)
│   ├── opportunity-zones.json    # Census tracts (Polygon)
│   ├── freight_clusters.geojson  # Freight zones (Polygon)
│   ├── parks.json                # Public parks (Polygon)
│   ├── historic_polygons.geojson # Historic districts (Polygon)
│   ├── bridges.json              # Bridge locations (Point)
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

The tool performs three types of spatial analysis:

1. **Corridor Matching** (for line features like transit routes)
   - Creates 100ft buffer around drawn line
   - Checks for minimum 300ft of parallel/shared length
   - Used for: Transit routes (currently), future bike routes, freight corridors

2. **Intersection Detection** (for polygon features)
   - Uses `turf.booleanIntersects()` for line-to-polygon
   - Uses `turf.booleanPointInPolygon()` for point-in-polygon
   - Used for: Opportunity Zones (currently), future EJ layers, historic districts

3. **Proximity Analysis** (for point features)
   - Creates 300ft buffer around drawn geometry
   - Checks if points fall within buffer
   - Used for: Bridges (currently), future crash locations, major employers

### Implemented Datasets (12 of ~19 required)

**Transportation:**
✅ **MATA Routes** - Transit network (corridor matching)
✅ **STRAHNET Routes** - Strategic highway network (corridor matching)
✅ **MPO Freight Route Network** - Regional/local freight routes (corridor matching, color-coded)
✅ **Bridges** - NBI structures (proximity analysis)

**Economic Development:**
✅ **Opportunity Zones** - Census tracts (intersection detection)
✅ **MPO Freight Zones** - Freight activity areas (intersection detection)
✅ **Major Employers** - Employment centers (proximity analysis)
✅ **Tourist Destinations** - Attractions (proximity analysis)

**Historic & Cultural:**
✅ **NHRP Polygons** - Historic districts (proximity analysis)
✅ **NHRP Points** - Historic sites (proximity analysis)

**Environment & Recreation:**
✅ **Parks** - Public parks (proximity analysis)
✅ **EPA Superfund Sites** - Cleanup locations (proximity analysis)

### Required for v1.0 (7 additional datasets)

**Transportation:** Congested Segments (ArcGIS Feature Service), High Injury Corridors, Crash Locations (counting logic), Greenprint Plan Network (bike infrastructure - CRITICAL)

**Environmental/EJ:** Wetlands, Streams, ALICE criteria (TBD)

## Critical Development Priorities

### ✅ COMPLETED (v0.6.0)

**Architecture Refactor** - ✅ DONE
- ✅ Created configuration-driven system with centralized `DATASETS` config object
- ✅ Each dataset specifies: type, analysis method, buffer distance, property mappings
- ✅ Replaced hardcoded functions with three generic analysis methods
- ✅ Support for conditional styling via `styleByProperty`
- ✅ Support for static labels via `staticLabel`
- ✅ New datasets can be added by updating config only—NO new code required
- ✅ Integrated 12 datasets using new architecture

### 🔴 BLOCKING for v1.0

**Specialized Analysis Logic:**
- Crash counting/aggregation (not just listing features)
- ALICE criteria evaluation (thresholds TBD by RTP team)
- ArcGIS Feature Service integration for large datasets

### 🟡 Data Integration

**Large file concern:** Congested Segments dataset will be very large (Streetlight data). May require ArcGIS Online hosting instead of local GeoJSON.

**Special logic needed:**
- Crash Locations: Counting/aggregation logic (not just listing)
- ALICE criteria: Thresholds and criteria still being defined by RTP team
- Greenprint Network: May consist of multiple files/layers

### 🟢 User Experience

- Context-aware empty result messages
- Confirmation dialog for "Clear & Start Over"
- Real-time validation feedback

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

### Testing Locally

```bash
# Serve with Python
python -m http.server 8000

# Or use any static file server
# Open http://localhost:8000
```

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
- **ArcGIS Feature Service integration** - For large datasets (Congested Segments)
- **Specialized analysis logic** - Counting, aggregation, thresholds (for crashes, ALICE, etc.)
- **Dataset integration** - 7 more datasets needed for v1.0
- **User feedback messages** - Empty states, validation, confirmation dialogs
- **PDF report improvements** - Better formatting, more context

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
2. **For ALICE criteria**: What are the specific thresholds and data sources? (Still TBD with RTP team)
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
