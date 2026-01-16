/**
 * pdf.js
 * PDF generation and export functionality
 *
 * Dependencies: jsPDF, html2canvas, Turf.js, Leaflet, map.js, analysis.js, datasets.js
 */

// ============================================
// HELPER FUNCTIONS FOR FILTERED LAYER STYLING
// ============================================

/**
 * Get style for a GeoJSON feature based on dataset config
 * Handles styleByProperty for conditional styling
 * @param {Object} feature - GeoJSON Feature
 * @param {Object} config - Dataset configuration from DATASETS
 * @returns {Object} Leaflet style object
 */
function getFeatureStyle(feature, config) {
  let style = { ...config.style };

  // Apply conditional styling if configured
  if (config.styleByProperty && feature.properties) {
    const propertyField = config.styleByProperty.field;
    const propertyValue = feature.properties[propertyField];
    const styleMap = config.styleByProperty.values;

    if (styleMap && styleMap[propertyValue]) {
      style = { ...style, ...styleMap[propertyValue] };
    }
  }

  return style;
}

/**
 * Create Leaflet marker for Point features
 * Applies styling from dataset config
 * @param {Object} feature - GeoJSON Feature
 * @param {Object} latlng - Leaflet LatLng object
 * @param {Object} config - Dataset configuration from DATASETS
 * @returns {Object} Leaflet CircleMarker
 */
function createPointMarker(feature, latlng, config) {
  const style = getFeatureStyle(feature, config);

  return L.circleMarker(latlng, {
    radius: style.radius || 5,
    fillColor: style.fillColor || '#007cbf',
    color: style.color || '#000000',
    weight: style.weight || 1,
    opacity: style.opacity || 1,
    fillOpacity: style.fillOpacity || 0.8
  });
}

// ============================================
// PDF GENERATION
// ============================================

/**
 * Generate PDF report with map image and analysis results
 * Captures map, formats data, and downloads PDF file
 */
