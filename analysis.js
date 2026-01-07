/**
 * analysis.js
 * Spatial analysis functions for project intersection detection
 *
 * Dependencies: Turf.js, datasets.js (CONFIG, DATASETS)
 */

// ============================================
// ANALYSIS GLOBAL VARIABLES
// ============================================
let drawnGeometry = null;         // GeoJSON of drawn line or point
const currentResults = {};        // Analysis results keyed by dataset ID

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Clean corridor names by removing directional suffixes
 * @param {string} name - Original corridor name
 * @returns {string} Cleaned name
 */
function cleanCorridorName(name) {
  if (!name) return 'Unknown';

  // Remove common directional suffixes (with optional space/dash before)
  // Handles: "Route 50 IB", "Route 50-OB", "Route 50IB", etc.
  return name
    .replace(/[\s\-]*(IB|OB|EB|WB)$/i, '')
    .trim();
}

/**
 * Normalize a GeoJSON feature to an array of LineStrings
 * Handles both LineString and MultiLineString geometry types
 * @param {Object} feature - GeoJSON Feature or geometry object
 * @returns {Array} Array of Turf.js LineString objects
 */
function normalizeToLineStrings(feature) {
  const geom = feature.geometry || feature;

  if (geom.type === 'LineString') {
    return [turf.lineString(geom.coordinates)];
  } else if (geom.type === 'MultiLineString') {
    return geom.coordinates.map(coords => turf.lineString(coords));
  }

  return [];
}

/**
 * Calculate the length of a line segment that falls inside a polygon buffer.
 * Uses polygon boundary intersection to find exact entry/exit points.
 * This fixes the false positive issue where perpendicular crossings were
 * counting the full segment length instead of just the portion inside.
 *
 * @param {Object} segment - Turf.js LineString (2 coordinates)
 * @param {Object} buffer - Turf.js Polygon (the corridor buffer)
 * @returns {number} Length in feet of segment inside the buffer
 */
function measureSegmentInsideBuffer(segment, buffer) {
  const coords = turf.getCoords(segment);
  if (coords.length < 2) return 0;

  const startPt = turf.point(coords[0]);
  const endPt = turf.point(coords[coords.length - 1]);
  const segmentLength = turf.length(segment, { units: 'feet' });

  if (segmentLength === 0) return 0;

  const startInside = turf.booleanPointInPolygon(startPt, buffer);
  const endInside = turf.booleanPointInPolygon(endPt, buffer);

  // Case 1: Both endpoints inside - entire segment is inside
  if (startInside && endInside) {
    return segmentLength;
  }

  // Find where segment crosses buffer boundary
  const bufferBoundary = turf.polygonToLine(buffer);
  const intersections = turf.lineIntersect(segment, bufferBoundary);

  // Case 2: No boundary crossings
  if (intersections.features.length === 0) {
    // If start is inside but no crossings, entire segment must be inside
    // (This handles numerical edge cases near boundary)
    return startInside ? segmentLength : 0;
  }

  // Calculate distance along segment for each intersection point
  const distances = [];
  for (const pt of intersections.features) {
    // Find the nearest point on the segment to this intersection
    const nearest = turf.nearestPointOnLine(segment, pt, { units: 'feet' });
    distances.push(nearest.properties.location);
  }

  // Sort distances from start to end
  distances.sort((a, b) => a - b);

  // Walk along segment, tracking inside/outside state
  let totalInside = 0;
  let inside = startInside;
  let prevDist = 0;

  for (const dist of distances) {
    if (inside) {
      totalInside += dist - prevDist;
    }
    prevDist = dist;
    inside = !inside; // Toggle at each boundary crossing
  }

  // Handle final segment from last crossing to end
  if (inside) {
    totalInside += segmentLength - prevDist;
  }

  return Math.max(0, totalInside); // Ensure non-negative
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze corridor match for LineString datasets
 * Works for any LineString dataset with corridor matching logic.
 * Uses buffer intersection with segment clipping to accurately measure
 * the portion of each route segment inside the corridor buffer.
 * This correctly handles perpendicular crossings (only counts the
 * portion inside the buffer, not the full segment length).
 *
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Array} Array of matching feature names/IDs
 */
