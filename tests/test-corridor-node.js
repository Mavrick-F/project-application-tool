/**
 * Node.js test runner for corridor detection algorithm
 * Run with: node test-corridor-node.js
 */

const turf = require('@turf/turf');

// ============================================
// HELPER FUNCTIONS (from index.html)
// ============================================

function normalizeToLineStrings(feature) {
    const geom = feature.geometry || feature;
    if (geom.type === 'LineString') {
        return [turf.lineString(geom.coordinates)];
    } else if (geom.type === 'MultiLineString') {
        return geom.coordinates.map(coords => turf.lineString(coords));
    }
    return [];
}

// ============================================
// CURRENT ALGORITHM (BROKEN)
// ============================================

function analyzeCorridorMatch_CURRENT(drawnGeometry, bufferDistance, minSharedLength, routeFeature) {
    const geometry = drawnGeometry.type === 'Feature' ? drawnGeometry.geometry : drawnGeometry;

    if (geometry.type !== 'LineString') return { match: false, overlap: 0 };

    const corridorBuffer = turf.buffer(geometry, bufferDistance, { units: 'feet' });

    if (!turf.booleanIntersects(corridorBuffer, routeFeature)) {
        return { match: false, overlap: 0 };
    }

    const routeLines = normalizeToLineStrings(routeFeature);
    let totalOverlap = 0;

    for (const routeLine of routeLines) {
        const routeCoords = turf.getCoords(routeLine);
        for (let i = 0; i < routeCoords.length - 1; i++) {
            const segment = turf.lineString([routeCoords[i], routeCoords[i + 1]]);

            // BUG: Adds FULL segment length, not just portion inside buffer
            if (turf.booleanIntersects(segment, corridorBuffer)) {
                totalOverlap += turf.length(segment, { units: 'feet' });
            }
        }
    }

    return {
        match: totalOverlap >= minSharedLength,
        overlap: totalOverlap
    };
}

// ============================================
// PROPOSED FIX: Segment Clipping Algorithm
// ============================================

