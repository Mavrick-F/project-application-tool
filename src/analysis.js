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
// UNIT CONVERSION CONSTANTS AND HELPERS
// ============================================

const CONVERSIONS = {
  FEET_PER_MILE:          5280,
  FEET_PER_KM:            3280.84,
  FEET_PER_METER:         3.28084,
  SQ_METERS_PER_ACRE:     4046.86,
  SQ_METERS_PER_SQ_MILE:  2589988.11,
  SQ_METERS_PER_SQ_FT:    0.092903,
  SQ_METERS_PER_SQ_KM:    1000000,
};

/**
 * Convert a length value between any two supported units.
 * Supported: 'feet', 'miles', 'meters', 'kilometers'
 */
function convertLength(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const toFeet = {
    feet:       1,
    miles:      CONVERSIONS.FEET_PER_MILE,
    meters:     CONVERSIONS.FEET_PER_METER,
    kilometers: CONVERSIONS.FEET_PER_KM,
  };
  const fromFeet = {
    feet:       1,
    miles:      1 / CONVERSIONS.FEET_PER_MILE,
    meters:     1 / CONVERSIONS.FEET_PER_METER,
    kilometers: 1 / CONVERSIONS.FEET_PER_KM,
  };
  return value * (toFeet[fromUnit] || 1) * (fromFeet[toUnit] || 1);
}

/**
 * Convert an area value from square meters to a display unit.
 * Supported: 'acres' (default), 'sq miles', 'sq ft', 'sq meters', 'sq km'
 */
function convertArea(sqMeters, toUnit) {
  switch (toUnit) {
    case 'sq miles':  return sqMeters / CONVERSIONS.SQ_METERS_PER_SQ_MILE;
    case 'sq ft':     return sqMeters / CONVERSIONS.SQ_METERS_PER_SQ_FT;
    case 'sq km':     return sqMeters / CONVERSIONS.SQ_METERS_PER_SQ_KM;
    case 'sq meters': return sqMeters;
    default:          return sqMeters / CONVERSIONS.SQ_METERS_PER_ACRE; // acres
  }
}

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
 * Check if a feature passes the dataset's analysisFilter (if any).
 * @param {Object} feature - GeoJSON Feature
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @returns {boolean} True if feature passes filter or no filter is configured
 */
function matchesAnalysisFilter(feature, datasetConfig) {
  if (!datasetConfig.analysisFilter) return true;
  const { field, value, operator } = datasetConfig.analysisFilter;
  const featureValue = feature.properties[field];
  if (operator === '=')  return featureValue === value;
  if (operator === '!=') return featureValue !== value;
  return true; // unknown operator = no filter
}

/**
 * Calculate the median value of an array
 * Returns null if array is empty
 * @param {Array<number>} values - Array of numeric values
 * @returns {number|null} Median value or null if array is empty
 */
