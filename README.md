# Memphis MPO Project Application Tool

![Version](https://img.shields.io/badge/version-0.7.0-blue) ![Status](https://img.shields.io/badge/status-in%20development-yellow)

**⚠️ This tool is currently in active development (v0.7.0) and not yet released for production use.**

A web-based mapping tool for analyzing transportation project proposals against regional planning datasets. Built for the Memphis Metropolitan Planning Organization's Regional Transportation Plan (RTP) 2055.

🔗 **Development Preview:** [https://mavrick-f.github.io/project-application-tool/](https://mavrick-f.github.io/project-application-tool/)

## Overview

This tool allows users to draw project alignments or mark specific locations on an interactive map, then automatically identifies intersecting or nearby transportation infrastructure and planning features. The tool generates a PDF report summarizing the spatial relationships between the proposed project and key regional datasets.

**Current Status (v0.7.0):** Codebase refactored into modular architecture with 7 separate files for improved maintainability. Core spatial analysis engine supports 12 datasets across multiple geometry types using a scalable, configuration-driven system. Significant work remains before v1.0 release:
- Integration of remaining ~7 required regional planning datasets
- User experience improvements and documentation
- Potential ArcGIS Feature Service integration for large datasets

See **Data Requirements** section below for full dataset roadmap.

## Features

### Drawing Tools
- **Line Drawing**: Draw corridor alignments for linear projects (roads, trails, transit routes)
- **Point Marking**: Mark specific locations for intersection improvements or spot projects
- **Interactive Map**: Pan, zoom, and draw on a CartoDB Voyager basemap

### Spatial Analysis
The tool performs automated spatial analysis using three different methods:

**1. Corridor Matching (for line features):**
- Creates configurable buffer around drawn line (typically 100ft)
- Checks route segments for overlap with buffer
- Requires minimum shared length (typically 300ft)
- Applies special handling (e.g., removing directional suffixes, deduplication)

**2. Intersection Detection (for polygon features):**
- Uses `turf.booleanIntersects()` for line-to-polygon
- Uses `turf.booleanPointInPolygon()` for point-in-polygon

**3. Proximity Analysis (for point features):**
- Creates configurable buffer around drawn geometry
- Identifies all features within specified distance

**Current implementation (v0.7.0)** analyzes against 12 datasets:
- **MATA Routes** - Transit route network
- **STRAHNET Routes** - Strategic Highway Network
- **MPO Freight Route Network** - Regional/local freight routes with color-coding
- **Opportunity Zones** - Census tract designations
- **MPO Freight Zones** - Designated freight activity areas
- **Parks** - Public park boundaries
- **NHRP Polygons** - Historic district boundaries
- **Bridges** - Bridge inventory with conditions
- **Major Employers** - Significant employment centers
- **Tourist Destinations** - Regional attractions
- **NHRP Points** - Historic sites (individual)
- **EPA Superfund Sites** - Environmental cleanup locations

**Planned for v1.0:** Analysis will expand to include congested segments, high injury corridors, crash locations, bike networks, and additional environmental/EJ features. See **Data Requirements** section for complete list.

### Report Generation
- Real-time results display in sidebar as you draw
- Downloadable PDF report with:
  - Static map showing project location
  - Complete list of intersecting features
  - Bridge inventory table (NBI IDs and conditions)
  - Project length, metadata, and timestamp

## Data Requirements

### Implemented Datasets (v0.7.0)

**Transportation:**
- ✅ **MATA Routes** (lines) - Transit route network
- ✅ **STRAHNET Routes** (lines) - Strategic Highway Network routes
- ✅ **MPO Freight Route Network** (lines) - Regional and local freight routes (color-coded)
- ✅ **Bridges** (points) - Bridge inventory with conditions

**Economic Development:**
- ✅ **Opportunity Zones** (polygons) - Census tract designations
- ✅ **MPO Freight Zones** (polygons) - Designated freight activity areas
- ✅ **Major Employers** (points) - Significant employment centers
- ✅ **Tourist Destinations** (points) - Regional attractions

**Historic & Cultural:**
- ✅ **NHRP Polygons** (polygons) - Historic district boundaries
- ✅ **NHRP Points** (points) - Individual historic sites

**Environment & Recreation:**
- ✅ **Parks** (polygons) - Public park boundaries
- ✅ **EPA Superfund Sites** (points) - Environmental cleanup locations

### Required for v1.0 Release

**Transportation Infrastructure:**
- ❌ **Congested Segments** (lines) - Streetlight data with Level of Travel Time Reliability and "Is Congested" flag
  - *Note: Will be a large file; strong candidate for ArcGIS Feature Service integration*
- ❌ **High Injury Corridors** (lines) - Safety priority corridors
- ❌ **Crash Locations** (points) - Fatality and Serious Injury crashes
  - *Requires counting logic for aggregation*
- ❌ **Greenprint Plan Network** (lines) - Regional/Intermediate Shared-Use Path and Bikeway connections
  - *May consist of multiple files/layers*

### Environmental Justice & Environmental Layers
*Status: Partially speculative - criteria under review by RTP team*

**Environmental Justice:**
- ❌ **ALICE-Related Criteria** (TBD) - Asset Limited, Income Constrained, Employed populations
  - *Specific layers and thresholds being determined by RTP team*

**Environmental Features:**
- ❌ **Parks** (polygons) - Public park boundaries
- ❌ **Wetlands** (polygons) - Regulated wetland areas
- ❌ **Streams** (lines) - Waterway network
- ❌ **NHRP Sites** (points) - National Register of Historic Places individual sites
- ❌ **NHRP Districts** (polygons) - Historic district boundaries
- ❌ **Superfund Sites** (points/polygons) - EPA Superfund locations

**Excluded from Scope:**
- Pavement condition data (applicants provide PCI directly)

## Usage

### For End Users

1. **Draw Your Project**
   - Click "Draw Alignment (Line)" for corridor projects
   - Click "Mark Location (Point)" for specific locations
   - Click on the map to place vertices (line) or drop a marker (point)
   - Double-click or click "Finish" to complete drawing

2. **Review Results**
   - Analysis results appear automatically in the left sidebar
   - Results update in real-time as you draw

3. **Generate Report**
   - Enter a project name
   - Click "Download PDF Report"
   - PDF saves with filename: `Project_Application_[ProjectName]_[Date].pdf`

4. **Start Over**
   - Click "Clear & Start Over" to reset and draw a new project

### Technical Requirements
- Desktop browser (minimum 1024px width)
- Modern browser with JavaScript enabled (Chrome, Firefox, Safari, Edge)

## Technical Details

### Architecture

**Modular JavaScript Application (v0.7.0)** with 7 focused files:

**Core Files:**
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

**Configuration-Driven Design:**
The application uses a centralized `DATASETS` configuration object that defines all dataset properties:
- File paths and geometry types
- Analysis methods (corridor, intersection, proximity)
- Buffer distances and thresholds
- Display fields and styling
- Special handling rules (deduplication, suffix removal, etc.)
- Conditional styling (e.g., color-coding by property value)

This approach allows new datasets to be added by simply defining their configuration—no new code required.

### Data Structure

All datasets are stored as GeoJSON files in `/data/`:

```
data/
├── mata-routes.json              # Transit route lines
├── strahnet.geojson              # Strategic highway network
├── truck_routes.json             # Freight routes (regional/local)
├── opportunity-zones.json        # Census tract polygons
├── freight_clusters.geojson      # Freight activity zones
├── parks.json                    # Public parks
├── historic_polygons.geojson     # Historic districts
├── bridges.json                  # Bridge point locations
├── major_employers.geojson       # Employment centers
├── tourist_attractions.geojson   # Tourist destinations
├── historic_points.geojson       # Historic sites (individual)
└── epa_superfund_sites.geojson  # EPA cleanup sites
```

**GeoJSON Requirements:**
- Must include valid `geometry` (Point, LineString, or Polygon)
- Must include `properties` object with required display fields as defined in DATASETS config
- Fields are case-sensitive and must match configuration exactly

### DATASETS Configuration

Each dataset is defined in the `DATASETS` object with the following properties:

```javascript
datasetKey: {
  id: 'datasetKey',
  name: 'Display Name',
  category: 'Category for grouping',
  filePath: './data/filename.json',
  geometryType: 'Point' | 'LineString' | 'Polygon',
  analysisMethod: 'corridor' | 'intersection' | 'proximity',
  bufferDistance: 100,              // For corridor analysis (feet)
  minSharedLength: 300,             // Minimum overlap (feet)
  proximityBuffer: 200,             // For proximity analysis (feet)
  properties: {
    displayField: 'FieldName',      // Field to show in tooltips/results
    staticLabel: 'Label',           // Optional: static text instead of field
    additionalFields: ['Field1']    // For table-style results
  },
  specialHandling: {
    removeDirectionalSuffixes: true,
    deduplicate: true
  },
  style: { /* Leaflet style object */ },
  styleByProperty: {                // Optional: conditional styling
    field: 'Type',
    values: {
      'Value1': { color: '#CC0000' },
      'Value2': { color: '#FF9900' }
    }
  },
  resultStyle: 'list' | 'table',
  enabled: true
}
```

### Generic Analysis Functions

Three generic functions handle all spatial analysis:

1. **`analyzeCorridorMatch()`** - For LineString datasets
   - Creates buffer, checks overlap length, applies special handling

2. **`analyzeIntersection()`** - For Polygon datasets
   - Boolean intersection tests for lines and points

3. **`analyzeProximity()`** - For Point datasets
   - Buffer-based proximity detection

**Master orchestration:** `analyzeAllDatasets()` loops through all enabled datasets and calls the appropriate analysis function based on each dataset's `analysisMethod`.

## Development

### Local Setup

1. Clone the repository:
```bash
git clone https://github.com/mavrick-f/project-application-tool.git
cd project-application-tool
```

2. Serve locally (Python example):
```bash
python -m http.server 8000
```

3. Open browser to `http://localhost:8000`

### File Structure

```
project-application-tool/
├── index.html              # HTML structure and script tags (~140 lines)
├── styles.css              # All CSS styling (~400 lines)
├── datasets.js             # Configuration data (~400 lines)
├── map.js                  # Map and drawing controls (~300 lines)
├── analysis.js             # Spatial analysis (~550 lines)
├── pdf.js                  # PDF generation (~450 lines)
├── app.js                  # App initialization & events (~900 lines)
├── data/                   # GeoJSON datasets
│   ├── mata-routes.json
│   ├── opportunity-zones.json
│   └── bridges.json
├── assets/
│   └── rtp-2055-logo.jpg   # Header logo
├── VERSION.md              # Version history
└── README.md
```

### Adding New Datasets

**Current approach (v0.7.0)** - configuration-driven:

1. **Add GeoJSON file to `/data/` directory**

2. **Define dataset in DATASETS object** (around line 648):
```javascript
newDataset: {
  id: 'newDataset',
  name: 'Display Name',
  category: 'Category',
  filePath: './data/new-dataset.json',
  geometryType: 'Point',           // or 'LineString' or 'Polygon'
  analysisMethod: 'proximity',     // or 'corridor' or 'intersection'
  proximityBuffer: 500,            // distance in feet
  properties: {
    displayField: 'NAME'           // field to display in results
  },
  style: {
    color: '#FF0000',
    fillColor: '#FF0000',
    radius: 4,
    fillOpacity: 0.8,
    weight: 1
  },
  resultStyle: 'list',
  enabled: true
}
```

3. **That's it!** The system automatically:
   - Loads the dataset on initialization
   - Creates map layers with proper styling and tooltips
   - Runs appropriate spatial analysis
   - Displays results in the sidebar
   - Includes data in PDF reports

**Advanced features:**
- Use `staticLabel` for constant tooltip text
- Use `styleByProperty` for conditional styling based on feature properties
- Use `specialHandling` for deduplication or suffix removal
- Use `additionalFields` for table-style results with multiple columns

## Known Limitations

**Development Status (v0.7.0):**
- 12 of ~19 required datasets currently integrated
- Large datasets (Congested Segments, Crash Locations) may require ArcGIS Feature Service integration
- Some specialized analysis logic (crash counting, ALICE criteria) not yet implemented

**Current Functionality:**
- Desktop-only (requires 1024px minimum width)
- No data persistence (refresh clears all work)
- PDF generation requires all map layers to load
- No undo/redo functionality during drawing
- Route corridor matching is computationally intensive for very long lines
- Analysis runs synchronously (may cause brief UI freeze on very large projects)

## Development Roadmap

### v0.7.0 - Completed ✅
- ✅ **Refactored monolithic index.html into modular architecture**
  - Split 3200+ line file into 7 focused modules
  - Maintained all functionality with zero breaking changes
  - Added cache busting with `?v=0.7.0` query strings
  - Improved code maintainability and organization
- ✅ **Updated all documentation** (README, VERSION.md, claude.md)

### v0.6.0 - Completed ✅
- ✅ **Refactored to configuration-driven dataset system**
  - Created centralized DATASETS config object
  - Implemented three generic analysis functions (corridor, intersection, proximity)
  - Dynamic layer creation, tooltip generation, and PDF reporting
  - Support for conditional styling via `styleByProperty`
  - Support for static labels via `staticLabel`
- ✅ **Integrated 12 datasets** across all geometry types
- ✅ **Prepared for ArcGIS Feature Service integration** (architecture in place)

### Priority for v1.0 Release

**Data Integration (Required):**
- [ ] **Transportation datasets** (4 layers remaining)
  - Congested Segments (integrate via ArcGIS Feature Service)
  - High Injury Corridors
  - Crash Locations (implement counting/aggregation logic)
  - Greenprint Plan Network (CRITICAL - bike infrastructure)

- [ ] **Environmental** (~3 layers)
  - Wetlands
  - Streams
  - ALICE-related criteria (coordinate with RTP team)

**Critical Features:**
- [ ] **Specialized analysis logic**
  - Crash counting within proximity buffer
  - ALICE criteria evaluation
  - Custom aggregation for Feature Service queries

**User Experience:**
- [ ] **Improved user feedback**
  - Context-aware empty result messages
  - Confirmation dialog for "Clear & Start Over"
  - Real-time validation feedback
  - Loading indicators for Feature Service requests

### Potential Post-v1.0 Enhancements

- [ ] **Enhanced functionality**
  - Save/load projects from local storage
  - Export results as CSV/GeoJSON
  - Toggle layer visibility on map
  - Clickable results to highlight features

- [ ] **Performance optimization**
  - Implement spatial indexing for large datasets
  - Progressive loading for heavy layers
  - Client-side caching strategies

- [ ] **Additional datasets**
  - Datasets identified during RTP development
  - Stakeholder-requested layers

## Browser Support

Tested and working on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Acknowledgments

Originally Built by Mavrick Fitzgerald using Claude Code. Built using open-source mapping and geospatial libraries. Basemap provided by CARTO and OpenStreetMap contributors.

---

**Memphis Metropolitan Planning Organization** | Regional Transportation Plan 2055  
*For questions or feedback during development, please use GitHub Issues.*
