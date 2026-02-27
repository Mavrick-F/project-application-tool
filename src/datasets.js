/**
 * datasets.js
 * Configuration and dataset definitions for MPO Project Application Tool
 *
 * This file must load after config.js and before other application scripts
 * Dependencies: js-yaml (loaded from CDN), config.js
 */

// ============================================
// APPLICATION CONFIGURATION
// ============================================
const CONFIG = {
  // Minimum project length in feet — projects shorter than this should use
  // the point marker tool instead. Applies only to line-drawn projects.
  minLineLength: 100,

  // Map configuration
  basemapUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  basemapAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',

  // Drawn geometry style - read from config.txt or use defaults
  drawnLineStyle: window.CONFIG_APP?.mapStyling?.drawnLine || {
    color: '#FF0000',
    weight: 12,
    opacity: 0.9
  },

  // Logo path (will be set from CONFIG_APP after loading)
  logoPath: null
};

// ============================================
// RESULT STYLE CONSTANTS
// ============================================
const RESULT_STYLES = {
  LIST:            'list',
  COUNT:           'count',
  BINARY:          'binary',
  LENGTH_BY_STATUS:'lengthByStatus',
  AREA:            'area',
  PERCENTAGE:      'percentage',
  SUM:             'sum',
  NEAREST:         'nearest',
  AVERAGE_VALUE:   'averageValue',
  TABLE:           'table',
};

// ============================================
// DATASET CONFIGURATION (Loaded from YAML)
// ============================================
/**
 * Configuration object for all datasets in the application
 * Loaded dynamically from datasets.txt
 * Each dataset defines its file path, geometry type, analysis method,
 * display properties, and styling options
 */
let DATASETS = {};

// ============================================
// YAML DATASET LOADER
// ============================================
/**
 * Loads dataset configuration from datasets.txt file
 * Populates the DATASETS object with parsed YAML data
 * @returns {Promise<void>} Resolves when datasets are loaded
 */
async function loadDatasets() {
  try {
    console.log('Loading datasets from YAML...');
    const response = await fetch('./datasets.txt', { cache: 'no-store' });

    if (!response.ok) {
      console.error(`Failed to fetch datasets.txt: ${response.status} ${response.statusText}`);
      console.error('Fetch URL was:', response.url);
      throw new Error(`Failed to load datasets.txt: ${response.statusText}`);
    }

    const yamlText = await response.text();
    console.log(`Received YAML (${yamlText.length} characters)`);

    const parsedDatasets = jsyaml.load(yamlText);

    // Populate DATASETS object with parsed YAML data
    Object.assign(DATASETS, parsedDatasets);

    // Inject id from the YAML key so datasets never need an explicit id: field
    Object.entries(DATASETS).forEach(([key, dataset]) => {
      if (dataset && typeof dataset === 'object') {
        dataset.id = key;
      }
    });

    // Update CONFIG with logo path from CONFIG_APP if available
    if (window.CONFIG_APP && window.CONFIG_APP.branding && window.CONFIG_APP.branding.logoPath) {
      CONFIG.logoPath = window.CONFIG_APP.branding.logoPath;
    }

    console.log('✓ Datasets loaded successfully from YAML:', Object.keys(DATASETS).length, 'datasets');
  } catch (error) {
    console.error('Error loading datasets from YAML:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Promise that resolves when datasets are loaded
// Other scripts can await this before initialization
const datasetsLoaded = loadDatasets();
