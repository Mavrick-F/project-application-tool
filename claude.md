# Claude Code Context - Memphis MPO Project Application Tool

## What This Is
Web-based spatial analysis tool for Memphis MPO's RTP 2055. Users draw project alignments or mark point locations, tool automatically analyzes against regional datasets, generates PDF report.

**Current Status:** v0.1.1 - Final polish & future-proofing phase
**Deployment:** GitHub Pages for development, MPO server for production

## Hard-Won Lessons

### Spatial Analysis Gotchas
- **Buffer distance ≠ minimum shared length**: 100ft buffer for initial intersection check, but requires 300ft minimum parallel overlap for corridor matching
- **Perpendicular crossings**: Fixed false positives by calculating actual segment length inside buffer, not full segment length (v0.6.0 fix)
- **MultiLineString handling**: Normalize all line features to array of LineStrings for consistent analysis

### PDF Generation
- **Must wait for ALL layers to render** before capture (basemap tiles + GeoJSON vectors)
- **Animation breaks capture**: Use `animate: false` on fitBounds
- **Zoom level must account for legends/overlays**: Calculate bounds BEFORE adding legends, or they'll obscure content
- **Color values must be valid**: Malformed hex/rgb values break PDF rendering - validate in config

### CSS/UI Gotchas
- **Text-transform inheritance**: Parent containers have `text-transform: uppercase` - icon fonts need explicit override
- **Check parent styles first**: Display issues often caused by inherited CSS, not the element itself

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

### Enterprise Environment Context
- **Windows machine at Memphis City Hall** - Large enterprise with security policies and restrictions
- **No admin access** - Can't install system-level tools, modify firewall, or kill system processes
- **Port availability is unpredictable** - Enterprise software claims common dev ports
  - Port 3000: Usually blocked by enterprise services (use 5000, 8000, or 8080 instead)
  - Working ports: 5000, 8000, 8080, 8888, 9000 (test with `netstat -an | grep "LISTENING"`)
- **ArcGIS Pro Python environment** - For ArcPy work, must use ArcGIS Pro's Python, not system Python
  - Typical path: `C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe`
  - Always specify full path when running ArcPy scripts

### AGOL/Data Constraints
- **AGOL publishing has bureaucratic delays** - Use Feature Services only for large datasets
- **No backend/database** - Client-side only architecture

**What this means:**
- Always test ports before assuming availability
- Can't install npm packages globally or use elevated installers
- Python scripts need explicit ArcGIS Pro Python path
- Large datasets require ArcGIS Feature Service integration (server does the work)
- No user authentication/sessions
- No data persistence across sessions

## Configuration-Driven System (v0.6.0+)

**v0.9.3+: YAML Configuration**
New datasets = just edit `datasets.yaml` in the root directory. The file is self-documenting with inline comments explaining every field and valid values.

**How to add a dataset:**
1. Open `datasets.yaml`
2. Copy an existing dataset that matches your geometry type (Point, LineString, or Polygon)
3. Modify the values (file path, field names, colors, analysis method)
4. Save - no code changes needed, just refresh the browser

**Key config properties:**
- `analysisMethod`: See Analysis Types section below
- `geometryType`: 'Point' | 'LineString' | 'Polygon'
- `styleByProperty`: Conditional styling (e.g., color-code freight routes by Regional/Local)
- `staticLabel`: Override field value with constant text (e.g., "STRAHNET" for all features)
- `filterByThreshold`: Filter features by field value with optional translucent display
- `lazyLoad`: Load large Feature Service datasets only when analysis runs
- `featureServiceUrl`: ArcGIS Feature Service endpoint (alternative to filePath)

## Things to Avoid
- Don't add build tooling - breaks deployment workflow
- Don't add mobile support - not the use case
- Don't add backend dependencies - architectural constraint
- Don't optimize file sizes prematurely - current datasets are manageable

## Useful Commands
```bash
# Local dev server (use port 5000 - port 3000 typically blocked in enterprise environment)
python -m http.server 5000

# Access at http://localhost:5000

# Check port availability before starting server
netstat -an | grep "LISTENING" | grep ":5000"

# Run tests (if present in tests/ folder)
# Tests are HTML files - open in browser or use a test runner
```

## Quick Reference

**File Structure:**
- `datasets.yaml` - Dataset configuration (self-documenting with inline comments)
- `src/datasets.js` - CONFIG object and YAML loader
- `src/map.js` - Leaflet map, layers, drawing controls
- `src/analysis.js` - Generic analysis functions for all 8 methods
- `src/pdf.js` - PDF generation with html2canvas
- `src/app.js` - Init, event handlers, UI management
- `data/*.json` - GeoJSON datasets (20 total)
- `tests/` - Test files (HTML/JS test suites)

## Documenting Changes

When making changes, follow this workflow:

1. **Make code changes** to src/ or data/ files
2. **Test thoroughly** - Use browser dev tools or write tests in `tests/` folder
3. **Update changelog.md** with concise entry:
   - Add new version section at top with date
   - Keep entries brief (1-2 sentences per bullet)
   - Follow existing format in changelog
4. **Update version numbers:**
   - Change badge in README.md: `v=X.X.X`
   - Change page title in index.html
   - Update cache-busting query strings: `?v=X.X.X` on all script tags
5. **Commit with clear message** following the style of recent commits

**changelog.md format:**
```markdown
## v1.1 (2026-01-27)
- Brief description of change and impact
- Implementation notes if relevant (file names, key functions)
- Combine multiple very minor changes to one line
```

## Testing Guidelines
Write tests BEFORE or alongside code changes. Tests save debugging time and document expected behavior.

**Where:** Save test files in `tests/` folder
**Format:** HTML files with embedded JavaScript (can run directly in browser) or use assertion libraries

**What to test:**
- Spatial analysis edge cases (zero-length features, self-intersecting polygons, tiny buffers)
- Rendering (correct colors, visibility, layer order)
- PDF generation (maps capture correctly, all features present)
- Configuration loading (YAML parsing, missing fields)
- Security (XSS prevention, sanitization)

**Example test file structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Analysis Function Tests</title>
</head>
<body>
  <h1>Corridor Matching Tests</h1>
  <div id="results"></div>

  <script>
    // Load dependencies
    const tests = [];

    // Test 1: Basic corridor match
    tests.push({
      name: "Corridor match with 300ft overlap",
      pass: /* assertion here */
    });

    // Run all tests
    tests.forEach(t => {
      console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
    });
  </script>
</body>
</html>
```