async function generatePDF() {
  const projectName = document.getElementById('projectName').value.trim();

  // Validate project name
  if (!projectName) {
    showError('Please enter a project name before generating the PDF.');
    return;
  }

  // Track which layers were visible before PDF generation
  const layerStates = {};
  Object.keys(DATASETS).forEach(datasetKey => {
    if (featureLayers[datasetKey]) {
      layerStates[datasetKey] = map.hasLayer(featureLayers[datasetKey]);
    }
  });

  // Temporary layers for filtered rendering
  const tempLayers = [];

  try {
    // Disable button and show loading state
    const pdfButton = document.getElementById('pdfButton');
    const originalText = pdfButton.textContent;
    pdfButton.disabled = true;
    pdfButton.textContent = 'Generating PDF...';

    // Show loading overlay with PDF progress
    showLoading(true, 'Preparing map for PDF...');

    // Auto-zoom map FIRST, before adding filtered layers
    // Use animate: false to ensure immediate positioning
    const optimalBounds = getOptimalMapBounds();
    if (optimalBounds) {
      map.fitBounds(optimalBounds, {
        padding: [80, 80],  // Increased padding for better centering
        maxZoom: 16,        // Prevent zooming in too close
        animate: false      // Critical: prevents capture during animation
      });
    }

    // Force Leaflet to update size/position after zoom
    map.invalidateSize();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Turn off all user-selected layers before adding filtered features
    Object.keys(DATASETS).forEach(datasetKey => {
      if (featureLayers[datasetKey] && map.hasLayer(featureLayers[datasetKey])) {
        map.removeLayer(featureLayers[datasetKey]);
      }
    });

    // NOW create temporary filtered layers with only matched features
    // (after map is at correct position)
    Object.keys(currentResults).forEach(datasetKey => {
      const results = currentResults[datasetKey];
      const config = DATASETS[datasetKey];

      if (!results || !config) return;

      // Skip rendering if dataset is marked to not show in PDF
      if (config.hideInPdfRendering) {
        return;
      }

      // Get features array (handle count results differently)
      let features;
      if (results.features) {
        // proximityCount results have a features array
        features = results.features;
      } else if (Array.isArray(results) && results.length > 0 && results[0] && results[0].geometry) {
        // corridor, intersection, proximity results are arrays of features
        features = results;
      } else {
        // No features to render (empty results or unexpected format)
        return;
      }

      if (features.length === 0) return;

      // Create GeoJSON FeatureCollection
      const featureCollection = {
        type: 'FeatureCollection',
        features: features
      };

      // Create Leaflet layer with appropriate styling
      const tempLayer = L.geoJSON(featureCollection, {
        style: (feature) => getFeatureStyle(feature, config),
        pointToLayer: (feature, latlng) => createPointMarker(feature, latlng, config)
      });

      tempLayer.addTo(map);
      tempLayers.push(tempLayer);
    });

    // === CRITICAL: Wait for all rendering to complete before capture ===

    // Step 1: Wait for basemap tiles to load at new position
    showLoading(true, 'Loading basemap tiles...');
    await waitForTilesToLoad();

    // Step 2: Wait for newly added temp layers to render
    showLoading(true, 'Rendering filtered layers...');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 3: Wait for GeoJSON vector layers to render
    showLoading(true, 'Rendering vector layers...');
    await waitForGeoJSONLayersToRender();

    // Step 4: Give browser one more render cycle to finalize
    showLoading(true, 'Finalizing map display...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: Force Leaflet to recalculate internal state one final time
    // This ensures all layer positions are correct
    map.invalidateSize();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Now safe to capture
    showLoading(true, 'Capturing map image...');

    // Capture map as image using html2canvas
    // Using simple v0.7.1 approach - only visibility toggles in onclone
    const mapElement = document.getElementById('map');
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      scale: 2,  // Higher DPI for better quality
      logging: false,
      backgroundColor: '#ffffff',
      onclone: function(clonedDoc) {
        // Simple: just ensure all Leaflet panes are visible
        const panes = clonedDoc.querySelectorAll('.leaflet-pane');
        panes.forEach(pane => {
          pane.style.opacity = '1';
          pane.style.visibility = 'visible';
        });
      }
    });

    // Remove temporary filtered layers
    tempLayers.forEach(layer => map.removeLayer(layer));

    // Restore user-selected layers
    Object.keys(DATASETS).forEach(datasetKey => {
      if (featureLayers[datasetKey] && layerStates[datasetKey]) {
        map.addLayer(featureLayers[datasetKey]);
      }
    });

    showLoading(true, 'Building PDF document...');

    const mapImageData = canvas.toDataURL('image/png');

    // Create PDF using jsPDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter'  // 8.5 x 11 inches
    });

    // PDF dimensions (letter size with margins)
    const pageWidth = 8.5;
    const pageHeight = 11;
    const margin = 0.5;
    const contentWidth = pageWidth - (2 * margin);

    let yPosition = margin;

    // ========== HEADER SECTION ==========

    // Add logo (if available)
    try {
      // Note: For production, you may need to convert logo to base64
      // Project name as main title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(projectName, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 0.3;
    } catch (error) {
      console.warn('Could not add logo to PDF:', error);
    }

    // Project Application Report as subtitle
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Project Application Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 0.3;

    // Date generated
    pdf.setFontSize(10);
    pdf.setTextColor(128, 128, 128);
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.text(`Generated: ${currentDate}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 0.2;

    // Project length (only for line features)
    if (drawnGeometry && drawnGeometry.geometry && drawnGeometry.geometry.type === 'LineString') {
      const lengthInMiles = turf.length(drawnGeometry.geometry, { units: 'miles' });
      pdf.text(`Project Length: ${lengthInMiles.toFixed(1)} miles`, pageWidth - margin, yPosition, { align: 'right' });
    }

    pdf.setTextColor(0, 0, 0);
    yPosition += 0.5;

    // ========== MAP SECTION ==========

    // Add map image
    const mapWidth = 7;
    const mapHeight = (canvas.height / canvas.width) * mapWidth;
    const mapX = (pageWidth - mapWidth) / 2;

    pdf.addImage(mapImageData, 'PNG', mapX, yPosition, mapWidth, mapHeight);
    yPosition += mapHeight + 0.4;

    // ========== RESULTS SECTION ==========
    // Only include sections that have results

    // Helper function to check if we need a new page
    const checkPageBreak = (neededSpace = 0.5) => {
      const footerSpace = 0.5;
      if (yPosition + neededSpace > pageHeight - footerSpace) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Check if we have any results from any dataset
    const hasAnyResults = Object.keys(currentResults).some(datasetKey => {
      const results = currentResults[datasetKey];
      if (!results) return false;

      // Handle count results (object with total property)
      if (typeof results === 'object' && 'total' in results) {
        return results.total > 0;
      }

      // Handle array results
      return results.length > 0;
    });

    if (hasAnyResults) {
      checkPageBreak(0.5);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Analysis Results', margin, yPosition);
      yPosition += 0.3;
    }

    // Group datasets by category
    const categoryOrder = ['Transportation', 'Economic Development', 'Environmental/Cultural'];
    const datasetsByCategory = {};

    Object.keys(DATASETS).forEach(datasetKey => {
      const config = DATASETS[datasetKey];
      const results = currentResults[datasetKey];

      // Skip if dataset is disabled or has no results
      if (!config.enabled || !results) {
        return;
      }

      // Check if results are empty (handle different result types)
      let isEmpty = false;
      if (config.resultStyle === 'binary' && typeof results === 'object' && 'detected' in results) {
        isEmpty = !results.detected;
      } else if (config.resultStyle === 'lengthByStatus' && typeof results === 'object' && 'total' in results) {
        isEmpty = results.total === 0;
      } else if (typeof results === 'object' && 'total' in results) {
        isEmpty = results.total === 0;
      } else {
        isEmpty = results.length === 0;
      }

      if (isEmpty) {
        return;
      }

      // Group by category
      const category = config.category || 'Other';
      if (!datasetsByCategory[category]) {
        datasetsByCategory[category] = [];
      }
      datasetsByCategory[category].push({ config, results });
    });

    // Loop through categories in order
    categoryOrder.forEach(category => {
      if (!datasetsByCategory[category] || datasetsByCategory[category].length === 0) {
        return;
      }

      // Add category header
      checkPageBreak(0.4);
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 102, 204); // Blue color for category headers
      pdf.text(category, margin, yPosition);
      yPosition += 0.25;
      pdf.setTextColor(0, 0, 0); // Reset to black

      // Loop through datasets in this category
      datasetsByCategory[category].forEach(({ config, results }) => {

      // Add section header
      checkPageBreak(0.5);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${config.name}:`, margin, yPosition);
      yPosition += 0.2;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      // Render based on resultStyle
      if (config.resultStyle === 'binary') {
        // Binary format (for flood zones and wetlands - just show Yes)
        checkPageBreak(0.3);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`  Yes`, margin, yPosition);
        yPosition += 0.2;
        yPosition += 0.1;  // Add spacing between datasets

      } else if (config.resultStyle === 'acreage') {
        // Acreage format (for wetlands - show total acreage)
        checkPageBreak(0.3);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`  Total Acreage: ${results.sum.toFixed(2)} acres`, margin, yPosition);
        yPosition += 0.2;
        pdf.setFont('helvetica', 'normal');
        yPosition += 0.1;  // Add spacing between datasets

      } else if (config.resultStyle === 'lengthByStatus') {
        // Length by status format (for travel time reliability - show percentages and mean LOTTR)
        checkPageBreak(0.3);
        pdf.setFont('helvetica', 'bold');

        // Show mean LOTTR if available
        if (results.meanLOTTR !== null && results.meanLOTTR !== undefined) {
          pdf.text(`  Mean LOTTR: ${results.meanLOTTR.toFixed(2)}`, margin, yPosition);
          yPosition += 0.18;
        }

        pdf.setFont('helvetica', 'normal');

        if (results.breakdown && Object.keys(results.breakdown).length > 0) {
          // Sort breakdown by status (True first, then False)
          const sortedBreakdown = Object.entries(results.breakdown).sort((a, b) => {
            if (a[0] === 'True' && b[0] !== 'True') return -1;
            if (a[0] !== 'True' && b[0] === 'True') return 1;
            return 0;
          });

          sortedBreakdown.forEach(([status, percentage]) => {
            checkPageBreak(0.2);
            const statusLabel = status === 'True' ? 'Reliable' : 'Unreliable';
            pdf.text(`    • ${statusLabel}: ${percentage.toFixed(1)}%`, margin, yPosition);
            yPosition += 0.16;
          });
        }
        yPosition += 0.2;  // Add spacing between datasets

      } else if (config.resultStyle === 'count') {
        // Count format
        checkPageBreak(0.3);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`  Total: ${results.total}`, margin, yPosition);
        yPosition += 0.18;
        pdf.setFont('helvetica', 'normal');

        if (results.breakdown && Object.keys(results.breakdown).length > 0) {
          // Sort breakdown by count (descending)
          const sortedBreakdown = Object.entries(results.breakdown).sort((a, b) => b[1] - a[1]);

          sortedBreakdown.forEach(([category, count]) => {
            checkPageBreak(0.2);
            pdf.text(`    • ${category}: ${count}`, margin, yPosition);
            yPosition += 0.16;
          });
        }
        yPosition += 0.2;  // Add spacing between datasets

      } else if (config.resultStyle === 'percentage') {
        // Percentage format (for project coverage analysis like HICs)
        checkPageBreak(0.3);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`  ${results.percentage}% of project`, margin, yPosition);
        yPosition += 0.2;
        pdf.setFont('helvetica', 'normal');
        yPosition += 0.1;  // Add spacing between datasets

      } else if (config.resultStyle === 'table' && config.properties.additionalFields.length > 0) {
        // Table format
        pdf.setFont('helvetica', 'bold');

        // Table header
        const columnWidth = 2.5;
        let xOffset = margin + 0.2;

        pdf.text(config.properties.displayField, xOffset, yPosition);
        xOffset += columnWidth;

        config.properties.additionalFields.forEach(field => {
          pdf.text(field, xOffset, yPosition);
          xOffset += columnWidth;
        });

        yPosition += 0.18;
        pdf.setFont('helvetica', 'normal');

        // Table rows
        results.forEach(result => {
          checkPageBreak(0.2);
          xOffset = margin + 0.2;

          // Access properties from Feature or flat object
          const props = result.properties || result;

          // Display field
          const displayValue = props[config.properties.displayField] || 'Unknown';
          pdf.text(String(displayValue), xOffset, yPosition);
          xOffset += columnWidth;

          // Additional fields
          config.properties.additionalFields.forEach(field => {
            const fieldValue = props[field] || 'Unknown';
            pdf.text(String(fieldValue), xOffset, yPosition);
            xOffset += columnWidth;
          });

          yPosition += 0.15;
        });
        yPosition += 0.1;  // Add spacing between datasets

      } else {
        // List format (default)
        results.forEach(result => {
          checkPageBreak(0.2);

          let displayText;
          if (typeof result === 'string') {
            displayText = result;
          } else if (typeof result === 'object') {
            // Access properties from Feature or flat object
            const props = result.properties || result;
            displayText = props._displayName || props[config.properties.displayField] || 'Unknown';

            // Add additional fields if present
            if (config.properties.additionalFields && config.properties.additionalFields.length > 0) {
              config.properties.additionalFields.forEach(field => {
                let value = props[field];

                // Format as percentage if specified
                if (config.properties.formatPercentage === field && value !== undefined && value !== 'Unknown') {
                  value = `${(value * 100).toFixed(1)}%`;
                }

                const fieldLabel = field === 'F__Below_A' ? '% Below ALICE' : field;
                displayText += ` | ${fieldLabel}: ${value}`;
              });
            }
          } else {
            displayText = String(result);
          }

          pdf.text(`  • ${displayText}`, margin, yPosition);
          yPosition += 0.18;
        });
        yPosition += 0.2;  // Add spacing between datasets
      }
      }); // End of datasets in category loop
    }); // End of category loop

    // ========== FOOTER (on each page) ==========
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      const footerY = pageHeight - 0.3;
      pdf.text('Generated by Memphis MPO Project Application Tool', pageWidth / 2, footerY, { align: 'center' });
      if (totalPages > 1) {
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
      }
    }

    // ========== SAVE PDF ==========

    const fileName = formatFileName(projectName);
    pdf.save(fileName);

    // Hide loading overlay
    showLoading(false);

    // Re-enable button
    pdfButton.disabled = false;
    pdfButton.textContent = originalText;

  } catch (error) {
    console.error('PDF generation error:', error);

    // Clean up temporary layers on error
    tempLayers.forEach(layer => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    showLoading(false);
    showError('Failed to generate PDF. Please try again.');

    // Re-enable button
    const pdfButton = document.getElementById('pdfButton');
    pdfButton.disabled = false;
    pdfButton.textContent = 'Download PDF Report';
  }
}

