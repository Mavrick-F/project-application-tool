# Version History

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
