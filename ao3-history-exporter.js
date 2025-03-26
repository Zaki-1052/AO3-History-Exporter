// ==UserScript==
// @name         AO3 History Exporter
// @namespace    https://github.com/Zaki-1052/ao3-history-exporter
// @version      1.0.0
// @description  Extract and analyze your AO3 reading history with pause/resume functionality
// @author       Zaki-1052
// @match        *://archiveofourown.org/users/*/readings*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    
    // First, inject the CSS styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
    .ao3-history-explorer {
      margin: 20px 0;
      padding: 15px;
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-family: 'Lucida Grande', 'Lucida Sans Unicode', 'GNU Unifont', Verdana, Helvetica, sans-serif;
    }

    .ao3he-button {
      padding: 8px 15px;
      font-size: 14px;
      cursor: pointer;
      background-color: #990000;
      color: #000; /* Changed to black for better readability */
      border: 1px solid #700;
      border-radius: 3px;
      font-weight: bold; /* Added for better visibility */
    }

    .ao3he-button:hover {
      background-color: #700;
    }

    .ao3he-button:disabled {
      background-color: #cc9999;
      cursor: not-allowed;
    }

    .ao3he-progress-container {
      margin-top: 15px;
    }

    .ao3he-progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 14px;
    }

    .ao3he-progress-bar-container {
      height: 20px;
      background-color: #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .ao3he-progress-bar {
      height: 100%;
      background-color: #5cb85c;
      transition: width 0.3s ease;
    }

    .ao3he-progress-controls {
      text-align: right;
      margin-bottom: 10px;
    }

    .ao3he-cancel-button, .ao3he-pause-button {
      padding: 5px 10px;
      font-size: 12px;
      background-color: #f0ad4e;
      color: #000; /* Changed to black for better readability */
      border: 1px solid #eea236;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold; /* Added for better visibility */
    }

    .ao3he-cancel-button:hover, .ao3he-pause-button:hover {
      background-color: #ec971f;
    }

    .ao3he-status-message {
      margin-top: 10px;
      padding: 8px;
      background-color: #f8f8f8;
      border-left: 3px solid #f0ad4e;
      color: #333; /* Darkened for better visibility */
      font-style: italic;
    }

    .ao3he-download-container {
      text-align: center;
    }

    .ao3he-download-options {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 10px;
    }

    .ao3he-download-button,
    .ao3he-webapp-button {
      text-decoration: none;
      padding: 8px 15px;
      display: inline-block;
      background-color: #5cb85c;
      color: #000; /* Changed to black for better readability */
      border: 1px solid #4cae4c;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold; /* Added for better visibility */
    }

    .ao3he-download-button:hover,
    .ao3he-webapp-button:hover {
      background-color: #449d44;
    }
    
    .ao3he-paused-container {
      margin-top: 10px;
      padding: 8px;
      background-color: #fcf8e3;
      border: 1px solid #faebcc;
      border-radius: 3px;
      text-align: center;
    }
    
    .ao3he-paused-options {
      margin-top: 10px;
    }
    `;
    document.head.appendChild(styleElement);

    // ----- State Variables ----- //
    let isExtracting = false;
    let shouldCancel = false;
    let isPaused = false;  // New variable to track pause state
    let partialWorks = []; // Store partial results
    let currentExtractionPage = 1; // Track current page for resuming

    // ----- UI Functions ----- //
    function initUI() {
      // Create UI container
      const uiContainer = document.createElement('div');
      uiContainer.id = 'ao3-history-explorer';
      uiContainer.className = 'ao3-history-explorer';
      
      // Add to the page
      const targetElement = document.querySelector('.dashboard.readings-index .navigation.actions');
      if (targetElement) {
        targetElement.parentNode.insertBefore(uiContainer, targetElement.nextSibling);
        populateUIContainer(uiContainer);
      }
    }

    function populateUIContainer(container) {
      // Create extraction button
      const button = document.createElement('button');
      button.className = 'action ao3he-button';
      button.textContent = 'Export Reading History';
      button.addEventListener('click', startExtractionProcess);
      
      // Create progress elements (initially hidden)
      const progressContainer = document.createElement('div');
      progressContainer.className = 'ao3he-progress-container';
      progressContainer.style.display = 'none';
      
      // In populateUIContainer function, modify the progress controls
      progressContainer.innerHTML = `
      <div class="ao3he-progress-info">
        <span class="ao3he-progress-text">Preparing...</span>
        <span class="ao3he-progress-percentage">0%</span>
      </div>
      <div class="ao3he-progress-bar-container">
        <div class="ao3he-progress-bar" style="width: 0%"></div>
      </div>
      <div class="ao3he-progress-controls">
        <button class="action ao3he-pause-button">Pause</button>
        <button class="action ao3he-cancel-button">Cancel</button>
      </div>
      `;

      // Add event listener for pause button
      const pauseButton = progressContainer.querySelector('.ao3he-pause-button');
      pauseButton.addEventListener('click', togglePauseExtractionProcess);
      
      // Add elements to the container
      container.appendChild(button);
      container.appendChild(progressContainer);
      
      // Create status message div (initially hidden)
      const statusMessage = document.createElement('div');
      statusMessage.className = 'ao3he-status-message';
      statusMessage.style.display = 'none'; // Initially hidden
      container.appendChild(statusMessage);
      
      // Add event listener for cancel button
      const cancelButton = progressContainer.querySelector('.ao3he-cancel-button');
      cancelButton.addEventListener('click', cancelExtractionProcess);
    }

    // ----- Extraction Process Control ----- //
    async function startExtractionProcess() {
      if (isExtracting) return;
      
      isExtracting = true;
      shouldCancel = false;
      isPaused = false;
      partialWorks = [];
      currentExtractionPage = 1;
      
      // Show progress UI
      const progressContainer = document.querySelector('.ao3he-progress-container');
      const button = document.querySelector('.ao3he-button');
      
      // Reset and hide status message
      hideStatusMessage();
      
      progressContainer.style.display = 'block';
      button.disabled = true;
      
      try {
        // Get total pages
        const totalPages = getTotalPages();
        updateProgressUI(0, totalPages);
        
        // Start collecting data
        const allWorks = await collectAllHistoryData(totalPages);
        
        if (shouldCancel) {
          // Offer partial results if we have any
          if (partialWorks.length > 0) {
            showStatusMessage(`Process cancelled. The data collected so far has been saved.`);
            offerDownload(partialWorks, true);
          } else {
            resetUI();
          }
          return;
        }
        
        // Check if we paused during collection
        if (isPaused) {
          showStatusMessage(`Process paused. Click Resume to continue from page ${currentExtractionPage}.`);
          offerPausedDownload(partialWorks);
          return;
        }
        
        // Process completed - offer download
        hideStatusMessage(); // Clear any status messages on success
        offerDownload(allWorks);
        
      } catch (error) {
        console.error('Extraction failed:', error);
        updateProgressUI(0, 0, 'Error: ' + error.message);
        
        // Offer partial download if we have any data
        if (partialWorks.length > 0) {
          showStatusMessage(`Some pages failed to load. The data collected so far has been saved.`);
          offerDownload(partialWorks, true);
        }
      } finally {
        // Only if we're not paused, consider the extraction complete
        if (!isPaused) {
          isExtracting = false;
          button.disabled = false;
        }
      }
    }

    function cancelExtractionProcess() {
      shouldCancel = true;
      updateProgressUI(0, 0, 'Cancelling...');
      showStatusMessage('Cancelling extraction process...');
    }

    function resetUI() {
      const progressContainer = document.querySelector('.ao3he-progress-container');
      const button = document.querySelector('.ao3he-button');
      
      progressContainer.style.display = 'none';
      button.disabled = false;
      hideStatusMessage();
    }

    // ----- UI Update Functions ----- //
    function updateProgressUI(currentPage, totalPages, customText = null) {
      const progressText = document.querySelector('.ao3he-progress-text');
      const progressPercentage = document.querySelector('.ao3he-progress-percentage');
      const progressBar = document.querySelector('.ao3he-progress-bar');
      
      if (!progressText || !progressPercentage || !progressBar) return;
      
      if (customText) {
        progressText.textContent = customText;
        return;
      }
      
      const percentage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      
      progressText.textContent = `Processing page ${currentPage} of ${totalPages}`;
      progressPercentage.textContent = `${percentage}%`;
      progressBar.style.width = `${percentage}%`;
    }

    function showStatusMessage(message) {
      const statusMessage = document.querySelector('.ao3he-status-message');
      if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.style.display = 'block';
      }
    }

    function hideStatusMessage() {
      const statusMessage = document.querySelector('.ao3he-status-message');
      if (statusMessage) {
        statusMessage.textContent = '';
        statusMessage.style.display = 'none';
      }
    }

    // ----- Page & Data Functions ----- //
    function getTotalPages() {
      const pagination = document.querySelector('ol.pagination');
      if (!pagination) return 1;
      
      const pageLinks = pagination.querySelectorAll('li a');
      if (pageLinks.length === 0) return 1;
      
      // Find the highest page number
      let maxPage = 1;
      pageLinks.forEach(link => {
        const pageNum = parseInt(link.textContent);
        if (!isNaN(pageNum) && pageNum > maxPage) {
          maxPage = pageNum;
        }
      });
      
      return maxPage;
    }

    async function collectAllHistoryData(totalPages, startPage = 1) {
      let allWorks = [...partialWorks]; // Use any existing works
      let currentPage = startPage;
      let failedPages = [];
      
      // First pass - collect as much as we can
      while (currentPage <= totalPages && !shouldCancel && !isPaused) {
        try {
          // Store the current page for potential resumption
          currentExtractionPage = currentPage;
          
          updateProgressUI(currentPage, totalPages);
          
          // Get the HTML for this page
          const pageDoc = await fetchHistoryPage(currentPage);
          
          // Extract works data from the page
          const pageWorks = extractWorksFromPage(pageDoc, currentPage);
          allWorks = [...allWorks, ...pageWorks];
          
          // Store partial results
          partialWorks = allWorks;
          
          // Hide any status messages when the page loads successfully
          hideStatusMessage();
          
          // Move to next page
          currentPage++;
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 600));
          
        } catch (error) {
          console.error(`Error on page ${currentPage}:`, error);
          
          // Check if we paused during a fetch/retry
          if (isPaused || (error.message && error.message.includes('Paused'))) {
            showStatusMessage(`Extraction paused at page ${currentPage}. Click Resume to continue.`);
            return allWorks;
          }
          
          // Record failed page and continue
          failedPages.push(currentPage);
          currentPage++;
          
          updateProgressUI(currentPage - 1, totalPages, `Error on page ${currentPage - 1}, continuing...`);
          showStatusMessage(`Failed to load page ${currentPage - 1}. Continuing with next page...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // If paused during processing, exit the loop
        if (isPaused) {
          return allWorks;
        }
      }
      
      // Return what we have if cancelled, paused, or no failed pages
      if (shouldCancel || isPaused || failedPages.length === 0) {
        return allWorks;
      }
      
      // Second pass - retry failed pages
      if (failedPages.length > 0) {
        updateProgressUI(0, totalPages, `Retrying ${failedPages.length} failed pages...`);
        showStatusMessage(`Retrying ${failedPages.length} failed pages...`);
        
        for (let i = 0; i < failedPages.length && !shouldCancel && !isPaused; i++) {
          const page = failedPages[i];
          
          try {
            updateProgressUI(0, totalPages, `Retry page ${page} (${i+1}/${failedPages.length})...`);
            showStatusMessage(`Retrying page ${page} (${i+1}/${failedPages.length})...`);
            
            const pageDoc = await fetchHistoryPage(page);
            const pageWorks = extractWorksFromPage(pageDoc, page);
            allWorks = [...allWorks, ...pageWorks];
            
            // Update partial results
            partialWorks = allWorks;
            
            // Clear the status message on success
            showStatusMessage(`Successfully loaded page ${page} on retry. Continuing...`);
            
            // Small delay between retries
            await new Promise(resolve => setTimeout(resolve, 300));
            
          } catch (error) {
            // Check if we paused during a fetch/retry
            if (isPaused || (error.message && error.message.includes('Paused'))) {
              showStatusMessage(`Extraction paused during retry for page ${page}. Click Resume to continue.`);
              return allWorks;
            }
            
            console.error(`Final retry failed for page ${page}:`, error);
            showStatusMessage(`Failed to load page ${page} after multiple attempts.`);
            // Continue with what we have
          }
          
          // If paused during retry phase, exit the loop
          if (isPaused) {
            return allWorks;
          }
        }
        
        if (!shouldCancel && !isPaused) {
          showStatusMessage(`Retry process complete. ${failedPages.length - (failedPages.length - allWorks.length)} pages recovered.`);
        }
      }
      
      return allWorks;
    }

    async function fetchHistoryPage(page, retryCount = 0) {
      const MAX_RETRIES = 5;
      const RETRY_DELAY = 3000; // 3 second delay between retries
      
      // Check if paused before starting
      if (isPaused) {
        throw new Error(`Paused before fetching page ${page}`);
      }
      
      try {
        const currentPath = window.location.pathname;
        const basePath = currentPath.includes('?') 
          ? currentPath.split('?')[0] 
          : currentPath;
        
        const url = `${basePath}?page=${page}`;
        
        // Create a more browser-like request
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'X-Requested-With': 'XMLHttpRequest'
          },
          redirect: 'follow',
          referrerPolicy: 'same-origin'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const html = await response.text();
        const parser = new DOMParser();
        return parser.parseFromString(html, 'text/html');
      } catch (error) {
        console.error(`Fetch error (attempt ${retryCount + 1}):`, error);
        
        // Check if paused after error occurs
        if (isPaused) {
          updateProgressUI(page, getTotalPages(), 'Paused...');
          showStatusMessage(`Extraction paused during fetch of page ${page}. Click Resume to continue.`);
          throw new Error(`Paused during fetch of page ${page}`);
        }
        
        if (retryCount < MAX_RETRIES) {
          // Update UI to show retry
          updateProgressUI(page, getTotalPages(), `Retrying page ${page} (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          showStatusMessage(`Network error on page ${page}. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          
          // Wait before retrying with exponential backoff, checking pause state during wait
          const backoffDelay = RETRY_DELAY * Math.pow(2, retryCount);
          const startTime = Date.now();
          
          // Use a polling approach to check pause state during the delay
          while (Date.now() - startTime < backoffDelay) {
            // Exit if paused during the wait
            if (isPaused) {
              updateProgressUI(page, getTotalPages(), 'Paused...');
              showStatusMessage(`Extraction paused during retry delay for page ${page}. Click Resume to continue.`);
              throw new Error(`Paused during retry delay for page ${page}`);
            }
            // Small sleep to avoid tight loop
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Check pause state again before initiating retry
          if (isPaused) {
            updateProgressUI(page, getTotalPages(), 'Paused...');
            showStatusMessage(`Extraction paused before retry for page ${page}. Click Resume to continue.`);
            throw new Error(`Paused before retry for page ${page}`);
          }
          
          // Retry with incremented counter
          return fetchHistoryPage(page, retryCount + 1);
        }
        
        // Max retries reached, throw error
        throw new Error(`Failed to fetch page ${page} after ${MAX_RETRIES} attempts: ${error.message}`);
      }
    }

    // ----- Data Extraction Functions ----- //
    function extractWorksFromPage(document, pageNumber) {
      const workElements = document.querySelectorAll('li.reading.work.blurb');
      return Array.from(workElements).map(element => extractWorkData(element, pageNumber));
    }

    function extractWorkData(workElement, pageNumber) {
      try {
        // Basic work information
        const id = workElement.id.replace('work_', '');
        
        // Title and link
        const titleElement = workElement.querySelector('.heading a');
        const title = titleElement ? titleElement.textContent.trim() : 'Unknown Title';
        const workUrl = titleElement ? titleElement.getAttribute('href') : null;
        
        // Author information
        const authorElement = workElement.querySelector('a[rel="author"]');
        const author = authorElement ? authorElement.textContent.trim() : 'Anonymous';
        const authorUrl = authorElement ? authorElement.getAttribute('href') : null;
        
        // Fandoms
        const fandomElements = workElement.querySelectorAll('.fandoms.heading a');
        const fandoms = Array.from(fandomElements).map(el => ({
          name: el.textContent.trim(),
          url: el.getAttribute('href')
        }));
        
        // Required tags
        const ratingElement = workElement.querySelector('.rating');
        const rating = ratingElement ? (ratingElement.getAttribute('title') || ratingElement.textContent.trim()) : 'Unknown';
        
        const warningElement = workElement.querySelector('.warnings');
        const warning = warningElement ? (warningElement.getAttribute('title') || warningElement.textContent.trim()) : 'Unknown';
        
        const categoryElement = workElement.querySelector('.category');
        const category = categoryElement ? (categoryElement.getAttribute('title') || categoryElement.textContent.trim()) : 'Unknown';
        
        const completionElement = workElement.querySelector('.iswip');
        const completion = completionElement ? (completionElement.getAttribute('title') || completionElement.textContent.trim()) : 'Unknown';
        
        // Summary - Fixed selector based on the actual HTML structure
        const summaryElement = workElement.querySelector('blockquote.userstuff.summary');
        const summary = summaryElement ? summaryElement.innerHTML.trim() : '';
        
        // Tags - explicitly separated by category
        const relationshipTags = Array.from(workElement.querySelectorAll('.tags .relationships a')).map(el => ({
          name: el.textContent.trim(),
          url: el.getAttribute('href')
        }));
        
        const characterTags = Array.from(workElement.querySelectorAll('.tags .characters a')).map(el => ({
          name: el.textContent.trim(),
          url: el.getAttribute('href')
        }));
        
        const freeformTags = Array.from(workElement.querySelectorAll('.tags .freeforms a')).map(el => ({
          name: el.textContent.trim(),
          url: el.getAttribute('href')
        }));
        
        // Additional warning tags
        const warningTags = Array.from(workElement.querySelectorAll('.tags .warnings a')).map(el => ({
          name: el.textContent.trim(),
          url: el.getAttribute('href')
        }));
        
        // Stats
        const wordCountElement = workElement.querySelector('dd.words');
        const wordCount = wordCountElement ? extractNumber(wordCountElement.textContent) : 0;
        
        const chapterElement = workElement.querySelector('dd.chapters');
        const chapters = chapterElement ? chapterElement.textContent.trim() : '?/?';
        
        const kudosElement = workElement.querySelector('dd.kudos');
        const kudos = kudosElement ? extractNumber(kudosElement.textContent) : 0;
        
        const commentsElement = workElement.querySelector('dd.comments');
        const comments = commentsElement ? extractNumber(commentsElement.textContent) : 0;
        
        const bookmarksElement = workElement.querySelector('dd.bookmarks');
        const bookmarks = bookmarksElement ? extractNumber(bookmarksElement.textContent) : 0;
        
        const hitsElement = workElement.querySelector('dd.hits');
        const hits = hitsElement ? extractNumber(hitsElement.textContent) : 0;
        
        // Language
        const languageElement = workElement.querySelector('dd.language');
        const language = languageElement ? languageElement.textContent.trim() : 'Unknown';
        
        // Date published
        const dateElement = workElement.querySelector('p.datetime');
        const publishDate = dateElement ? dateElement.textContent.trim() : 'Unknown';
        
        // User-specific data
        const viewedElement = workElement.querySelector('.viewed.heading');
        const lastVisited = viewedElement ? extractLastVisited(viewedElement.textContent) : 'Unknown';
        const visits = viewedElement ? extractVisitCount(viewedElement.textContent) : 0;
        
        // Series information
        const seriesElement = workElement.querySelector('.series a');
        const series = seriesElement ? {
          name: seriesElement.textContent.trim(),
          url: seriesElement.getAttribute('href'),
          part: workElement.querySelector('.series li strong')?.textContent.trim() || 'Unknown'
        } : null;
        
        return {
          id,
          pageNumber, // Track which page this came from for debugging
          title,
          url: workUrl,
          author,
          authorUrl,
          fandoms,
          rating,
          warning,
          category,
          completion,
          summary,
          tags: {
            warnings: warningTags,
            relationships: relationshipTags,
            characters: characterTags,
            freeforms: freeformTags
          },
          stats: {
            wordCount,
            chapters,
            kudos,
            comments,
            bookmarks,
            hits,
            language,
            publishDate
          },
          userStats: {
            lastVisited,
            visits
          },
          series
        };
      } catch (error) {
        console.error('Error extracting work data:', error);
        return {
          id: workElement.id.replace('work_', ''),
          pageNumber,
          error: 'Failed to extract complete data',
          errorDetails: error.message
        };
      }
    }

    // ----- Helper Functions ----- //
    function extractLastVisited(text) {
      if (!text) return 'Unknown';
      
      const match = text.match(/Last visited:\s*([^(]+)/);
      return match ? match[1].trim() : 'Unknown';
    }

    function extractVisitCount(text) {
      if (!text) return 0;
      
      if (text.includes('Visited once')) {
        return 1;
      }
      
      const match = text.match(/Visited (\d+) times/);
      return match ? parseInt(match[1]) : 0;
    }

    function extractNumber(text) {
      if (!text) return 0;
      
      const matches = text.match(/[\d,]+/g);
      return matches ? parseInt(matches.join('').replace(/,/g, '')) : 0;
    }

    // ----- Download Functions ----- //
    function offerDownload(works, isPartial = false) {
      // Prepare the JSON data
      const jsonData = JSON.stringify(works, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download button
      const downloadContainer = document.createElement('div');
      downloadContainer.className = 'ao3he-download-container';
      
      const fileName = isPartial ? 'ao3_history_partial.json' : 'ao3_history.json';
      
      downloadContainer.innerHTML = `
        <p>${isPartial ? 'Collected partial data:' : 'Successfully collected'} ${works.length} works!</p>
        <div class="ao3he-download-options">
          <a href="${url}" download="${fileName}" class="action ao3he-download-button">Download JSON</a>
          <button class="action ao3he-webapp-button">Open in Web App</button>
        </div>
      `;
      
      // Update the progress container
      const progressContainer = document.querySelector('.ao3he-progress-container');
      progressContainer.innerHTML = '';
      progressContainer.appendChild(downloadContainer);
      
      // Add event listener for web app button
      const webAppButton = downloadContainer.querySelector('.ao3he-webapp-button');
      webAppButton.addEventListener('click', () => {
        // Base64 encode the data for URL parameter
        const encodedData = btoa(unescape(encodeURIComponent(jsonData)));
        
        // Open the web app with the data
        // Note: Replace with actual web app URL when available
        window.open(`https://ao3-history.nazalibhai.com/?data=${encodedData}`, '_blank');
      });
    }

    function togglePauseExtractionProcess() {
      const pauseButton = document.querySelector('.ao3he-pause-button');
      if (!pauseButton) return;
      
      isPaused = !isPaused;
      
      if (isPaused) {
        // Pause the extraction
        pauseButton.textContent = 'Resume';
        updateProgressUI(currentExtractionPage, getTotalPages(), 'Paused...');
        showStatusMessage(`Extraction paused. Click Resume to continue from page ${currentExtractionPage}.`);
      } else {
        // Resume the extraction
        pauseButton.textContent = 'Pause';
        updateProgressUI(currentExtractionPage, getTotalPages());
        showStatusMessage(`Resuming extraction from page ${currentExtractionPage}...`);
        
        // Restart the collection process from where we left off
        continueExtractionProcess();
      }
    }

    async function continueExtractionProcess() {
      if (!isExtracting) return;
      
      try {
        const totalPages = getTotalPages();
        
        // Remove any existing paused download container since we're continuing
        const pausedContainer = document.querySelector('.ao3he-paused-container');
        if (pausedContainer) {
          pausedContainer.remove();
        }
        
        const remainingWorks = await collectAllHistoryData(totalPages, currentExtractionPage);
        
        if (shouldCancel) {
          if (partialWorks.length > 0) {
            showStatusMessage(`Process cancelled. The data collected so far has been saved.`);
            offerDownload(partialWorks, true);
          } else {
            resetUI();
          }
          return;
        }
        
        if (isPaused) {
          // If paused again during continuation, maintain the pause UI
          showStatusMessage(`Process paused. Click Resume to continue from page ${currentExtractionPage}.`);
          offerPausedDownload(partialWorks);
          return;
        }
        
        // Process completed - offer download
        hideStatusMessage();
        offerDownload(partialWorks);
        
      } catch (error) {
        console.error('Extraction failed:', error);
        updateProgressUI(0, 0, 'Error: ' + error.message);
        
        // Offer partial download if we have any data
        if (partialWorks.length > 0) {
          showStatusMessage(`Some pages failed to load. The data collected so far has been saved.`);
          offerDownload(partialWorks, true);
        }
      } finally {
        // Only if we're not paused, consider the extraction complete
        if (!isPaused) {
          isExtracting = false;
          const button = document.querySelector('.ao3he-button');
          if (button) button.disabled = false;
        }
      }
    }

    // Create a new function to handle the paused state UI
    function offerPausedDownload(works) {
      // Prepare the JSON data for potential download
      const jsonData = JSON.stringify(works, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create UI for paused state
      const pausedContainer = document.createElement('div');
      pausedContainer.className = 'ao3he-paused-container';
      
      pausedContainer.innerHTML = `
        <p>Paused at page ${currentExtractionPage}. Collected ${works.length} works so far.</p>
        <div class="ao3he-paused-options">
          <a href="${url}" download="ao3_history_partial.json" class="action ao3he-download-button">Download Partial JSON</a>
        </div>
      `;
      
      // Add below the progress bar but keep progress UI intact
      const progressContainer = document.querySelector('.ao3he-progress-container');
      const existingPausedContainer = progressContainer.querySelector('.ao3he-paused-container');
      
      // Only add if it doesn't exist yet
      if (!existingPausedContainer) {
        // Get the progress bar container to insert after
        const progressBarContainer = progressContainer.querySelector('.ao3he-progress-bar-container');
        if (progressBarContainer) {
          progressBarContainer.insertAdjacentElement('afterend', pausedContainer);
        } else {
          progressContainer.appendChild(pausedContainer);
        }
      }
    }

    // Initialize the script based on document readiness
    function init() {
      // Only run on history pages
      if (window.location.pathname.includes('/readings')) {
        initUI();
      }
    }

    // Run the script when the document is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      init();
    } else {
      document.addEventListener('DOMContentLoaded', init);
    }
})();