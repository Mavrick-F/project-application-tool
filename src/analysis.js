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
 * Validate that a feature has valid geometry
 * @param {Object} feature - GeoJSON Feature
 * @returns {boolean} True if geometry is valid
 */
function hasValidGeometry(feature) {
  return feature &&
         feature.geometry &&
         feature.geometry.coordinates &&
         Array.isArray(feature.geometry.coordinates) &&
         feature.geometry.coordinates.length > 0;
}

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
 * @param {Object} feature - GeoJSON Feature or geometry object
 * @returns {Array} Array of Turf.js LineString objects
 */
function normalizeToLineStrings(feature) {
  const geom = feature.geometry || feature;

  if (geom.type === 'LineString') {
    return [turf.lineString(geom.coordinates)];
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
        if (!hasValidGeometry(feature)) return;

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
      if (!hasValidGeometry(feature)) return;

      // Apply analysis filter if configured (e.g., only unreliable segments)
      if (datasetConfig.analysisFilter) {
        const filterField = datasetConfig.analysisFilter.field;
        const filterValue = datasetConfig.analysisFilter.value;
        const filterOperator = datasetConfig.analysisFilter.operator;
        const featureValue = feature.properties[filterField];

        let matchesFilter = false;
        if (filterOperator === '=') {
          matchesFilter = featureValue === filterValue;
        } else if (filterOperator === '!=') {
          matchesFilter = featureValue !== filterValue;
        }

        if (!matchesFilter) {
          return; // Skip features that don't match the filter
        }
      }

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
      // Skip features with invalid geometry
      if (!hasValidGeometry(feature)) {
        return;
      }

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
        if (!hasValidGeometry(feature)) return;

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
 * Analyze proximity with acreage summation for Polygon datasets
 * Creates buffer around drawn geometry and sums acreage of intersecting features
 * Optionally filters features by a property value (e.g., wetland type)
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} Object with total count, acreage sum, and matched features
 */
function analyzeProximityWithAcreage(drawnGeometry, datasetConfig, geoJsonData) {
  const matchedFeatures = [];
  let totalAcreage = 0;

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
        // Apply analysis filter if configured (e.g., wetland type filter)
        if (datasetConfig.analysisFilter) {
          const filterField = datasetConfig.analysisFilter.field;
          const filterValue = datasetConfig.analysisFilter.value;
          const filterOperator = datasetConfig.analysisFilter.operator;
          const featureValue = feature.properties[filterField];

          let matchesFilter = false;
          if (filterOperator === '=') {
            matchesFilter = featureValue === filterValue;
          } else if (filterOperator === '!=') {
            matchesFilter = featureValue !== filterValue;
          }

          if (!matchesFilter) {
            return; // Skip features that don't match the filter
          }
        }

        // Check if polygon intersects buffer
        const isNearby = turf.booleanIntersects(feature, buffered);

        if (isNearby) {
          // Store matched feature
          matchedFeatures.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: { ...feature.properties }
          });

          // Sum acreage if sumField is configured
          if (datasetConfig.sumField) {
            const acreage = parseFloat(feature.properties[datasetConfig.sumField]) || 0;
            totalAcreage += acreage;
          }
        }
      } catch (error) {
        console.warn('Error checking proximity for acreage:', error);
      }
    });

  } catch (error) {
    console.error('Error in proximity acreage analysis:', error);
  }

  return {
    total: matchedFeatures.length,
    sum: totalAcreage,
    features: matchedFeatures
  };
}

/**
 * Analyze binary proximity for Polygon datasets
 * Simply checks if any features exist within the proximity buffer
 * Used for flood zones where we just need yes/no detection
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} Object with detected boolean and matched features
 */
function analyzeBinaryProximity(drawnGeometry, datasetConfig, geoJsonData) {
  const matchedFeatures = [];

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
    for (const feature of geoJsonData.features) {
      try {
        // Apply analysis filter if configured (e.g., filter by wetland type)
        if (datasetConfig.analysisFilter) {
          const filterField = datasetConfig.analysisFilter.field;
          const filterValue = datasetConfig.analysisFilter.value;
          const filterOperator = datasetConfig.analysisFilter.operator;
          const featureValue = feature.properties[filterField];

          let matchesFilter = false;
          if (filterOperator === '=') {
            matchesFilter = featureValue === filterValue;
          } else if (filterOperator === '!=') {
            matchesFilter = featureValue !== filterValue;
          }

          if (!matchesFilter) {
            continue; // Skip features that don't match the filter
          }
        }

        const isNearby = turf.booleanIntersects(feature, buffered);

        if (isNearby) {
          matchedFeatures.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: { ...feature.properties }
          });
        }
      } catch (error) {
        console.warn('Error checking binary proximity:', error);
      }
    }

  } catch (error) {
    console.error('Error in binary proximity analysis:', error);
  }

  return {
    detected: matchedFeatures.length > 0,
    features: matchedFeatures
  };
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
        if (!hasValidGeometry(feature)) return;

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
 * Analyze corridor with length summation by reliability status
 * Sums up the total length of segments that fall within the corridor buffer,
 * grouped by reliability status (reliable vs unreliable)
 * Calculates percentages and mean LOTTR for all captured segments
 * Used specifically for Travel Time Reliability dataset
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} Object with percentages by reliability status, mean LOTTR, and matched features
 */
