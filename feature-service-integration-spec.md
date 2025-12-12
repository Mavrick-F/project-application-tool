# Feature Service Integration Spec

## Overview

This spec defines the work needed to integrate ArcGIS Feature Services into the Memphis MPO Project Application Tool. We're using a functional classification layer as a test case to validate the integration pattern before requesting IT publish additional datasets.

**Goal:** Prove we can query ArcGIS Feature Services from the browser, convert responses to GeoJSON, and use them in spatial analysis—all without breaking existing functionality.

**Test Layer:** Functional Classification Roads
- Item Page: https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/ETRIMS_Roads_All/FeatureServer

## Context

### Current Architecture
- All data loaded as local GeoJSON files from `/data/` folder
- Three datasets: MATA routes, opportunity zones, bridges
- Each dataset has hardcoded loading and analysis functions
- Analysis runs client-side using Turf.js

### Target Architecture  
- Support both local GeoJSON AND ArcGIS Feature Services
- Configuration-driven dataset definitions
- Generic analysis functions that work with either source type
- Large/dynamic datasets served via Feature Service (query on-demand)
- Small/static datasets remain as local GeoJSON

### Why This Matters
- Congested Segments dataset is ~150MB—too large for client-side GeoJSON
- Feature Services let us query only features within relevant bounds
- Must validate this works before asking IT to publish final data warehouse

## Phase 1: Discover and Test the REST Endpoint

### Task 1.1: Find the Feature Service URL

The ArcGIS item page URL provided is NOT the REST endpoint. You need to find the actual Feature Service URL which will look something like:
```
https://services[N].arcgis.com/[orgId]/arcgis/rest/services/[serviceName]/FeatureServer/[layerIndex]
```

**Steps:**
1. Fetch or inspect the item page to find the service URL
2. The REST endpoint should support `/query` operations
3. Test that the endpoint is publicly accessible (no token required)

### Task 1.2: Verify Basic Query Works

Once you have the REST endpoint, verify you can query it:

```
GET [featureServiceUrl]/query?where=1=1&outFields=*&f=json&resultRecordCount=5
```

This should return a small sample of features. Check:
- Does it return data without authentication?
- What's the response format? (ArcGIS JSON, not GeoJSON)
- What fields are available in the attributes?
- What's the geometry type?

### Task 1.3: Test Spatial Query

Feature Services support spatial queries. Test querying by bounding box:

```
GET [url]/query?
  where=1=1&
  geometry=[bbox as JSON]&
  geometryType=esriGeometryEnvelope&
  spatialRel=esriSpatialRelIntersects&
  outFields=*&
  f=json
```

The bbox should be in the format: `{"xmin":-90.1,"ymin":35.0,"xmax":-89.9,"ymax":35.2}`

Verify this returns only features within the bounds.

## Phase 2: Build Feature Service Query Module

### Task 2.1: Create Query Function

Create a reusable function to query Feature Services:

```javascript
/**
 * Query an ArcGIS Feature Service and return results as GeoJSON
 * @param {string} serviceUrl - The Feature Service layer URL (ending in /FeatureServer/N)
 * @param {Object} options - Query options
 * @param {Array} options.bbox - Bounding box [minX, minY, maxX, maxY] in WGS84
 * @param {string} options.where - SQL where clause (default: "1=1")
 * @param {Array} options.outFields - Fields to return (default: ["*"])
 * @param {number} options.maxRecords - Max features to return (default: 1000)
 * @returns {Promise<GeoJSON.FeatureCollection>} - GeoJSON FeatureCollection
 */
async function queryFeatureService(serviceUrl, options = {}) {
  // Implementation here
}
```

