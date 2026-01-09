# Claude Code Context - Memphis MPO Project Application Tool

## What This Is
Web-based spatial analysis tool for Memphis MPO's RTP 2055. Users draw project alignments or mark point locations, tool automatically analyzes against regional datasets, generates PDF report.

**Current Status:** Entering v0.9.X polish phase  
**Deployment:** GitHub Pages for development, MPO server for production

## Hard-Won Lessons

### Spatial Analysis Gotchas
- **Buffer distance ≠ minimum shared length**: 100ft buffer for initial intersection check, but requires 300ft minimum parallel overlap for corridor matching
- **Perpendicular crossings**: Fixed false positives by calculating actual segment length inside buffer, not full segment length (v0.6.0 fix)
- **MultiLineString handling**: Normalize all line features to array of LineStrings for consistent analysis

### PDF Generation
- **Must wait for ALL layers to render** before capture (basemap tiles + GeoJSON vectors)
- **Animation breaks capture**: Use `animate: false` on fitBounds

### Data Requirements
- All datasets MUST be WGS84 (EPSG:4326)
- Memphis bounds: lng -90.1 to -89.6, lat 34.9 to 35.3
- Property field names are case-sensitive - must match DATASETS config exactly

## Architecture Decisions

### Intentional Simplicity
- **Client-side only** - No backend, no API server
- **No build process** - Vanilla JS, no bundlers/transpilers (keeps it maintainable by non-coders)
- **Minimal dependencies** - CDN libraries only, no npm package hell
- **Configuration over code** - Add datasets via config, not custom logic
- **Desktop only** - Complex mapping UI, 1024px minimum (not a mobile use case)

## IT Constraints
- **AGOL publishing has bureacratic delays** - Use Feature Services only for large datasets
- **Port 8000 restriction** - Can't access this port
- **No admin access** - Can't install dev tools requiring elevation

**What this means:**
- Large datasets require ArcGIS Feature Service integration (server does the work)
- No user authentication/sessions
- No data persistence across sessions

## Current Development Phase: Polish & QOL for v1.0

**Focus areas for v1.0:**
- UX improvements (loading states, error messages, confirmation dialogs)
- Empty state messages that explain what's missing
- Final dataset integrations
- Documentation polish
- Potentially replacing the two MultiLineString datasets to clear lingering bugs

## Configuration-Driven System (v0.6.0+)

New datasets = just update `DATASETS` config in `datasets.js`. No code changes needed.

**Key config properties:**
- `analysisMethod`: 'corridor' | 'intersection' | 'proximity'
- `geometryType`: 'Point' | 'LineString' | 'MultiLineString' | 'Polygon'
- `styleByProperty`: Conditional styling (e.g., color-code freight routes by Regional/Local)
- `staticLabel`: Override field value with constant text (e.g., "STRAHNET" for all features)

## Things to Avoid
- Don't add build tooling - breaks deployment workflow
- Don't add mobile support - not the use case
- Don't add backend dependencies - architectural constraint
- Don't optimize file sizes prematurely - current datasets are manageable

## Useful Commands
```bash
# Local dev server
python -m http.server 8000

# Access at http://localhost:8000
```

## Quick Reference

**Analysis Types:**
1. **Corridor matching** - 100ft buffer, 300ft min shared length (transit routes, freight, bike paths)
2. **Intersection** - Boolean intersection (opportunity zones, wetlands, historic districts)
3. **Proximity** - Point-in-buffer (bridges, crashes, employers)

**File Structure:**
- `datasets.js` - CONFIG and DATASETS configuration
- `map.js` - Leaflet map, layers, drawing controls
- `analysis.js` - Three generic analysis functions
- `pdf.js` - PDF generation with html2canvas
- `app.js` - Init, event handlers, UI management
- `data/*.json` - GeoJSON datasets (12+ files)
