const ObjectsToCsv = require('objects-to-csv');
const puppeteer = require('puppeteer');
const { getRandomData, getRandomFilterData } = require('./helper.js');
const EmailService = require('./emailService.js');

// Configuration
const CONFIG = {
  vizpadUrl: process.argv[2] || 'https://galaxyai.bayer.com/dashboard/270c03b/a5986ed7-28c8-4739-bc84-8ef2dfead134?utm_source=546bf610-3e40-4ebb-b57e-78a7f5a076fc',
  tabSwitch: process.argv[4] || 'false',
  enableEmail: process.argv[5] === 'true' || process.env.ENABLE_EMAIL === 'true',
  tabIndex: 0,
  timeouts: {
    navigation: 1000000,
    element: 300000, // 30 seconds for element timeout
    longNavigation: 1000000,
  },
  filterData:[],
  viewport: { width: 1366, height: 768 },
  selectors: {
      chartLoading: 'Vizpad is loading...',
      vizContainer: '.vizContainer',
      highcharts: '.highcharts-container',
      searchInput: "[data-cy-id='cy-search-data']",
      searchValueInput: "[data-cy-id='cy-search-value']",
      checkBox: '.checkbox-available',
      filterApplyBtn: "[data-cy-id='cy-apply-changes']",
      vizpadChart: "[data-cy-id='cy-vzpd-chart11']",
      filterIcon: "[data-testid='viz-filter-icon']",
      filterColumnInput: "[data-cy-id='cy-popup-fltrclmn-input']",
      filterColumnValueInput: "[data-cy-id='cy-popup-rng']",
      filterColumnValue: "[data-cy-id='cy-popup-fltrclmn-item0']",
      operatorInput: "[data-cy-id='cy-popup-rng']",
      dateSelectionType: "[data-cy-id='cy-tmslc-ctr-dttype-slctr']",
      rangeOfDates: "[data-cy-id='cy-tmslc-crnttmrng-rng-of-dts']",
      startDate: "[data-cy-id='cy-tmslc-ctr-strtdt']",
      endDate: "[data-cy-id='cy-tmslc-ctr-enddt']",
      applyTimeFilterBtn: "[data-cy-id='cy-tmslc-aply']",
      applyBtn: "[data-cy-id='cy-popup-aply']",
      tab: "cy-tb"
      

    },
    data: {
      DateColumn: "CONVERSION_DATE"
  },
  delays: {
    pageLoad: 2000,
    },

};

// Performance metrics class
class PerformanceMetrics {
  constructor() {
    this.startTime = new Date();
    this.metrics = [];
    this.errors = [];
  }

  addMetric(userId, metricName, value, timestamp = new Date()) {
    this.metrics.push({
      userId,
      metricName,
      value,
      timestamp,
      duration: this.calculateDuration(timestamp),
    });
  }

  addError(userId, error, context) {
    this.errors.push({
      userId,
      error: error.message,
      context,
      timestamp: new Date(),
    });
  }

  calculateDuration(timestamp) {
    return (timestamp - this.startTime) / 1000;
  }

  getScriptRunTime() {
    return this.calculateDuration(new Date());
  }
}

// Browser manager class
class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async launch() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport(CONFIG.viewport);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async navigateTo(url, options = {}) {
    const defaultOptions = {
      timeout: CONFIG.timeouts.longNavigation,
    };
    try {
      await this.page.goto(url, { ...defaultOptions, ...options });
    } catch (error) {
      console.log(`Navigation to ${url} failed, retrying...`);
      await this.page.goto(url, { ...defaultOptions, ...options });
    }
  }

  async waitForElement(selector, options = {}) {
    const defaultOptions = { timeout: CONFIG.timeouts.element };
    try {
      await this.page.waitForSelector(selector, { ...defaultOptions, ...options });
    } catch (error) {
      throw new Error(`Element not found: ${selector} (timeout: ${CONFIG.timeouts.element}ms)`);
    }
  }

  async waitForText(text, timeout = CONFIG.timeouts.element) {
    try {
      await this.page.waitForFunction(
        (searchText) => {
          const elements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
          return Array.from(elements).some(el => el.textContent.includes(searchText));
        },
        { timeout },
        text
      );
    } catch (error) {
      throw new Error(`Text not found: "${text}" (timeout: ${timeout}ms)`);
    }
  }

  async delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async forceClick(selector, options = {}) {
    const defaultOptions = { 
      timeout: CONFIG.timeouts.element,
      force: true,
      waitForElement: true 
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
      if (finalOptions.waitForElement) {
        await this.waitForElement(selector, { timeout: finalOptions.timeout });
      }
      
      try {
        await this.page.click(selector, { force: finalOptions.force });
        return true;
      } catch (error) {
        console.log(`Normal click failed for ${selector}, trying evaluate click...`);
        
        const clicked = await this.page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (element) {
            element.click();
            return true;
          }
          return false;
        }, selector);
        
        if (clicked) {
          return true;
        }
        
        const dispatched = await this.page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (element) {
            element.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            }));
            return true;
          }
          return false;
        }, selector);
        
        return dispatched;
      }
    } catch (error) {
      throw new Error(`Element not found for click: ${selector} (timeout: ${finalOptions.timeout}ms)`);
    }
  }
}

