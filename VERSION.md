# Version History

## v0.8.0 (2026-01-05)
- Added 4 critical datasets: High Injury Corridors, Crash Locations (KSI), Greenprint Bike Network, ALICE ZCTAs
- Implemented advanced analysis features: proximity counting, threshold-based filtering, percentage formatting
- Expanded dataset integration to 16 total datasets (from 12)
- Enhanced UI/UX with improved polygon styling and PDF report spacing

### New Features
- **High Injury Corridors**: Safety priority corridors for corridor matching analysis
- **Crash Locations (KSI)**: Fatal and Suspected Serious Injury crashes with proximity counting by severity
- **Greenprint Bike Network**: Regional/Intermediate/Local bike routes with conditional styling and dashed line display
- **ALICE ZCTAs**: Economic distress indicators with ≥45% threshold filtering and percentage display

### Advanced Analysis Implementation
- Generic proximity counting function (`analyzeProximityWithCounting`) for aggregated point data
- Threshold-based filtering with translucent styling for polygon datasets
- Multi-value conditional styling for datasets like Freight Routes and Greenprint Bike Network
- Enhanced tooltips showing additional fields (crash severity details, economic percentages)

### UI/UX Improvements
- Removed black selection box from polygon features
- Improved PDF report spacing between dataset sections
- Renamed datasets for clarity (Freight Routes, Freight Zones)
- Enhanced map layer organization and visibility controls

## v0.7.1 (2025-12-29)
- Fixed zoom extent to show Memphis area instead of continental US
- Grouped layers by topic (Transportation, Economic, Environmental) in map view
- Fixed freight routes display symbol from points to lines (MultiLineString support)

### Bug Fixes
- **Zoom extent**: Changed `fitMapToBounds()` to use fixed Memphis MPO bounds [34.9, -90.1] to [35.3, -89.6] instead of calculating from all layers
- **Layer grouping**: Reorganized layer control with visual category headers (Transportation, Economic, Environmental)
- **Freight routes symbol**: Added MultiLineString check in symbol selection to display '─' (line) instead of '●' (point)

### Configuration Changes
- Updated dataset categories to use simplified grouping (Transportation, Economic, Environmental)
- Layer control now displays grouped overlays with category headers and indented layer names

## v0.7.0 (2025-12-29)
- Refactored monolithic index.html into 7 modular files
- No functional changes to user experience
- Prepares for configuration-driven dataset system in v0.8.0

### Architecture Changes
- **styles.css** (~400 lines): All CSS styling
- **datasets.js** (~400 lines): CONFIG and DATASETS configuration
- **map.js** (~300 lines): Map initialization, layer management, drawing controls
- **analysis.js** (~550 lines): Spatial analysis functions
- **pdf.js** (~450 lines): PDF generation and export
- **app.js** (~900 lines): Application initialization, event handlers, UI management
- **index.html** (~140 lines): HTML structure and script tags only

### Technical Details
- Added cache busting with `?v=0.7.0` query strings
- Maintained all global variable declarations at module level
- Preserved all functionality with zero breaking changes
- Updated documentation across README.md and claude.md

### Testing
- All tests pass
- Verified complete workflow: map loading, drawing, analysis, PDF generation
- Confirmed cross-browser compatibility (Chrome, Firefox)
