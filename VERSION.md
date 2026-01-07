# Version History

## v0.8.2 (2026-01-07)
- Redesigned color scheme to eliminate conflicts and make project line stand out
- Increased project line thickness from 8px to 12px for maximum visibility

### Color Changes
- **Project line**: Remains bright red `#FF0000` but now 50% thicker (weight: 12, opacity: 0.9)
- **STRAHNET Routes**: Orange → Dark goldenrod (highway brown)
- **High Injury Corridors**: Dark red → Gold (caution/warning color)
- **Freight Routes Regional**: Dark red → Dark slate gray
- **Freight Routes Local**: Orange → Burlywood (tan)
- **Crash Locations (KSI)**: Dark red → Midnight blue
- **Bridges**: Crimson → Saddle brown
- **Freight Zones**: Purple → Light sea green (teal/turquoise)

### Rationale
- Red project line now has no competing red/orange/crimson layers
- ALICE ZCTAs retain purple color (no longer conflicts with Freight Zones)
- Each layer category uses distinct, meaningful colors

## v0.8.1 (2026-01-07)
- Implemented filtered layer rendering for PDF generation
- Reduced PDF generation time from ~20 seconds to ~5-10 seconds
- Eliminated visual clutter by rendering only matched features in PDF maps

### Performance Improvements
- **PDF Generation**: 60-75% faster (20s → 5-10s)
- **Map Rendering**: Only matched features rendered instead of all 10,000+ features
- **Visual Clarity**: PDF maps now show only basemap + project line + matched features

### Technical Changes
- Modified all analysis functions to return complete GeoJSON Feature objects with geometry
  - `analyzeCorridorMatch()`: Returns features with `_displayName` property for deduplication
  - `analyzeIntersection()`: Returns features with geometry
  - `analyzeProximity()`: Returns features with geometry
  - `analyzeProximityWithCounting()`: Added `features` array to return object
- Added helper functions in `pdf.js`:
  - `getFeatureStyle()`: Handles conditional styling based on feature properties
  - `createPointMarker()`: Creates styled Leaflet CircleMarkers for point features
- Replaced "add all layers" logic with temporary filtered layer creation
- Updated result display logic in `app.js` and `pdf.js` to handle new GeoJSON Feature format

### Backward Compatibility
- Sidebar display and PDF results section maintain full compatibility
- All existing functionality preserved (no breaking changes)

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