// Vizpad test runner class
class VizpadTestRunner {
  constructor() {
    this.metrics = new PerformanceMetrics();
  }

  async runTest(userId) {
    const testResults = {
      userId,
      vizpadLoadTime: 0,
      chartLoadTime: 0,
      areaFilterTime: 0,
      regionFilterTime: 0,
      territoryFilterTime: 0,
      TotalFilterTestTime: 0,
      success: true,
    };

    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();
      
      // Test vizpad performance
      await this.performVizpadTest(userId, testResults, browserManager);
      
      // Debug: Log the tab index value and type
      console.log(`User ${userId}: CONFIG.tabIndex = "${CONFIG.tabIndex}" (type: ${typeof CONFIG.tabIndex})`);
      
      // Check if tab index is valid and greater than 0
      if (CONFIG.tabSwitch === 'true') {
        let tabIndex = Math.floor(Math.random() * 10);
        console.log(`User ${userId}: Tab index is ${tabIndex}`);
        CONFIG.tabIndex = tabIndex;
        await this.switchTab(userId, testResults, browserManager);
      } 
      await this.performFilterTest(userId, testResults, browserManager);

    } catch (error) {
      testResults.success = false;
      this.metrics.addError(userId, error, 'Vizpad test execution');
      console.error(`User ${userId} test failed:`, error.message);
    } finally {
      await browserManager.close();
    }