/**
 * Format project name into valid filename for PDF download
 * Replaces spaces with underscores and adds ISO date
 * @param {string} projectName - User-entered project name
 * @returns {string} Formatted filename
 */
function formatFileName(projectName) {
  // Replace spaces and special characters with underscores
  const sanitized = projectName.replace(/[^a-zA-Z0-9]/g, '_');

  // Get current date in YYYY-MM-DD format
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return `Project_Application_${sanitized}_${dateStr}.pdf`;
}

/**
 * Wait for all map tiles to finish loading
 * Returns a promise that resolves when tiles are loaded
 * @returns {Promise} Resolves when tiles are loaded or after timeout
 */
function waitForTilesToLoad() {
  return new Promise((resolve) => {
    // Get the tile layer from map
    let tileLayer = null;
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        tileLayer = layer;
      }
    });

    if (!tileLayer) {
      console.warn('No tile layer found');
      resolve();
      return;
    }

    // Helper function to check pending tiles
    const checkTiles = () => {
      let pending = 0;
      const container = tileLayer.getContainer();
      if (container) {
        const tiles = container.querySelectorAll('img');
        tiles.forEach(tile => {
          if (!tile.complete) pending++;
        });
      }
      return pending;
    };

    // Check if tiles are already loaded
    const initialPending = checkTiles();
    console.log(`Basemap tiles: ${initialPending} pending`);

    if (initialPending === 0) {
      console.log('✓ All basemap tiles already loaded');
      resolve();
      return;
    }

    // Wait for 'load' event or timeout
    let resolved = false;
    let timeoutHandle;

    const onLoad = () => {
      const stillPending = checkTiles();
      if (!resolved && stillPending === 0) {
        resolved = true;
        clearTimeout(timeoutHandle);
        tileLayer.off('load', onLoad);
        tileLayer.off('tileerror', onTileError);
        console.log('✓ All basemap tiles loaded successfully');
        resolve();
      } else if (stillPending > 0) {
        console.log(`Basemap tiles: ${stillPending} still pending...`);
      }
    };

    const onTileError = (error) => {
      console.warn('Tile load error:', error);
      // Continue anyway - some tiles may have failed but we should proceed
    };

    tileLayer.on('load', onLoad);
    tileLayer.on('tileerror', onTileError);

    // Timeout fallback (5 seconds max wait - increased from 3s)
    timeoutHandle = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        tileLayer.off('load', onLoad);
        tileLayer.off('tileerror', onTileError);
        const finalPending = checkTiles();
        console.warn(`⚠ Tile load timeout after 5s - ${finalPending} tiles still pending - proceeding anyway`);
        resolve();
      }
    }, 5000);
  });
}

