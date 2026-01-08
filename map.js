/**
 * map.js
 * Map initialization, layer management, and drawing controls
 *
 * Dependencies: Leaflet, Leaflet.draw, datasets.js (CONFIG)
 */

// ============================================
// MAP GLOBAL VARIABLES
// ============================================
let map;                          // Leaflet map instance
let drawControl;                  // Leaflet.draw control
let drawnItems;                   // Feature group for drawn items
let polylineDrawer;               // Polyline draw handler
let markerDrawer;                 // Marker draw handler
let drawnLayer = null;            // Currently drawn polyline layer

// Layer groups for reference data (dynamically populated from DATASETS)
const featureLayers = {};

// ============================================
// MAP INITIALIZATION
// ============================================

/**
 * Initialize the Leaflet map with basemap and controls
 */
function initializeMap() {
  // Create map instance
  // Using canvas renderer instead of SVG to fix html2canvas offset issues in PDF export
  map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    renderer: L.canvas()
  });

  // Add CartoDB Voyager basemap (streets style, similar to Google Maps)
  const basemap = L.tileLayer(CONFIG.basemapUrl, {
    attribution: CONFIG.basemapAttribution,
    maxZoom: 19
  }).addTo(map);

  // Add scale control (bottom left)
  L.control.scale({
    imperial: true,
    metric: false,
    position: 'bottomleft'
  }).addTo(map);
}

/**
 * Dynamically add all reference layers to the map based on DATASETS configuration
 * Configures styling, tooltips, and hover interactions for each dataset
 */