/**
 * Calculate the length of a line segment that falls inside a polygon buffer.
 * Uses polygon boundary intersection to find exact entry/exit points.
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
        return startInside ? segmentLength : 0;
    }

    // Calculate distance along segment for each intersection point
    const distances = [];
    for (const pt of intersections.features) {
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
        inside = !inside;
    }

    // Handle final segment from last crossing to end
    if (inside) {
        totalInside += segmentLength - prevDist;
    }

    return Math.max(0, totalInside);
}

function analyzeCorridorMatch_FIXED(drawnGeometry, bufferDistance, minSharedLength, routeFeature) {
    const geometry = drawnGeometry.type === 'Feature' ? drawnGeometry.geometry : drawnGeometry;

    if (geometry.type !== 'LineString') return { match: false, overlap: 0 };

    const corridorBuffer = turf.buffer(geometry, bufferDistance, { units: 'feet' });

    if (!turf.booleanIntersects(corridorBuffer, routeFeature)) {
        return { match: false, overlap: 0 };
    }

    const routeLines = normalizeToLineStrings(routeFeature);
    let totalOverlap = 0;

    for (const routeLine of routeLines) {
        const routeCoords = turf.getCoords(routeLine);

        for (let i = 0; i < routeCoords.length - 1; i++) {
            const segment = turf.lineString([routeCoords[i], routeCoords[i + 1]]);

            if (!turf.booleanIntersects(segment, corridorBuffer)) {
                continue;
            }

            const insideLength = measureSegmentInsideBuffer(segment, corridorBuffer);
            totalOverlap += insideLength;
        }

        if (totalOverlap >= minSharedLength) {
            break;
        }
    }

    return {
        match: totalOverlap >= minSharedLength,
        overlap: totalOverlap
    };
}

// ============================================
// TEST UTILITIES
// ============================================

function createEWLine(centerLon, lat, lengthFeet) {
    const degreesPerFoot = 1 / 288200;
    const halfLength = (lengthFeet / 2) * degreesPerFoot;
    return turf.lineString([
        [centerLon - halfLength, lat],
        [centerLon + halfLength, lat]
    ]);
}

function createNSLine(lon, centerLat, lengthFeet) {
    const degreesPerFoot = 1 / 364000;
    const halfLength = (lengthFeet / 2) * degreesPerFoot;
    return turf.lineString([
        [lon, centerLat - halfLength],
        [lon, centerLat + halfLength]
    ]);
}

function createAngledLine(startLon, startLat, lengthFeet, angleDegrees) {
    const lonDegreesPerFoot = 1 / 288200;
    const latDegreesPerFoot = 1 / 364000;
    const angleRad = (angleDegrees * Math.PI) / 180;

    const dx = Math.cos(angleRad) * lengthFeet * lonDegreesPerFoot;
    const dy = Math.sin(angleRad) * lengthFeet * latDegreesPerFoot;

    return turf.lineString([
        [startLon, startLat],
        [startLon + dx, startLat + dy]
    ]);
}

function offsetLine(line, offsetFeet, direction = 'north') {
    const coords = turf.getCoords(line);
    const latDegreesPerFoot = 1 / 364000;
    const lonDegreesPerFoot = 1 / 288200;

    const offset = direction === 'north' || direction === 'south'
        ? offsetFeet * latDegreesPerFoot * (direction === 'north' ? 1 : -1)
        : offsetFeet * lonDegreesPerFoot * (direction === 'east' ? 1 : -1);

    const newCoords = coords.map(coord => {
        if (direction === 'north' || direction === 'south') {
            return [coord[0], coord[1] + offset];
        } else {
            return [coord[0] + offset, coord[1]];
        }
    });

    return turf.lineString(newCoords);
}

// ============================================
// TEST CASES
// ============================================

const TEST_CASES = [
    {
        name: "Parallel route 50ft away, 800ft overlap",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 1000);
            const route = offsetLine(createEWLine(-90.0, 35.0, 800), 50, 'north');
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: true,
        expectedOverlapMin: 700,
        expectedOverlapMax: 850
    },
    {
        name: "Parallel route entirely within buffer (30ft offset)",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 600);
            const route = offsetLine(createEWLine(-90.0, 35.0, 500), 30, 'north');
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: true,
        expectedOverlapMin: 480,
        expectedOverlapMax: 520
    },
    {
        name: "Perpendicular crossing - short route (200ft)",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 500);
            const route = createNSLine(-90.0, 35.0, 200);
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: false,
        expectedOverlapMin: 0,
        expectedOverlapMax: 250
    },
    {
        name: "Perpendicular crossing - long route (500ft) - THE BUG CASE",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 500);
            const route = createNSLine(-90.0, 35.0, 500);
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: false,
        expectedOverlapMin: 0,
        expectedOverlapMax: 250
    },
    {
        name: "Perpendicular crossing - very long route (1000ft)",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 500);
            const route = createNSLine(-90.0, 35.0, 1000);
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: false,
        expectedOverlapMin: 0,
        expectedOverlapMax: 250
    },
    {
        name: "Route entirely outside buffer",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 500);
            const route = offsetLine(createEWLine(-90.0, 35.0, 500), 200, 'north');
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: false,
        expectedOverlapMin: 0,
        expectedOverlapMax: 0
    },
    {
        name: "Short parallel segment (100ft) - below threshold",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 500);
            const route = offsetLine(createEWLine(-90.0, 35.0, 100), 30, 'north');
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: false,
        expectedOverlapMin: 50,
        expectedOverlapMax: 150
    },
    {
        name: "MultiLineString with mixed segments",
        setup: () => {
            const project = createEWLine(-90.0, 35.0, 1000);
            const route = turf.feature({
                type: 'MultiLineString',
                coordinates: [
                    [[-90.001, 35.00008], [-89.9996, 35.00008]],
                    [[-89.998, 34.999], [-89.998, 35.001]]
                ]
            });
            return { project, route };
        },
        bufferDistance: 100,
        minSharedLength: 300,
        expectedMatch: true,
        expectedOverlapMin: 350,
        expectedOverlapMax: 650
    }
];

// ============================================
// RUN TESTS
// ============================================

console.log('\n=== Corridor Detection Algorithm Test Suite ===\n');

let passCount = 0;
let failCount = 0;
let currentPassCount = 0;

for (const testCase of TEST_CASES) {
    const { project, route } = testCase.setup();

    const currentResult = analyzeCorridorMatch_CURRENT(
        project,
        testCase.bufferDistance,
        testCase.minSharedLength,
        route
    );

    const fixedResult = analyzeCorridorMatch_FIXED(
        project,
        testCase.bufferDistance,
        testCase.minSharedLength,
        route
    );

    const matchCorrect = fixedResult.match === testCase.expectedMatch;
    const overlapInRange = fixedResult.overlap >= testCase.expectedOverlapMin &&
                           fixedResult.overlap <= testCase.expectedOverlapMax;
    const passed = matchCorrect && overlapInRange;

    const currentMatchCorrect = currentResult.match === testCase.expectedMatch;
    const currentOverlapInRange = currentResult.overlap >= testCase.expectedOverlapMin &&
                                   currentResult.overlap <= testCase.expectedOverlapMax;
    const currentPassed = currentMatchCorrect && currentOverlapInRange;

    if (passed) passCount++;
    else failCount++;

    if (currentPassed) currentPassCount++;

    const icon = passed ? '✓' : '✗';
    const color = passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${color}${icon}${reset} ${testCase.name}`);
    console.log(`  Expected: match=${testCase.expectedMatch}, overlap=${testCase.expectedOverlapMin}-${testCase.expectedOverlapMax}ft`);
    console.log(`  Current:  match=${currentResult.match}, overlap=${currentResult.overlap.toFixed(1)}ft ${currentPassed ? '✓' : '✗'}`);
    console.log(`  Fixed:    match=${fixedResult.match}, overlap=${fixedResult.overlap.toFixed(1)}ft ${passed ? '✓' : '✗'}`);
    console.log('');
}

console.log('=== SUMMARY ===');
console.log(`Current algorithm: ${currentPassCount}/${TEST_CASES.length} passing`);
console.log(`Fixed algorithm:   ${passCount}/${TEST_CASES.length} passing`);
console.log('');

if (failCount > 0) {
    console.log('\x1b[31mSome tests failed!\x1b[0m');
    process.exit(1);
} else {
    console.log('\x1b[32mAll tests passed!\x1b[0m');
    process.exit(0);
}
