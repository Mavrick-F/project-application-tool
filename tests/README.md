# Testing Guide

## Running Tests

Start the development server and open test files in your browser:
```bash
python -m http.server 3000
# Navigate to: http://localhost:3000/tests/test-[name].html
```

## Writing Analysis Function Tests

Test files are self-contained HTML pages that load Turf.js and test the analysis function directly.

### Basic Test Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Analysis Tests</title>
  <script src="https://unpkg.com/@turf/turf@6.5.0/turf.min.js"></script>
</head>
<body>
  <h1>My Analysis Tests</h1>
  <div id="results"></div>

  <script>
    const tests = [];

    // Copy the analysis function from src/analysis.js
    function myAnalysisFunction(drawnGeometry, datasetConfig, geoJsonData) {
      // ... implementation
    }

    // Test 1: Basic functionality
    (() => {
      const geometry = turf.point([-90.0, 35.0]);
      const config = { /* ... */ };
      const data = { features: [ /* ... */ ] };

      const result = myAnalysisFunction(geometry, config, data);

      tests.push({
        name: 'Test description',
        pass: result.total === expectedValue,
        details: `Expected ${expectedValue}, got ${result.total}`
      });
    })();

    // Test 2: Edge case
    // ...

    // Render results (copy from test-sumNearbyValues.html)
  </script>
</body>
</html>
```

## What to Test

1. **All geometry types**: Point, LineString, Polygon (where applicable)
2. **Edge cases**: Empty data, zero values, null values, missing fields
3. **Filters**: Test `analysisFilter` if supported
4. **Precision**: For calculations, verify correct rounding/precision
5. **Buffer distances**: Test that proximity/buffer logic works correctly

## Test Data Tips

Use Turf.js helpers to create test data:
```javascript
// Points
turf.point([-90.0, 35.0], { propertyName: 'value' })

// Lines
turf.lineString([[-90.0, 35.0], [-90.01, 35.01]], { propertyName: 'value' })

// Polygons
turf.polygon([[
  [-90.0, 35.0], [-90.0, 35.01], [-90.01, 35.01], [-90.01, 35.0], [-90.0, 35.0]
]], { propertyName: 'value' })

// FeatureCollections
turf.featureCollection([feature1, feature2, feature3])
```

## Coordinate Reference

Memphis area coordinates (WGS84):
- Longitude: -90.1 to -89.6
- Latitude: 34.9 to 35.3

Distance approximations at 35°N:
- 0.001° longitude ≈ 90 meters
- 0.001° latitude ≈ 110 meters
- 100 feet ≈ 0.0003° (30 meters)
- 1000 feet ≈ 0.003° (300 meters)

Keep test points close together for reliable buffer intersections.

## Example: test-sumNearbyValues.html

See this file for a complete example with:
- Helper functions (hasValidGeometry, etc.)
- 8 test cases covering various scenarios
- Visual results rendering with CSS styling
- Console logging for debugging