function analyzeCorridorMatch(drawnGeometry, datasetConfig, geoJsonData) {
  const matchingFeatures = new Map(); // Changed from Set to Map for deduplication with geometry

  // Extract actual geometry from GeoJSON Feature if needed
  const geometry = drawnGeometry.type === 'Feature'
    ? drawnGeometry.geometry
    : drawnGeometry;

  // Handle Point geometry separately (simple buffer intersection)
  if (geometry.type === 'Point') {
    const corridorBuffer = turf.buffer(geometry, datasetConfig.bufferDistance, {
      units: 'feet'
    });

    geoJsonData.features.forEach(feature => {
      try {
        if (turf.booleanIntersects(corridorBuffer, feature)) {
          const featureName = feature.properties[datasetConfig.properties.displayField] || 'Unknown';
          let processedName = featureName;
          if (datasetConfig.specialHandling?.removeDirectionalSuffixes) {
            processedName = cleanCorridorName(featureName);
          }

          // Store complete feature with geometry, keyed by processed name for deduplication
          if (!matchingFeatures.has(processedName)) {
            matchingFeatures.set(processedName, {
              type: 'Feature',
              geometry: feature.geometry,
              properties: {
                ...feature.properties,
                _displayName: processedName
              }
            });
          }
        }
      } catch (error) {
        console.warn('Error checking point corridor match:', error);
      }
    });

    return Array.from(matchingFeatures.values());
  }

  // LineString corridor matching using buffer intersection approach
  if (geometry.type !== 'LineString') {
    console.warn(`Unsupported geometry type for corridor matching: ${geometry.type}`);
    return [];
  }

  // Create buffer around drawn line for corridor tolerance
  const corridorBuffer = turf.buffer(geometry, datasetConfig.bufferDistance, {
    units: 'feet'
  });

  geoJsonData.features.forEach(feature => {
    try {
      // Quick check: does route intersect buffer at all?
      if (!turf.booleanIntersects(corridorBuffer, feature)) {
        return; // No intersection, skip this feature
      }

      // Normalize feature to array of LineStrings (handles both LineString and MultiLineString)
      const routeLines = normalizeToLineStrings(feature);
      let totalOverlap = 0;

      // Calculate how much of the route falls within the corridor buffer
      for (const routeLine of routeLines) {
        try {
          const routeCoords = turf.getCoords(routeLine);

          // Check each segment of the route
          for (let i = 0; i < routeCoords.length - 1; i++) {
            const segment = turf.lineString([routeCoords[i], routeCoords[i + 1]]);

            // Quick check: skip if segment doesn't intersect buffer at all
            if (!turf.booleanIntersects(segment, corridorBuffer)) {
              continue;
            }

            // FIX: Calculate actual length inside buffer, not full segment length
            // This prevents false positives from perpendicular crossings
            const insideLength = measureSegmentInsideBuffer(segment, corridorBuffer);
            totalOverlap += insideLength;
          }

          // Early exit optimization: if we've already met the threshold, no need to continue
          if (totalOverlap >= datasetConfig.minSharedLength) {
            break;
          }

        } catch (segmentError) {
          // Log error but continue processing other line segments
          console.warn('Error calculating segment intersection:', segmentError);
        }
      }

      // Feature matches if total overlap meets minimum threshold
      if (totalOverlap >= datasetConfig.minSharedLength) {
        // Use staticLabel if defined, otherwise use field value
        const featureName = datasetConfig.properties.staticLabel ||
                            feature.properties[datasetConfig.properties.displayField] ||
                            'Unknown';

        // Apply deduplication/suffix removal if configured
        let processedName = featureName;
        if (datasetConfig.specialHandling?.removeDirectionalSuffixes) {
          processedName = cleanCorridorName(featureName);
        }

        // Store complete feature with geometry, keyed by processed name for deduplication
        if (!matchingFeatures.has(processedName)) {
          matchingFeatures.set(processedName, {
            type: 'Feature',
            geometry: feature.geometry,
            properties: {
              ...feature.properties,
              _displayName: processedName
            }
          });
        }
      }

    } catch (error) {
      console.warn(`Error analyzing corridor match for ${datasetConfig.name}:`, error);
    }
  });

  // Convert Map values to array (already deduplicated by Map key)
  return Array.from(matchingFeatures.values());
}

/**
 * Analyze intersection for Polygon datasets
 * Works for any Polygon dataset with intersection logic
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Array} Array of intersecting feature names/IDs
 */
