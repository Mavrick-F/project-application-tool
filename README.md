# Memphis MPO Project Application Tool

![Version](https://img.shields.io/badge/version-0.9.0-blue) ![Status](https://img.shields.io/badge/status-feature%20complete-brightgreen)

A web-based mapping tool for analyzing transportation project proposals against regional planning datasets. Built for the Memphis Metropolitan Planning Organization's Regional Transportation Plan (RTP) 2055.

🔗 **Development Preview:** [https://mavrick-f.github.io/project-application-tool/](https://mavrick-f.github.io/project-application-tool/)

## Overview

Users draw project alignments or mark specific locations on an interactive map. The tool automatically identifies intersecting or nearby transportation infrastructure and planning features, then generates a PDF report summarizing the findings.

**Current Status:** v0.9.0 - Feature complete with all 19 core datasets integrated. Ready for v1.0 release.

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
- Bridge inventory table with NBI IDs and conditions
- Project length, metadata, and timestamp

## Integrated Datasets (19 total)

**Transportation (8):**
- MATA Routes - Transit network
- STRAHNET Routes - Strategic Highway Network
- Freight Routes - Regional/local freight routes (color-coded)
- Crash Locations (KSI) - Fatal and Suspected Serious Injury crashes (counting by severity)
- High Injury Corridors - Safety priority corridors
- Greenprint Bike Network - Regional/Intermediate/Local routes (dashed, color-coded)
- Travel Time Reliability - Road segments with reliability status (length summation)
- Bridges - Bridge inventory with conditions

**Economic Development (5):**
- Opportunity Zones - Census tract designations
- ALICE ZCTAs - Economic distress indicators (≥45% threshold, shows % below ALICE)
- Freight Zones - Designated freight activity areas
- Major Employers - Significant employment centers
- Tourist Destinations - Regional attractions

**Historic & Cultural (2):**
- NHRP Polygons - Historic district boundaries
- NHRP Points - Individual historic sites

**Environment & Recreation (5):**
- Parks - Public park boundaries
- Wetlands - Wetland areas, with forested wetlands captured as a second "Critical Wetlands" feature
- Flood Zones 100-year flood-plains
- EPA Superfund Sites - Environmental cleanup locations


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

**7 modular files** (vanilla JavaScript, no build process):
- `index.html` - HTML structure
- `styles.css` - All CSS styling
- `datasets.js` - Configuration (CONFIG and DATASETS objects)
- `map.js` - Map initialization, layers, drawing controls
- `analysis.js` - Spatial analysis functions
- `pdf.js` - PDF generation
- `app.js` - Application initialization and event handlers

**External libraries** (via CDN):
- Leaflet.js (v1.9.4) - Interactive mapping
- Leaflet.Draw (v1.0.4) - Drawing controls
- Turf.js (v6.5.0) - Geospatial analysis
- jsPDF (v2.5.1) - PDF generation
- html2canvas (v1.4.1) - Map capture

### Adding New Datasets

**Configuration-driven** - add datasets by updating `datasets.js` only:

```javascript
newDataset: {
  id: 'newDataset',
  name: 'Display Name',
  category: 'Transportation',          // or 'Economic' or 'Environmental'
  filePath: './data/new-dataset.json',
  geometryType: 'Point',               // or 'LineString' or 'Polygon'
  analysisMethod: 'proximity',         // or 'corridor' or 'intersection'
  proximityBuffer: 500,                // distance in feet
  properties: {
    displayField: 'NAME'               // field to display in results
  },
  style: {
    color: '#FF0000',
    weight: 2,
    opacity: 0.7
  },
  enabled: true
}
```

**Advanced config options:**
- `staticLabel` - Show constant text instead of field value
- `styleByProperty` - Conditional styling (e.g., color-code by type)
- `specialHandling` - Deduplication, suffix removal
- `additionalFields` - Multi-column table results
- `hideInPdfRendering` - Exclude from PDF map capture

System automatically handles:
- Data loading and validation
- Layer creation with tooltips
- Spatial analysis
- Results display
- PDF report inclusion

### Data Requirements

All datasets must be:
- Valid GeoJSON with `geometry` and `properties`
- WGS84 coordinate system (EPSG:4326)
- Property fields matching DATASETS config (case-sensitive)

Expected Memphis bounds: lng -90.1 to -89.6, lat 34.9 to 35.3

## Known Limitations

- **Desktop only** - Requires 1024px minimum width (complex mapping UI)
- **No data persistence** - Refresh clears all work (by design)
- **PDF capture timing** - Must wait for all layers to render (~20 seconds with many features)
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
