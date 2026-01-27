/**
 * app.js
 * Application initialization, event handlers, and UI management
 *
 * Dependencies: All other modules (datasets.js, map.js, analysis.js, pdf.js)
 */

// ============================================
// APP GLOBAL VARIABLES
// ============================================
const geoJsonData = {};  // Raw GeoJSON data for all datasets

// ============================================
// APPLICATION INITIALIZATION
// ============================================

/**
 * Main initialization function
 * Loads data, initializes map, sets up controls and event listeners
 */
async function init() {
  try {
    showLoading(true, 'Loading configuration...');

    // Wait for datasets configuration to load from YAML
    await datasetsLoaded;

    // Validate that DATASETS loaded successfully
    if (!DATASETS || typeof DATASETS !== 'object') {
      throw new Error('DATASETS configuration object is not available.');
    }

    if (Object.keys(DATASETS).length === 0) {
      throw new Error('No datasets loaded from YAML configuration. Check console for errors.');
    }

    console.log(`✓ Configuration loaded: ${Object.keys(DATASETS).length} datasets configured`);

    showLoading(true, 'Loading map data...');

    // Load all GeoJSON files and track failures
    const loadResults = await loadGeoJsonData();

    // Check for failed datasets
    if (loadResults && loadResults.failed && loadResults.failed.length > 0) {
      console.warn(`⚠ ${loadResults.failed.length} dataset(s) failed to load:`, loadResults.failed);
      // Continue with partial data - non-critical datasets can fail gracefully
    }

    if (loadResults && loadResults.loaded === 0) {
      throw new Error('No datasets could be loaded. Check network connection and data files.');
    }

    console.log(`✓ Data loaded: ${loadResults?.loaded || 0} dataset(s) loaded successfully`);

    // Initialize the Leaflet map
    const mapInitialized = initializeMap();

    // Validate map initialization
    if (!mapInitialized || !window.map) {
      throw new Error('Map initialization failed. Leaflet library may not have loaded correctly.');
    }

    console.log('✓ Map initialized successfully');

    // Add reference layers to map
    addReferenceLayers();

    // Calculate and fit map to data bounds
    fitMapToBounds();

    // Set up drawing controls
    setupDrawingControls();

    // Set up event listeners
    setupEventListeners();

    // Hide loading overlay
    showLoading(false);

    console.log('✓ Application initialized successfully');

    // Show tutorial popup if first visit
    showTutorialIfFirstVisit();

  } catch (error) {
    console.error('Initialization error:', error);
    showLoading(false);
    showError(`Failed to initialize the application: ${error.message}\n\nPlease refresh the page and try again.`);
    throw error; // Re-throw to stop execution
  }
}

/**
 * Show tutorial popup
 * Always shows on every page load
 */
function showTutorialIfFirstVisit() {
  // Always show tutorial popup (no localStorage check)
  document.getElementById('tutorialOverlay').classList.add('visible');
  document.getElementById('tutorialPopup').classList.add('visible');
}

/**
 * Close tutorial popup
 */
function closeTutorial() {
  document.getElementById('tutorialOverlay').classList.remove('visible');
  document.getElementById('tutorialPopup').classList.remove('visible');
}

// ============================================
// FEATURE SERVICE QUERY
// ============================================

/**
 * Discover the correct layer from a FeatureServer by querying its metadata
 * @param {string} serviceUrl - The base FeatureServer URL (without /N at the end)
 * @param {Object} options - Discovery options
 * @param {string} options.layerName - Optional layer name to match (case-insensitive)
 * @returns {Promise<Object>} - Object with {layerIndex, layerInfo} or null if not found
 */
