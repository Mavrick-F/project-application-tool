# Version History

## v0.9.5 (2026-01-16) - Travel Time Reliability Refinements

### Analysis Method Updates
- **Changed LOTTR calculation from mean to median**: More robust statistical measure for typical LOTTR values across project corridor
- **Added `calculateMedian()` helper function**: Correctly handles both odd and even numbers of values (averages two middle values for even counts)
- **Updated all result displays**: Sidebar and PDF now show "Median LOTTR" instead of "Mean LOTTR"

### UI/Styling Consistency
- **Removed inconsistent bolding from results**: All individual result items now display in regular font weight
- Improves visual consistency and reduces visual noise in result displays

### Technical Implementation
- Modified `analyzeMeasureProjectByCategory()` in analysis.js to collect LOTTR values in array instead of summing
- Updated property names from `meanLOTTR` to `medianLOTTR` across all result handling code
- Changes made in: src/analysis.js, src/pdf.js, src/app.js

## v0.9.4 (2026-01-16) - Header Redesign & Security Hardening

### UI/Design Improvements
- **Completely redesigned header**: Replaced bold blue gradient with clean white/light gray background for better aesthetic cohesion
- **New landscape logo**: Integrated landscape version of RTP 2055 logo (replaces vertical square format)
- **Larger header elements**: Scaled all header components ~33% bigger (logo height 48px → 64px, title font 20px → 27px, header height 70px → 95px)
- **Typography refinements**: Split title into "2055 RTP" (bolder, purple accent) and "Application Mapping Tool" (lighter weight)
- **Accent line detail**: Added subtle purple/teal gradient line at header top that echoes logo colors
- **Cleaner spacing**: Reduced padding and gap for tight, professional appearance

### Security Fixes
- **XSS Prevention**: Sanitized GeoJSON property rendering to prevent cross-site scripting attacks (replaced innerHTML with textContent in property display)
- **Dependency Security**: Added SRI (Subresource Integrity) integrity hashes to all CDN script dependencies for supply chain security

### Features
- **Measurement tool**: Implemented user-accessible distance measurement tool for on-map calculations
- **projectCoverage analysis**: Added analysis method for High Injury Corridors project coverage detection
- **Tutorial redesign**: Rewrote tutorial popup with clearer, more effective onboarding messaging

## v0.9.3 (2026-01-14) - YAML Configuration & Code Organization

### Configuration System Overhaul
- **Migrated to YAML-based configuration**: Datasets now defined in `datasets.yaml` instead of JavaScript
- **Self-documenting YAML**: Comprehensive inline comments explain every field, geometry types, analysis methods, and styling options
- **Zero breaking changes**: All analysis functions, map rendering, and PDF generation work identically
- **Easier dataset management**: Non-coders can add new datasets by copying/modifying YAML entries

### Code Organization
- **Created `src/` folder**: Core application files now organized (analysis.js, app.js, datasets.js, map.js, pdf.js, styles.css)
- **Root-level HTML**: index.html remains at root for direct access
- **Data folder**: All GeoJSON files stay in root-level `data/` folder

### Dataset Management
- **Deleted outdated files**: Removed `midsouth_greenprint.geojson` and `truck_routes.json` from data folder
- **Added Pavement Condition example**: Demonstrates conditional styling pattern in YAML for future dataset additions

### User Experience Improvements
- **Tighter map zoom**: Reduced project bounds padding from 50% to 5% for focused views on long projects
- **Better visual framing**: Long corridors now zoom to show primarily the project with minimal surrounding context

### Technical Implementation
- **Added js-yaml CDN library**: For YAML parsing in the browser
- **Async dataset loading**: App waits for YAML to load before initializing (transparent to user)
- **Logging**: Console message confirms successful dataset load with count

### Documentation Updates
- **Updated claude.md**: Added instructions for adding datasets via YAML
- **Updated README.md**: Explains new file structure and YAML configuration system

## v0.9.2 (2026-01-14) - Travel Time Reliability & Visual Polish

### Travel Time Reliability Improvements
- **Changed from mileage to percentages**: Displays % Reliable/Unreliable instead of absolute miles for dual carriageway accuracy
- **Added Mean LOTTR metric**: Shows average Level_of_Travel_Time_Reliability across all captured segments
- **UI/PDF consistency**: Percentages and Mean LOTTR display in both sidebar results and PDF reports
- Fixes misleading results on dual carriageways and complex road networks

### Visual & Layout Improvements
- **Layers alphabetically organized**: All 20 datasets now ordered A-Z within their three categories
  - Transportation: Bridges, Crash Locations, Greenprint, High Injury, MATA, STRAHNET, Travel Time Reliability
  - Economic Development: ALICE ZCTAs, Freight Clusters, Freight Routes, Major Employers, Opportunity Zones, Tourist Destinations
  - Environmental/Cultural: Critical Wetlands, EPA Superfund, Flood Zones, Historic Points, Historic Polygons, Parks, Wetlands
