# Performance Optimization History - High Injury Corridors


## Problem Statement
High Injury Corridors analysis was taking 11.7+ seconds out of 12 total seconds for spatial analysis. This made the tool unusable with long loading times after drawing projects.

## Root Cause
The `projectCoverage` analysis method was using `turf.union()` to combine 279 corridor buffers into a single geometry. This operation has O(n²) complexity - each union operation becomes more expensive as the combined geometry grows more complex.

## Attempted Solutions (All Failed)

### Attempt 1: Cache buffers + simplify feature matching
- **Change**: Cached buffers in a Map, removed per-segment measuring loop
- **Result**: Reduced from 12.5s to ~12s (minimal improvement)
- **Why it failed**: The expensive `turf.union()` operations were still happening

### Attempt 2: Cache Feature Service responses
- **Change**: Implemented promise-based caching to prevent duplicate wetlands queries
- **Result**: Helped with duplicate queries, but didn't solve HIC slowness
- **Side benefit**: Fixed race condition in parallel Feature Service requests

### Attempt 3: Replace buffer union with bbox intersection
- **Change**: Removed all `turf.union()` calls, used simple bounding box overlap checks
- **Result**: Fast (~50ms) but **results were garbage** - percentage calculations were meaningless approximations
- **Why it failed**: Bbox-only checks are too coarse, estimated coverage by feature count ratio was inaccurate
- **User feedback**: "The results are unusable garbage"

### Attempt 4: Add intersection verification to bbox approach
- **Change**: Added `turf.booleanIntersects()` after bbox filter to verify actual overlap
- **Result**: Still produced unreliable results, not accurate enough for real-world use
- **Why it failed**: Removing the precise segment-by-segment measuring broke the accuracy that users depend on

## Conclusion
**There is no fast way to do accurate projectCoverage analysis with 279 complex geometries.**

The original corridor matching approach (used for other datasets) is the correct method. The `projectCoverage` analysis type was a failed experiment that should be removed.

## Lessons Learned
1. Complex geometric operations (union, intersection) on large datasets are fundamentally slow
2. Approximations that sacrifice accuracy are not acceptable for spatial analysis tools
3. Sometimes the slow way is the only correct way
4. When performance optimization breaks correctness, abandon the optimization

## Recommended Action
- Revert High Injury Corridors to use standard `corridor` analysis method
- Remove `projectCoverage` analysis code entirely
- Accept that some analyses will take a few seconds - accuracy matters more than speed
- Consider adding a progress indicator instead of trying to make it instant

## Date
2026-01-15
