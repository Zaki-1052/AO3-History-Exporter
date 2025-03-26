// Main content script for AO3 History Explorer

// ----- Initialization ----- //
document.addEventListener('DOMContentLoaded', () => {
  // Only run on history pages
  if (window.location.pathname.includes('/readings')) {
    initUI();
  }
});

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
  
  // Create progress info
  const progressInfo = document.createElement('div');
  progressInfo.className = 'ao3he-progress-info';
  
  const progressText = document.createElement('span');
  progressText.className = 'ao3he-progress-text';
  progressText.textContent = 'Preparing...';
  
  const progressPercentage = document.createElement('span');
  progressPercentage.className = 'ao3he-progress-percentage';
  progressPercentage.textContent = '0%';
  
  progressInfo.appendChild(progressText);
  progressInfo.appendChild(progressPercentage);
  
  // Create progress bar
  const progressBarContainer = document.createElement('div');
  progressBarContainer.className = 'ao3he-progress-bar-container';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'ao3he-progress-bar';
  progressBar.style.width = '0%';
  
  progressBarContainer.appendChild(progressBar);
  
  // Create controls
  const progressControls = document.createElement('div');
  progressControls.className = 'ao3he-progress-controls';
  
  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'action ao3he-pause-button';
  pauseBtn.textContent = 'Pause';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action ao3he-cancel-button';
  cancelBtn.textContent = 'Cancel';
  
  progressControls.appendChild(pauseBtn);
  progressControls.appendChild(cancelBtn);
  
  // Assemble progress container
  progressContainer.appendChild(progressInfo);
  progressContainer.appendChild(progressBarContainer);
  progressContainer.appendChild(progressControls);
  
  // Create status message div (initially hidden)
  const statusMessage = document.createElement('div');
  statusMessage.className = 'ao3he-status-message';
  statusMessage.style.display = 'none'; // Initially hidden
  
  // Add elements to the container
  container.appendChild(button);
  container.appendChild(progressContainer);
  container.appendChild(statusMessage);
  
  // Add event listeners
  pauseBtn.addEventListener('click', togglePauseExtractionProcess);
  cancelBtn.addEventListener('click', cancelExtractionProcess);
}

// ----- Extraction Process Control ----- //
// Add isPaused state variable alongside existing state variables
let isExtracting = false;
let shouldCancel = false;
let isPaused = false;  // New variable to track pause state
let partialWorks = []; // Store partial results
let currentExtractionPage = 1; // Track current page for resuming

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
    
    // Summary - Fixed selector and using textContent instead of innerHTML
    const summaryElement = workElement.querySelector('blockquote.userstuff.summary');
    const summary = summaryElement ? summaryElement.textContent.trim() : '';
    
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
  
  // Create download container
  const downloadContainer = document.createElement('div');
  downloadContainer.className = 'ao3he-download-container';
  
  const fileName = isPartial ? 'ao3_history_partial.json' : 'ao3_history.json';
  
  // Create elements using safe DOM methods
  const statusMsg = document.createElement('p');
  statusMsg.textContent = `${isPartial ? 'Collected partial data:' : 'Successfully collected'} ${works.length} works!`;
  
  const downloadOptions = document.createElement('div');
  downloadOptions.className = 'ao3he-download-options';
  
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = fileName;
  downloadLink.className = 'action ao3he-download-button';
  downloadLink.textContent = 'Download JSON';
  
  const webAppBtn = document.createElement('button');
  webAppBtn.className = 'action ao3he-webapp-button';
  webAppBtn.textContent = 'Open in Web App';
  
  downloadOptions.appendChild(downloadLink);
  downloadOptions.appendChild(webAppBtn);
  
  downloadContainer.appendChild(statusMsg);
  downloadContainer.appendChild(downloadOptions);
  
  // Update the progress container
  const progressContainer = document.querySelector('.ao3he-progress-container');
  // Remove existing content safely
  while (progressContainer.firstChild) {
    progressContainer.removeChild(progressContainer.firstChild);
  }
  progressContainer.appendChild(downloadContainer);
  
  // Add event listener for web app button
  webAppBtn.addEventListener('click', () => {
    // Base64 encode the data for URL parameter
    const encodedData = btoa(unescape(encodeURIComponent(jsonData)));
    
    // Open the web app with the data
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

// Create a function to handle the paused state UI
function offerPausedDownload(works) {
  // Prepare the JSON data for potential download
  const jsonData = JSON.stringify(works, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create UI for paused state
  const pausedContainer = document.createElement('div');
  pausedContainer.className = 'ao3he-paused-container';
  
  // Create elements using safe DOM methods
  const pauseMsg = document.createElement('p');
  pauseMsg.textContent = `Paused at page ${currentExtractionPage}. Collected ${works.length} works so far.`;
  
  const pausedOptions = document.createElement('div');
  pausedOptions.className = 'ao3he-paused-options';
  
  const pausedDownloadLink = document.createElement('a');
  pausedDownloadLink.href = url;
  pausedDownloadLink.download = 'ao3_history_partial.json';
  pausedDownloadLink.className = 'action ao3he-download-button';
  pausedDownloadLink.textContent = 'Download Partial JSON';
  
  pausedOptions.appendChild(pausedDownloadLink);
  
  pausedContainer.appendChild(pauseMsg);
  pausedContainer.appendChild(pausedOptions);
  
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

// Initialize the UI when the script loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initUI();
} else {
  document.addEventListener('DOMContentLoaded', initUI);
}