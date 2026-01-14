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

  // Drawn geometry style - BOLD RED for maximum visibility
  drawnLineStyle: {
    color: '#FF0000',        // Bright red
    weight: 12,              // Much thicker (was 8)
    opacity: 0.9             // Slightly more opaque
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
  // ========== TRANSPORTATION (7 datasets - alphabetical) ==========

  bridges: {
    id: 'bridges',
    name: 'Bridges',
    category: 'Transportation',
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
      color: '#8B4513',        // Default color, overridden by styleByProperty
      fillColor: '#8B4513',
      radius: 4.5,
      fillOpacity: 0.8,
      weight: 1
    },
    styleByProperty: {  // Color by condition: green for good, yellow for fair, red for poor
      field: 'Condition',
      values: {
        'Good': { color: '#228B22', fillColor: '#228B22' },     // Forest green
        'Fair': { color: '#FFD700', fillColor: '#FFD700' },     // Gold
        'Poor': { color: '#CC0000', fillColor: '#CC0000' }      // Bright red (lighter than project line)
      }
    },
    legendColor: '#999999',    // Gray color for legend only (not on map)
    resultStyle: 'table',
    enabled: true
  },

  crashLocations: {
    id: 'crashLocations',
    name: 'Crash Locations (KSI)',
    category: 'Transportation',
    filePath: './data/ksi_crashes.geojson',
    geometryType: 'Point',
    analysisMethod: 'proximityCount',  // Use counting analysis
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 300,  // 300 feet buffer
    countByField: 'Severity',  // Count by Fatal vs Suspected Serious Injury
    properties: {
      displayField: 'Severity',  // Show severity in tooltip
      additionalFields: ['Fatality_C', 'Injured_Co']  // Show deaths and injuries
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#191970',        // Midnight blue (was dark red #8B0000)
      fillColor: '#191970',
      radius: 2.5,
      fillOpacity: 0.9,
      weight: 1
    },
    resultStyle: 'count',  // Special result style for counts
    enabled: true
  },

  greenprintNetwork: {
    id: 'greenprintNetwork',
    name: 'Greenprint Bike Network',
    category: 'Transportation',
    filePath: './data/greenprint.geojson',
    geometryType: 'LineString',
    analysisMethod: 'corridor',
    bufferDistance: 100,
    minSharedLength: 300,
    proximityBuffer: null,
    properties: {
      displayField: 'Priority_T',  // Show Regional, Intermediate, or Local
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#228B22',  // Default color, overridden by styleByProperty
      weight: 2,
      opacity: 0.8,
      dashArray: '10, 10'  // Dashed line
    },
    styleByProperty: {  // Different colors for Regional, Intermediate, Local
      field: 'Priority_T',
      values: {
        'Regional': { color: '#006400', weight: 3, opacity: 0.8, dashArray: '10, 10' },      // Dark green for Regional
        'Intermediate': { color: '#228B22', weight: 3, opacity: 0.8, dashArray: '10, 10' },  // Medium green for Intermediate
        'Local': { color: '#90EE90', weight: 2, opacity: 0.8, dashArray: '10, 10' }          // Light green for Local
      }
    },
    resultStyle: 'list',
    enabled: true
  },

  highInjuryCorridors: {
    id: 'highInjuryCorridors',
    name: 'High Injury Corridors',
    category: 'Transportation',
    filePath: './data/HIN_Corridors.geojson',
    geometryType: 'LineString',
    analysisMethod: 'corridor',
    bufferDistance: 100,
    minSharedLength: 300,
    proximityBuffer: null,
    properties: {
      displayField: 'OBJECTID',
      staticLabel: 'High Injury Corridor',  // Show static label instead of OBJECTID
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#FFD700',        // Gold/amber (caution color, was dark red #CC0000)
      weight: 3,
      opacity: 0.9
    },
    resultStyle: 'list',
    enabled: true
  },

  mataRoutes: {
    id: 'mataRoutes',
    name: 'MATA Routes',
    category: 'Transportation',
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
    category: 'Transportation',
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
      color: '#8B6914',        // Dark goldenrod (highway brown, was orange #FF6600)
      weight: 3,
      opacity: 0.8
    },
    resultStyle: 'list',
    enabled: true
  },

  travelTimeReliability: {
    id: 'travelTimeReliability',
    name: 'Travel Time Reliability',
    category: 'Transportation',
    filePath: './data/road_congestion.json',
    geometryType: 'LineString',
    analysisMethod: 'corridorLengthByStatus',
    bufferDistance: 100,
    minSharedLength: 300,
    proximityBuffer: null,
    properties: {
      displayField: 'name',
      additionalFields: ['Travel_Time_Index', 'Level_of_Travel_Time_Reliability']
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: true
    },
    style: {
      color: '#808080',
      weight: 3,
      opacity: 0.6
    },
    styleByProperty: {
      field: 'Reliable_Segment_',
      values: {
        'True': { color: '#808080', weight: 3, opacity: 0.6 },
        'False': { color: '#FFD700', weight: 4, opacity: 0.9 }
      }
    },
    resultStyle: 'lengthByStatus',
    hideInPdfRendering: true,
    enabled: true
  },

  // ========== ECONOMIC DEVELOPMENT (6 datasets - alphabetical) ==========

  aliceZctas: {
    id: 'aliceZctas',
    name: 'ALICE ZCTAs',
    category: 'Economic Development',
    filePath: './data/alice_zctas.geojson',
    geometryType: 'Polygon',
    analysisMethod: 'intersection',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: null,
    filterByThreshold: {  // Filter to only show economically distressed areas
      field: 'F__Below_A',  // Fraction of households below ALICE threshold
      operator: '>=',
      value: 0.45,  // 45% threshold
      showTranslucentBelow: true  // Show below-threshold areas as translucent
    },
    properties: {
      displayField: 'GEOID20',  // ZIP Code Tabulation Area ID
      additionalFields: ['F__Below_A'],  // Show percentage in results
      formatPercentage: 'F__Below_A'  // Format this field as percentage
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#9932CC',  // Dark orchid
      weight: 2,
      fillColor: '#DDA0DD',  // Plum
      fillOpacity: 0.4
    },
    styleTranslucent: {  // Style for below-threshold areas (not in report)
      color: '#9932CC',
      weight: 1,
      fillColor: '#DDA0DD',
      fillOpacity: 0.1  // Very translucent
    },
    resultStyle: 'list',
    enabled: true
  },

  freightClusters: {
    id: 'freightClusters',
    name: 'Freight Zones',
    category: 'Economic Development',
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
      color: '#20B2AA',        // Light sea green (was purple #9966CC)
      weight: 2,
      fillColor: '#AFEEEE',    // Pale turquoise (was light purple #CC99FF)
      fillOpacity: 0.3
    },
    resultStyle: 'list',
    enabled: true
  },

  truckRoutes: {
    id: 'truckRoutes',
    name: 'Freight Routes',
    category: 'Economic Development',
    filePath: './data/freight_routes.json',
    geometryType: 'LineString',
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
      color: '#CD853F',  // Default color, overridden by styleByProperty
      weight: 2,
      opacity: 0.7
    },
    styleByProperty: {  // Different colors for Regional vs Local (warm tones to complement teal zones)
      field: 'Type',
      values: {
        'Regional': { color: '#8B4513', weight: 3, opacity: 0.8 },  // Saddle brown (warm, darker complement)
        'Local': { color: '#DEB887', weight: 2, opacity: 0.7 }      // Burlywood (warm, lighter complement)
      }
    },
    resultStyle: 'list',
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

  // ========== ENVIRONMENTAL/CULTURAL (7 datasets - alphabetical) ==========

  criticalWetlands: {
    id: 'criticalWetlands',
    name: 'Critical Wetlands',
    lazyLoad: true,
    category: 'Environmental/Cultural',
    featureServiceUrl: 'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MemphisMPO_Wetlands/FeatureServer/0',
    geometryType: 'Polygon',
    analysisMethod: 'binaryProximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 200,
    analysisFilter: {
      field: 'WETLAND_TY',
      operator: '=',
      value: 'Freshwater Forested/Shrub Wetland'
    },
    properties: {
      displayField: 'WETLAND_TY',
      additionalFields: ['ACRES']
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#32CD32',          // Lime green border (matches fill)
      weight: 0.5,               // Very thin border
      fillColor: '#32CD32',      // Lime green fill
      fillOpacity: 1.0           // 100% opaque - fully solid
    },
    resultStyle: 'binary',
    binaryLabel: 'Within Critical Wetlands',
    enabled: true
  },

  epaSuperFundSites: {
    id: 'epaSuperFundSites',
    name: 'EPA Superfund Sites',
    category: 'Environmental/Cultural',
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
      color: '#000000',
      fillColor: '#000000',
      radius: 5,
      fillOpacity: 0.8,
      weight: 1
    },
    resultStyle: 'list',
    enabled: true
  },

  floodZones: {
    id: 'floodZones',
    name: 'Flood Zones',
    lazyLoad: true,
    category: 'Environmental/Cultural',
    featureServiceUrl: 'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPO_Flood_Zones/FeatureServer/0',
    geometryType: 'Polygon',
    analysisMethod: 'binaryProximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 200,
    properties: {
      displayField: 'FLD_ZONE',
      additionalFields: []
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#00008B',          // Dark blue border
      weight: 4,                 // Thick border
      fillColor: '#87CEEB',      // Sky blue fill
      fillOpacity: 0.35,
      dashArray: '5, 5'          // Regular dashed pattern
    },
    resultStyle: 'binary',
    binaryLabel: 'Within Flood Zone',
    enabled: true
  },

  historicPoints: {
    id: 'historicPoints',
    name: 'NHRP Points',
    category: 'Environmental/Cultural',
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

  historicPolygons: {
    id: 'historicPolygons',
    name: 'NHRP Polygons',
    category: 'Environmental/Cultural',
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

  parks: {
    id: 'parks',
    name: 'Parks',
    category: 'Environmental/Cultural',
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

  wetlands: {
    id: 'wetlands',
    name: 'Wetlands',
    lazyLoad: true,
    category: 'Environmental/Cultural',
    featureServiceUrl: 'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MemphisMPO_Wetlands/FeatureServer/0',
    geometryType: 'Polygon',
    analysisMethod: 'binaryProximity',
    bufferDistance: null,
    minSharedLength: null,
    proximityBuffer: 200,
    properties: {
      displayField: 'WETLAND_TY',
      additionalFields: ['ACRES']
    },
    specialHandling: {
      removeDirectionalSuffixes: false,
      deduplicate: false
    },
    style: {
      color: '#556B2F',          // Olive green border
      weight: 2,
      fillColor: '#6B8E23',      // Olive drab fill
      fillOpacity: 0.4
    },
    resultStyle: 'binary',
    binaryLabel: 'Within Wetlands',
    enabled: true
  }
};