- **Crash location dots smaller**: Reduced from radius 4 to 2.5 for less visual clutter
- **Bridge styling enhanced**:
  - Increased size (radius 4.5 for better visibility)
  - Conditional coloring by condition (Good=Green, Fair=Gold, Poor=Bright Red)
  - Condition-based colors now display on interactive map layer (not just PDF)
- **Freight routes repositioned**: Moved adjacent to Freight Zones with complementary warm tones (brown/tan) that contrast teal zones

### Configuration Changes
- Point layer styling now supports `styleByProperty` for conditional marker colors
- Enhanced `createPointMarker()` in map.js to apply feature-specific styling

## v0.9.1 (2026-01-12) - Feature Services Integration & Categorization
- **Integrated ArcGIS Feature Services**: Wetlands, Critical Wetlands, and Flood Zones now load via lazy-loading from ArcGIS Online
- **Lazy-loading architecture**: Feature services query on project draw (not at startup) with 200ft bounding box filter for fast performance
- **Organized by categories**: All datasets grouped into Transportation, Economic Development, and Environmental/Cultural
- **Category headers**: Added blue category headers to analysis results and PDF reports
- **Improved styling**: Feature services have distinctive dashed borders (flood zones) and solid fills (wetlands)
- Changed wetlands and flood zones analysis from acreage to binary (Yes/No) detection
- Simplified PDF binary results from "Within X: Yes" to just "Yes"

### Feature Service Integration
- Wetlands and Flood Zones load from ArcGIS Feature Services on demand
- `lazyLoad: true` flag prevents loading at startup (instant app load)
- When project is drawn, queries feature services with Web Mercator bbox around project (200ft buffer)
- Automatic WGS84 ↔ Web Mercator coordinate conversion
- Data cleared from memory when user clicks "Clear & Start Over"
- Critical Wetlands filters to only "Freshwater Forested/Shrub Wetland" type via `analysisFilter`

### Category Organization
- **Transportation**: MATA Routes, STRAHNET, High Injury Corridors, Greenprint Bike Network, Travel Time Reliability, Bridges, Crash Locations
- **Economic Development**: Opportunity Zones, ALICE ZCTAs, Freight Routes, Freight Zones, Major Employers, Tourist Destinations
- **Environmental/Cultural**: Parks, Historic Polygons, Historic Points, EPA Superfund Sites, Wetlands, Critical Wetlands, Flood Zones
- Category headers appear in: Layer Control (with spacing), Analysis Results (blue headers), PDF Reports (blue headers)

