# Project Application Tool
Memphis MPO project application map assistant

## Overview
An interactive web-based tool for analyzing transportation projects in the Memphis metropolitan area. Draw corridor projects or point locations to automatically identify intersecting MATA routes, opportunity zones, and nearby bridges.

## Features

### Core Functionality
- **Interactive Drawing Tools**: Draw lines for corridor projects or points for intersection/spot improvements
- **Automatic Analysis**: Results update automatically when you finish drawing
- **Route Detection**: Identifies MATA routes running parallel for at least 300ft
- **Opportunity Zone Analysis**: Detects intersecting census tracts designated as opportunity zones
- **Bridge Proximity**: Finds bridges within 300 feet of the project alignment

### PDF Report Generation
- **Professional Reports**: Generate comprehensive PDF reports with:
  - Project name displayed prominently
  - Map showing project location with all intersecting features
  - Detailed analysis results (routes, zones, bridges)
  - Project length in miles (for corridor projects)
  - Generation date and metadata

### User Experience
- **Welcome Tutorial**: First-time visitors see helpful instructions on how to use the tool
- **Optimized Map Views**: Project features are automatically centered in PDF reports
- **Layer Controls**: Toggle visibility of routes, zones, and bridges
- **Responsive Design**: Optimized for desktop browsers (minimum 1024px width)

## Recent Updates
- **Improved PDF Layout**: Project name now appears as the main title with enhanced styling
- **Project Length Display**: Corridor projects show length in miles (to one decimal place) in PDF reports
- **Better Map Centering**: Projects are now properly centered in PDF map views instead of appearing off-center
- **Welcome Tutorial**: New users see a helpful popup with basic instructions on first visit

## Usage
1. Open the tool in a desktop browser
2. Use the drawing tools to create your project:
   - **Draw Alignment (Line)**: For corridor projects along roadways
   - **Mark Location (Point)**: For intersection or spot improvements
3. Review the analysis results in the sidebar
4. Enter a project name and download the PDF report

## Technical Details
- Built with Leaflet.js for interactive mapping
- Uses Turf.js for spatial analysis
- Generates PDF reports with jsPDF and html2canvas
- Data includes MATA routes, opportunity zones, and bridge infrastructure