function calculateMedian(values) {
  if (!values || values.length === 0) return null;

  // Sort values in ascending order
  const sorted = [...values].sort((a, b) => a - b);

  // Find middle value
  const mid = Math.floor(sorted.length / 2);

  // If odd number of values, return middle value
  // If even number of values, return average of two middle values
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  } else {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

/**
 * Clean corridor names by removing directional suffixes
 * @param {string} name - Original corridor name
 * @returns {string} Cleaned name
 */
function cleanCorridorName(name) {
  if (!name) return 'Unknown';

  // Remove common directional suffixes (with optional space/dash before)
  // Handles: "Route 50 NB", "Route 50-SB", "Route 50IB", etc.
  return name
    .replace(/[\s\-]*(NB|SB|EB|WB|IB|OB)$/i, '')
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
function measureSegmentInsideBuffer(segment, buffer, units = 'feet') {
  const coords = turf.getCoords(segment);
  if (coords.length < 2) return 0;

  const startPt = turf.point(coords[0]);
  const endPt = turf.point(coords[coords.length - 1]);
  const segmentLength = turf.length(segment, { units });

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
    const nearest = turf.nearestPointOnLine(segment, pt, { units });
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

/**
 * Return cos(angle) between a segment and the overall project line direction.
 * 1.0 = fully parallel, 0.0 = fully perpendicular.
 * Prevents perpendicular crossings from accumulating as "parallel overlap".
 * @param {Object} segment - Turf.js LineString
 * @param {Array} projectCoords - Coordinate array of the project LineString
 * @returns {number} Parallel factor 0.0–1.0
 */
function segmentParallelFactor(segment, projectCoords) {
  if (!projectCoords || projectCoords.length < 2) return 1;
  const segCoords = turf.getCoords(segment);
  if (segCoords.length < 2) return 0;

  const [sx1, sy1] = segCoords[0];
  const [sx2, sy2] = segCoords[segCoords.length - 1];
  if (sx1 === sx2 && sy1 === sy2) return 0; // Zero-length segment

  const segBearing     = turf.bearing(turf.point(segCoords[0]),    turf.point(segCoords[segCoords.length - 1]));
  const projectBearing = turf.bearing(turf.point(projectCoords[0]), turf.point(projectCoords[projectCoords.length - 1]));

  // Normalize to 0–180, then fold to 0–90 (parallel in either direction counts)
  let angleDeg = Math.abs(segBearing - projectBearing);
  if (angleDeg > 180) angleDeg = 360 - angleDeg;
  if (angleDeg > 90)  angleDeg = 180 - angleDeg;

  return Math.cos(angleDeg * Math.PI / 180);
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
function analyzeListParallelFeatures(drawnGeometry, datasetConfig, geoJsonData) {
  const matchingFeatures = new Map(); // Changed from Set to Map for deduplication with geometry

  // Extract actual geometry from GeoJSON Feature if needed
  const geometry = drawnGeometry.type === 'Feature'
    ? drawnGeometry.geometry
    : drawnGeometry;

  const bufferUnit = datasetConfig.bufferUnit || 'feet';

  // Handle Point geometry separately (simple buffer intersection)
  if (geometry.type === 'Point') {
    const corridorBuffer = turf.buffer(geometry, datasetConfig.bufferDistance, {
      units: bufferUnit
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
    units: bufferUnit
  });

  const projectCoords = turf.getCoords(geometry);

  geoJsonData.features.forEach(feature => {
    try {
      if (!hasValidGeometry(feature)) return;

      // Apply analysis filter if configured (e.g., only unreliable segments)
      if (!matchesAnalysisFilter(feature, datasetConfig)) return;

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

            // Weight by parallel factor: perpendicular crossings contribute ~0,
            // fully parallel segments contribute their full inside length.
            const insideLength = measureSegmentInsideBuffer(segment, corridorBuffer, bufferUnit);
            totalOverlap += insideLength * segmentParallelFactor(segment, projectCoords);
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
 * Analyze intersection for Polygon and LineString datasets
 * Works for any Polygon or LineString dataset with intersection logic
 * For LineString datasets, uses optional bufferDistance for tolerance
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Array} Array of intersecting feature names/IDs
 */
function analyzeListIntersectingFeatures(drawnGeometry, datasetConfig, geoJsonData) {
  // Use Map for deduplication if configured, otherwise use array
  const useDedupe = datasetConfig.specialHandling?.deduplicate;
  const intersectingFeatures = useDedupe ? new Map() : [];

  const bufferUnit = datasetConfig.bufferUnit || 'feet';

  // Extract actual geometry from GeoJSON Feature if needed
  const geometry = drawnGeometry.type === 'Feature'
    ? drawnGeometry.geometry
    : drawnGeometry;

  // Create buffer around drawn geometry if bufferDistance is specified
  // This allows line-to-line intersection with tolerance
  let geometryToTest = geometry;
  if (datasetConfig.bufferDistance && datasetConfig.bufferDistance > 0) {
    geometryToTest = turf.buffer(geometry, datasetConfig.bufferDistance, {
      units: bufferUnit
    });
  }

  geoJsonData.features.forEach(feature => {
    try {
      // Skip features with invalid geometry
      if (!hasValidGeometry(feature)) {
        return;
      }

      let intersects = false;

      if (datasetConfig.bufferDistance && datasetConfig.bufferDistance > 0) {
        // Buffer-based intersection (works for any geometry type)
        intersects = turf.booleanIntersects(geometryToTest, feature);
      } else if (geometry.type === 'LineString') {
        // Line-to-polygon or line-to-line intersection (no buffer)
        intersects = turf.booleanIntersects(geometry, feature);
      } else if (geometry.type === 'Point') {
        // Point-in-polygon check
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          intersects = turf.booleanPointInPolygon(geometry, feature);
        } else {
          // Point-to-other geometry intersection
          intersects = turf.booleanIntersects(geometry, feature);
        }
      }

      if (intersects) {
        // Use staticLabel if defined, otherwise use field value
        const displayValue = datasetConfig.properties.staticLabel ||
                            feature.properties[datasetConfig.properties.displayField] ||
                            'Unknown';

        // Build properties object
        const props = {
          [datasetConfig.properties.displayField]:
            feature.properties[datasetConfig.properties.displayField] || 'Unknown',
          _displayName: displayValue
        };

        // Add additional fields if configured
        if (datasetConfig.properties.additionalFields) {
          datasetConfig.properties.additionalFields.forEach(field => {
            props[field] = feature.properties[field] || 'Unknown';
          });
        }

        // Return complete GeoJSON Feature with geometry
        const featureData = {
          type: 'Feature',
          geometry: feature.geometry,
          properties: props
        };

        if (useDedupe) {
          // Store in Map keyed by display name for automatic deduplication
          if (!intersectingFeatures.has(displayValue)) {
            intersectingFeatures.set(displayValue, featureData);
          }
        } else {
          intersectingFeatures.push(featureData);
        }
      }
    } catch (error) {
      console.warn('Error checking intersection:', error);
    }
  });

  // Convert Map to array if using deduplication (already deduplicated by Map key)
  return useDedupe ? Array.from(intersectingFeatures.values()) : intersectingFeatures;
}

/**
 * Analyze proximity for Point and Polygon datasets
 * Works for any Point or Polygon dataset with proximity buffer
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Array} Array of nearby features with their properties
 */
function analyzeListNearbyFeatures(drawnGeometry, datasetConfig, geoJsonData) {
  const nearbyFeatures = [];

  const bufferUnit = datasetConfig.bufferUnit || 'feet';

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Create buffer around the drawn geometry
    const buffered = turf.buffer(geometry, datasetConfig.proximityBuffer, {
      units: bufferUnit
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
      const aVal = String(a.properties[datasetConfig.properties.displayField]);
      const bVal = String(b.properties[datasetConfig.properties.displayField]);
      return aVal.localeCompare(bVal);
    });

  } catch (error) {
    console.error('Error creating buffer or checking proximity:', error);
  }

  return nearbyFeatures;
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
function analyzeHasNearbyFeatures(drawnGeometry, datasetConfig, geoJsonData) {
  const matchedFeatures = [];

  const bufferUnit = datasetConfig.bufferUnit || 'feet';

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Create buffer around the drawn geometry
    const buffered = turf.buffer(geometry, datasetConfig.proximityBuffer, {
      units: bufferUnit
    });

    // Check each feature against the buffer
    for (const feature of geoJsonData.features) {
      try {
        // Apply analysis filter if configured (e.g., filter by wetland type)
        if (!matchesAnalysisFilter(feature, datasetConfig)) continue;

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
 * Measure intersected area for Polygon datasets
 * Calculates the area (in acres) of polygon features that intersect with the project buffer
 * Uses Martinez polygon clipping for accurate area calculation
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} Object with totalArea (in resultUnit) and array of features with calculatedArea
 */
function analyzeMeasureIntersectedArea(drawnGeometry, datasetConfig, geoJsonData) {
  const intersectedFeatures = [];
  let totalArea = 0;

  const bufferUnit = datasetConfig.bufferUnit || 'feet';
  const resultUnit = datasetConfig.resultUnit || 'acres';

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Create buffer around the drawn geometry
    const bufferDistance = datasetConfig.bufferDistance || datasetConfig.proximityBuffer || 200;
    const buffered = turf.buffer(geometry, bufferDistance, {
      units: bufferUnit
    });

    // Get buffer coordinates for Martinez (must be a Polygon or MultiPolygon)
    let bufferCoords;
    if (buffered.geometry.type === 'Polygon') {
      bufferCoords = buffered.geometry.coordinates;
    } else if (buffered.geometry.type === 'MultiPolygon') {
      // For MultiPolygon buffers, use the first polygon
      bufferCoords = buffered.geometry.coordinates[0];
    } else {
      console.warn('Unexpected buffer geometry type:', buffered.geometry.type);
      return { totalArea: 0, features: [] };
    }

    // Check each feature against the buffer
    for (const feature of geoJsonData.features) {
      try {
        // Skip features with invalid geometry
        if (!hasValidGeometry(feature)) {
          continue;
        }

        // Apply analysis filter if configured (e.g., filter by wetland type)
        if (!matchesAnalysisFilter(feature, datasetConfig)) continue;

        // Check if feature intersects buffer
        const intersects = turf.booleanIntersects(feature, buffered);

        if (intersects) {
          // Get feature coordinates for Martinez
          let featureCoords;
          if (feature.geometry.type === 'Polygon') {
            featureCoords = feature.geometry.coordinates;
          } else if (feature.geometry.type === 'MultiPolygon') {
            // Handle MultiPolygon by processing each polygon separately
            let multiPolygonTotalAcres = 0;

            for (const polygonCoords of feature.geometry.coordinates) {
              try {
                // Use Martinez to get intersection
                const intersection = martinez.intersection(bufferCoords, polygonCoords);

                if (intersection && intersection.length > 0) {
                  // Convert Martinez output to Turf polygon
                  const intersectedPolygon = turf.polygon(intersection[0]);

                  // Calculate area in square meters and convert to resultUnit
                  const areaSquareMeters = turf.area(intersectedPolygon);
                  multiPolygonTotalAcres += convertArea(areaSquareMeters, resultUnit);
                }
              } catch (martinezError) {
                console.warn('Martinez clipping failed for MultiPolygon part:', martinezError);
              }
            }

            if (multiPolygonTotalAcres > 0) {
              const displayValue = feature.properties[datasetConfig.properties.displayField] || 'Unknown';

              intersectedFeatures.push({
                type: 'Feature',
                geometry: feature.geometry, // Keep original geometry for display
                properties: {
                  [datasetConfig.properties.displayField]: displayValue,
                  calculatedArea: multiPolygonTotalAcres
                }
              });

              totalArea += multiPolygonTotalAcres;
            }

            continue; // Skip to next feature
          } else {
            console.warn('Unexpected feature geometry type:', feature.geometry.type);
            continue;
          }

          // Use Martinez to get intersection geometry for single Polygon
          try {
            const intersection = martinez.intersection(bufferCoords, featureCoords);

            if (intersection && intersection.length > 0) {
              // Convert Martinez output to Turf polygon
              const intersectedPolygon = turf.polygon(intersection[0]);

              // Calculate area in square meters and convert to resultUnit
              const areaSquareMeters = turf.area(intersectedPolygon);
              const calculatedArea = convertArea(areaSquareMeters, resultUnit);

              // Only include if area is non-zero (threshold: 0.001 of resultUnit)
              if (calculatedArea > 0.001) {
                const displayValue = feature.properties[datasetConfig.properties.displayField] || 'Unknown';

                intersectedFeatures.push({
                  type: 'Feature',
                  geometry: feature.geometry, // Keep original full geometry for display
                  properties: {
                    [datasetConfig.properties.displayField]: displayValue,
                    calculatedArea: calculatedArea
                  }
                });

                totalArea += calculatedArea;
              }
            }
          } catch (martinezError) {
            console.warn('Martinez clipping failed for feature, skipping:', martinezError);
          }
        }
      } catch (error) {
        console.warn('Error processing feature in measureIntersectedArea:', error);
      }
    }

  } catch (error) {
    console.error('Error in measureIntersectedArea analysis:', error);
  }

  return {
    totalArea: totalArea,
    features: intersectedFeatures
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
function analyzeCountByCategory(drawnGeometry, datasetConfig, geoJsonData) {
  const counts = {};
  let totalCount = 0;
  const matchedFeatures = []; // Store matched features for PDF rendering

  const bufferUnit = datasetConfig.bufferUnit || 'feet';

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Create buffer around the drawn geometry
    const buffered = turf.buffer(geometry, datasetConfig.proximityBuffer, {
      units: bufferUnit
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

          // Count by category — uses countByField if set, otherwise falls back to displayField
          const countField = datasetConfig.countByField || datasetConfig.properties?.displayField;
          if (countField) {
            const category = feature.properties[countField] || 'Unknown';
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
 * Analyze corridor with length summation by a status/category field
 * Sums up the total length of segments that fall within the corridor buffer,
 * grouped by a configurable status field (e.g. "Reliable_Segment_", "ownership", etc.)
 * Optionally computes a length-weighted average of a numeric field (e.g. LOTTR, speed).
 * Requires datasetConfig.statusField. Optionally uses datasetConfig.averageField.
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} { total, breakdown, avg, features }
 */
function analyzeMeasureProjectByCategory(drawnGeometry, datasetConfig, geoJsonData) {
  const lengthsByStatus = {};  // Track lengths by statusField value
  const matchedFeatures = [];  // Store matched features for map rendering
  let totalLength = 0;
  let weightedSum = 0;   // Sum of (value * segment length) for weighted average

  const bufferUnit = datasetConfig.bufferUnit || 'feet';
  const resultUnit = datasetConfig.resultUnit || 'miles';

  // Extract actual geometry from GeoJSON Feature if needed
  const geometry = drawnGeometry.type === 'Feature'
    ? drawnGeometry.geometry
    : drawnGeometry;

  // Handle Point geometry separately (simple buffer intersection)
  if (geometry.type === 'Point') {
    const corridorBuffer = turf.buffer(geometry, datasetConfig.bufferDistance, {
      units: bufferUnit
    });

    geoJsonData.features.forEach(feature => {
      try {
        if (!hasValidGeometry(feature)) return;

        if (turf.booleanIntersects(corridorBuffer, feature)) {
          const status = feature.properties[datasetConfig.statusField] || 'Unknown';
          const length = turf.length(feature, { units: resultUnit });
          lengthsByStatus[status] = (lengthsByStatus[status] || 0) + length;
          totalLength += length;

          // Collect weighted average of averageField if configured
          if (datasetConfig.averageField) {
            const val = parseFloat(feature.properties[datasetConfig.averageField]);
            if (!isNaN(val)) weightedSum += val * length;
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

    // Calculate length-weighted average of averageField if configured
    const avg = (datasetConfig.averageField && totalLength > 0) ? weightedSum / totalLength : null;

    return {
      total: totalLength,
      breakdown: percentageBreakdown,
      avg: avg,
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
    units: bufferUnit
  });
  const projectCoords = turf.getCoords(geometry);

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

            // Weight by parallel factor: perpendicular crossings contribute ~0
            const insideLength = measureSegmentInsideBuffer(segment, corridorBuffer, bufferUnit);
            featureOverlapLength += insideLength * segmentParallelFactor(segment, projectCoords);
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
        const status = feature.properties[datasetConfig.statusField] || 'Unknown';
        const lengthInResultUnit = convertLength(featureOverlapLength, bufferUnit, resultUnit);
        lengthsByStatus[status] = (lengthsByStatus[status] || 0) + lengthInResultUnit;
        totalLength += lengthInResultUnit;

        // Collect weighted average of averageField if configured
        if (datasetConfig.averageField) {
          const val = parseFloat(feature.properties[datasetConfig.averageField]);
          if (!isNaN(val)) weightedSum += val * lengthInResultUnit;
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

  // Calculate length-weighted average of averageField if configured
  const avg = (datasetConfig.averageField && totalLength > 0) ? weightedSum / totalLength : null;

  return {
    total: totalLength,
    breakdown: percentageBreakdown,
    avg: avg,
    features: matchedFeatures
  };
}

/**
 * Sum numeric values from features within proximity buffer
 * Generic function that sums any numeric attribute from nearby features
 * Works for Point, LineString, and Polygon geometry types
 * Examples: sum fatalities from crashes, sum jobs from census tracts
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} Object with total sum and matched features
 */
function analyzeSumNearbyValues(drawnGeometry, datasetConfig, geoJsonData) {
  const matchedFeatures = [];
  let totalSum = 0;

  const bufferUnit = datasetConfig.bufferUnit || 'feet';

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Create buffer around the drawn geometry
    const buffered = turf.buffer(geometry, datasetConfig.proximityBuffer, {
      units: bufferUnit
    });

    // Check each feature against the buffer
    geoJsonData.features.forEach(feature => {
      try {
        if (!hasValidGeometry(feature)) return;

        // Apply analysis filter if configured (e.g., filter by category)
        if (!matchesAnalysisFilter(feature, datasetConfig)) return;

        let isNearby = false;

        // Check proximity based on geometry type
        if (datasetConfig.geometryType === 'Point') {
          // Point features: check if point is in buffer
          isNearby = turf.booleanPointInPolygon(feature, buffered);
        } else if (datasetConfig.geometryType === 'LineString') {
          // LineString features: check if line intersects buffer
          isNearby = turf.booleanIntersects(feature, buffered);
        } else if (datasetConfig.geometryType === 'Polygon') {
          // Polygon features: check if polygon intersects buffer
          isNearby = turf.booleanIntersects(feature, buffered);
        }

        if (isNearby) {
          // Store matched feature for rendering
          matchedFeatures.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: { ...feature.properties }
          });

          // Sum the specified field value
          if (datasetConfig.sumField) {
            const value = parseFloat(feature.properties[datasetConfig.sumField]) || 0;
            totalSum += value;
          }
        }
      } catch (error) {
        console.warn('Error checking proximity for sum:', error);
      }
    });

  } catch (error) {
    console.error('Error in sumNearbyValues analysis:', error);
  }

  return {
    total: matchedFeatures.length,
    sum: totalSum,
    features: matchedFeatures
  };
}

/**
 * Find the nearest X features to the drawn project geometry
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString, Point, or Polygon)
 * @param {Object} datasetConfig - Configuration object from DATASETS (supports optional maxDistance)
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Array} Array of {feature, distance} objects sorted by distance, filtered by maxDistance if specified
 */
function analyzeFindNearestFeatures(drawnGeometry, datasetConfig, geoJsonData) {
  const featuresWithDistance = [];

  const resultUnit = datasetConfig.resultUnit || 'feet';

  try {
    // Extract actual geometry from GeoJSON Feature if needed
    const geometry = drawnGeometry.type === 'Feature'
      ? drawnGeometry.geometry
      : drawnGeometry;

    // Get centroid of drawn geometry for distance calculations
    const drawnCentroid = turf.centroid(geometry);

    geoJsonData.features.forEach(feature => {
      try {
        if (!hasValidGeometry(feature)) return;

        let distance = 0;

        // Calculate distance based on feature geometry type
        if (datasetConfig.geometryType === 'Point') {
          // Distance from drawn centroid to point
          distance = turf.distance(drawnCentroid, feature, { units: resultUnit });
        } else if (datasetConfig.geometryType === 'LineString') {
          // Distance from drawn centroid to nearest point on line
          distance = turf.pointToLineDistance(drawnCentroid, feature, { units: resultUnit });
        } else if (datasetConfig.geometryType === 'Polygon') {
          // Distance from drawn centroid to polygon centroid
          const featureCentroid = turf.centroid(feature);
          distance = turf.distance(drawnCentroid, featureCentroid, { units: resultUnit });
        }

        featuresWithDistance.push({
          feature: {
            type: 'Feature',
            geometry: feature.geometry,
            properties: { ...feature.properties }
          },
          distance: distance
        });

      } catch (error) {
        console.warn('Error calculating distance for feature:', error);
      }
    });

    // Sort by distance (ascending)
    featuresWithDistance.sort((a, b) => a.distance - b.distance);

    // Filter by max distance if specified
    let filteredFeatures = featuresWithDistance;
    if (datasetConfig.maxDistance && datasetConfig.maxDistance > 0) {
      filteredFeatures = featuresWithDistance.filter(f => f.distance <= datasetConfig.maxDistance);
    }

    // Take the nearest N features
    const nearestCount = datasetConfig.nearestCount || 1;
    const nearest = filteredFeatures.slice(0, nearestCount);

    return nearest;

  } catch (error) {
    console.error('Error in findNearestFeatures analysis:', error);
    return [];
  }
}

/**
 * Analyze project coverage percentage for corridor datasets
 * Uses two-phase approach: filter first with simple intersection, then measure coverage
 * This is significantly faster than trying to union all features upfront
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Configuration object from DATASETS
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} Object with percentage coverage and matched features
 */
function analyzeProjectCoverage(drawnGeometry, datasetConfig, geoJsonData) {
  // Extract actual geometry from GeoJSON Feature if needed
  const geometry = drawnGeometry.type === 'Feature'
    ? drawnGeometry.geometry
    : drawnGeometry;

  const bufferUnit = datasetConfig.bufferUnit || 'feet';

  // Phase 1: Find ALL features that intersect the project buffer (no minSharedLength filter)
  // This is critical - we need to include all segments, even short ones, for accurate coverage
  const matchedFeatures = [];

  const corridorBuffer = turf.buffer(geometry, datasetConfig.bufferDistance, {
    units: bufferUnit
  });

  geoJsonData.features.forEach(feature => {
    try {
      if (!hasValidGeometry(feature)) return;

      // Simple intersection check - include ALL intersecting features
      if (turf.booleanIntersects(corridorBuffer, feature)) {
        matchedFeatures.push({
          type: 'Feature',
          geometry: feature.geometry,
          properties: { ...feature.properties }
        });
      }
    } catch (error) {
      console.warn('Error checking feature intersection:', error);
    }
  });

  if (matchedFeatures.length === 0) {
    return { percentage: 0, features: [] };
  }

  console.log(`  └─ Found ${matchedFeatures.length} intersecting segments, calculating coverage...`);

  // Phase 2: Use point sampling for accurate coverage measurement
  // Sample points along the project and check what % are within buffer distance of ANY matched feature
  try {
    const projectLength = turf.length(geometry, { units: 'feet' });

    // Sample every 10 feet along the project line
    const sampleInterval = 10; // feet
    const numSamples = Math.max(Math.ceil(projectLength / sampleInterval), 10);

    let samplesNearFeature = 0;

    for (let i = 0; i <= numSamples; i++) {
      const distance = (i / numSamples) * projectLength;
      const samplePoint = turf.along(geometry, distance / CONVERSIONS.FEET_PER_MILE, { units: 'miles' }); // Convert feet to miles for turf.along

      // Check if this point is within buffer distance of ANY matched feature
      let isNearMatch = false;

      for (const matchedFeature of matchedFeatures) {
        try {
          const distanceToFeature = turf.pointToLineDistance(
            samplePoint,
            matchedFeature,
            { units: bufferUnit }
          );

          if (distanceToFeature <= datasetConfig.bufferDistance) {
            isNearMatch = true;
            break;
          }
        } catch (err) {
          // Skip this feature if there's an error
          continue;
        }
      }

      if (isNearMatch) {
        samplesNearFeature++;
      }
    }

    const percentage = (samplesNearFeature / (numSamples + 1)) * 100;

    console.log(`  └─ Sampled ${numSamples + 1} points, ${samplesNearFeature} near matched features (${percentage.toFixed(1)}%)`);

    return {
      percentage: Math.round(percentage),
      features: matchedFeatures
    };

  } catch (error) {
    console.error('Error calculating project coverage:', error);
    return {
      percentage: 0,
      features: matchedFeatures
    };
  }
}

/**
 * Find parallel line features and compute a length-weighted average of a numeric field.
 * Uses the same corridor matching logic as listParallelFeatures but returns an average
 * instead of a list. Overlap length (feet inside buffer) is used as the weight so that
 * segments with more shared length with the project have more influence on the result.
 *
 * @param {Object} drawnGeometry - GeoJSON geometry (LineString or Point)
 * @param {Object} datasetConfig - Config object; must include averageField
 * @param {Object} geoJsonData - GeoJSON FeatureCollection to analyze
 * @returns {Object} { avg, count, tier, features }
 */
function analyzeAverageParallelValue(drawnGeometry, datasetConfig, geoJsonData) {
  const matchedFeatures = [];
  let weightedSum = 0;
  let totalWeight = 0;

  const bufferUnit = datasetConfig.bufferUnit || 'feet';
  const geometry = drawnGeometry.type === 'Feature' ? drawnGeometry.geometry : drawnGeometry;
  const averageField = datasetConfig.averageField;

  if (!averageField) {
    console.warn(`averageParallelValue: averageField not configured for ${datasetConfig.name}`);
    return { avg: null, count: 0, tier: null, features: [] };
  }

  const corridorBuffer = turf.buffer(geometry, datasetConfig.bufferDistance, { units: bufferUnit });

  if (geometry.type === 'Point') {
    geoJsonData.features.forEach(feature => {
      try {
        if (!hasValidGeometry(feature)) return;
        if (!turf.booleanIntersects(corridorBuffer, feature)) return;
        const val = parseFloat(feature.properties[averageField]);
        const weight = turf.length(feature, { units: bufferUnit });
        if (!isNaN(val) && weight > 0) {
          weightedSum += val * weight;
          totalWeight += weight;
        }
        matchedFeatures.push({ type: 'Feature', geometry: feature.geometry, properties: { ...feature.properties } });
      } catch (e) { console.warn('averageParallelValue point error:', e); }
    });

  } else if (geometry.type === 'LineString') {
    const projectCoords = turf.getCoords(geometry);

    geoJsonData.features.forEach(feature => {
      try {
        if (!hasValidGeometry(feature)) return;
        if (!turf.booleanIntersects(corridorBuffer, feature)) return;

        const routeLines = normalizeToLineStrings(feature);
        let totalOverlap = 0;

        for (const routeLine of routeLines) {
          const routeCoords = turf.getCoords(routeLine);
          for (let i = 0; i < routeCoords.length - 1; i++) {
            const segment = turf.lineString([routeCoords[i], routeCoords[i + 1]]);
            if (!turf.booleanIntersects(segment, corridorBuffer)) continue;
            totalOverlap += measureSegmentInsideBuffer(segment, corridorBuffer, bufferUnit) * segmentParallelFactor(segment, projectCoords);
          }
          if (totalOverlap >= datasetConfig.minSharedLength) break;
        }

        if (totalOverlap >= datasetConfig.minSharedLength) {
          const val = parseFloat(feature.properties[averageField]);
          if (!isNaN(val)) {
            weightedSum += val * totalOverlap;
            totalWeight += totalOverlap;
          }
          matchedFeatures.push({ type: 'Feature', geometry: feature.geometry, properties: { ...feature.properties } });
        }
      } catch (e) { console.warn('averageParallelValue line error:', e); }
    });
  }

  const avg = totalWeight > 0 ? weightedSum / totalWeight : null;

  return { avg, count: matchedFeatures.length, features: matchedFeatures };
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
      // Time individual dataset analysis for performance profiling
      const datasetTimer = `  └─ ${config.name}`;
      console.time(datasetTimer);

      let datasetResults = [];

      // Call appropriate analysis function based on method
      switch (config.analysisMethod) {
        case 'listParallelFeatures':
          datasetResults = analyzeListParallelFeatures(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'measureProjectByCategory':
          datasetResults = analyzeMeasureProjectByCategory(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'projectCoverage':
          datasetResults = analyzeProjectCoverage(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'listIntersectingFeatures':
          datasetResults = analyzeListIntersectingFeatures(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'listNearbyFeatures':
          datasetResults = analyzeListNearbyFeatures(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'countByCategory':
          datasetResults = analyzeCountByCategory(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'measureNearbyArea':
          datasetResults = analyzeSumNearbyValues(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'hasNearbyFeatures':
          datasetResults = analyzeHasNearbyFeatures(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'measureIntersectedArea':
          datasetResults = analyzeMeasureIntersectedArea(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'sumNearbyValues':
          datasetResults = analyzeSumNearbyValues(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'findNearestFeatures':
          datasetResults = analyzeFindNearestFeatures(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        case 'averageParallelValue':
          datasetResults = analyzeAverageParallelValue(drawnGeometry, config, geoJsonData[datasetKey]);
          break;

        default:
          console.warn(`Unknown analysis method: ${config.analysisMethod} for ${datasetKey}`);
      }

      // Store results keyed by dataset ID
      results[datasetKey] = datasetResults;

      console.timeEnd(datasetTimer);

    } catch (error) {
      console.error(`Error analyzing ${datasetKey}:`, error);
      results[datasetKey] = [];
      console.timeEnd(datasetTimer);
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