function analyzeCorridorLengthByStatus(drawnGeometry, datasetConfig, geoJsonData) {
  const lengthsByStatus = {};  // Track lengths by Reliable_Segment_ value
  const matchedFeatures = [];  // Store matched features for map rendering
  let totalLength = 0;
  let lottrSum = 0;  // Sum of LOTTR values for calculating mean
  let lottrCount = 0;  // Count of features with LOTTR values

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
        if (!hasValidGeometry(feature)) return;

        if (turf.booleanIntersects(corridorBuffer, feature)) {
          const status = feature.properties['Reliable_Segment_'] || 'Unknown';
          const length = turf.length(feature, { units: 'miles' });
          lengthsByStatus[status] = (lengthsByStatus[status] || 0) + length;
          totalLength += length;

          // Collect LOTTR values for mean calculation
          const lottr = parseFloat(feature.properties['Level_of_Travel_Time_Reliability']);
          if (!isNaN(lottr)) {
            lottrSum += lottr;
            lottrCount++;
          }

          matchedFeatures.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: { ...feature.properties }
          });
        }
      } catch (error) {
        console.warn('Error checking point corridor length:', error);
      }
    });

    // Calculate percentages
    const percentageBreakdown = {};
    if (totalLength > 0) {
      Object.keys(lengthsByStatus).forEach(status => {
        percentageBreakdown[status] = (lengthsByStatus[status] / totalLength) * 100;
      });
    }

    // Calculate mean LOTTR
    const meanLOTTR = lottrCount > 0 ? lottrSum / lottrCount : null;

    return {
      total: totalLength,
      breakdown: percentageBreakdown,
      meanLOTTR: meanLOTTR,
      features: matchedFeatures
    };
  }

  // LineString corridor matching
  if (geometry.type !== 'LineString') {
    console.warn(`Unsupported geometry type for corridor length: ${geometry.type}`);
    return { total: 0, breakdown: {}, features: [] };
  }

  // Create buffer around drawn line
  const corridorBuffer = turf.buffer(geometry, datasetConfig.bufferDistance, {
    units: 'feet'
  });

  geoJsonData.features.forEach(feature => {
    try {
      if (!hasValidGeometry(feature)) return;

      // Quick check: does feature intersect buffer at all?
      if (!turf.booleanIntersects(corridorBuffer, feature)) {
        return; // No intersection, skip
      }

      // Normalize feature to array of LineStrings
      const routeLines = normalizeToLineStrings(feature);
      let featureOverlapLength = 0;

      // Calculate how much of the feature falls within the corridor buffer
      for (const routeLine of routeLines) {
        try {
          const routeCoords = turf.getCoords(routeLine);

          // Check each segment of the route
          for (let i = 0; i < routeCoords.length - 1; i++) {
            const segment = turf.lineString([routeCoords[i], routeCoords[i + 1]]);

            // Skip if segment doesn't intersect buffer
            if (!turf.booleanIntersects(segment, corridorBuffer)) {
              continue;
            }

            // Calculate actual length inside buffer
            const insideLength = measureSegmentInsideBuffer(segment, corridorBuffer);
            featureOverlapLength += insideLength;
          }

          // Early exit if we found significant overlap
          if (featureOverlapLength >= datasetConfig.minSharedLength) {
            break;
          }

        } catch (segmentError) {
          console.warn('Error calculating segment length:', segmentError);
        }
      }

      // Feature matches if total overlap meets minimum threshold
      if (featureOverlapLength >= datasetConfig.minSharedLength) {
        const status = feature.properties['Reliable_Segment_'] || 'Unknown';
        const lengthInMiles = featureOverlapLength / 5280;  // Convert feet to miles
        lengthsByStatus[status] = (lengthsByStatus[status] || 0) + lengthInMiles;
        totalLength += lengthInMiles;

        // Collect LOTTR values for mean calculation
        const lottr = parseFloat(feature.properties['Level_of_Travel_Time_Reliability']);
        if (!isNaN(lottr)) {
          lottrSum += lottr;
          lottrCount++;
        }

        matchedFeatures.push({
          type: 'Feature',
          geometry: feature.geometry,
          properties: { ...feature.properties }
        });
      }

    } catch (error) {
      console.warn(`Error analyzing corridor length for ${datasetConfig.name}:`, error);
    }
  });

  // Calculate percentages
  const percentageBreakdown = {};
  if (totalLength > 0) {
    Object.keys(lengthsByStatus).forEach(status => {
      percentageBreakdown[status] = (lengthsByStatus[status] / totalLength) * 100;
    });
  }

  // Calculate mean LOTTR
  const meanLOTTR = lottrCount > 0 ? lottrSum / lottrCount : null;

  return {
    total: totalLength,
    breakdown: percentageBreakdown,
    meanLOTTR: meanLOTTR,
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

        case 'corridorLengthByStatus':
          datasetResults = analyzeCorridorLengthByStatus(drawnGeometry, config, geoJsonData[datasetKey]);
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

        case 'proximityAcreage':
          datasetResults = analyzeProximityWithAcreage(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'binaryProximity':
          datasetResults = analyzeBinaryProximity(drawnGeometry, config, geoJsonData[datasetKey]);
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