function analyzeIntersection(drawnGeometry, datasetConfig, geoJsonData) {
  const intersectingFeatures = [];

  // Extract actual geometry from GeoJSON Feature if needed
  const geometry = drawnGeometry.type === 'Feature'
    ? drawnGeometry.geometry
    : drawnGeometry;

  geoJsonData.features.forEach(feature => {
    try {
      let intersects = false;

      if (geometry.type === 'LineString') {
        // Line-to-polygon intersection
        intersects = turf.booleanIntersects(geometry, feature);
      } else if (geometry.type === 'Point') {
        // Point-in-polygon check
        intersects = turf.booleanPointInPolygon(geometry, feature);
      }

      if (intersects) {
        // Build properties object
        const props = {
          [datasetConfig.properties.displayField]:
            feature.properties[datasetConfig.properties.displayField] || 'Unknown'
        };

        // Add additional fields if configured
        datasetConfig.properties.additionalFields.forEach(field => {
          props[field] = feature.properties[field] || 'Unknown';
        });

        // Return complete GeoJSON Feature with geometry
        const featureData = {
          type: 'Feature',
          geometry: feature.geometry,
          properties: props
        };

        intersectingFeatures.push(featureData);
      }
    } catch (error) {
      console.warn('Error checking intersection:', error);
    }
  });

  // Sort by feature name
  return intersectingFeatures.sort();
}

/**
 * Analyze proximity for Point and Polygon datasets
 * Works for any Point or Polygon dataset with proximity buffer
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Array} Array of nearby features with their properties
 */
function analyzeProximity(drawnGeometry, datasetConfig, geoJsonData) {
  const nearbyFeatures = [];

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Create buffer around the drawn geometry
    const buffered = turf.buffer(geometry, datasetConfig.proximityBuffer, {
      units: 'feet'
    });

    // Check each feature against the buffer
    geoJsonData.features.forEach(feature => {
      try {
        let isNearby = false;

        if (datasetConfig.geometryType === 'Point') {
          // Point features: check if point is in buffer
          isNearby = turf.booleanPointInPolygon(feature, buffered);
        } else if (datasetConfig.geometryType === 'Polygon') {
          // Polygon features: check if polygon intersects buffer
          isNearby = turf.booleanIntersects(feature, buffered);
        }

        if (isNearby) {
          // Build properties object
          const props = {
            [datasetConfig.properties.displayField]:
              feature.properties[datasetConfig.properties.displayField] || 'Unknown'
          };

          // Add additional fields if configured
          datasetConfig.properties.additionalFields.forEach(field => {
            props[field] = feature.properties[field] || 'Unknown';
          });

          // Return complete GeoJSON Feature with geometry
          const featureData = {
            type: 'Feature',
            geometry: feature.geometry,
            properties: props
          };

          nearbyFeatures.push(featureData);
        }
      } catch (error) {
        console.warn('Error checking proximity:', error);
      }
    });

    // Sort by display field
    nearbyFeatures.sort((a, b) => {
      const aVal = String(a[datasetConfig.properties.displayField]);
      const bVal = String(b[datasetConfig.properties.displayField]);
      return aVal.localeCompare(bVal);
    });

  } catch (error) {
    console.error('Error creating buffer or checking proximity:', error);
  }

  return nearbyFeatures;
}

/**
 * Analyze proximity with counting for Point datasets
 * Counts features within buffer and groups by a specified property
 * Generic function that can be used for any point dataset requiring counts
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} Object with counts grouped by category
 */
function analyzeProximityWithCounting(drawnGeometry, datasetConfig, geoJsonData) {
  const counts = {};
  let totalCount = 0;
  const matchedFeatures = []; // Store matched features for PDF rendering

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Create buffer around the drawn geometry
    const buffered = turf.buffer(geometry, datasetConfig.proximityBuffer, {
      units: 'feet'
    });

    // Check each feature against the buffer
    geoJsonData.features.forEach(feature => {
      try {
        let isNearby = false;

        if (datasetConfig.geometryType === 'Point') {
          // Point features: check if point is in buffer
          isNearby = turf.booleanPointInPolygon(feature, buffered);
        }

        if (isNearby) {
          totalCount++;

          // Store complete feature for PDF rendering
          matchedFeatures.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: { ...feature.properties }
          });

          // Count by category if countByField is specified
          if (datasetConfig.countByField) {
            const category = feature.properties[datasetConfig.countByField] || 'Unknown';
            counts[category] = (counts[category] || 0) + 1;
          }
        }
      } catch (error) {
        console.warn('Error checking proximity for counting:', error);
      }
    });

  } catch (error) {
    console.error('Error creating buffer or checking proximity for counting:', error);
  }

  // Return structured count data with features for PDF rendering
  return {
    total: totalCount,
    breakdown: counts,
    features: matchedFeatures
  };
}