function addReferenceLayers() {
  // Group layers by category
  const layersByCategory = {};

  // Loop through all enabled datasets and create layers
  Object.keys(DATASETS).forEach(datasetKey => {
    const config = DATASETS[datasetKey];

    // Skip if dataset is disabled or data not loaded
    if (!config.enabled || !geoJsonData[datasetKey]) {
      return;
    }

    try {
      let layer;

      // Create layer based on geometry type
      if (config.geometryType === 'Point') {
        // ========== POINT LAYERS ==========
        layer = L.geoJSON(geoJsonData[datasetKey], {
          pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, config.style);
          },
          onEachFeature: (feature, leafletLayer) => {
            // Use staticLabel if defined, otherwise use field value
            const displayValue = config.properties.staticLabel ||
                                feature.properties[config.properties.displayField] ||
                                'Unknown';

            // Build tooltip text
            let tooltipText = displayValue;
            if (config.properties.additionalFields && config.properties.additionalFields.length > 0) {
              config.properties.additionalFields.forEach(field => {
                const value = feature.properties[field] || 'Unknown';
                tooltipText += ` | ${field}: ${value}`;
              });
            }

            // Bind tooltip
            leafletLayer.bindTooltip(tooltipText, {
              sticky: true,
              className: 'leaflet-tooltip'
            });

            // Hover effects
            const hoverStyle = { ...config.style, radius: (config.style.radius || 3) + 2 };
            leafletLayer.on('mouseover', function() {
              this.setStyle(hoverStyle);
            });

            leafletLayer.on('mouseout', function() {
              this.setStyle(config.style);
            });
          }
        });

      } else if (config.geometryType === 'LineString') {
        // ========== LINE LAYERS ==========
        layer = L.geoJSON(geoJsonData[datasetKey], {
          style: (feature) => {
            // Check if style should vary by property
            if (config.styleByProperty) {
              const propertyValue = feature.properties[config.styleByProperty.field];
              const propertyStyle = config.styleByProperty.values[propertyValue];
              if (propertyStyle) {
                return { ...config.style, ...propertyStyle };
              }
            }
            return config.style;
          },
          onEachFeature: (feature, leafletLayer) => {
            // Use staticLabel if defined, otherwise use field value
            const displayValue = config.properties.staticLabel ||
                                feature.properties[config.properties.displayField] ||
                                'Unknown';

            // Bind tooltip
            leafletLayer.bindTooltip(displayValue, {
              sticky: true,
              className: 'leaflet-tooltip'
            });

            // Get current feature style for hover effects
            let currentStyle = config.style;
            if (config.styleByProperty) {
              const propertyValue = feature.properties[config.styleByProperty.field];
              const propertyStyle = config.styleByProperty.values[propertyValue];
              if (propertyStyle) {
                currentStyle = { ...config.style, ...propertyStyle };
              }
            }

            // Hover effects
            const hoverStyle = { ...currentStyle, weight: (currentStyle.weight || 2) + 0.5, opacity: (currentStyle.opacity || 0.7) + 0.15 };
            leafletLayer.on('mouseover', function() {
              this.setStyle(hoverStyle);
            });

            leafletLayer.on('mouseout', function() {
              this.setStyle(currentStyle);
            });
          }
        });

      } else if (config.geometryType === 'MultiLineString') {
        // ========== MULTILINESTRING LAYERS ==========
        // Use same logic as LineString - Leaflet handles MultiLineString automatically
        layer = L.geoJSON(geoJsonData[datasetKey], {
          style: (feature) => {
            // Check if style should vary by property
            if (config.styleByProperty) {
              const propertyValue = feature.properties[config.styleByProperty.field];
              const propertyStyle = config.styleByProperty.values[propertyValue];
              if (propertyStyle) {
                return { ...config.style, ...propertyStyle };
              }
            }
            return config.style;
          },
          onEachFeature: (feature, leafletLayer) => {
            // Use staticLabel if defined, otherwise use field value
            const displayValue = config.properties.staticLabel ||
                                feature.properties[config.properties.displayField] ||
                                'Unknown';

            // Bind tooltip
            leafletLayer.bindTooltip(displayValue, {
              sticky: true,
              className: 'leaflet-tooltip'
            });

            // Get current feature style for hover effects
            let currentStyle = config.style;
            if (config.styleByProperty) {
              const propertyValue = feature.properties[config.styleByProperty.field];
              const propertyStyle = config.styleByProperty.values[propertyValue];
              if (propertyStyle) {
                currentStyle = { ...config.style, ...propertyStyle };
              }
            }

            // Hover effects
            const hoverStyle = { ...currentStyle, weight: (currentStyle.weight || 2) + 0.5, opacity: (currentStyle.opacity || 0.7) + 0.15 };
            leafletLayer.on('mouseover', function() {
              this.setStyle(hoverStyle);
            });

            leafletLayer.on('mouseout', function() {
              this.setStyle(currentStyle);
            });
          }
        });

      } else if (config.geometryType === 'Polygon') {
        // ========== POLYGON LAYERS ==========
        // Use all features for display if threshold filtering is enabled
        const dataToDisplay = config.filterByThreshold && geoJsonData[datasetKey + '_all']
          ? geoJsonData[datasetKey + '_all']
          : geoJsonData[datasetKey];

        layer = L.geoJSON(dataToDisplay, {
          style: (feature) => {
            // Apply threshold-based styling if configured
            if (config.filterByThreshold) {
              const value = feature.properties[config.filterByThreshold.field];
              const meetsThreshold = config.filterByThreshold.operator === '>='
                ? value >= config.filterByThreshold.value
                : value > config.filterByThreshold.value;

              // Use translucent style for features below threshold
              return meetsThreshold ? config.style : config.styleTranslucent;
            }
            return config.style;
          },
          onEachFeature: (feature, leafletLayer) => {
            // Use staticLabel if defined, otherwise use field value
            const displayValue = config.properties.staticLabel ||
                                feature.properties[config.properties.displayField] ||
                                'Unknown';

            // Build tooltip text
            let tooltipText = displayValue;
            if (config.properties.additionalFields && config.properties.additionalFields.length > 0) {
              config.properties.additionalFields.forEach(field => {
                let value = feature.properties[field];

                // Format as percentage if specified
                if (config.properties.formatPercentage === field && value !== undefined) {
                  value = `${(value * 100).toFixed(1)}%`;
                } else if (value === undefined) {
                  value = 'Unknown';
                }

                const fieldLabel = field === 'F__Below_A' ? '% Below ALICE' : field;
                tooltipText += ` | ${fieldLabel}: ${value}`;
              });
            }

            // Bind tooltip
            leafletLayer.bindTooltip(tooltipText, {
              sticky: true,
              className: 'leaflet-tooltip'
            });

            // Get current feature style for hover effects
            let currentStyle = config.style;
            if (config.filterByThreshold) {
              const value = feature.properties[config.filterByThreshold.field];
              const meetsThreshold = config.filterByThreshold.operator === '>='
                ? value >= config.filterByThreshold.value
                : value > config.filterByThreshold.value;
              currentStyle = meetsThreshold ? config.style : config.styleTranslucent;
            }

            // Hover effects
            const hoverStyle = { ...currentStyle, fillOpacity: (currentStyle.fillOpacity || 0.3) + 0.2 };
            leafletLayer.on('mouseover', function() {
              this.setStyle(hoverStyle);
            });

            leafletLayer.on('mouseout', function() {
              this.setStyle(currentStyle);
            });
          }
        });
      }

      // Store layer and organize by category
      if (layer) {
        featureLayers[datasetKey] = layer;

        // Create layer control label with colored symbol
        let symbol = '●';
        if (config.geometryType === 'Polygon') symbol = '■';
        if (config.geometryType === 'LineString' || config.geometryType === 'MultiLineString') symbol = '─';

        const layerLabel = `<span style="color:${config.style.color};">${symbol}</span> ${config.name}`;

        // Group by category
        const category = config.category || 'Other';
        if (!layersByCategory[category]) {
          layersByCategory[category] = {};
        }
        layersByCategory[category][layerLabel] = layer;
      }

    } catch (error) {
      console.error(`Error creating layer for ${datasetKey}:`, error);
    }
  });

  // ========== LAYER CONTROL ==========
  // Build grouped overlay layers with category headers
  const overlayLayers = {};
  const categoryOrder = ['Transportation', 'Economic', 'Environmental'];

  categoryOrder.forEach(category => {
    if (layersByCategory[category]) {
      // Add category header (non-interactive)
      const headerKey = `<div style="font-weight: bold; font-size: 13px; color: #333; margin-top: 8px; margin-bottom: 4px; pointer-events: none; border-bottom: 1px solid #ddd; padding-bottom: 4px;">${category}</div>`;

      // Add all layers in this category
      Object.keys(layersByCategory[category]).forEach(layerLabel => {
        // Indent layer names under category header
        const indentedLabel = `<span style="margin-left: 8px; display: inline-block;">${layerLabel}</span>`;
        overlayLayers[indentedLabel] = layersByCategory[category][layerLabel];
      });
    }
  });

  // Add layer control to map if we have any layers
  if (Object.keys(overlayLayers).length > 0) {
    L.control.layers(null, overlayLayers, {
      collapsed: false,
      position: 'topright'
    }).addTo(map);
  }
}