    return testResults;
  }

  async waitForChartToLoad(browserManager) { 
    try {
      // Check for either "Vizpad is loading..." or "chart is loading" text
      const loadingTexts = ['Vizpad is loading...', 'Chart is loading...'];
      let loadingTextFound = false;
      
      // Check if any loading text exists immediately first
      const existingLoadingText = await browserManager.page.evaluate((texts) => {
        const elements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
        for (const text of texts) {
          if (Array.from(elements).some(el => el.textContent.includes(text))) {
            return text;
          }
        }
        return null;
      }, loadingTexts);
      
      if (existingLoadingText) {
        console.log(`Loading text found: "${existingLoadingText}"`);
        loadingTextFound = true;
      } else {
        // Wait for any loading text to appear (with short timeout)
        for (const loadingText of loadingTexts) {
          try {
            await browserManager.waitForText(loadingText, 5000); // 5 second timeout
            console.log(`Loading text appeared: "${loadingText}"`);
            loadingTextFound = true;
            break;
          } catch (error) {
            // Continue to next loading text if this one doesn't appear
            continue;
          }
        }
      }
      
      if (!loadingTextFound) {
        console.log('No loading text found, proceeding...');
        return;
      }
      
      console.log('Waiting for chart to load...');
      
      // Then wait for all loading texts to disappear
      await browserManager.page.waitForFunction(
        (loadingTexts) => {
          const spans = document.querySelectorAll('span');
          for (let span of spans) {
            for (let loadingText of loadingTexts) {
              if (span.textContent && span.textContent.includes(loadingText)) {
                return false; // Any loading text still exists, keep waiting
              }
            }
          }
          return true; // No loading text exists in any span, loading is complete
        },
        { timeout: CONFIG.timeouts.element },
        loadingTexts
      );
      console.log('Chart loading completed');
    } catch (error) {
      console.log('Chart loading detection failed, trying fallback method...');
      
      // Fallback: Wait for chart container or highcharts to appear
      try {
        await browserManager.waitForElement(CONFIG.selectors.vizContainer, { timeout: 10000 });
        console.log('Chart loaded (fallback method)');
      } catch (fallbackError) {
        console.log('Fallback method also failed, proceeding anyway...');
      }
    }
  }

  async performVizpadTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting vizpad test`);
    
    const testStartTime = new Date();
    
    // Navigate to vizpad using the complete URL
    await browserManager.navigateTo(CONFIG.vizpadUrl, {
      timeout: CONFIG.timeouts.longNavigation,
    });
    
    // Wait for both APIs concurrently
    console.log(`User ${userId}: Waiting for APIs...`);
    
    await Promise.all([
      browserManager.page.waitForResponse(
        response => response.url().includes('/vizpadView') && response.request().method() === 'GET',
        { timeout: CONFIG.timeouts.navigation }
      ),
      browserManager.page.waitForResponse(
        response => response.url().includes('/vizItem') && response.request().method() === 'GET',
        { timeout: CONFIG.timeouts.navigation }
      ),
      browserManager.page.waitForResponse(
        response => response.url().includes('/businessViews') && response.request().method() === 'GET',
        { timeout: CONFIG.timeouts.navigation }
      ),
      browserManager.page.waitForResponse(
        response => response.url().includes('/auth/runtimeConfig') && response.request().method() === 'GET',
        { timeout: CONFIG.timeouts.navigation }
      )
    ]).then(() => {
      console.log(`User ${userId}: APIs Load completed`);
    }).catch((error) => {
      console.log(`User ${userId}: APIs Load failed: ${error}`);
      throw new Error(error);
    });
    
    // Calculate total vizpad load time (time for both APIs to complete)
    const vizpadLoadTime = (new Date() - testStartTime) / 1000;
    testResults.vizpadLoadTime = vizpadLoadTime;
    this.metrics.addMetric(userId, 'vizpadLoadTime', vizpadLoadTime);
    console.log(`User ${userId}: Vizpad load completed in ${vizpadLoadTime}s`);
    
    // Wait for chart to load
    console.log(`User ${userId}: Waiting for chart to load...`);
    const chartStartTime = new Date();
    await this.waitForChartToLoad(browserManager);
    const chartLoadTime = (new Date() - chartStartTime) / 1000;
    
    testResults.chartLoadTime = chartLoadTime;
    this.metrics.addMetric(userId, 'chartLoadTime', chartLoadTime);
    console.log(`User ${userId}: Charts loaded in ${chartLoadTime}s`);

  }
  async switchTab(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting tab switch to tab index ${CONFIG.tabIndex}`);
    const tabSelector = `[data-cy-id='cy-tb${CONFIG.tabIndex}']`;
    try {
      await browserManager.waitForElement(tabSelector);
      await browserManager.page.click(tabSelector);
      console.log(`User ${userId}: Tab clicked successfully`);
      
      let tabSwitchStartTime = new Date();
      await this.waitForChartToLoad(browserManager);
      let tabSwitchTime = (new Date() - tabSwitchStartTime) / 1000;
      
      testResults.tabSwitchTime = tabSwitchTime;
      this.metrics.addMetric(userId, 'tabSwitchTime', tabSwitchTime);
      console.log(`User ${userId}: Tab switched in ${tabSwitchTime}s`);
    } catch (error) {
      console.error(`User ${userId}: Failed to switch tab: ${error.message}`);
      throw new Error(`Tab switch failed: ${error.message}`);
    }
  }
  async performFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting filter test`);
    
      //performing filter tests
      const testStartTime = new Date();
      const filterData = getRandomFilterData();
      await this.performAreaFilterTest(userId, testResults, browserManager, filterData.Area);

      await this.performRegionFilterTest(userId, testResults, browserManager, filterData.Region);

      await this.performTerritoryFilterTest(userId, testResults, browserManager, filterData.territory);


      const TotalFilterTestTime = (new Date() - testStartTime) / 1000;
      testResults.TotalFilterTestTime = TotalFilterTestTime;
      this.metrics.addMetric(userId, 'TotalFilterTestTime', TotalFilterTestTime);
      console.log(`User ${userId}: Filter test completed in ${TotalFilterTestTime}s`);
  }
  async performAreaFilterTest(userId, testResults, browserManager, randomAreas) {
      console.log(`User ${userId}: Starting area filter test`);
          
      // Get random area data
      console.log(`User ${userId}: Testing with areas: ${randomAreas.join(', ')}`);
      
      await browserManager.waitForElement(CONFIG.selectors.searchInput);
      let elements = await browserManager.page.$$(CONFIG.selectors.searchInput);
      await browserManager.page.evaluate((element) => {
        element.scrollIntoView();
        element.click();
      }, elements[0]);
      
      // Apply each area filter
      for (const area of randomAreas) {
        await this.searchAndSelectValue(area, browserManager);
      }
      
    // Apply the filter
      await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
      await browserManager.page.click(CONFIG.selectors.filterApplyBtn);
      const areaFilterStartTime = new Date();
      await this.waitForChartToLoad(browserManager);
      console.log(`User ${userId}: Waiting for All API calls to complete`);
      await browserManager.page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 });
      console.log(`User ${userId}: All API calls completed`);
      const areaFilterTime = (new Date() - areaFilterStartTime) / 1000;
      testResults.areaFilterTime = areaFilterTime;
      this.metrics.addMetric(userId, 'areaFilterTime', areaFilterTime);
      console.log(`User ${userId}: Area filter completed in ${areaFilterTime}s`);
  }
  async performRegionFilterTest(userId, testResults, browserManager, randomRegions) {
    console.log(`User ${userId}: Starting region filter test`);
          
    // Get random area data
    console.log(`User ${userId}: Testing with regions: ${randomRegions.join(', ')}`);
    
    await browserManager.waitForElement(CONFIG.selectors.searchInput);
    let elements = await browserManager.page.$$(CONFIG.selectors.searchInput);
    await browserManager.page.evaluate((element) => {
      element.scrollIntoView();
      element.click();
    }, elements[1]);
    
    // Apply each area filter
    for (const region of randomRegions) {
      await this.searchAndSelectValue(region, browserManager);
    }
    
  // Apply the filter
    await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
    await browserManager.page.click(CONFIG.selectors.filterApplyBtn);
    const regionFilterStartTime = new Date();
    await this.waitForChartToLoad(browserManager);
    console.log(`User ${userId}: Waiting for All API calls to complete`);
    await browserManager.page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 });
    console.log(`User ${userId}: All API calls completed`);
    const regionFilterTime = (new Date() - regionFilterStartTime) / 1000;
    testResults.regionFilterTime = regionFilterTime;
    this.metrics.addMetric(userId, 'regionFilterTime', regionFilterTime);
    console.log(`User ${userId}: Region filter completed in ${regionFilterTime}s`);
  }

    async searchAndSelectValue(value, browserManager) {
        await browserManager.waitForElement(CONFIG.selectors.searchValueInput);
        
        // Clear the input field using evaluate
        await browserManager.page.evaluate((selector) => {
            const element = document.querySelector(selector);
            if (element) {
                element.value = '';
                element.focus();
            }
        }, CONFIG.selectors.searchValueInput);
        
        await browserManager.page.type(CONFIG.selectors.searchValueInput, value);
        await browserManager.page.keyboard.press('Enter');
        await browserManager.waitForElement(CONFIG.selectors.checkBox);
        await browserManager.page.click(CONFIG.selectors.checkBox);
    }
  async performTerritoryFilterTest(userId, testResults, browserManager, randomTerritories) {
    console.log(`User ${userId}: Starting territory filter test`);
    // Get random territory data
    console.log(`User ${userId}: Testing with territories: ${randomTerritories.join(', ')}`);
    
    await browserManager.waitForElement(CONFIG.selectors.searchInput);
    let elements = await browserManager.page.$$(CONFIG.selectors.searchInput);
    await browserManager.page.evaluate((element) => {
      element.scrollIntoView();
      element.click();
    }, elements[2]);
      
    
    // Apply each territory filter
    for (const territory of randomTerritories) {
      await this.searchAndSelectValue(territory, browserManager);
    }
    
    // Apply the filter
    await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
    await browserManager.page.click(CONFIG.selectors.filterApplyBtn);

    // Wait for chart to reload after filter application
    const territoryFilterStartTime = new Date();
    await this.waitForChartToLoad(browserManager);

    console.log(`User ${userId}: Waiting for All API calls to complete`);
    await browserManager.page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 });
    
    console.log(`User ${userId}: All API calls completed`);
    const territoryFilterTime = (new Date() - territoryFilterStartTime) / 1000;
    testResults.territoryFilterTime = territoryFilterTime;
    this.metrics.addMetric(userId, 'territoryFilterTime', territoryFilterTime);
    console.log(`User ${userId}: Territory filter completed in ${territoryFilterTime}s`);
  }
  async performTimeFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting time filter test`);
        // Get random time data
    const timeData = getRandomData('time');
    console.log(`User ${userId}: Testing with time range: ${timeData.startDate} to ${timeData.endDate}`);
    
    // Wait for any chart loading to complete before attempting hover
    console.log(`User ${userId}: Checking for chart loading state before hover`);
    
    // Check if "Chart is loading..." text exists and wait for it to disappear
    const chartLoadingText = await browserManager.page.evaluate(() => {
      const elements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
      return Array.from(elements).some(el => el.textContent.includes('Chart is loading...'));
    });
    
    if (chartLoadingText) {
      console.log(`User ${userId}: Found "Chart is loading..." text, waiting for it to disappear`);
      await browserManager.page.waitForFunction(
        () => {
          const elements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
          return !Array.from(elements).some(el => el.textContent.includes('Chart is loading...'));
        },
        { timeout: CONFIG.timeouts.element }
      );
      console.log(`User ${userId}: Chart loading completed, proceeding with hover`);
    } else {
      console.log(`User ${userId}: No "Chart is loading..." text found, chart is stable`);
    }
    
    const chartElement = await browserManager.page.$(CONFIG.selectors.vizpadChart);
    if (!chartElement) {
      throw new Error(`Chart element not found: ${CONFIG.selectors.vizpadChart}`);
    }
    
    const box = await chartElement.boundingBox();
    if (!box) {
      throw new Error(`Chart element has no bounding box`);
    }
    await browserManager.page.hover(CONFIG.selectors.vizpadChart);
    // Now wait for filter icon to be visible and click it
    console.log(`User ${userId}: Waiting for filter icon to appear`);
    await browserManager.waitForElement(CONFIG.selectors.filterIcon);
    await browserManager.forceClick(CONFIG.selectors.filterIcon);
    console.log(`User ${userId}: Filter icon clicked successfully`);
    //select date column
    await browserManager.waitForElement(CONFIG.selectors.filterColumnInput);
    await browserManager.page.click(CONFIG.selectors.filterColumnInput);
    await browserManager.page.type(CONFIG.selectors.filterColumnInput, CONFIG.data.DateColumn);
    await browserManager.waitForElement(CONFIG.selectors.filterColumnValue);
    await browserManager.page.click(CONFIG.selectors.filterColumnValue);
    await browserManager.waitForElement(CONFIG.selectors.filterColumnValueInput);
    await browserManager.page.click(CONFIG.selectors.filterColumnValueInput);
    // Select date selection type
    await browserManager.page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 });
    await browserManager.waitForElement(CONFIG.selectors.dateSelectionType);
    await browserManager.page.click(CONFIG.selectors.dateSelectionType);
    
    // Select range of dates
    await browserManager.waitForElement(CONFIG.selectors.rangeOfDates);
    await browserManager.page.click(CONFIG.selectors.rangeOfDates);
    
    // Set start date
    await browserManager.waitForElement(CONFIG.selectors.startDate);

    // Click to focus the input
    await browserManager.page.click(CONFIG.selectors.startDate);
    
    // Clear the field using multiple methods for reliability
    await browserManager.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.value = '';
        element.focus();
        // Trigger input event to ensure the field is properly cleared
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, CONFIG.selectors.startDate);
    
    // Alternative clear method using keyboard shortcuts
    await browserManager.page.focus(CONFIG.selectors.startDate);
    await browserManager.page.keyboard.down('Meta');
    await browserManager.page.keyboard.press('A');
    await browserManager.page.keyboard.up('Meta');
    await browserManager.page.keyboard.press('Backspace');
    // Type the new date
    await browserManager.page.type(CONFIG.selectors.startDate, timeData.startDate);
    
    console.log(`User ${userId}: Set start date to: ${timeData.startDate}`);
    
    // Set end date
    await browserManager.waitForElement(CONFIG.selectors.endDate);
    await browserManager.page.click(CONFIG.selectors.endDate);
    
    // Clear the field using multiple methods for reliability
    await browserManager.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.value = '';
        element.focus();
        // Trigger input event to ensure the field is properly cleared
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, CONFIG.selectors.endDate);
    
    // Alternative clear method using keyboard shortcuts
    await browserManager.page.focus(CONFIG.selectors.endDate);
    await browserManager.page.keyboard.down('Meta');
    await browserManager.page.keyboard.press('A');
    await browserManager.page.keyboard.up('Meta');
    await browserManager.page.keyboard.press('Backspace');
    
    await browserManager.page.type(CONFIG.selectors.endDate, timeData.endDate);

    console.log(`User ${userId}: Set end date to: ${timeData.endDate}`);
    
    // Apply time filter
    await browserManager.waitForElement(CONFIG.selectors.applyTimeFilterBtn);
    await browserManager.forceClick(CONFIG.selectors.applyTimeFilterBtn);
    await browserManager.waitForElement(CONFIG.selectors.applyBtn);
    await browserManager.forceClick(CONFIG.selectors.applyBtn);
    // Wait for chart to reload after time filter application
    const timeFilterStartTime = new Date();
    await this.waitForChartToLoad(browserManager);
      
    const timeFilterTime = (new Date() - timeFilterStartTime) / 1000;
    testResults.timeFilterTime = timeFilterTime;
    this.metrics.addMetric(userId, 'timeFilterTime', timeFilterTime);
    console.log(`User ${userId}: Time filter completed in ${timeFilterTime}s`);
  }

  async runAllTests() {
    const numUsers = parseInt(process.argv[3]) || 1;
    
    console.log(`Starting vizpad performance test with ${numUsers} users`);
    console.log(`Vizpad URL: ${CONFIG.vizpadUrl}`);
    
    // Create test promises for concurrent execution
    const testPromises = Array(numUsers)
      .fill(null)
      .map((_, index) => this.runTest(index));
    
    // Run all tests concurrently using Promise.all
    const results = await Promise.all(testPromises);
    
    // Generate report
    await this.generateReport(results, numUsers);
    
    console.log('Vizpad performance test completed successfully');
  }

  async generateReport(results, numUsers) {
    const scriptRunTime = this.metrics.getScriptRunTime();
    
    // Debug: Log the results to see what we're working with
    console.log(`\n=== DEBUG: Results Summary ===`);
    console.log(`Number of results: ${results.length}`);
    console.log(`Results structure:`, JSON.stringify(results[0], null, 2));
    
    // Save CSV file using manual generation (more reliable)
    const filename = `testReports/vizpad_test_${numUsers}_users.csv`;
    const fs = require('fs');
    
    let csvContent = 'Script Time (s),Number of Users,Vizpad URL\n';
    csvContent += `${scriptRunTime},${numUsers},"${CONFIG.vizpadUrl}"\n\n`;
    
    // Add headers
    let headerRow = 'User ID,Vizpad Load (s),Chart Load (s)';
    const tabIndexNum = parseInt(CONFIG.tabIndex);
    if (CONFIG.tabIndex && CONFIG.tabIndex !== '' && CONFIG.tabIndex !== 'null' && CONFIG.tabIndex !== 'undefined' && !isNaN(tabIndexNum) && tabIndexNum > 0) {
      headerRow += ',Tab Switch (s)';
    }
    headerRow += ',Area Filter (s),Region Filter (s),Territory Filter (s),Total Filter Test (s),Status,Error Message\n';
    csvContent += headerRow;
    
    // Add data rows
    results.forEach(result => {
      let dataRow = `${result.userId || 0},${result.vizpadLoadTime || 0},${result.chartLoadTime || 0}`;
      
      const tabIndexNum = parseInt(CONFIG.tabIndex);
      if (CONFIG.tabIndex && CONFIG.tabIndex !== '' && CONFIG.tabIndex !== 'null' && CONFIG.tabIndex !== 'undefined' && !isNaN(tabIndexNum) && tabIndexNum > 0) {
        dataRow += `,${result.tabSwitchTime || 0}`;
      }
      
      dataRow += `,${result.areaFilterTime || 0},${result.regionFilterTime || 0},${result.territoryFilterTime || 0},${result.TotalFilterTestTime || 0}`;
      
      // Add status and error message
      const status = result.success ? 'SUCCESS' : 'FAILED';
      const errorMessage = this.metrics.errors
        .filter(error => error.userId === result.userId)
        .map(error => error.error)
        .join('; ') || '';
      
      dataRow += `,${status},"${errorMessage}"\n`;
      csvContent += dataRow;
    });
    
    fs.writeFileSync(filename, csvContent);
    console.log(`CSV file saved successfully: ${filename}`);
    console.log(`CSV contains ${results.length} user records`);
    
    // Print summary
    console.log('\n=== VIZPAD PERFORMANCE TEST SUMMARY ===');
    console.log(`Total script runtime: ${scriptRunTime}s`);
    console.log(`Users tested: ${numUsers}`);
    console.log(`Successful tests: ${results.filter(r => r.success).length}`);
    console.log(`Failed tests: ${results.filter(r => !r.success).length}`);
    console.log(`CSV report saved: ${filename}`);
    
    // Display results in table format
    console.log('\n=== DETAILED RESULTS TABLE ===');
    
    // Prepare table data
    const tableData = results.map(result => {
      const status = result.success ? '✅ Success' : '❌ Failed';
      
      const row = {
        'User ID': result.userId,
        'Vizpad Load (s)': result.vizpadLoadTime.toFixed(2),
        'Chart Load (s)': result.chartLoadTime.toFixed(2)
      };
      
      const tabIndexNum = parseInt(CONFIG.tabIndex);
      if (CONFIG.tabIndex && CONFIG.tabIndex !== '' && CONFIG.tabIndex !== 'null' && CONFIG.tabIndex !== 'undefined' && !isNaN(tabIndexNum) && tabIndexNum > 0 && result.tabSwitchTime !== undefined) {
        row['Tab Switch (s)'] = result.tabSwitchTime.toFixed(2);
      }
      
      row['Area Filter (s)'] = result.areaFilterTime.toFixed(2);
      row['Region Filter (s)'] = result.regionFilterTime.toFixed(2);
      row['Territory Filter (s)'] = result.territoryFilterTime.toFixed(2);
      row['Total Filter Test (s)'] = result.TotalFilterTestTime.toFixed(2);
      row['Status'] = status;
      
      return row;
    });
    
    // Display the table
    console.table(tableData);
    
    // Calculate and display averages
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
      console.log('\n=== AVERAGE PERFORMANCE METRICS ===');
      const averages = {
        'Average Vizpad Load (s)': (successfulResults.reduce((sum, r) => sum + r.vizpadLoadTime, 0) / successfulResults.length).toFixed(2),
        'Average Chart Load (s)': (successfulResults.reduce((sum, r) => sum + r.chartLoadTime, 0) / successfulResults.length).toFixed(2),
        'Average Area Filter (s)': (successfulResults.reduce((sum, r) => sum + r.areaFilterTime, 0) / successfulResults.length).toFixed(2),
        'Average Region Filter (s)': (successfulResults.reduce((sum, r) => sum + r.regionFilterTime, 0) / successfulResults.length).toFixed(2),
        'Average Territory Filter (s)': (successfulResults.reduce((sum, r) => sum + r.territoryFilterTime, 0) / successfulResults.length).toFixed(2),
        'Average Total Filter Test (s)': (successfulResults.reduce((sum, r) => sum + r.TotalFilterTestTime, 0) / successfulResults.length).toFixed(2),
      };
      const tabIndexNum = parseInt(CONFIG.tabIndex);
      if (CONFIG.tabIndex && CONFIG.tabIndex !== '' && CONFIG.tabIndex !== 'null' && CONFIG.tabIndex !== 'undefined' && !isNaN(tabIndexNum) && tabIndexNum > 0) {
        const tabSwitchResults = successfulResults.filter(r => r.tabSwitchTime !== undefined);
        if (tabSwitchResults.length > 0) {
          averages['Average Tab Switch (s)'] = (tabSwitchResults.reduce((sum, r) => sum + r.tabSwitchTime, 0) / tabSwitchResults.length).toFixed(2);
        }
      }
      console.table(averages);
    }
    
    if (this.metrics.errors.length > 0) {
      console.log('\n==== ERRORS ====');
      this.metrics.errors.forEach(error => {
        console.log(`User ${error.userId}: ${error.error} (${error.context})`);
      });
    }

    // Send email if enabled
    if (CONFIG.enableEmail) {
      try {
        console.log('\n📧 Sending email report...');
        const emailService = new EmailService();
        await emailService.sendTestResults(results, numUsers, scriptRunTime, CONFIG.vizpadUrl, filename);
        console.log('✅ Email report sent successfully!');
      } catch (error) {
        console.error('❌ Failed to send email report:', error.message);
        console.log('Continuing without email...');
      }
    }
  }
}

// Main execution
async function main() {
  try {
    const runner = new VizpadTestRunner();
    await runner.runAllTests();
  } catch (error) {
    console.error('Vizpad test execution failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { VizpadTestRunner, BrowserManager, PerformanceMetrics };