### Styling Improvements
- **Wetlands**: Olive green (#6B8E23), 40% opacity, no distinctive border
- **Critical Wetlands**: Bright lime green (#32CD32), 100% opacity, minimal border (0.5px)
- **Flood Zones**: Sky blue fill with dark blue dashed border (5px dash pattern)
- All three feature services stand out clearly from regular datasets

### Known Issues
- **Undefined results bug**: Some datasets show "undefined" count in sidebar when they shouldn't appear
  - Analysis completes but filtering logic needs refinement
  - Does not affect PDF generation or data accuracy
  - Fix pending for v0.9.2

### Previous v0.9.1 Changes (2026-01-12)
- Removed all MultiLineString-specific code logic for cleaner codebase
- Improved PDF generation: now clears all user-selected layers before rendering filtered features
- Enhanced drawing UX: draw tools now grey out and become unselectable after project is drawn
- Draw tools re-enable when user clicks "Clear & Start Over"

### Code Cleanup
- Removed `MultiLineString` handling from `normalizeToLineStrings()` in analysis.js
- Removed entire MultiLineString layer creation block from map.js
- Removed MultiLineString validation from app.js projection check
- Simplified geometry type checks throughout codebase

### Dataset Configuration Changes
- **Wetlands**: Changed from `proximityAcreage` analysis to `binaryProximity`, result style now `binary`
- **Critical Wetlands**: Changed from `proximityAcreage` analysis to `binaryProximity`, result style now `binary`, opacity increased to 0.85

### PDF Generation Improvements
- User-selected layers are now temporarily removed before adding filtered result layers
- Prevents visual clutter and ensures only relevant features appear in PDF maps
- User layers are restored after PDF capture completes

### UI/UX Enhancements
- New `setDrawButtonsEnabled()` function controls draw button state
- Draw buttons display as greyed out (50% opacity) with "not-allowed" cursor when disabled
- Buttons disable automatically after successful drawing
- Buttons re-enable when "Clear & Start Over" is clicked
- Improves user clarity on when drawing actions are available

## v0.9.0 (2026-01-09) - Feature Complete ✅
- Integrated Travel Time Reliability dataset (17 total datasets - all core datasets complete)
- Renamed from "Congested Segments" to "Travel Time Reliability" for user-facing display
- Implemented new analysis method: `analyzeCorridorLengthByStatus` for length summation by status
- Added `hideInPdfRendering` config option to exclude layers from PDF maps while maintaining analysis
- All 17 required core datasets now integrated and operational
- **Status: Feature-complete for v1.0 release**

### New Features
- **Travel Time Reliability dataset**: Road segments with travel time reliability status (local GeoJSON)
- **Corridor Length by Status analysis**: Sums segment lengths grouped by reliability status
  - Results show total miles and breakdown by category (e.g., 1.2 miles reliable / 2.4 unreliable)
  - Uses accurate buffer intersection with segment clipping for precise measurements
- **PDF layer exclusion feature**: `hideInPdfRendering` config option controls which layers appear in PDF maps
  - Travel Time Reliability layer hidden from PDF map for cleaner presentation
  - Analysis results still included in PDF reports

### Dataset Completion
All 17 required datasets now integrated:
- 7 Transportation datasets (MATA, STRAHNET, Freight Routes, High Injury Corridors, Greenprint, Travel Time Reliability, Bridges)
- 5 Economic Development datasets (Opportunity Zones, ALICE ZCTAs, Freight Zones, Major Employers, Tourist Destinations)
- 2 Historic & Cultural datasets (NHRP Polygons, NHRP Points)
- 3 Environment & Recreation datasets (Parks, EPA Superfund Sites, Crash Locations)

### Analysis Methods Supported (5 total)
1. **Corridor Matching**: For line features with 100ft buffer, 300ft minimum overlap
2. **Corridor Length by Status**: New - for line features with categorical breakdown (Travel Time Reliability)
3. **Intersection Detection**: For polygon features with optional threshold filtering
4. **Proximity Analysis**: For point features within configurable buffer
5. **Proximity with Counting**: For aggregated point features with category breakdown

### Configuration-Driven Architecture
- All datasets defined in centralized DATASETS configuration object
- No code changes required to add new datasets
- Support for conditional styling, threshold filtering, special handling, and custom result formatting

## v0.8.3 (2026-01-08)
- Fixed PDF layer alignment issue where GeoJSON features were offset from basemap
- Switched Leaflet renderer from SVG to Canvas to eliminate html2canvas transform handling issues
- Simplified html2canvas capture back to v0.7.1 approach
- Code cleanup: removed ~67 lines of unused/problematic code

### Bug Fix Details
**Problem**: PDF maps showed all layers offset upward (and sometimes left/right) from the basemap tiles. This was a known html2canvas limitation with Leaflet's CSS transform-based positioning system.

**Solution**:
1. Added `renderer: L.canvas()` to map initialization in `map.js`
   - Renders all GeoJSON/vector layers as canvas instead of SVG
   - Canvas elements don't have the same transform issues as SVG
   - No visual degradation - canvas is fully compatible with Leaflet styling

2. Reverted html2canvas capture to simple v0.7.1 approach in `pdf.js`
   - Removed problematic options (`foreignObjectRendering`, `scrollX/Y`, dimension specifications)
   - Removed ~115 lines of unused transform manipulation code
   - Kept simple visibility toggle in `onclone` callback

3. Code cleanup in `analysis.js`
   - Removed deprecated `analyzeIntersections()` function (replaced by `analyzeAllDatasets()`)
   - Removed unused `findNearbyBridges()` function (replaced by generic proximity analysis)

### Preserved for Future Work
- All ArcGIS Feature Service query functions remain in `app.js`
- Ready for upcoming integration of Congested Segments dataset from ArcGIS Online

### Testing
- Verified PDF generation produces correctly aligned maps
- Tested at multiple zoom levels
- Confirmed live map display unaffected
- All spatial analysis results accurate

## v0.8.2 (2026-01-07)
- Redesigned color scheme to eliminate conflicts and make project line stand out
- Increased project line thickness from 8px to 12px for maximum visibility

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
=======
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

### v0.6.0 - Completed 
- **Refactored to configuration-driven dataset system**
  - Created centralized DATASETS config object
  - Implemented three generic analysis functions (corridor, intersection, proximity)
  - Dynamic layer creation, tooltip generation, and PDF reporting
  - Support for conditional styling via `styleByProperty`
  - Support for static labels via `staticLabel`
- **Integrated 12 datasets** across all geometry types
- **Prepared for ArcGIS Feature Service integration** (architecture in place)


