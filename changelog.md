# Version History

## v1.0.1 (2026-01-27)
- Improve PDF map zoom with fractional zoom levels
- Fix STRAHNET deduplication to appear once in PDF
- Add PDF footer disclaimer and reduce legend size
- Reduce legend size
- Add configurable showFullLayerInPdf option for datasets, enabled for STRAHNET

## v1.0 (2026-01-22)
### User Interface
- Added info tooltips to all 20 datasets with explanatory text about data sources, analysis implications, and regulatory requirements
- Tutorial popup now displays on every page load
- Map tooltips now show all configured additional fields for line features, not just primary display field
- PDF improvements: color-coded dataset names match map layers, centered category headers

### Analysis
- **STRAHNET**: Changed from parallel corridor matching to intersection-based detection with 100ft buffer for improved accuracy
- **Travel Time Reliability**: Changed from median to length-weighted mean LOTTR calculation (longer segments have proportionally more influence on result)
- **Line-to-line intersection**: Enhanced intersection analysis to support buffer distance for LineString features

### Data & Performance
- Updated NHRP Polygons with improved historic polygon boundaries for better geographic accuracy
- Added cache-busting query parameters (`?v=1.0`) to all GeoJSON file fetches to prevent stale browser cache issues
- Removed Feature Service cache - every drawn project creates a unique bounding box, so cache hits never occurred

### Documentation
- Consolidated VERSION.MD into changelog

---

## v0.9.5 (2026-01-16)
- Changed Travel Time Reliability calculation from mean to median LOTTR to prevent congested intersection segments from dominating results
- Removed inconsistent bold styling from result items
- Renamed analysis methods to standardized verbFunction style for greater clarity

## v0.9.4 (2026-01-16)
- Redesigned header with landscape RTP 2055 logo and clean white/gray aesthetic
- Added XSS prevention for GeoJSON property rendering and SRI integrity hashes for CDN dependencies
- Added measurement tool for on-map distance calculations
- Added projectCoverage analysis method for to show how much of project is on a High Injury Corridor

## v0.9.3 (2026-01-14)
- Migrated dataset configuration from JavaScript to self-documenting YAML format
- Organized core application files into `src/` folder
- Improved map zoom to show 5% padding instead of 50% for tighter focus on corridors

## v0.9.2 (2026-01-14)
- Travel Time Reliability now shows percentages instead of absolute miles for dual carriageway accuracy
- Organized all 20 datasets alphabetically within their three categories
- Recolored and resized many features, including enhanced bridge styling with condition-based colors (Good=Green, Fair=Gold, Poor=Red)

## v0.9.1 (2026-01-12) - Feature Complete
- Implemented lazy loading for ArcGIS Online: Feature services query on project draw (not at startup) with 200ft bounding box filter for fast performance
- Integrated ArcGIS Feature Services for Wetlands, Critical Wetlands, and Flood Zones with lazy-loading
- Organized all datasets into three categories: Transportation, Economic Development, Environmental/Cultural
- Draw tools now grey out after project is drawn, re-enable on "Clear & Start Over"
- User-selected layers are now temporarily removed before adding filtered result layers to prevent visual clutter
- Removed multilinestring features from data. Supporting them was more trouble than it was worth

## v0.9.0 (2026-01-09)
- Integrated Travel Time Reliability dataset (17 total datasets complete)
- Added corridor length by status analysis method
- Implemented PDF layer exclusion option via `hideInPdfRendering` config
- First attempt at loading environmental features from AGOL failed

---

## v0.8.3 (2026-01-08)
- Fixed PDF layer alignment issue by switching Leaflet renderer from SVG to Canvas to eliminate html2canvas transform handling issues - 
this prevents layer features from appearing offset to the northwest of the basemap
- All GeoJSON/vector layers now render as canvas instead of SVG with no visual degradation
- Removed ~180 lines of unused transform manipulation code from pdf.js
- Removed deprecated `analyzeIntersections()` and `findNearbyBridges()` functions replaced by generic analysis methods

