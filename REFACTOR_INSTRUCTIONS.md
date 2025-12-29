# Architecture Refactor - v0.7.0
## Memphis MPO Project Application Tool

Split monolithic `index.html` (3200+ lines) into modular architecture.

---

## Critical Requirements

**⚠️ These are non-negotiable:**

1. **Variable Declarations**: ALL shared variables use `let`/`const` at TOP LEVEL (outside all functions)
2. **Script Order**: `datasets.js` loads first, `app.js` loads last
3. **Test After Each Step**: Don't extract all modules then test - test incrementally
4. **Cache Busting**: Add `?v=0.7.0` to all local script tags
5. **No Functional Changes**: User experience must be identical

---

## Target Structure

```
index.html     (~250 lines - HTML + script tags)
styles.css     (~400 lines - all CSS)
datasets.js    (~200 lines - CONFIG object)
map.js         (~400 lines - map, layers, drawing)
analysis.js    (~500 lines - spatial analysis)
pdf.js         (~500 lines - PDF generation)
app.js         (~450 lines - initialization, events, UI)
```

---

## Global Variables by Module

### datasets.js
```javascript
const CONFIG = { /* all config */ };
```

### map.js
```javascript
let map;
let drawControl;
let drawnItems;
let polylineDrawer;
let markerDrawer;
let drawnLayer = null;
const featureLayers = { routes: null, zones: null, bridges: null };
```

### analysis.js
```javascript
let drawnGeometry = null;
const currentResults = { routes: [], zones: [], bridges: [] };
```

### app.js
```javascript
const geoJsonData = { routes: null, zones: null, bridges: null };
```

Use `let` for variables that will be reassigned. Use `const` for objects that won't be reassigned (contents can change).

---

## Extraction Steps

### 1. Extract CSS → `styles.css`
- Move all `<style>` content to `styles.css`
- Add `<link rel="stylesheet" href="styles.css">` in `<head>`
- **Test**: Styling identical, no console errors

### 2. Create `datasets.js`
- Extract entire `CONFIG` object from index.html
- Add header comment with dependencies note
- **Test in console**: `CONFIG`, `CONFIG.bridgeBufferDistance` should work

### 3. Create `map.js`
**Extract functions:**
- `initializeMap()`
- `addReferenceLayers()`
- `fitMapToBounds()`
- `setupDrawingControls()`
- `getOptimalMapBounds()`

**Add global variables** (see reference above)

**Test**: Map renders, layer control appears, console shows `map` and `featureLayers` objects

### 4. Create `analysis.js`
**Extract functions:**
- `analyzeIntersections()`
- `findIntersectingRoutes()`
- `cleanRouteName()`
- `findIntersectingZones()`
- `findNearbyBridges()`
- `validateGeometry()`

**Add global variables** (see reference above)

**Test**: Draw line, results appear in sidebar, console shows `currentResults` and `drawnGeometry`

### 5. Create `pdf.js`
**Extract functions:**
- `generatePDF()`
- `waitForTilesToLoad()`
- `formatFileName()`

**Test**: Generate PDF with project name, verify map image and results appear

### 6. Create `app.js`
**Extract everything remaining:**
- `init()`
- `loadGeoJsonData()`
- All event handlers (onDrawCreated, onClearClicked, etc.)
- `setupEventListeners()`
- `displayResults()`, `clearResults()`
- Tutorial functions
- Utility functions (showError, showLoading)

**Add at bottom:**
```javascript
document.addEventListener('DOMContentLoaded', init);
```

**Add global variable** for `geoJsonData`

**Test**: Complete workflow - draw, analyze, PDF, clear, redraw

### 7. Final `index.html`
Should contain ONLY:
- HTML structure
- `<link>` to styles.css
- CDN script tags (Leaflet, Turf, jsPDF, html2canvas)
- Local script tags in order with `?v=0.7.0`:
  ```html
  <script src="datasets.js?v=0.7.0"></script>
  <script src="map.js?v=0.7.0"></script>
  <script src="analysis.js?v=0.7.0"></script>
  <script src="pdf.js?v=0.7.0"></script>
  <script src="app.js?v=0.7.0"></script>
  ```

---

## Testing Checklist

**After each extraction:**
- [ ] Refresh page, check console for errors
- [ ] Test that module's functionality works
- [ ] Verify global variables accessible in console
- [ ] Document results in `/tests/refactor-log.md`

**Final complete test:**
- [ ] Map loads and renders
- [ ] Drawing tools work (line and point)
- [ ] Analysis runs and displays results
- [ ] PDF generates correctly with map image
- [ ] Clear button resets everything
- [ ] Tutorial appears on first visit
- [ ] Test in Chrome and Firefox

---

## Version Updates

**index.html title**: Add `v0.7.0`

**Create VERSION.md**:
```markdown
## v0.7.0 (2025-01-XX)
- Refactored monolithic index.html into 7 modular files
- No functional changes to user experience
- Prepares for configuration-driven dataset system in v0.8.0
```

**README.md**:
- Update version badge to `0.7.0`
- Update "Current Status" to `v0.7.0`
- Add Architecture section showing module structure

**claude.md**:
- Update "Current Status" to `v0.7.0`
- Update Architecture & Tech Stack section
- Update File Structure section

---

## Git Workflow

```bash
git checkout -b refactor/modular-architecture

# Commit after each step
git commit -m "refactor: extract CSS to styles.css"
git commit -m "refactor: create datasets.js"
# etc.

# Final commit after all tests pass
git commit -m "refactor: split monolithic index.html into modular architecture (v0.7.0)

BREAKING CHANGE: Refactored to modular structure
- Created 7 focused files (styles.css, 5 JS modules, index.html)
- Added cache busting with ?v=0.7.0 query strings
- Updated all documentation
- All tests pass, no functional changes

Prepares for configuration-driven dataset system in v0.8.0"

git push origin refactor/modular-architecture
```

Create PR, merge to main, tag as `v0.7.0`

---

## Common Issues

**"CONFIG is not defined"**: Check datasets.js loads first and CONFIG declared at top level

**"map is not defined"**: Check map.js loads before pdf.js/app.js and map declared at top level

**Analysis doesn't run**: Check onDrawCreated() in app.js calls analyzeIntersections()

**PDF fails**: Check pdf.js can access map, featureLayers, currentResults

**Styles broken**: Check styles.css linked in `<head>` and file loads in Network tab