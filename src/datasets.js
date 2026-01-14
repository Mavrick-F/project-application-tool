/**
 * datasets.js
 * Configuration and dataset definitions for Memphis MPO Project Application Tool
 *
 * This file must load before all other application scripts
 * Dependencies: js-yaml (loaded from CDN)
 */

// ============================================
// APPLICATION CONFIGURATION
// ============================================
const CONFIG = {
  // Spatial analysis parameters
  bridgeBufferDistance: 300,      // Buffer distance in feet for bridge proximity
  bridgeBufferUnits: 'feet',      // Units for buffer calculation
  minLineLength: 100,             // Minimum project length in feet

  // Map configuration
  mapCenter: null,                // Auto-calculated from data bounds
  mapZoom: 11,                    // Default zoom level
  basemapUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  basemapAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',

  // Drawn geometry style - BOLD RED for maximum visibility
  drawnLineStyle: {
    color: '#FF0000',        // Bright red
    weight: 12,              // Much thicker (was 8)
    opacity: 0.9             // Slightly more opaque
  },

  // Logo path
  logoPath: '../assets/rtp-2055-logo.jpg'
};

// ============================================
// DATASET CONFIGURATION (Loaded from YAML)
// ============================================
/**
 * Configuration object for all datasets in the application
 * Loaded dynamically from datasets.yaml
 * Each dataset defines its file path, geometry type, analysis method,
 * display properties, and styling options
 */
let DATASETS = {};

// ============================================
// YAML DATASET LOADER
// ============================================
/**
 * Loads dataset configuration from datasets.yaml file
 * Populates the DATASETS object with parsed YAML data
 * @returns {Promise<void>} Resolves when datasets are loaded
 */
async function loadDatasets() {
  try {
    const response = await fetch('datasets.yaml');
    if (!response.ok) {
      throw new Error(`Failed to load datasets.yaml: ${response.statusText}`);
    }
    const yamlText = await response.text();
    const parsedDatasets = jsyaml.load(yamlText);

    // Populate DATASETS object with parsed YAML data
    Object.assign(DATASETS, parsedDatasets);

    console.log('✓ Datasets loaded successfully from YAML:', Object.keys(DATASETS).length, 'datasets');
  } catch (error) {
    console.error('Error loading datasets from YAML:', error);
    throw error;
  }
}

// Promise that resolves when datasets are loaded
// Other scripts can await this before initialization
const datasetsLoaded = loadDatasets();