/**
 * Fit map to Memphis MPO area extent
 * Uses fixed bounds for consistent viewport
 */
function fitMapToBounds() {
  // Memphis MPO area bounds
  // Southwest corner: [34.9, -90.1]
  // Northeast corner: [35.3, -89.6]
  const memphisBounds = L.latLngBounds(
    [34.9, -90.1],  // Southwest
    [35.3, -89.6]   // Northeast
  );

  // Fit map to Memphis bounds with padding
  map.fitBounds(memphisBounds, { padding: [50, 50] });
}

/**
 * Set up Leaflet.draw controls for drawing project alignments
 * Only allows polyline drawing, one feature at a time
 */
function setupDrawingControls() {
  // Create a feature group to store drawn items
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // Create draw handlers (but don't add toolbar to map)
  // These will be triggered programmatically from sidebar buttons
  polylineDrawer = new L.Draw.Polyline(map, {
    shapeOptions: CONFIG.drawnLineStyle,
    showLength: true,
    metric: false,  // Use imperial units (feet)
    feet: true
  });

  markerDrawer = new L.Draw.Marker(map, {
    icon: L.divIcon({
      className: 'project-marker',
      html: '<div style="background-color: #FF0000; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white;"></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  });

  // Event handler: When drawing is created
  map.on(L.Draw.Event.CREATED, function(event) {
    onDrawCreated(event, drawnItems);
  });

  // Event handler: When drawing starts
  map.on(L.Draw.Event.DRAWSTART, function() {
    updateDrawButtonStates(true);
  });

  // Event handler: When drawing stops
  map.on(L.Draw.Event.DRAWSTOP, function() {
    updateDrawButtonStates(false);
  });
}

/**
 * Calculate optimal bounds for PDF map capture
 * Expands drawn geometry bounds for better framing
 * @returns {L.LatLngBounds|null} Expanded bounds or null if no drawing
 */
function getOptimalMapBounds() {
  if (!drawnLayer) return null;

  // Handle different layer types
  if (drawnLayer.getBounds) {
    // LineString - has getBounds method
    const lineBounds = drawnLayer.getBounds();
    const center = lineBounds.getCenter();
    const latDiff = Math.abs(lineBounds.getNorth() - lineBounds.getSouth());
    const lngDiff = Math.abs(lineBounds.getEast() - lineBounds.getWest());

    // Expand bounds evenly around center by 50% on each side for better framing
    const latPad = latDiff * 0.5;
    const lngPad = lngDiff * 0.5;

    // Create new bounds centered on the project center
    return L.latLngBounds([
      [center.lat - latDiff / 2 - latPad, center.lng - lngDiff / 2 - lngPad],
      [center.lat + latDiff / 2 + latPad, center.lng + lngDiff / 2 + lngPad]
    ]);
  } else if (drawnLayer.getLatLng) {
    // Point/Marker - use getLatLng
    const latlng = drawnLayer.getLatLng();
    // Create balanced bounds around the point (0.008 degrees ~ 800m for better framing)
    const offset = 0.008;
    return L.latLngBounds([
      [latlng.lat - offset, latlng.lng - offset],
      [latlng.lat + offset, latlng.lng + offset]
    ]);
  }

  return null;
}
