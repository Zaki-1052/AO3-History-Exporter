# AO3 History Explorer

A tool for exporting and analyzing your Archive of Our Own (AO3) reading history.

![AO3 History Explorer](https://img.shields.io/badge/AO3-History%20Explorer-990000)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Overview

AO3 History Explorer helps you export your entire AO3 reading history to a JSON file, allowing you to analyze your reading habits, search through past works, and create visualizations of your fan fiction preferences.

This tool is available in two formats:
- As a browser extension (for Chrome, Firefox, etc.)
- As a Tampermonkey script (for any browser with Tampermonkey support)

## Features

- **Export Full Reading History**: Captures all works in your AO3 reading history
- **Comprehensive Data**: Extracts detailed information including:
  - Work details (title, author, publication date)
  - Fandom information
  - Tags (relationships, characters, freeforms)
  - Statistics (word count, kudos, comments, etc.)
  - Your personal history (last visit date, visit count)
  - Series information
- **Pause/Resume Functionality**: Handle rate limiting by pausing the extraction and resuming later
- **Partial Results**: Download partial results if the process is interrupted
- **Web App Integration**: Exported data can be loaded into the upcoming web app for analysis (coming soon)

## Installation

### Method 1: Browser Extension (Manual Installation)

1. Download or clone this repository
2. Open your browser's extension management page:
   - Chrome: Navigate to `chrome://extensions/`
   - Firefox: Navigate to `about:addons`
   - Edge: Navigate to `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" (Chrome/Edge) or "Load Temporary Add-on" (Firefox)
5. Select the folder containing this repository

### Method 2: Tampermonkey Script

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. Click on the Tampermonkey icon in your browser and select "Create a new script"
3. Delete any default code
4. Copy and paste the entire contents of `ao3-history-exporter.js` into the editor
5. Click File > Save or press Ctrl+S

## Usage

1. Navigate to your AO3 reading history page (`https://archiveofourown.org/users/USERNAME/readings`)
2. Click the "Export Reading History" button that appears below the navigation
3. Wait while the tool processes each page of your reading history
4. If you encounter rate limiting:
   - Click "Pause" to temporarily stop the process
   - Wait for some time (recommended: at least 30-60 minutes)
   - Return to the page and click "Resume" to continue
5. When complete, click "Download JSON" to save your data

### Handling Large Collections

AO3 may rate-limit requests if you have a very large reading history. Tips:
- Use the pause feature when you notice errors
- Try running the export during off-peak hours
- Consider exporting in smaller batches by using pagination

## Technical Details

The tool works by:
1. Scraping each page of your reading history
2. Extracting structured data from the HTML
3. Compiling all entries into a single JSON file
4. Providing download options

### Project Structure

- `manifest.json` - Extension manifest file
- `content.js` - Main JavaScript for the extension
- `styles.css` - CSS styling for the UI elements
- `ao3-history-exporter.js` - Standalone Tampermonkey script version

## Future Plans

### Web App Integration

A companion web app is under development that will allow you to:
- Upload your exported JSON file
- Visualize your reading patterns
- Filter and search through your history
- Generate statistics about your reading habits
- Create charts and graphs of your fandom preferences

The export tool currently includes a placeholder "Open in Web App" button that will be activated when the web app is released.

## Privacy

This tool runs entirely in your browser. Your reading history data is:
- Never transmitted to any server
- Only saved locally when you download the JSON file
- Not accessible to any third party

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! If you'd like to improve the AO3 History Explorer:
1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Submit a pull request

## Acknowledgments

- [Archive of Our Own (AO3)](https://archiveofourown.org/) for creating an amazing platform for fan works
- All the writers who contribute their creativity to the archive