## v0.8.2 (2026-01-07)
- Redesigned color scheme to eliminate layer conflicts and make red project line stand out with no competing colors
- Increased project line thickness from 8px to 12px for maximum visibility

## v0.8.1 (2026-01-07)
- Implemented filtered layer rendering for PDF generation - only matched features appear in PDF maps instead of all 10,000+ features - MUCH cleaner appearance, also unexpectedly helped with PDF zoom
- Reduced PDF generation time from ~20 seconds to ~5-10 seconds (60-75% faster)
- Modified all analysis functions to return complete GeoJSON Feature objects with geometry for filtered rendering

## v0.8.0 (2026-01-05)
- Added 4 critical datasets: High Injury Corridors (safety priority corridors), Crash Locations (KSI - fatal and suspected serious injury crashes), 
Greenprint Bike Network (regional/intermediate/local bike routes), ALICE ZCTAs (economic distress indicators)
- Implemented proximity counting analysis for aggregated point data with category breakdown (e.g., crash severity)
- Added threshold-based filtering with translucent styling for polygon datasets (e.g., ALICE ZCTAs ≥45% threshold)
- Enhanced tooltips to show additional fields like crash severity details and economic percentages
- Removed black selection box from polygon features for cleaner appearance

---

## v0.7.1 (2025-12-29)
- Attempted to fix pdf zoom bugs by using fixed Memphis coordinate bounds [34.9, -90.1] to [35.3, -89.6]
- Grouped layers by topic (Transportation, Economic, Environmental) in map layer control with visual category headers
- Fixed freight routes display symbol from points to lines by adding MultiLineString check

## v0.7.0 (2025-12-29) - Technical Debt Catch-Up
- Refactored monolithic 2000+ line index.html into 7 modular files for maintainability (styles.css, datasets.js, map.js, analysis.js, pdf.js, app.js, index.html)
- Previous plans called for a one-file approach, but this changed recognized that the index had bloated beyond easy use and allowed Claude to read entire files at once
- Added cache busting with `?v=0.7.0` query strings
- No functional changes to user experience

---

## v0.6 (2025-12-22) - From Toy Model to Useful Tool
- Refactored to configuration-driven dataset system - new datasets can be added via config instead of custom code
- Created centralized DATASETS config object with support for all geometry types
- Implemented three generic analysis functions (corridor matching, intersection detection, proximity analysis) replacing dataset-specific functions
- Added 9 new datasets (STRAHNET Routes, Freight Routes, Freight Zones, Parks, NHRP Polygons, NHRP Points, Major Employers, Tourist Destinations, EPA Superfund Sites) using the new configuration system
- Added support for conditional styling via `styleByProperty` (e.g., color-code freight routes by type)
- Added support for static labels via `staticLabel` (e.g., override field value with constant text)
- With this update, all of the essential functionality has been confirmed to be possible - the rest is building out the necessary features

---

## v0.5 (2025-12-12) - Proofs of Concepts
- Added foundation of support for feature services hosted on AGOL in future versions and successfully tested proof-of-concept with previously published Functional Classification feature service
- Successfully tested hosting tool on MPO server and made plans to move final production version of tool here

## v0.4 (2025-12-11) - Planning & Documentation
- Created project documentation (readme, claude.md, to-do list) and identified need for configuration-driven dataset system

## Demo Alpha/v0.3 (2025-12-10)
- Launched as a proof of concept with three datasets (MATA routes, bridges, Opportunity Zones) to test lines, points, and polygons
- Hosted on GitHub Pages

## Project Start (2025-12-09)
- Began brainstorming with Claude to determine methods to automate project elligibility verification in GIS, initially with a focus on ArcGIS Online Experience Builder or Arcade 
and then quickly shifting to an HTML page/javascript app for faster AI-driven development
- Initially looked at hosting layers on ArcGIS Online, but it quickly become obvious that self-hosted JSON files would be easier to manage for small datasets - 
developed plan to host those locally while possibly hosting larger files on AGOL