**Requirements:**
- Must handle ArcGIS JSON response format and convert to GeoJSON
- Must handle pagination if results exceed maxRecordCount
- Must handle errors gracefully (network, invalid response, etc.)
- Must work with the coordinate system the service uses (check if it's WGS84 or Web Mercator)

### Task 2.2: ArcGIS JSON to GeoJSON Conversion

ArcGIS REST API returns a custom JSON format, NOT GeoJSON. You need to convert it.

**ArcGIS format:**
```json
{
  "features": [
    {
      "attributes": { "OBJECTID": 1, "RoadName": "Poplar Ave", ... },
      "geometry": { "paths": [[[x1,y1], [x2,y2], ...]] }  // for polylines
    }
  ],
  "geometryType": "esriGeometryPolyline",
  "spatialReference": { "wkid": 4326 }
}
```

**GeoJSON format (what we need):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "OBJECTID": 1, "RoadName": "Poplar Ave", ... },
      "geometry": { "type": "LineString", "coordinates": [[x1,y1], [x2,y2], ...] }
    }
  ]
}
```

**Geometry type mappings:**
- `esriGeometryPoint` → `Point`
- `esriGeometryPolyline` → `LineString` or `MultiLineString`
- `esriGeometryPolygon` → `Polygon` or `MultiPolygon`

**Coordinate system:**
- If service returns Web Mercator (wkid: 102100 or 3857), you must reproject to WGS84 (4326)
- If service returns WGS84 (wkid: 4326), no conversion needed
- Check the `spatialReference` in the response

### Task 2.3: Handle Pagination

ArcGIS services have a `maxRecordCount` (often 1000 or 2000). If more features match, you need to paginate.

**Approach:**
1. First query: include `returnCountOnly=true` to get total count
2. If count > maxRecordCount, make multiple queries with `resultOffset` parameter
3. Combine all results into single FeatureCollection

**Or simpler approach:**
1. Query with `resultOffset=0`
2. Check if `exceededTransferLimit` is true in response
3. If so, query again with `resultOffset=previousOffset+returnedCount`
4. Repeat until no more results

### Task 2.4: Error Handling

Handle these error cases:
- Network failure (fetch throws)
- Service unavailable (non-200 response)
- Invalid JSON response
- Service returns error object: `{ "error": { "code": 400, "message": "..." } }`
- Empty results (valid, just no features matched)

Return a consistent structure:
```javascript
{
  success: true/false,
  data: FeatureCollection or null,
  error: null or error message string
}
```

## Phase 3: Integration Test

### Task 3.1: Add Functional Class as Test Dataset

Add functional classification to the application as a proof-of-concept:

1. Add to CONFIG with a new source type:
```javascript
CONFIG.dataUrls.functionalClass = {
  type: 'featureService',
  url: '[discovered URL]'
};
```

2. Create a simple test: when user draws a line, query functional class roads within a bounding box around the drawn line, and log results to console.

### Task 3.2: Spatial Analysis Test

Verify the Feature Service data works with Turf.js analysis:

1. Draw a test line in the application
2. Query functional class roads within expanded bounds of the line
3. Run corridor analysis (similar to MATA routes) to find roads that run parallel
4. Display results in console (not in UI yet)

**Expected behavior:**
- Drawing a line along a major road should find that road in results
- Drawing a line through empty area should return few/no results
- Performance should be reasonable (<2-3 seconds for typical query)

### Task 3.3: Verify No Regressions

Ensure existing functionality still works:
- MATA routes analysis still works
- Opportunity zones analysis still works  
- Bridges analysis still works
- PDF generation still works
- All three local GeoJSON datasets load correctly

## Phase 4: Document Findings

### Task 4.1: Create Integration Report

After testing, document:

1. **The working Feature Service URL** - exact endpoint that works
2. **Response format notes** - any quirks discovered
3. **Coordinate system** - what the service returns, any reprojection needed
4. **Performance characteristics** - typical query times, response sizes
5. **Pagination behavior** - maxRecordCount, how pagination works
6. **Field names** - what attributes are available, which ones we'd display

### Task 4.2: Identify Blockers

Note any issues that would prevent this approach from working:
- CORS problems?
- Authentication requirements?
- Rate limiting?
- Response format issues?
- Performance concerns?

## Technical Notes

### CORS Considerations

Feature Services hosted on ArcGIS Online are typically CORS-enabled for public services. If you encounter CORS issues:
1. First verify the service is actually public (check item sharing settings)
2. Check if the service requires a token
3. As a last resort, we might need a proxy, but this shouldn't be necessary for public services

### Coordinate Systems

Memphis is in Tennessee, typical coordinates are around:
- Longitude: -90.1 to -89.7
- Latitude: 34.9 to 35.3

If you're getting coordinates like `x: -10000000, y: 4000000`, that's Web Mercator and needs reprojection.

### Useful ArcGIS REST API Parameters

```
f=json              # Response format (always use json, not pjson)
where=1=1           # SQL filter (1=1 returns all)
outFields=*         # Fields to return (* for all)
returnGeometry=true # Include geometry (default true)
geometryType=esriGeometryEnvelope  # For bbox queries
spatialRel=esriSpatialRelIntersects  # Spatial relationship
outSR=4326          # Output spatial reference (request WGS84)
resultRecordCount=N # Limit results
resultOffset=N      # For pagination
returnCountOnly=true  # Just get count, no features
```

### Testing Coordinates

Use these bounds for testing (downtown Memphis area):
```javascript
const testBbox = [-90.06, 35.13, -90.03, 35.16];
```

Or this point for point-based testing:
```javascript
const testPoint = [-90.05, 35.145];  // Near downtown
```

## Success Criteria

This phase is complete when:

1. ✅ Feature Service URL discovered and documented
2. ✅ Can query service from browser without CORS/auth issues
3. ✅ ArcGIS JSON successfully converts to GeoJSON
4. ✅ Spatial queries (bbox) return correct subset of features
5. ✅ Pagination works if results exceed limit
6. ✅ Converted GeoJSON works with Turf.js analysis functions
7. ✅ Integration doesn't break existing functionality
8. ✅ Findings documented for future dataset integration

## Out of Scope for This Phase

- UI changes to display functional class results
- Adding functional class to PDF report
- Refactoring existing datasets to new architecture
- Full configuration-driven system (that's next phase)
- Other datasets beyond functional classification test

## Files to Create/Modify

**New files:**
- `js/featureServiceQuery.js` or add functions to index.html (maintain single-file approach)

**Modified files:**
- `index.html` - add Feature Service query capability, test integration

**Documentation:**
- Update this spec with findings
- Or create new `feature-service-findings.md` with results

## Questions to Resolve During Implementation

1. What's the exact REST endpoint URL?
2. What coordinate system does it use?
3. What's the maxRecordCount?
4. What fields are available and what are they called?
5. Any unexpected issues with the response format?

---

## Appendix: ArcGIS REST API Reference

Full documentation: https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/

Common query endpoint pattern:
```
[serviceUrl]/query?[parameters]
```

Example full request:
```
https://services.arcgis.com/XXX/arcgis/rest/services/FunctionalClass/FeatureServer/0/query?where=1%3D1&outFields=*&geometry=%7B%22xmin%22%3A-90.1%2C%22ymin%22%3A35.0%2C%22xmax%22%3A-89.9%2C%22ymax%22%3A35.2%7D&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outSR=4326&f=json
```
