# Memphis MPO Project Application Tool - Claude Context

## Project Overview

This is a web-based mapping tool for the Memphis Metropolitan Planning Organization's Regional Transportation Plan (RTP) 2055. It allows users to draw transportation project alignments or mark locations on an interactive map, then automatically performs spatial analysis to identify intersecting or nearby infrastructure and planning features. The tool generates a PDF report summarizing the findings.

**Current Status:** v0.4.1 (active development, not production-ready)

**Primary User:** Engineers from MPO partner agencies will use tool to create pdf reports which they submit as part of project applications. MPO staff will use the pdf reports to evalute project applications.

## Architecture & Tech Stack

This is a **single-page HTML application** with all code in `index.html`:
- **Leaflet.js** (v1.9.4) - Interactive mapping
- **Leaflet.Draw** (v1.0.4) - Drawing controls
- **Turf.js** (v6.5.0) - Geospatial analysis
- **jsPDF** (v2.5.1) - PDF generation
- **html2canvas** (v1.4.1) - Map screenshot capture

**No build process, no bundler** - Everything runs in the browser.

## File Structure

```
project-application-tool/
├── index.html              # Single-file application (~1400 lines)
├── data/                   # GeoJSON datasets
│   ├── mata-routes.json    # Transit routes (LineString)
│   ├── opportunity-zones.json  # Census tracts (Polygon)
│   └── bridges.json        # Bridge locations (Point)
├── assets/
│   └── rtp-2055-logo.jpg   # RTP header logo for PDF
└── README.md
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

### Current Datasets (3 of ~16 required)

✅ **MATA Routes** - Transit network (corridor matching)
✅ **Opportunity Zones** - Census tracts (intersection detection)
✅ **Bridges** - NBI structures (proximity analysis)

### Required for v1.0 (13 additional datasets)

**Transportation:** Congested Segments, High Injury Corridors, STRAHNET, Crash Locations, Greenprint Plan Network (bike infrastructure)

**Freight:** MPO Freight Route Network, MPO Freight Zones

**Activity Centers:** Major Employers, Tourist Destinations

**Environmental/EJ:** Parks, Wetlands, Streams, NHRP Sites/Districts, Superfund Sites, ALICE criteria (TBD)

## Critical Development Priorities

### 🔴 BLOCKING for v1.0

**Architecture Refactor** - The current implementation has hardcoded analysis functions for each dataset (e.g., `findIntersectingRoutes()`, `findIntersectingZones()`). This is not scalable for 16+ datasets.

**Required before adding more datasets:**
- Create configuration-driven system with a `DATASETS` config object
- Each dataset specifies: type, analysis method, buffer distance, property mappings
- Replace hardcoded functions with generic analysis methods
- Support special logic (counting crashes, ALICE thresholds) via config flags
- New datasets should be added by updating config, NOT writing new code

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
   - Sidebar for controls and results
   - Map container
   - Welcome modal

2. **CSS Styles** (~400 lines)
   - Responsive layout (desktop only, 1024px min)
   - Custom Leaflet control styling

3. **JavaScript** (~900 lines)
   - Configuration object (`CONFIG`, line ~535)
   - Map initialization
   - Drawing event handlers
   - Analysis functions (one per dataset currently)
   - PDF generation
   - Results display

## Important Configuration

Key parameters in the `CONFIG` object:

```javascript
CONFIG = {
    bridgeBufferDistance: 300,  // Buffer for proximity analysis (feet)
    minLineLength: 100,         // Minimum valid project length (feet)
    dataUrls: {
        routes: 'data/mata-routes.json',
        zones: 'data/opportunity-zones.json',
        bridges: 'data/bridges.json'
    }
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

**Current approach (manual, to be replaced):**
1. Add GeoJSON to `/data/`
2. Update `CONFIG.dataUrls`
3. Create analysis function (e.g., `findIntersectingBikeRoutes()`)
4. Add results section in sidebar HTML
5. Update PDF generation logic

**Target approach (configuration-driven):**
- Define in config with analysis type, buffer, properties
- Generic functions handle analysis
- No new code required

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

- **Configuration-driven architecture** - This is the #1 blocker for v1.0
- **Dataset integration** - 13 more datasets needed
- **User feedback messages** - Empty states, validation, confirmation dialogs
- **PDF report improvements** - Better formatting, more context
- **Special analysis logic** - Counting, aggregation, thresholds (for crashes, ALICE, etc.)

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
