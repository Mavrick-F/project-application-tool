/**
 * datasets.js
 * Configuration and dataset definitions for Memphis MPO Project Application Tool
 *
 * This file must load before all other application scripts
 * Dependencies: None
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

  // Drawn geometry style
  drawnLineStyle: {
    color: '#FF0000',
    weight: 8,
    opacity: 0.8
  },

  // Logo path
  logoPath: './assets/rtp-2055-logo.jpg'
};

// ============================================
// DATASET CONFIGURATION
// ============================================
/**
 * Configuration object for all datasets in the application
 * Each dataset defines its file path, geometry type, analysis method,
 * display properties, and styling options
 */
const DATASETS = {
  mataRoutes: {
    id: 'mataRoutes',
    name: 'MATA Routes',
    category: 'Transportation - Transit',
    filePath: './data/mata-routes.json',
    geometryType: 'LineString',
    analysisMethod: 'corridor',
    bufferDistance: 100,
    minSharedLength: 300,
    proximityBuffer: null,
    properties: {
      displayField: 'Name',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: true,
      deduplicate: true
    },
    style: {
      color: '#0066CC',
      weight: 2,
      opacity: 0.7
    },
    resultStyle: 'list',
    enabled: true
  },

  strahnet: {
    id: 'strahnet',
    name: 'STRAHNET Routes',
    category: 'Transportation - Freight',
    filePath: './data/strahnet.geojson',
    geometryType: 'LineString',
    analysisMethod: 'corridor',
    bufferDistance: 100,
    minSharedLength: 300,
    proximityBuffer: null,
    properties: {
      displayField: 'OBJECTID',
      staticLabel: 'STRAHNET',  // Show static label instead of field value
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#FF6600',
      weight: 3,
      opacity: 0.8
    },
    resultStyle: 'list',
    enabled: true
  },

  truckRoutes: {
    id: 'truckRoutes',
    name: 'MPO Freight Route Network',
    category: 'Transportation - Freight',
    filePath: './data/truck_routes.json',
    geometryType: 'MultiLineString',
    analysisMethod: 'corridor',
    bufferDistance: 100,
    minSharedLength: 300,
    proximityBuffer: null,
    properties: {
      displayField: 'Type',  // Show Regional or Local
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#CC6600',  // Default color, overridden by styleByProperty
      weight: 2,
      opacity: 0.7
    },
    styleByProperty: {  // Different colors for Regional vs Local
      field: 'Type',
      values: {
        'Regional': { color: '#CC0000', weight: 3, opacity: 0.8 },  // Red for Regional
        'Local': { color: '#FF9900', weight: 2, opacity: 0.7 }       // Orange for Local
      }
    },
    resultStyle: 'list',
    enabled: true
  },

  opportunityZones: {
    id: 'opportunityZones',
    name: 'Opportunity Zones',
    category: 'Economic Development',
    filePath: './data/opportunity-zones.json',
    geometryType: 'Polygon',
    analysisMethod: 'intersection',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: null,
    properties: {
      displayField: 'CENSUSTRAC',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#FF8C00',
      weight: 2,
      fillColor: '#FFD700',
      fillOpacity: 0.3
    },
    resultStyle: 'list',
    enabled: true
  },

  freightClusters: {
    id: 'freightClusters',
    name: 'MPO Freight Zones',
    category: 'Transportation - Freight',
    filePath: './data/freight_clusters.geojson',
    geometryType: 'Polygon',
    analysisMethod: 'intersection',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: null,
    properties: {
      displayField: 'N',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#9966CC',
      weight: 2,
      fillColor: '#CC99FF',
      fillOpacity: 0.3
    },
    resultStyle: 'list',
    enabled: true
  },

  parks: {
    id: 'parks',
    name: 'Parks',
    category: 'Environment & Recreation',
    filePath: './data/parks.json',
    geometryType: 'Polygon',
    analysisMethod: 'proximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 200,
    properties: {
      displayField: 'NAME',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#228B22',
      weight: 2,
      fillColor: '#90EE90',
      fillOpacity: 0.3
    },
    resultStyle: 'list',
    enabled: true
  },

  historicPolygons: {
    id: 'historicPolygons',
    name: 'NHRP Polygons',
    category: 'Historic & Cultural',
    filePath: './data/historic_polygons.geojson',
    geometryType: 'Polygon',
    analysisMethod: 'proximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 200,
    properties: {
      displayField: 'RESNAME',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#8B4513',
      weight: 2,
      fillColor: '#DEB887',
      fillOpacity: 0.3
    },
    resultStyle: 'list',
    enabled: true
  },

  bridges: {
    id: 'bridges',
    name: 'Bridges',
    category: 'Infrastructure',
    filePath: './data/bridges.json',
    geometryType: 'Point',
    analysisMethod: 'proximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 300,
    properties: {
      displayField: 'STRUCTURE_',
      additionalFields: ['Condition']
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#DC143C',
      fillColor: '#DC143C',
      radius: 3,
      fillOpacity: 0.8,
      weight: 1
    },
    resultStyle: 'table',
    enabled: true
  },

  majorEmployers: {
    id: 'majorEmployers',
    name: 'Major Employers',
    category: 'Economic Development',
    filePath: './data/major_employers.geojson',
    geometryType: 'Point',
    analysisMethod: 'proximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 1320,
    properties: {
      displayField: 'company_name',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#4169E1',
      fillColor: '#4169E1',
      radius: 4,
      fillOpacity: 0.8,
      weight: 1
    },
    resultStyle: 'list',
    enabled: true
  },

  touristAttractions: {
    id: 'touristAttractions',
    name: 'Tourist Destinations',
    category: 'Economic Development',
    filePath: './data/tourist_attractions.geojson',
    geometryType: 'Point',
    analysisMethod: 'proximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 1320,
    properties: {
      displayField: 'NAME',  // Use correct uppercase field name
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#FF1493',
      fillColor: '#FF1493',
      radius: 4,
      fillOpacity: 0.8,
      weight: 1
    },
    resultStyle: 'list',
    enabled: true
  },

  historicPoints: {
    id: 'historicPoints',
    name: 'NHRP Points',
    category: 'Historic & Cultural',
    filePath: './data/historic_points.geojson',
    geometryType: 'Point',
    analysisMethod: 'proximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 200,
    properties: {
      displayField: 'RESNAME',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#8B4513',
      fillColor: '#8B4513',
      radius: 3,
      fillOpacity: 0.8,
      weight: 1
    },
    resultStyle: 'list',
    enabled: true
  },

  epaSuperFundSites: {
    id: 'epaSuperFundSites',
    name: 'EPA Superfund Sites',
    category: 'Environment & Recreation',
    filePath: './data/epa_superfund_sites.geojson',
    geometryType: 'Point',
    analysisMethod: 'proximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 200,
    properties: {
      displayField: 'PRIMARY_NAME',  // Use correct field name
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#FF4500',
      fillColor: '#FF4500',
      radius: 4,
      fillOpacity: 0.8,
      weight: 1
    },
    resultStyle: 'list',
    enabled: true
  }
};