/**
 * Wait for all GeoJSON vector layers to finish rendering in the DOM
 * GeoJSON layers render as SVG elements in the overlay pane
 * This ensures all vector features are visible before PDF capture
 * @returns {Promise} Resolves when layers are rendered or timeout (2s)
 */
async function waitForGeoJSONLayersToRender() {
  return new Promise((resolve) => {
    let checks = 0;
    const maxChecks = 20; // 2 seconds max wait (20 * 100ms)

    const checkRendered = () => {
      checks++;

      // Find the Leaflet overlay pane that contains vector layers
      const overlayPane = document.querySelector('.leaflet-overlay-pane');
      if (!overlayPane) {
        if (checks < maxChecks) {
          setTimeout(checkRendered, 100);
        } else {
          console.warn('GeoJSON layers: overlay pane not found - proceeding anyway');
          resolve();
        }
        return;
      }

      // Count rendered SVG paths (GeoJSON features render as SVG)
      const svgPaths = overlayPane.querySelectorAll('svg path');
      const canvasElements = overlayPane.querySelectorAll('canvas');

      // Count total rendered elements
      const totalElements = svgPaths.length + canvasElements.length;

      // Log progress every 5 checks
      if (checks % 5 === 0 || checks === 1) {
        console.log(`GeoJSON render check ${checks}: ${svgPaths.length} SVG paths, ${canvasElements.length} canvas elements`);
      }

      // Consider rendered if we have some elements OR reached max checks
      // We expect at least a few paths for the drawn geometry + reference layers
      if (totalElements > 0 || checks >= maxChecks) {
        if (checks >= maxChecks && totalElements === 0) {
          console.warn('GeoJSON layers: timeout reached with no elements - check if layers are actually enabled');
        } else {
          console.log(`✓ GeoJSON layers rendered: ${totalElements} elements found after ${checks * 100}ms`);
        }
        resolve();
      } else {
        // Keep checking
        setTimeout(checkRendered, 100);
      }
    };

    checkRendered();
  });
}