/**
 * Master analysis function that loops through all enabled datasets
 * and calls the appropriate analysis function based on analysisMethod
 * @param {Object} drawnGeometry - GeoJSON of drawn line or point
 * @returns {Object} Analysis results keyed by dataset ID
 */
function analyzeAllDatasets(drawnGeometry) {
  console.time('Spatial Analysis');

  const results = {};

  // Loop through all datasets in configuration
  Object.keys(DATASETS).forEach(datasetKey => {
    const config = DATASETS[datasetKey];

    // Skip if dataset is disabled or data not loaded
    if (!config.enabled || !geoJsonData[datasetKey]) {
      return;
    }

    try {
      let datasetResults = [];

      // Call appropriate analysis function based on method
      switch (config.analysisMethod) {
        case 'corridor':
          datasetResults = analyzeCorridorMatch(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'intersection':
          datasetResults = analyzeIntersection(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'proximity':
          datasetResults = analyzeProximity(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'proximityCount':
          datasetResults = analyzeProximityWithCounting(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        default:
          console.warn(`Unknown analysis method: ${config.analysisMethod} for ${datasetKey}`);
      }

      // Store results keyed by dataset ID
      results[datasetKey] = datasetResults;

    } catch (error) {
      console.error(`Error analyzing ${datasetKey}:`, error);
      results[datasetKey] = [];
    }
  });

  console.timeEnd('Spatial Analysis');
  console.log('Analysis results:', results);

  // Store results globally
  Object.assign(currentResults, results);

  return results;
}

/**
 * Perform all spatial analyses on the drawn geometry (legacy wrapper)
 * This maintains backward compatibility while using the new system
 * @param {Object} drawnGeometry - GeoJSON of drawn line or point
 * @returns {Object} Analysis results containing routes, zones, and bridges
 * @deprecated Use analyzeAllDatasets() instead
 */
function analyzeIntersections(drawnGeometry) {
  const allResults = analyzeAllDatasets(drawnGeometry);

  // Map new structure to old structure for backward compatibility
  return {
    routes: allResults.mataRoutes || [],
    zones: allResults.opportunityZones || [],
    bridges: allResults.bridges || []
  };
}

/**
 * Find all bridges within 300 feet of the drawn geometry
 * Creates a buffer around the line or point and checks point-in-polygon
 * @param {Object} featureOrGeometry - GeoJSON Feature or geometry (LineString or Point)
 * @returns {Array} Array of bridge objects {nbiId, condition}
 */
function findNearbyBridges(featureOrGeometry) {
  const nearbyBridges = [];

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = featureOrGeometry.type === 'Feature'
      ? featureOrGeometry.geometry
      : featureOrGeometry;

    // Create 300-foot buffer around the drawn geometry (works for both lines and points)
    const buffered = turf.buffer(geometry, CONFIG.bridgeBufferDistance, {
      units: CONFIG.bridgeBufferUnits
    });

    // Check each bridge point against the buffer
    geoJsonData.bridges.features.forEach(bridge => {
      try {
        if (turf.booleanPointInPolygon(bridge, buffered)) {
          nearbyBridges.push({
            nbiId: bridge.properties.STRUCTURE_ || 'Unknown',
            condition: bridge.properties.Condition || 'Unknown'
          });
        }
      } catch (error) {
        console.warn('Error checking bridge proximity:', error);
      }
    });

    // Sort by NBI ID
    nearbyBridges.sort((a, b) => {
      return String(a.nbiId).localeCompare(String(b.nbiId));
    });

  } catch (error) {
    console.error('Error creating buffer or checking bridges:', error);
  }

  return nearbyBridges;
}

/**
 * Validate drawn geometry meets minimum requirements
 * @param {Object} featureOrGeometry - GeoJSON Feature or geometry
 * @returns {boolean} True if geometry is valid
 */
function validateGeometry(featureOrGeometry) {
  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = featureOrGeometry.type === 'Feature'
      ? featureOrGeometry.geometry
      : featureOrGeometry;

    console.log('Validating geometry type:', geometry.type);

    // Points are always valid
    if (geometry.type === 'Point') {
      console.log('Point geometry detected - validation passed');
      return true;
    }

    // For LineStrings, check minimum length
    if (geometry.type === 'LineString') {
      const length = turf.length(geometry, { units: 'feet' });
      console.log(`Drawn line length: ${length.toFixed(2)} feet`);
      return length >= CONFIG.minLineLength;
    }

    // Unknown geometry type
    console.warn('Unknown geometry type:', geometry.type);
    return false;
  } catch (error) {
    console.error('Geometry validation error:', error);
    return false;
  }
}
