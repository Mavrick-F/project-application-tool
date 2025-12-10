# Memphis MPO Project Application Tool

![Version](https://img.shields.io/badge/version-0.4.0-blue) ![Status](https://img.shields.io/badge/status-in%20development-yellow)

**⚠️ This tool is currently in active development (v0.4.0) and not yet released for production use.**

A web-based mapping tool for analyzing transportation project proposals against regional planning datasets. Built for the Memphis Metropolitan Planning Organization's Regional Transportation Plan (RTP) 2055.

🔗 **Development Preview:** [https://mavrick-f.github.io/project-application-tool/](https://mavrick-f.github.io/project-application-tool/)

## Overview

This tool allows users to draw project alignments or mark specific locations on an interactive map, then automatically identifies intersecting or nearby transportation infrastructure and planning features. The tool generates a PDF report summarizing the spatial relationships between the proposed project and key regional datasets.

**Current Status (v0.4.0):** Core spatial analysis engine is functional with three sample datasets (transit routes, opportunity zones, bridges) representing different geometry types. Significant work remains before v1.0 release:
- Architecture refactoring for scalable dataset management
- Integration of ~16 required regional planning datasets
- User experience improvements and documentation

See **Data Requirements** section below for full dataset roadmap.

## Features

### Drawing Tools
- **Line Drawing**: Draw corridor alignments for linear projects (roads, trails, transit routes)
- **Point Marking**: Mark specific locations for intersection improvements or spot projects
- **Interactive Map**: Pan, zoom, and draw on a CartoDB Voyager basemap

### Spatial Analysis
The tool performs automated spatial analysis. **Current implementation (v0.4.0)** identifies:
- **Transit Routes**: MATA bus routes running parallel to or intersecting the project (300ft corridor matching with minimum 300ft shared length)
- **Opportunity Zones**: Census tracts designated as Opportunity Zones that the project crosses
- **Bridges**: Bridge structures within 300 feet of the project alignment

**Planned for v1.0:** Analysis will expand to include transportation infrastructure (congested segments, high injury corridors, bike networks), freight networks, activity centers, and environmental/EJ features. See **Data Requirements** section for complete list.

### Report Generation
- Real-time results display in sidebar as you draw
- Downloadable PDF report with:
  - Static map showing project location
  - Complete list of intersecting features
  - Bridge inventory table (NBI IDs and conditions)
  - Project metadata and timestamp

## Data Requirements

### Current Datasets (v0.4.0)
✅ **MATA Routes** (lines) - Transit route network  
✅ **Opportunity Zones** (polygons) - Census tract designations  
✅ **Bridges** (points) - Bridge inventory with conditions  

### Required for v1.0 Release

**Transportation Infrastructure:**
- ❌ **Congested Segments** (lines) - Streetlight data with Level of Travel Time Reliability and "Is Congested" flag
  - *Note: Will be a large file; strong candidate for ArcGIS Online hosting*
- ❌ **High Injury Corridors** (lines) - Safety priority corridors
- ❌ **STRAHNET Corridors** (lines) - Strategic Highway Network routes
- ❌ **Crash Locations** (points) - Fatality and Serious Injury crashes
  - *Requires counting logic for aggregation*
- ❌ **Greenprint Plan Network** (lines) - Regional/Intermediate Shared-Use Path and Bikeway connections
  - *May consist of multiple files/layers*

**Freight:**
- ❌ **MPO Freight Route Network** (lines) - Regional and local freight routes
- ❌ **MPO Freight Zones** (polygons) - Designated freight zones with names

**Land Use/Activity Centers:**
- ❌ **Major Employers** (points) - Significant employment centers
  - *Source data TBD*
- ❌ **Tourist/Travel Destinations** (points) - Regional attractions and destinations
  - *May need manual digitization*

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

**Single-page HTML application** using:
- **Leaflet.js** (v1.9.4) - Interactive mapping
- **Leaflet.Draw** (v1.0.4) - Drawing controls
- **Turf.js** (v6.5.0) - Geospatial analysis
- **jsPDF** (v2.5.1) - PDF generation
- **html2canvas** (v1.4.1) - Map screenshot capture

### Data Structure

All datasets are stored as GeoJSON files in `/data/`:

```
data/
├── mata-routes.json        # Transit route lines
├── opportunity-zones.json  # Census tract polygons
└── bridges.json           # Bridge point locations
```

**GeoJSON Requirements:**
- Must include valid `geometry` (Point, LineString, or Polygon)
- Must include `properties` object with required fields:
  - Routes: `Name` (string)
  - Zones: `CENSUSTRAC` (string)
  - Bridges: `STRUCTURE_` (string), `Condition` (string)

### Analysis Methods

**Corridor Matching (Lines):**
- Creates 100ft buffer around drawn line
- Checks each route segment for overlap with buffer
- Requires minimum 300ft of parallel/shared length
- Removes directional suffixes (IB/OB/EB/WB) and deduplicates

**Intersection Detection (Polygons):**
- Uses `turf.booleanIntersects()` for line-to-polygon
- Uses `turf.booleanPointInPolygon()` for point-in-polygon

**Proximity Analysis (Points):**
- Creates 300ft buffer around drawn geometry
- Uses `turf.booleanPointInPolygon()` to check if features fall within buffer

### Configuration

Key parameters in `CONFIG` object (line 535):
```javascript
bridgeBufferDistance: 300      // Buffer distance in feet for bridge proximity
minLineLength: 100             // Minimum project length in feet (validation)
```

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
├── index.html              # Main application (all-in-one file)
├── data/                   # GeoJSON datasets
│   ├── mata-routes.json
│   ├── opportunity-zones.json
│   └── bridges.json
├── assets/
│   └── rtp-2055-logo.jpg   # Header logo
└── README.md
```

### Adding New Datasets

**Current approach (v0.4.0)** - manual and requires code changes:
1. Add GeoJSON file to `/data/`
2. Update `CONFIG.dataUrls` object
3. Create new analysis function (e.g., `findIntersectingBikeRoutes()`)
4. Add results display section in sidebar
5. Update PDF generation logic

**Target approach (v1.0)** - configuration-driven:
- Define dataset in config object with type, analysis method, and property mappings
- Generic analysis functions handle all dataset types
- Support special logic (counting, aggregation, custom criteria) via config flags
- Add new datasets without writing new code
- This refactor must be completed before integrating the remaining ~13 required datasets
- See Development Roadmap for implementation priority

## Known Limitations

**Development Status (v0.4.0):**
- Only 3 of ~16 required datasets currently integrated
- Architecture requires refactoring for scalable dataset management before adding remaining layers
- Hardcoded analysis functions need generalization
- Large datasets (Congested Segments) may require external hosting (ArcGIS Online)

**Current Functionality:**
- Desktop-only (requires 1024px minimum width)
- No data persistence (refresh clears all work)
- PDF generation requires all map layers to load
- No undo/redo functionality during drawing
- Route corridor matching is computationally intensive for very long lines

## Development Roadmap

### Priority for v1.0 Release

**Core Architecture (Blocking):**
- [ ] **Refactor to configuration-driven dataset system**
  - Create DATASETS config for easy addition of new data layers
  - Replace hardcoded analysis functions with generic methods
  - Support for different buffer distances and analysis methods per dataset
  - Support for special logic (e.g., crash counting, ALICE criteria)

**Critical User Experience:**
- [ ] **Welcome/tutorial popup**
  - Explain line vs point drawing
  - Clarify corridor matching requirements
  - Show example use cases

- [ ] **Improved user feedback**
  - Context-aware empty result messages
  - Confirmation dialog for "Clear & Start Over"
  - Real-time validation feedback

**Data Integration (Required):**
- [ ] **Transportation datasets** (5 layers)
  - Congested Segments (investigate ArcGIS Online hosting)
  - High Injury Corridors
  - STRAHNET Corridors
  - Crash Locations (implement counting logic)
  - Greenprint Plan Network (CRITICAL - bike infrastructure)

- [ ] **Freight datasets** (2 layers)
  - MPO Freight Route Network
  - MPO Freight Zones

- [ ] **Activity centers** (2 layers)
  - Major Employers (finalize data source)
  - Tourist/Travel Destinations

- [ ] **Environmental Justice & Environmental** (~7 layers)
  - Coordinate with RTP team on ALICE criteria
  - Parks, Wetlands, Streams
  - NHRP Sites and Districts
  - Superfund Sites

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