async function discoverFeatureServiceLayer(serviceUrl, options = {}) {
  try {
    // Remove trailing slash if present
    const baseUrl = serviceUrl.replace(/\/$/, '');

    // Query the service metadata
    const metadataUrl = `${baseUrl}?f=json`;
    console.log('Fetching service metadata from:', metadataUrl);

    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch service metadata: ${response.status} ${response.statusText}`);
    }

    const metadata = await response.json();

    // Check for error in response
    if (metadata.error) {
      throw new Error(`Service error: ${metadata.error.message || JSON.stringify(metadata.error)}`);
    }

    // Get layers from metadata
    const layers = metadata.layers || [];
    console.log('Available layers:', layers.map(l => ({ id: l.id, name: l.name })));

    if (layers.length === 0) {
      console.warn('No layers found in service metadata');
      return null;
    }

    // If a specific layer name is requested, find it
    if (options.layerName) {
      const targetName = options.layerName.toLowerCase();
      const matchedLayer = layers.find(layer =>
        layer.name && layer.name.toLowerCase().includes(targetName)
      );

      if (matchedLayer) {
        console.log(`Found matching layer: ${matchedLayer.name} (ID: ${matchedLayer.id})`);
        return {
          layerIndex: matchedLayer.id,
          layerInfo: matchedLayer,
          serviceMetadata: metadata
        };
      }
    }

    // Default to first layer if no specific name requested
    const firstLayer = layers[0];
    console.log(`Using first layer: ${firstLayer.name} (ID: ${firstLayer.id})`);
    return {
      layerIndex: firstLayer.id,
      layerInfo: firstLayer,
      serviceMetadata: metadata
    };

  } catch (error) {
    console.error('Error discovering feature service layer:', error);
    return null;
  }
}

/**
 * Query an ArcGIS Feature Service and return results as GeoJSON
 * @param {string} serviceUrl - The Feature Service URL (can be base URL or layer-specific)
 * @param {Object} options - Query options
 * @param {Array} options.bbox - Bounding box [minX, minY, maxX, maxY] in WGS84
 * @param {string} options.where - SQL where clause (default: "1=1")
 * @param {Array} options.outFields - Fields to return (default: ["*"])
 * @param {number} options.maxRecords - Max features to return (default: 1000)
 * @param {string} options.layerName - Optional layer name to discover (if serviceUrl is base URL)
 * @returns {Promise<Object>} - {success, data (GeoJSON FeatureCollection), error}
 */
async function queryFeatureService(serviceUrl, options = {}) {
  try {
    let queryUrl = serviceUrl;

    // Check if the URL already has a layer index (ends with /N)
    const hasLayerIndex = /\/\d+\/?$/.test(serviceUrl);

    if (!hasLayerIndex) {
      // Need to discover the layer first
      console.log('No layer index found in URL, discovering layer...');
      const layerInfo = await discoverFeatureServiceLayer(serviceUrl, {
        layerName: options.layerName
      });

      if (!layerInfo) {
        throw new Error('Could not discover layer from service metadata');
      }

      // Construct the layer-specific URL
      queryUrl = `${serviceUrl.replace(/\/$/, '')}/${layerInfo.layerIndex}`;
      console.log('Discovered layer URL:', queryUrl);
    }

    // Build query parameters
    const params = new URLSearchParams({
      where: options.where || '1=1',
      outFields: options.outFields ? options.outFields.join(',') : '*',
      returnGeometry: 'true',
      outSR: '4326',  // Request WGS84 coordinates for output
      f: 'json'
    });

    // Add bounding box if provided
    if (options.bbox && options.bbox.length === 4) {
      const [minX, minY, maxX, maxY] = options.bbox;
      params.append('geometry', JSON.stringify({
        xmin: minX,
        ymin: minY,
        xmax: maxX,
        ymax: maxY,
        spatialReference: { wkid: 3857 }  // Input bbox is in Web Mercator
      }));
      params.append('geometryType', 'esriGeometryEnvelope');
      params.append('spatialRel', 'esriSpatialRelIntersects');
      params.append('inSR', '3857');  // Input spatial reference is Web Mercator
    }

    // Add max records limit
    if (options.maxRecords) {
      params.append('resultRecordCount', options.maxRecords);
    }

    // Execute query
    const fullQueryUrl = `${queryUrl}/query?${params.toString()}`;
    console.log('Querying Feature Service:', fullQueryUrl);

    const response = await fetch(fullQueryUrl);
    if (!response.ok) {
      throw new Error(`Query failed: ${response.status} ${response.statusText}`);
    }

    const arcgisJson = await response.json();

    // Check for error in response
    if (arcgisJson.error) {
      throw new Error(`Query error: ${arcgisJson.error.message || JSON.stringify(arcgisJson.error)}`);
    }

    // Convert ArcGIS JSON to GeoJSON
    const geojson = convertArcGIStoGeoJSON(arcgisJson);

    console.log(`Query successful: ${geojson.features.length} features returned`);

    return {
      success: true,
      data: geojson,
      error: null
    };

  } catch (error) {
    console.error('Feature Service query error:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Convert ArcGIS JSON format to GeoJSON format
 * @param {Object} arcgisJson - ArcGIS REST API response
 * @returns {Object} - GeoJSON FeatureCollection
 */
function convertArcGIStoGeoJSON(arcgisJson) {
  const features = (arcgisJson.features || []).map(arcgisFeature => {
    // Convert geometry
    const geometry = convertArcGISGeometry(
      arcgisFeature.geometry,
      arcgisJson.geometryType
    );

    return {
      type: 'Feature',
      properties: arcgisFeature.attributes || {},
      geometry: geometry
    };
  });

  return {
    type: 'FeatureCollection',
    features: features
  };
}

/**
 * Convert ArcGIS geometry to GeoJSON geometry
 * @param {Object} arcgisGeom - ArcGIS geometry object
 * @param {string} geometryType - ArcGIS geometry type
 * @returns {Object} - GeoJSON geometry
 */
function convertArcGISGeometry(arcgisGeom, geometryType) {
  if (!arcgisGeom) return null;

  switch (geometryType) {
    case 'esriGeometryPoint':
      return {
        type: 'Point',
        coordinates: [arcgisGeom.x, arcgisGeom.y]
      };

    case 'esriGeometryPolyline':
      // ArcGIS polylines can have multiple paths
      if (arcgisGeom.paths && arcgisGeom.paths.length === 1) {
        return {
          type: 'LineString',
          coordinates: arcgisGeom.paths[0]
        };
      } else if (arcgisGeom.paths && arcgisGeom.paths.length > 1) {
        return {
          type: 'MultiLineString',
          coordinates: arcgisGeom.paths
        };
      }
      return null;

    case 'esriGeometryPolygon':
      // ArcGIS polygons can have multiple rings
      if (arcgisGeom.rings && arcgisGeom.rings.length === 1) {
        return {
          type: 'Polygon',
          coordinates: arcgisGeom.rings
        };
      } else if (arcgisGeom.rings && arcgisGeom.rings.length > 1) {
        return {
          type: 'MultiPolygon',
          coordinates: [arcgisGeom.rings]
        };
      }
      return null;

    default:
      console.warn('Unknown geometry type:', geometryType);
      return null;
  }
}

// ============================================
// DATA LOADING
// ============================================

/**
 * Dynamically load all enabled GeoJSON datasets from the DATASETS configuration
 * Fetches all dataset files and feature services in parallel for better performance
 * @returns {Promise<Object>} Object with {loaded: number, failed: Array<string>}
 */
async function loadGeoJsonData() {
  const failedDatasets = [];
  let loadedCount = 0;

  try {
    // Build array of fetch promises for all enabled datasets
    const fetchPromises = [];
    const datasetKeys = [];

    Object.keys(DATASETS).forEach(datasetKey => {
      const config = DATASETS[datasetKey];

      // Only load enabled datasets that are NOT lazy-loaded
      if (config.enabled && !config.lazyLoad) {
        if (config.filePath) {
          // Regular GeoJSON file (add cache-busting query parameter for fresh loads)
          const filePathWithVersion = config.filePath + '?v=1.0';
          fetchPromises.push(fetch(filePathWithVersion));
          datasetKeys.push({ key: datasetKey, isFeatureService: false });
        } else if (config.featureServiceUrl) {
          // Feature service - needs to query for data
          // Note: Don't use bbox filter - feature services are stored in Web Mercator (EPSG:3857)
          // and bbox filtering with WGS84 coords fails. These services are already scoped to Memphis area.
          fetchPromises.push(queryFeatureService(config.featureServiceUrl, {
            maxRecords: 5000
          }));
          datasetKeys.push({ key: datasetKey, isFeatureService: true });
        }
      }
    });

    // Fetch all datasets in parallel for better performance
    const responses = await Promise.all(fetchPromises);

    // Process responses based on type
    const dataPromises = responses.map((response, index) => {
      const datasetInfo = datasetKeys[index];
      const config = DATASETS[datasetInfo.key];

      if (datasetInfo.isFeatureService) {
        // Feature service returns {success, data, error}
        if (response.success) {
          return response.data;
        } else {
          console.warn(`Failed to query ${config.name}: ${response.error}`);
          return null;
        }
      } else {
        // Regular HTTP fetch response
        if (!response.ok) {
          console.warn(`Failed to load ${config.name}: ${response.status} ${response.statusText}`);
          return null;
        }
        return response.json();
      }
    });

    const dataResults = await Promise.all(dataPromises);

    // Store loaded data and log results
    const loadedCounts = {};

    dataResults.forEach((data, index) => {
      const datasetInfo = datasetKeys[index];
      const datasetKey = datasetInfo.key;
      const config = DATASETS[datasetKey];

      if (data) {
        // Apply filters if specified
        if (config.filterByThreshold) {
          // Filter features by threshold (for analysis, not display)
          // Store original data with all features for map display
          const allFeatures = [...data.features];

          // Filter features that meet the threshold for analysis
          const filteredFeatures = data.features.filter(feature => {
            const value = feature.properties[config.filterByThreshold.field];
            if (config.filterByThreshold.operator === '>=') {
              return value >= config.filterByThreshold.value;
            } else if (config.filterByThreshold.operator === '<=') {
              return value <= config.filterByThreshold.value;
            } else if (config.filterByThreshold.operator === '>') {
              return value > config.filterByThreshold.value;
            } else if (config.filterByThreshold.operator === '<') {
              return value < config.filterByThreshold.value;
            }
            return true;
          });

          // Store both versions: all features for display, filtered for analysis
          geoJsonData[datasetKey + '_all'] = { ...data, features: allFeatures };
          data.features = filteredFeatures;
        }

        geoJsonData[datasetKey] = data;
        loadedCounts[datasetKey] = data.features ? data.features.length : 0;
        loadedCount++;
      } else {
        geoJsonData[datasetKey] = null;
        loadedCounts[datasetKey] = 'failed';
        failedDatasets.push(config.name);
      }
    });

    console.log('Data loaded:', loadedCounts);

    // Validate coordinate systems for all loaded datasets
    Object.keys(DATASETS).forEach(datasetKey => {
      const config = DATASETS[datasetKey];
      if (config.enabled && geoJsonData[datasetKey]) {
        try {
          validateProjection(geoJsonData[datasetKey], config.name);
        } catch (projError) {
          // Projection validation failed - treat as load failure
          console.error(`Projection validation failed for ${config.name}:`, projError);
          geoJsonData[datasetKey] = null;
          failedDatasets.push(config.name);
          loadedCount--;
        }
      }
    });

    return {
      loaded: loadedCount,
      failed: failedDatasets
    };

  } catch (error) {
    console.error('Error loading GeoJSON data:', error);
    throw error;
  }
}

/**
 * Load lazy-load datasets (feature services) on demand
 * Called when user draws a project to query feature services with project bounds
 * @param {Object} drawnGeometry - GeoJSON geometry of drawn project
 * @returns {Promise} Resolves when all lazy datasets are loaded
 */
async function loadLazyDatasets(drawnGeometry) {
  try {
    const lazyDatasets = Object.keys(DATASETS).filter(key =>
      DATASETS[key].enabled && DATASETS[key].lazyLoad && DATASETS[key].featureServiceUrl
    );

    if (lazyDatasets.length === 0) {
      return; // No lazy datasets to load
    }

    console.log(`Loading ${lazyDatasets.length} lazy-load datasets...`);

    // Extract geometry from Feature if needed
    const geometry = drawnGeometry.type === 'Feature' ? drawnGeometry.geometry : drawnGeometry;

    // Create a buffer around the drawn geometry (use max proximityBuffer from all lazy datasets)
    const maxBuffer = Math.max(...lazyDatasets.map(key => DATASETS[key].proximityBuffer || 200));
    const buffered = turf.buffer(geometry, maxBuffer, { units: 'feet' });

    // Get the bounding box of the buffered geometry in WGS84
    const bbox = turf.bbox(buffered); // [minX, minY, maxX, maxY] in WGS84

    // Convert WGS84 bbox to Web Mercator (EPSG:3857) for feature service query
    // Feature services are stored in Web Mercator
    const webMercatorBbox = convertWGS84BboxToWebMercator(bbox);

    console.log(`Query bbox (Web Mercator): [${webMercatorBbox.map(v => v.toFixed(2)).join(', ')}]`);

    // Query all feature services in parallel with spatial filter
    const queryPromises = lazyDatasets.map(datasetKey => {
      const config = DATASETS[datasetKey];
      return queryFeatureService(config.featureServiceUrl, {
        bbox: webMercatorBbox,
        maxRecords: 1000  // Reduced since we're only querying nearby features
      });
    });

    const results = await Promise.all(queryPromises);

    // Store loaded data
    results.forEach((result, index) => {
      const datasetKey = lazyDatasets[index];
      const config = DATASETS[datasetKey];

      if (result.success && result.data) {
        geoJsonData[datasetKey] = result.data;
        console.log(`✓ ${config.name}: ${result.data.features.length} features loaded`);
      } else {
        console.warn(`Failed to load ${config.name}:`, result.error);
        geoJsonData[datasetKey] = null;
      }
    });

  } catch (error) {
    console.error('Error loading lazy datasets:', error);
  }
}

/**
 * Convert WGS84 bounding box to Web Mercator (EPSG:3857)
 * @param {Array} bbox - [minX, minY, maxX, maxY] in WGS84 (longitude, latitude)
 * @returns {Array} [minX, minY, maxX, maxY] in Web Mercator
 */
function convertWGS84BboxToWebMercator(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // Web Mercator transformation formulas
  const earthRadius = 6378137; // Earth radius in meters

  const minX = earthRadius * minLon * Math.PI / 180;
  const maxX = earthRadius * maxLon * Math.PI / 180;

  const minY = earthRadius * Math.log(Math.tan(Math.PI / 4 + minLat * Math.PI / 360));
  const maxY = earthRadius * Math.log(Math.tan(Math.PI / 4 + maxLat * Math.PI / 360));

  return [minX, minY, maxX, maxY];
}

/**
 * Validate that GeoJSON data is in WGS84 (EPSG:4326) coordinate system
 * Throws error if coordinates appear to be in projected CRS
 * @param {Object} data - GeoJSON FeatureCollection
 * @param {string} datasetName - Name of dataset for error messages
 */
function validateProjection(data, datasetName) {
  if (!data.features || data.features.length === 0) {
    console.log(`⚠ ${datasetName}: No features to validate`);
    return true;
  }

  const firstFeature = data.features[0];
  let coords;

  // Extract first coordinate based on geometry type
  if (firstFeature.geometry.type === 'Point') {
    coords = firstFeature.geometry.coordinates;
  } else if (firstFeature.geometry.type === 'LineString') {
    coords = firstFeature.geometry.coordinates[0];
  } else if (firstFeature.geometry.type === 'MultiLineString') {
    coords = firstFeature.geometry.coordinates[0][0];
  } else if (firstFeature.geometry.type === 'Polygon') {
    coords = firstFeature.geometry.coordinates[0][0];
  } else if (firstFeature.geometry.type === 'MultiPolygon') {
    coords = firstFeature.geometry.coordinates[0][0][0];
  } else if (firstFeature.geometry.type === 'MultiPoint') {
    coords = firstFeature.geometry.coordinates[0];
  }

  if (!coords || coords.length < 2) {
    console.warn(`⚠ ${datasetName}: Could not extract coordinates for validation`);
    return true;
  }

  const [lng, lat] = coords;

  // Memphis area bounding box: lng -90.1 to -89.6, lat 34.9 to 35.3
  // Using slightly wider bounds (-91 to -89, 34 to 36) to allow for regional datasets
  const isValidWGS84 = (
    lng >= -91 && lng <= -89 &&
    lat >= 34 && lat <= 36
  );

  if (!isValidWGS84) {
    console.error(`❌ PROJECTION ERROR in ${datasetName}!`);
    console.error(`Found coordinates: [${lng}, ${lat}]`);
    console.error(`Expected Memphis area: lng -90 to -89, lat 34.9 to 35.3`);
    console.error(`Data appears to be in projected CRS, not WGS84!`);

    throw new Error(
      `${datasetName} has invalid coordinates. ` +
      `Found [${lng}, ${lat}]. ` +
      `Data must be in WGS84 (EPSG:4326), not projected coordinates. ` +
      `Please reproject the data to WGS84 before use.`
    );
  }

  console.log(`✓ ${datasetName} projection validated (WGS84): [${lng.toFixed(3)}, ${lat.toFixed(3)}]`);
  return true;
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle completion of drawing a project alignment or location
 * Validates geometry and triggers spatial analysis
 * @param {Object} event - Leaflet draw event
 * @param {L.FeatureGroup} drawnItems - Feature group containing drawn items
 */
async function onDrawCreated(event, drawnItems) {
  const layer = event.layer;

  // Remove any previous drawing
  if (drawnLayer) {
    map.removeLayer(drawnLayer);
    drawnItems.clearLayers();
  }

  // Add new drawing to map
  drawnLayer = layer;
  drawnItems.addLayer(layer);

  // Convert to GeoJSON for analysis
  drawnGeometry = layer.toGeoJSON();

  // Validate geometry
  if (!validateGeometry(drawnGeometry)) {
    const geomType = drawnGeometry.geometry.type;
    if (geomType === 'LineString') {
      showError(`Project alignment must be at least ${CONFIG.minLineLength} feet long.`);
    } else {
      showError('Invalid geometry drawn. Please try again.');
    }
    map.removeLayer(drawnLayer);
    drawnLayer = null;
    drawnGeometry = null;
    return;
  }

  // Show loading overlay while querying feature services
  showLoading(true, 'Loading environmental datasets...');

  try {
    // Load lazy-load datasets (feature services) before analysis
    await loadLazyDatasets(drawnGeometry);

    // Hide loading overlay
    showLoading(false);

    // Run spatial analysis on all datasets
    const results = analyzeAllDatasets(drawnGeometry);

    // Display results in sidebar
    displayResults(results);

    // Show project name/PDF section
    document.getElementById('projectNameSection').classList.add('visible');

    // Disable draw buttons after project is drawn
    setDrawButtonsEnabled(false);

    // Focus project name input
    document.getElementById('projectName').focus();

  } catch (error) {
    showLoading(false);
    console.error('Error during analysis:', error);
    showError('Failed to complete analysis. Please try again.');
  }
}

/**
 * Handle clear button click
 * Removes drawn feature and resets results
 */
function onClearClicked() {
  // Remove drawn layer from map
  if (drawnLayer) {
    map.removeLayer(drawnLayer);
    drawnLayer = null;
    drawnGeometry = null;
  }

  // Clear lazy-loaded datasets from memory
  Object.keys(DATASETS).forEach(datasetKey => {
    const config = DATASETS[datasetKey];
    if (config.lazyLoad && geoJsonData[datasetKey]) {
      geoJsonData[datasetKey] = null;
      console.log(`Cleared lazy-loaded data: ${config.name}`);
    }
  });

  // Clear results
  clearResults();

  // Hide project name/PDF section
  document.getElementById('projectNameSection').classList.remove('visible');

  // Re-enable draw buttons
  setDrawButtonsEnabled(true);
}

/**
 * Handle PDF button click
 * Generates and downloads PDF report
 */
async function onPDFButtonClicked() {
  await generatePDF();
}

/**
 * Handle project name input
 * Enables/disables PDF button based on input
 */
function onProjectNameInput() {
  const projectName = document.getElementById('projectName').value.trim();
  const pdfButton = document.getElementById('pdfButton');

  // Enable PDF button only if project name is entered and we have results
  pdfButton.disabled = !projectName || !drawnGeometry;
}

/**
 * Handle draw line button click
 * Triggers polyline drawing mode
 */
function onDrawLineButtonClicked() {
  // Disable marker drawing if active
  if (markerDrawer._enabled) {
    markerDrawer.disable();
  }

  // Disable measurement tool if active
  if (isMeasuring) {
    toggleMeasurementTool();
  }

  // Toggle polyline drawing
  if (polylineDrawer._enabled) {
    polylineDrawer.disable();
  } else {
    polylineDrawer.enable();
  }
}

/**
 * Handle draw point button click
 * Triggers marker drawing mode
 */
function onDrawPointButtonClicked() {
  // Disable polyline drawing if active
  if (polylineDrawer._enabled) {
    polylineDrawer.disable();
  }

  // Disable measurement tool if active
  if (isMeasuring) {
    toggleMeasurementTool();
  }

  // Toggle marker drawing
  if (markerDrawer._enabled) {
    markerDrawer.disable();
  } else {
    markerDrawer.enable();
  }
}

/**
 * Update visual state of draw buttons
 * @param {boolean} isDrawing - Whether drawing is active
 */
function updateDrawButtonStates(isDrawing) {
  const lineButton = document.getElementById('drawLineButton');
  const pointButton = document.getElementById('drawPointButton');

  if (isDrawing) {
    if (polylineDrawer._enabled) {
      lineButton.classList.add('active');
      pointButton.classList.remove('active');
    } else if (markerDrawer._enabled) {
      pointButton.classList.add('active');
      lineButton.classList.remove('active');
    }
  } else {
    lineButton.classList.remove('active');
    pointButton.classList.remove('active');
  }
}

/**
 * Enable or disable draw buttons
 * @param {boolean} enabled - Whether buttons should be enabled
 */
function setDrawButtonsEnabled(enabled) {
  const lineButton = document.getElementById('drawLineButton');
  const pointButton = document.getElementById('drawPointButton');

  lineButton.disabled = !enabled;
  pointButton.disabled = !enabled;

  if (!enabled) {
    lineButton.style.opacity = '0.5';
    pointButton.style.opacity = '0.5';
    lineButton.style.cursor = 'not-allowed';
    pointButton.style.cursor = 'not-allowed';
  } else {
    lineButton.style.opacity = '1';
    pointButton.style.opacity = '1';
    lineButton.style.cursor = 'pointer';
    pointButton.style.cursor = 'pointer';
  }
}

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
  document.getElementById('clearButton').addEventListener('click', onClearClicked);
  document.getElementById('pdfButton').addEventListener('click', onPDFButtonClicked);
  document.getElementById('projectName').addEventListener('input', onProjectNameInput);
  document.getElementById('drawLineButton').addEventListener('click', onDrawLineButtonClicked);
  document.getElementById('drawPointButton').addEventListener('click', onDrawPointButtonClicked);
  document.getElementById('zoomExtentButton').addEventListener('click', fitMapToBounds);
  document.getElementById('tutorialCloseButton').addEventListener('click', closeTutorial);
  document.getElementById('tutorialOverlay').addEventListener('click', closeTutorial);
}

// ============================================
// RESULTS DISPLAY
// ============================================

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for HTML insertion
 */
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }

  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create HTML for a single results card
 * @param {Object} datasetConfig - Configuration from DATASETS
 * @param {Array} results - Analysis results for this dataset
 * @returns {string} HTML string for the results card
 */
function createResultCard(datasetConfig, results) {
  // Feature service datasets (wetlands, flood zones) have display issues in sidebar
  // Show simplified message instead (except for acreage results which we want to display)
  if (datasetConfig.lazyLoad && datasetConfig.resultStyle !== 'acreage') {
    let cardHtml = `<div class="results-card" data-dataset="${escapeHtml(datasetConfig.id)}">`;
    cardHtml += `<div class="section-heading">`;
    cardHtml += `${escapeHtml(datasetConfig.name)}`;

    // Add info icon with tooltip if description is available
    if (datasetConfig.description) {
      cardHtml += `<span class="info-icon">`;
      cardHtml += `<span class="info-icon-circle">i</span>`;
      cardHtml += `<span class="info-tooltip">${escapeHtml(datasetConfig.description)}</span>`;
      cardHtml += `</span>`;
    }

    cardHtml += `</div>`;
    cardHtml += `<p style="padding: 10px; background-color: #F5F5F5; border-left: 4px solid #0066CC; margin-top: 10px; font-size: 14px;">
      See full PDF Report for results
    </p>`;
    cardHtml += `</div>`;
    return cardHtml;
  }

  // Handle count results differently (object with total and breakdown)
  const isCountResult = datasetConfig.resultStyle === 'count' && typeof results === 'object' && 'total' in results;
  const isLengthByStatusResult = datasetConfig.resultStyle === 'lengthByStatus' && typeof results === 'object' && 'total' in results;
  const isPercentageResult = datasetConfig.resultStyle === 'percentage' && typeof results === 'object' && 'percentage' in results;
  const isAcreageResult = datasetConfig.resultStyle === 'acreage' && typeof results === 'object' && 'totalAcres' in results;
  const isSumResult = datasetConfig.resultStyle === 'sum' && typeof results === 'object' && 'sum' in results;
  const isNearestResult = datasetConfig.resultStyle === 'nearest' && Array.isArray(results);

  // For lengthByStatus, use features.length as count; for count results use total; for percentage/acreage/sum results use features.length; for nearest use array length; otherwise use array length
  const count = isLengthByStatusResult ? (results.features ? results.features.length : 0) :
                isPercentageResult ? (results.features ? results.features.length : 0) :
                isAcreageResult ? (results.features ? results.features.length : 0) :
                isSumResult ? (results.features ? results.features.length : 0) :
                isNearestResult ? results.length :
                (isCountResult ? results.total : results.length);
  const hasResults = count > 0;

  let cardHtml = `<div class="results-card" data-dataset="${escapeHtml(datasetConfig.id)}">`;
  cardHtml += `<div class="section-heading">`;
  cardHtml += `${escapeHtml(datasetConfig.name)} `;
  cardHtml += `<span class="result-count">${escapeHtml(count)}</span>`;

  // Add info icon with tooltip if description is available
  if (datasetConfig.description) {
    cardHtml += `<span class="info-icon">`;
    cardHtml += `<span class="info-icon-circle">i</span>`;
    cardHtml += `<span class="info-tooltip">${escapeHtml(datasetConfig.description)}</span>`;
    cardHtml += `</span>`;
  }

  cardHtml += `</div>`;

  if (!hasResults) {
    cardHtml += `<p class="empty-state">No ${escapeHtml(datasetConfig.name.toLowerCase())} found</p>`;
  } else if (datasetConfig.resultStyle === 'lengthByStatus') {
    // Length by status format (for travel time reliability - show percentages and median LOTTR)
    cardHtml += `<div style="padding: 10px; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 10px;">`;

    // Show mean LOTTR if available
    if (results.meanLOTTR !== null && results.meanLOTTR !== undefined) {
      cardHtml += `<p style="margin: 0 0 10px 0; font-size: 14px;">Mean LOTTR: ${escapeHtml(results.meanLOTTR.toFixed(2))}</p>`;
    }

    if (results.breakdown && Object.keys(results.breakdown).length > 0) {
      cardHtml += `<ul class="results-list" style="margin: 0; padding-left: 20px;">`;

      // Sort breakdown by status (True first, then False)
      const sortedBreakdown = Object.entries(results.breakdown).sort((a, b) => {
        if (a[0] === 'True' && b[0] !== 'True') return -1;
        if (a[0] !== 'True' && b[0] === 'True') return 1;
        return 0;
      });

      sortedBreakdown.forEach(([status, percentage]) => {
        const statusLabel = status === 'True' ? 'Reliable' : 'Unreliable';
        cardHtml += `<li>${escapeHtml(statusLabel)}: ${escapeHtml(percentage.toFixed(1))}%</li>`;
      });

      cardHtml += `</ul>`;
    }

    cardHtml += `</div>`;
  } else if (datasetConfig.resultStyle === 'percentage') {
    // Percentage format (for project coverage analysis like HICs)
    cardHtml += `<div style="padding: 10px; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 10px;">`;
    cardHtml += `<p style="margin: 0; font-size: 14px;">${escapeHtml(results.percentage)}% of project</p>`;
    cardHtml += `</div>`;
  } else if (datasetConfig.resultStyle === 'count') {
    // Count format (for datasets that count features by category)
    cardHtml += `<div style="padding: 10px; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 10px;">`;
    cardHtml += `<p style="margin: 0 0 10px 0; font-size: 14px;">Total: ${escapeHtml(results.total)}</p>`;

    if (results.breakdown && Object.keys(results.breakdown).length > 0) {
      cardHtml += `<ul class="results-list" style="margin: 0; padding-left: 20px;">`;

      // Sort breakdown by count (descending)
      const sortedBreakdown = Object.entries(results.breakdown).sort((a, b) => b[1] - a[1]);

      sortedBreakdown.forEach(([category, categoryCount]) => {
        cardHtml += `<li>${escapeHtml(category)}: ${escapeHtml(categoryCount)}</li>`;
      });

      cardHtml += `</ul>`;
    }

    cardHtml += `</div>`;
  } else if (datasetConfig.resultStyle === 'acreage') {
    // Acreage format (for area impact analysis - show only total)
    cardHtml += `<div style="padding: 10px; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 10px;">`;
    const acreageLabel = datasetConfig.id === 'criticalWetlands'
      ? `Total: ${results.totalAcres.toFixed(2)} acres of Freshwater Forested/Shrub Wetlands`
      : `Total: ${results.totalAcres.toFixed(2)} acres`;
    cardHtml += `<p style="margin: 0; font-size: 14px;">
      ${acreageLabel}</p>`;
    cardHtml += `</div>`;
  } else if (datasetConfig.resultStyle === 'sum') {
    // Sum format (for summing numeric values from nearby features)
    cardHtml += `<div style="padding: 10px; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 10px;">`;
    // Determine if we should show integer or decimal places
    const displayValue = Number.isInteger(results.sum) ? results.sum : results.sum.toFixed(2);
    const sumLabel = datasetConfig.sumField
      ? `Total ${escapeHtml(datasetConfig.sumField)}: ${escapeHtml(displayValue)}`
      : `Total: ${escapeHtml(displayValue)}`;
    cardHtml += `<p style="margin: 0; font-size: 14px;">${sumLabel}</p>`;
    cardHtml += `</div>`;
  } else if (datasetConfig.resultStyle === 'nearest') {
    // Nearest features format (for findNearestFeatures analysis)
    cardHtml += `<ul class="results-list">`;
    results.forEach(result => {
      const props = result.feature.properties || result.feature;
      const displayName = props._displayName || props[datasetConfig.properties.displayField] || 'Unknown';
      const distanceFormatted = Math.round(result.distance).toLocaleString();
      cardHtml += `<li>${escapeHtml(displayName)} - ${escapeHtml(distanceFormatted)} ft</li>`;
    });
    cardHtml += `</ul>`;
  } else if (datasetConfig.resultStyle === 'table') {
    // Table format (for datasets with additional fields like bridges)
    cardHtml += `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`;
    cardHtml += `<thead><tr>`;
    cardHtml += `<th style="background-color: #E6F2FF; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #CCCCCC; font-size: 12px;">${escapeHtml(datasetConfig.properties.displayField)}</th>`;

    datasetConfig.properties.additionalFields.forEach(field => {
      cardHtml += `<th style="background-color: #E6F2FF; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #CCCCCC; font-size: 12px;">${escapeHtml(field)}</th>`;
    });

    cardHtml += `</tr></thead><tbody>`;

    results.forEach((result, index) => {
      const bgColor = index % 2 === 0 ? 'white' : '#F9F9F9';
      cardHtml += `<tr style="background-color: ${bgColor};">`;

      // Access properties from Feature or flat object
      const props = result.properties || result;
      cardHtml += `<td style="padding: 8px 10px; border: 1px solid #CCCCCC; font-size: 12px;">${escapeHtml(props[datasetConfig.properties.displayField])}</td>`;

      datasetConfig.properties.additionalFields.forEach(field => {
        cardHtml += `<td style="padding: 8px 10px; border: 1px solid #CCCCCC; font-size: 12px;">${escapeHtml(props[field])}</td>`;
      });

      cardHtml += `</tr>`;
    });

    cardHtml += `</tbody></table>`;
  } else {
    // List format (default)
    cardHtml += `<ul class="results-list">`;

    results.forEach(result => {
      let displayText;
      if (typeof result === 'string') {
        displayText = result;
      } else if (typeof result === 'object') {
        // Access properties from Feature or flat object
        const props = result.properties || result;
        displayText = props._displayName || props[datasetConfig.properties.displayField] || 'Unknown';

        // Add additional fields if present
        if (datasetConfig.properties.additionalFields && datasetConfig.properties.additionalFields.length > 0) {
          datasetConfig.properties.additionalFields.forEach(field => {
            let value = props[field];

            // Format as percentage if specified
            if (datasetConfig.properties.formatPercentage === field && value !== undefined && value !== 'Unknown') {
              value = `${(value * 100).toFixed(1)}%`;
            }

            const fieldLabel = field === 'F__Below_A' ? '% Below ALICE' : field;
            displayText += ` | ${fieldLabel}: ${value}`;
          });
        }
      } else {
        displayText = String(result);
      }

      cardHtml += `<li>${escapeHtml(displayText)}</li>`;
    });

    cardHtml += `</ul>`;
  }

  cardHtml += `</div>`;

  return cardHtml;
}

/**
 * Display analysis results in the sidebar
 * Dynamically creates result cards for all datasets with results
 * @param {Object} results - Analysis results keyed by dataset ID
 */
function displayResults(results) {
  // Get results container
  const resultsContainer = document.getElementById('resultsContainer');

  // Clear existing results
  resultsContainer.innerHTML = '';

  // Group datasets by category
  const categoryOrder = ['Transportation', 'Economic Development', 'Environmental/Cultural'];
  const datasetsByCategory = {};

  Object.keys(DATASETS).forEach(datasetKey => {
    const config = DATASETS[datasetKey];
    const datasetResults = results[datasetKey];

    // Skip disabled datasets
    if (!config.enabled) {
      return;
    }

    // Skip datasets that don't exist in results (not analyzed) or are explicitly undefined/null
    if (datasetResults === undefined || datasetResults === null) {
      return;
    }

    // Determine if results are empty based on result type
    let isEmpty = true; // Default to empty

    if (config.resultStyle === 'binary' && typeof datasetResults === 'object' && 'detected' in datasetResults) {
      isEmpty = !datasetResults.detected;
    } else if (config.resultStyle === 'percentage' && typeof datasetResults === 'object' && 'percentage' in datasetResults) {
      isEmpty = datasetResults.percentage === 0;
    } else if (config.resultStyle === 'acreage' && typeof datasetResults === 'object' && 'totalAcres' in datasetResults) {
      isEmpty = datasetResults.totalAcres === 0;
    } else if (config.resultStyle === 'sum' && typeof datasetResults === 'object' && 'sum' in datasetResults) {
      isEmpty = datasetResults.sum === 0;
    } else if (config.resultStyle === 'nearest' && Array.isArray(datasetResults)) {
      isEmpty = datasetResults.length === 0;
    } else if (config.resultStyle === 'lengthByStatus' && typeof datasetResults === 'object' && 'total' in datasetResults) {
      isEmpty = datasetResults.total === 0;
    } else if (typeof datasetResults === 'object' && 'total' in datasetResults) {
      isEmpty = datasetResults.total === 0;
    } else if (Array.isArray(datasetResults)) {
      isEmpty = datasetResults.length === 0;
    } else {
      // Unknown result type - skip it
      return;
    }

    // Skip datasets with no results
    if (isEmpty) {
      return;
    }

    const category = config.category || 'Other';
    if (!datasetsByCategory[category]) {
      datasetsByCategory[category] = [];
    }
    datasetsByCategory[category].push({ key: datasetKey, config });
  });

  // Display results by category
  categoryOrder.forEach(category => {
    if (!datasetsByCategory[category]) return;

    // Add category header
    resultsContainer.innerHTML += `
      <div style="font-weight: bold; font-size: 16px; color: #333; margin-top: 20px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #0066CC;">
        ${escapeHtml(category)}
      </div>
    `;

    // Add dataset cards for this category
    datasetsByCategory[category].forEach(({ key, config }) => {
      // Get results for this dataset
      const datasetResults = results[key] || [];

      // Create and append result card
      const cardHtml = createResultCard(config, datasetResults);
      resultsContainer.innerHTML += cardHtml;
    });
  });

  // Enable PDF button if project name is entered
  onProjectNameInput();
}

/**
 * Clear all results from the sidebar
 * Resets to initial empty state
 */
function clearResults() {
  // Get results container
  const resultsContainer = document.getElementById('resultsContainer');

  // Display placeholder message
  resultsContainer.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #666;">
      <p style="font-size: 16px; margin: 0;">Draw a project to see analysis results</p>
      <p style="font-size: 13px; margin-top: 10px; color: #999;">Click "Draw Alignment" or "Mark Location" above to get started</p>
    </div>
  `;

  // Clear project name
  document.getElementById('projectName').value = '';

  // Disable PDF button
  document.getElementById('pdfButton').disabled = true;

  // Clear stored results
  Object.keys(currentResults).forEach(key => delete currentResults[key]);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Show user-friendly error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  alert(message);
}

/**
 * Show or hide loading overlay
 * @param {boolean} show - Whether to show or hide the overlay
 * @param {string} message - Optional loading message
 */
function showLoading(show, message = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');

  if (show) {
    loadingText.textContent = message;
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
}

// ============================================
// INITIALIZE APPLICATION
// ============================================

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', init);
