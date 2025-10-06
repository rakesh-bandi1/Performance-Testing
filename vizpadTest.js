const ObjectsToCsv = require("objects-to-csv");
const puppeteer = require("puppeteer");
const fs = require("fs");
const { getRandomData, getRandomFilterData } = require("./helper.js");
const EmailService = require("./emailService.js");
// Using built-in fetch API (Node.js 18+)
const fetch = globalThis.fetch;
const CONFIG = {
  vizpadUrl:
    process.argv[2] ||
    "https://galaxyai-dev.bayer.com/dashboard/60f7edee-af68-4b81-9721-cba9166fab26/a23139b8-e035-4c2f-b38c-548636d33bc6",
  tabSwitch: process.argv[4] || "false",
  enableEmail:
    process.argv[5] === "true" || process.env.ENABLE_EMAIL === "true",
  tabIndex: 0,
  timeouts: {
    navigation: 1000000,
    element: 300000, // 30 seconds for element timeout
    longNavigation: 1000000,
  },
  filterData: [],
  viewport: { width: 1512, height: 864 },
  selectors: {
    chartLoading: "Vizpad is loading...",
    vizContainer: ".vizContainer",
    highcharts: ".highcharts-container",
    searchInput: "[data-cy-id='cy-search-data']",
    searchValueInput: "[data-cy-id='cy-search-value']",
    checkBox: ".checkbox-available",
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
    tab: "cy-tb",
    appLoader: "#appLoader",
    territoryEle: `//input[@data-cy-id='cy-viz-title' and @value='Territory']/ancestor::div[contains(@class,'viz-control-chart')]//div[@data-cy-id='cy-search-data']`,
    regionEle: `//input[@data-cy-id='cy-viz-title' and @value='Region']/ancestor::div[contains(@class,'viz-control-chart')]//div[@data-cy-id='cy-search-data']`,
    areaEle: `//input[@data-cy-id='cy-viz-title' and @value='Area']/ancestor::div[contains(@class,'viz-control-chart')]//div[@data-cy-id='cy-search-data']`,
    // Login selectors
    userNameInput: '[data-cy-id="cy-usrnm"]',
    passwordInput: '[data-cy-id="cy-pswrd"]',
    loginButton: '[data-cy-id="cy-lgn-btn"]',
    standardLogin: '[data-cy-id="cy-stndrd-lgn"]',
  },
  data: {
    DateColumn: "CONVERSION_DATE",
  },
  login: {
    username: process.argv[6] || "bayer-admin",
    password: process.argv[7] || "Tellius123!",
    baseUrl: process.argv[8] || "https://galaxyai-dev.bayer.com/api/login",
  },
  delays: {
    pageLoad: 2000,
  },
};

// Loader Component for handling app loader
class LoaderComponent {
  constructor() {
    this.maxWaitTime = 3 * 60 * 1000; // 3 minutes in ms
  }

  async waitForLoading(page, startTime = Date.now()) {
    const elapsed = Date.now() - startTime;

    if (elapsed > this.maxWaitTime) {
      console.log(
        "Loader did not disappear within 3 minutes ❌, continuing with the test"
      );
      return;
    }

    try {
      const isLoaderVisible = await page.evaluate(() => {
        const loader = document.querySelector("#appLoader");
        return (
          loader &&
          loader.offsetParent !== null &&
          window.getComputedStyle(loader).display !== "none" &&
          window.getComputedStyle(loader).visibility !== "hidden"
        );
      });

      if (isLoaderVisible) {
        console.log("App loader is visible, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.waitForLoading(page, startTime);
      } else {
        console.log("Loader is gone ✅");
      }
    } catch (error) {
      console.log("Error checking loader visibility, continuing...");
    }
  }

  async waitForLoaderToDisappear(page) {
    console.log("Waiting for app loader to disappear...");
    await this.waitForLoading(page);
  }
}

// Create a singleton instance
const loaderComponent = new LoaderComponent();

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
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas", // disables GPU canvas
        "--disable-gpu", // save GPU overhead (Linux headless mode often needs this)
        "--disable-software-rasterizer", // prevent GPU fallback
        "--no-zygote", // reduce resource usage
        "--single-process", // runs in one process (good for constrained envs)
        "--disable-cache", // Add this for better network monitoring
      ],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport(CONFIG.viewport);

    // Create CDP session
    const client = await this.page.target().createCDPSession();
    await client.send("Network.enable");

    this.requests = new Map(); // Make requests accessible to the class

    // Fired when a request is sent
    client.on("Network.requestWillBeSent", (params) => {
      this.requests.set(params.requestId, {
        url: params.request.url,
        method: params.request.method,
        startTime: Date.now(),
        requestId: params.requestId,
      });
    });

    // Fired when a response is received
    client.on("Network.responseReceived", (params) => {
      const req = this.requests.get(params.requestId);
      if (req) {
        req.status = params.response.status;
        req.mimeType = params.response.mimeType;
        req.responseReceived = Date.now();
      }
    });

    // Fired when loading finishes (response body done)
    client.on("Network.loadingFinished", (params) => {
      const req = this.requests.get(params.requestId);
      if (req) {
        req.endTime = Date.now();
        req.durationMs = req.endTime - req.startTime;
        
        // Capture response body for specific APIs after a short delay
        const targetAPIs = [
          '/vizResponse',
          '/tqlSpark', 
          '/getVizMetadata',
          '/annotations/chartFormMappings',
          '/customCalendars',
          '/auth/runtimeConfig',
          '/businessViews',
          '/datasetMetadata',
          '/api/config'
        ];
        
        const isTargetAPI = targetAPIs.some(api => req.url.includes(api));
        if (isTargetAPI && req.status === 200) {
          // Try immediate capture first
          this.captureResponseBody(client, params.requestId, req);
          
          // Also try with delay as fallback
          setTimeout(() => {
            this.captureResponseBody(client, params.requestId, req);
          }, 100); // 100ms delay to ensure response body is available
        }
      }
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async takeScreenshot(userId, testStep, error = null) {
    try {
      if (!this.page) {
        console.log(`User ${userId}: No page available for screenshot`);
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `testReports/screenshots/user_${userId}_${testStep}_${timestamp}.png`;
      
      // Ensure screenshots directory exists
      const screenshotsDir = 'testReports/screenshots';
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
        console.log(`📁 Created screenshots directory: ${screenshotsDir}`);
      }

      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });

      console.log(`📸 Screenshot captured: ${screenshotPath}`);
      
      // Verify the file was actually created
      if (fs.existsSync(screenshotPath)) {
        const stats = fs.statSync(screenshotPath);
        console.log(`📸 Screenshot file size: ${stats.size} bytes`);
      } else {
        console.error(`❌ Screenshot file was not created: ${screenshotPath}`);
        return null;
      }
      
      // Add error context to screenshot if provided
      if (error) {
        const errorInfoPath = `testReports/screenshots/user_${userId}_${testStep}_${timestamp}_error.txt`;
        const errorInfo = {
          userId,
          testStep,
          timestamp,
          error: error.message || error,
          stack: error.stack || 'No stack trace available',
          url: this.page.url() || 'Unknown URL'
        };
        
        fs.writeFileSync(errorInfoPath, JSON.stringify(errorInfo, null, 2));
        console.log(`📄 Error info saved: ${errorInfoPath}`);
      }

      return screenshotPath;
    } catch (screenshotError) {
      console.error(`❌ Failed to take screenshot for User ${userId}:`, screenshotError.message);
      return null;
    }
  }

  async captureResponseBody(client, requestId, req) {
    try {
      // Check if the request still exists and is valid
      if (!this.requests.has(requestId)) {
        return;
      }
      
      // Skip if we already have the data
      if (req.chartName || req.datasetName) {
        return;
      }
      
      const response = await client.send('Network.getResponseBody', { requestId });
      if (response.body) {
        try {
          const responseData = JSON.parse(response.body);
          
          // Extract specific data based on API endpoint
          if (req.url.includes('/vizResponse')) {
            // Extract chart name from various possible paths
            let chartName = null;
            
            // Try different possible paths for chart name
            if (responseData && responseData.viz && responseData.viz.title) {
              chartName = responseData.viz.title;
            } else if (responseData && responseData.title) {
              chartName = responseData.title;
            } else if (responseData && responseData.data && responseData.data.title) {
              chartName = responseData.data.title;
            } else if (responseData && responseData.data && responseData.data.viz && responseData.data.viz.title) {
              chartName = responseData.data.viz.title;
            } else if (responseData && responseData.name) {
              chartName = responseData.name;
            } else if (responseData && responseData.chartName) {
              chartName = responseData.chartName;
            } else if (responseData && responseData.viz && responseData.viz.id) {
              // Fallback to viz.id if title is not available
              chartName = responseData.viz.id;
            } else if (responseData && responseData.data && responseData.data.viz && responseData.data.viz.id) {
              // Fallback to data.viz.id if title is not available
              chartName = responseData.data.viz.id;
            }
            
            if (chartName) {
              req.chartName = chartName;
              console.log(`📊 Chart name captured: ${req.chartName}`);
            } else {
              // Store partial response structure for debugging
              req.responseStructure = JSON.stringify(responseData, null, 2).substring(0, 500);
              console.log(`⚠️  No chart name found in vizResponse. Response structure:`, req.responseStructure);
            }
          } else if (req.url.includes('/tqlSpark')) {
            // Extract dataset name from body.columns[0].datasetName
            if (responseData && responseData.columns && responseData.columns[0] && responseData.columns[0].datasetName) {
              req.datasetName = responseData.columns[0].datasetName;
              console.log(`📊 Dataset name captured: ${req.datasetName}`);
            } else {
              req.responseStructure = JSON.stringify(responseData, null, 2).substring(0, 500);
              console.log(`⚠️  No dataset name found in tqlSpark. Response structure:`, req.responseStructure);
            }
          }
          
          // Store the full response for debugging
          req.responseData = responseData;
        } catch (parseError) {
          console.log(`⚠️  Failed to parse response body for ${req.url}:`, parseError.message);
        }
      }
    } catch (error) {
      // Silently handle errors - the request might have been cleaned up
      // This is expected behavior and not an error condition
    }
  }

  async navigateTo(url, options = {}) {
    // options.waitUntil = ['domcontentloaded','networkidle2'];

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
      await this.page.waitForSelector(selector, {
        ...defaultOptions,
        ...options,
      });
    } catch (error) {
      throw new Error(
        `Element not found: ${selector} (timeout: ${CONFIG.timeouts.element}ms)`
      );
    }
  }

  async waitForText(text, timeout = CONFIG.timeouts.element) {
    try {
      await this.page.waitForFunction(
        (searchText) => {
          const elements = document.querySelectorAll(
            "span, div, p, h1, h2, h3, h4, h5, h6"
          );
          return Array.from(elements).some((el) =>
            el.textContent.includes(searchText)
          );
        },
        { timeout },
        text
      );
    } catch (error) {
      throw new Error(`Text not found: "${text}" (timeout: ${timeout}ms)`);
    }
  }

  async delay(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async waitForAppLoader() {
    await loaderComponent.waitForLoaderToDisappear(this.page);
  }

  async retryOperation(operation, maxRetries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.log(
          `Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`
        );
        await this.delay(delayMs);
      }
    }
  }

  async forceClick(selector, options = {}) {
    const defaultOptions = {
      timeout: CONFIG.timeouts.element,
      force: true,
      waitForElement: true,
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
        console.log(
          `Normal click failed for ${selector}, trying evaluate click...`
        );

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
            element.dispatchEvent(
              new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window,
              })
            );
            return true;
          }
          return false;
        }, selector);

        return dispatched;
      }
    } catch (error) {
      throw new Error(
        `Element not found for click: ${selector} (timeout: ${finalOptions.timeout}ms)`
      );
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
      loginTime: 0,
      apiLoadTime: 0,
      vizpadLoadTime: 0,
      chartLoadTime: 0,
      areaFilterTime1: 0, // Step 2: Initial area filter
      areaFilterTime2: 0, // Step 3: Area filter after tab switch 1
      areaFilterTime3: 0, // Step 5: Area filter after tab switch 3
      tabSwitchTime1: 0,
      tabSwitchTime2: 0,
      regionFilterTime: 0,
      territoryFilterTime: 0,
      tabSwitchTime3: 0,
      randomTab1: 0,
      randomTab2: 0,
      randomTab3: 0,
      success: true,
      screenshots: [], // Array to store screenshot paths
      errors: [] // Array to store error details
    };

    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();

      // Step 0: Perform API login (faster than UI login)
      console.log(`User ${userId}: Step 0 - Performing API login`);
      await this.performAPILogin(userId, testResults, browserManager);

      // Step 1: Open the Embed URL and wait for all charts to load
      console.log(
        `User ${userId}: Step 1 - Loading Vizpad and waiting for charts`
      );
      await this.performVizpadTest(userId, testResults, browserManager);

      // Step 2: Apply Area filter and wait for all charts to load
      // console.log(`User ${userId}: Step 2 - Applying Area filter`);
      // await this.performAreaFilterTest(userId, testResults, browserManager, 'areaFilterTime1');

      // Step 3: Switch to a random tab and wait for all charts to load
      // const availableTabs = [1, 2, 3, 4];
      // const randomTab1 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // testResults.randomTab1 = randomTab1;
      // console.log(`User ${userId}: Step 3 - Switching to random Tab ${randomTab1}`);
      await this.performTabSwitch(
        userId,
        testResults,
        browserManager,
        2,
        "tabSwitchTime1"
      );
      // await this.performAreaFilterTest(userId, testResults, browserManager, 'areaFilterTime2');

      // Step 4: Switch to another random tab and wait for all charts to load
      // let randomTab2 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // // Ensure we don't select the same tab as the previous one
      // while (randomTab2 === randomTab1) {
      //   randomTab2 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // }
      // testResults.randomTab2 = randomTab2;
      // console.log(`User ${userId}: Step 4 - Switching to random Tab ${randomTab2}`);
      await this.performTabSwitch(
        userId,
        testResults,
        browserManager,
        3,
        "tabSwitchTime2"
      );

      // Step 5: Apply Region filter and wait for all charts to load
      console.log(`User ${userId}: Step 5 - Applying Region filter`);
      // await this.performRegionFilterTest(userId, testResults, browserManager);

      // // Step 6: Apply Territory filter and wait for all charts to load
      // console.log(`User ${userId}: Step 6 - Applying Territory filter`);
      // await this.performTerritoryFilterTest(userId, testResults, browserManager);

      // Step 7: Switch to yet another random tab and wait for all charts to load
      // let randomTab3 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // // Ensure we don't select the same tab as the previous ones
      // while (randomTab3 === randomTab1 || randomTab3 === randomTab2) {
      //   randomTab3 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // }
      // testResults.randomTab3 = randomTab3;
      // console.log(`User ${userId}: Step 7 - Switching to random Tab ${randomTab3}`);
      await this.performTabSwitch(
        userId,
        testResults,
        browserManager,
        4,
        "tabSwitchTime3"
      );

      // Step 5: Apply Area filter and wait for all charts to load
      // console.log(`User ${userId}: Step 5 - Applying Area filter`);
      // await this.performAreaFilterTest(userId, testResults, browserManager, 'areaFilterTime3');
      
      // Take a final screenshot to verify screenshot functionality
      console.log(`User ${userId}: Taking final test completion screenshot`);
      await this.takeTestScreenshot(userId, 'test_completion', browserManager, testResults);
      
    } catch (error) {
      testResults.success = false;
      this.metrics.addError(userId, error, "Vizpad test execution");
      console.error(`User ${userId} test failed:`, error.message);
      
      // Take screenshot on failure
      try {
        const screenshotPath = await browserManager.takeScreenshot(userId, 'test_failure', error);
        if (screenshotPath) {
          testResults.screenshots.push(screenshotPath);
        }
        testResults.errors.push({
          step: 'test_execution',
          error: error.message,
          timestamp: new Date().toISOString(),
          screenshot: screenshotPath
        });
      } catch (screenshotError) {
        console.error(`Failed to capture screenshot for User ${userId}:`, screenshotError.message);
      }
    } finally {
      // Store only specific API network requests in test results before closing browser
      const targetAPIs = [
        '/vizResponse',
        '/tqlSpark', 
        '/getVizMetadata',
        '/annotations/chartFormMappings',
        '/customCalendars',
        '/auth/runtimeConfig',
        '/businessViews',
        '/datasetMetadata',
        '/api/config'
      ];
      
      testResults.networkRequests = Array.from(browserManager.requests.values())
        .filter(r => r.durationMs && targetAPIs.some(api => r.url.includes(api)))
        .sort((a, b) => b.durationMs - a.durationMs);
      
      await browserManager.close();
    }

    return testResults;
  }

  async waitForChartToLoad(browserManager) {
    try {
      // Check for either "Vizpad is loading..." or "chart is loading" text
      const loadingTexts = ["Vizpad is loading...", "Chart is loading..."];
      let loadingTextFound = false;

      // Check if any loading text exists immediately first
      const existingLoadingText = await browserManager.page.evaluate(
        (texts) => {
          const elements = document.querySelectorAll(
            "span, div, p, h1, h2, h3, h4, h5, h6"
          );
          for (const text of texts) {
            if (
              Array.from(elements).some((el) => el.textContent.includes(text))
            ) {
              return text;
            }
          }
          return null;
        },
        loadingTexts
      );

      if (existingLoadingText) {
        console.log(`Loading text found: "${existingLoadingText}"`);
        loadingTextFound = true;
      } else {
        // Wait for any loading text to appear (with short timeout)
        for (const loadingText of loadingTexts) {
          try {
            await browserManager.waitForText(loadingText, 3000); // 3 second timeout
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
        console.log("No loading text found, proceeding...");
        return;
      }

      console.log("Waiting for chart to load...");

      // Then wait for all loading texts to disappear
      await browserManager.page.waitForFunction(
        (loadingTexts) => {
          const spans = document.querySelectorAll("span");
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
      console.log("Chart loading completed");
    } catch (error) {
      console.log("Chart loading detection failed, trying fallback method...");

      // Fallback: Wait for chart container or highcharts to appear
      try {
        await browserManager.waitForElement(CONFIG.selectors.vizContainer, {
          timeout: 10000,
        });
        console.log("Chart loaded (fallback method)");
      } catch (fallbackError) {
        console.log("Fallback method also failed, proceeding anyway...");
      }
    }
  }
  async clickElementByXPath(page, xpath, timeout = 30000) {
    try {
      // Wait for element to be available using evaluate
      await page.waitForFunction(
        (xpath) => {
          const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return result.singleNodeValue !== null;
        },
        { timeout },
        xpath
      );

      // Find and click the element using evaluate
      await page.evaluate((xpath) => {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const element = result.singleNodeValue;
        if (element) {
          element.scrollIntoView();
          element.click();
          console.log("Element clicked successfully via XPath");
        } else {
          throw new Error("Element not found");
        }
      }, xpath);

      return true;
    } catch (error) {
      console.error("Failed to click element:", error.message);
      return false;
    }
  }

  async performVizpadTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting vizpad test`);

    const testStartTime = new Date();

    try {

    // Navigate to vizpad using the complete URL
    await browserManager.navigateTo(CONFIG.vizpadUrl, {
      timeout: CONFIG.timeouts.longNavigation,
    });

    // Wait for APIs with detailed logging
    console.log(`User ${userId}: Waiting for APIs...`);

    const apiPromises = [
      {
        name: "vizpadView",
        promise: browserManager.page.waitForResponse(
          (response) =>
            response.url().includes("/vizpadView") &&
            response.request().method() === "GET",
          { timeout: CONFIG.timeouts.navigation }
        ),
      },
      {
        name: "vizItem",
        promise: browserManager.page.waitForResponse(
          (response) =>
            response.url().includes("/vizItem") &&
            response.request().method() === "GET",
          { timeout: CONFIG.timeouts.navigation }
        ),
      },
      {
        name: "businessViews",
        promise: browserManager.page.waitForResponse(
          (response) =>
            response.url().includes("/businessViews") &&
            response.request().method() === "GET",
          { timeout: CONFIG.timeouts.navigation }
        ),
      },
      {
        name: "auth/runtimeConfig",
        promise: browserManager.page.waitForResponse(
          (response) =>
            response.url().includes("/auth/runtimeConfig") &&
            response.request().method() === "GET",
          { timeout: CONFIG.timeouts.navigation }
        ),
      },
    ];

    // Track each API individually
    const apiResults = [];
    const startTime = Date.now();

    for (const api of apiPromises) {
      console.log(`User ${userId}: Starting to wait for ${api.name} API...`);
      const apiStartTime = Date.now();

      try {
        await api.promise;
        const apiDuration = Date.now() - apiStartTime;
        console.log(
          `User ${userId}: ✅ ${api.name} API completed in ${apiDuration}ms`
        );
        apiResults.push({
          name: api.name,
          success: true,
          duration: apiDuration,
        });
      } catch (error) {
        const apiDuration = Date.now() - apiStartTime;
        console.log(
          `User ${userId}: ❌ ${api.name} API failed after ${apiDuration}ms: ${error.message}`
        );
        apiResults.push({
          name: api.name,
          success: false,
          duration: apiDuration,
          error: error.message,
        });
        throw new Error(`API ${api.name} failed: ${error.message}`);
      }
    }

    const totalApiTime = Date.now() - startTime;
    console.log(`User ${userId}: All APIs completed in ${totalApiTime}ms`);
    console.log(`User ${userId}: API Results:`, apiResults);

    // Calculate total vizpad load time (time for both APIs to complete)
    const vizpadLoadTime = (new Date() - testStartTime) / 1000;
    testResults.vizpadLoadTime = vizpadLoadTime;
    this.metrics.addMetric(userId, "vizpadLoadTime", vizpadLoadTime);
    console.log(`User ${userId}: Vizpad load completed in ${vizpadLoadTime}s`);

    // Wait for chart to load
    console.log(`User ${userId}: Waiting for chart to load...`);
    const chartStartTime = new Date();
    await this.waitForChartToLoad(browserManager);
    await browserManager.waitForAppLoader();
    const chartLoadTime = (new Date() - chartStartTime) / 1000;

    testResults.chartLoadTime = chartLoadTime;
    this.metrics.addMetric(userId, "chartLoadTime", chartLoadTime);
    console.log(`User ${userId}: Charts loaded in ${chartLoadTime}s`);
    
    } catch (error) {
      console.error(`User ${userId}: Vizpad test failed:`, error.message);
      
      // Take screenshot on vizpad test failure
      await this.takeTestScreenshot(userId, 'vizpad_failure', browserManager, testResults, error);
      
      throw error;
    }
  }
  async performTabSwitch(
    userId,
    testResults,
    browserManager,
    tabIndex,
    timeField
  ) {
    console.log(`User ${userId}: Starting tab switch to tab index ${tabIndex}`);
    const tabSelector = `[data-cy-id='cy-tb${tabIndex}']`;
    try {
      await browserManager.waitForElement(tabSelector);
      await browserManager.page.click(tabSelector);
      console.log(`User ${userId}: Tab clicked successfully`);

      let tabSwitchStartTime = new Date();
      await this.waitForChartToLoad(browserManager);
      await browserManager.waitForAppLoader();
      let tabSwitchTime = (new Date() - tabSwitchStartTime) / 1000;

      testResults[timeField] = tabSwitchTime;
      this.metrics.addMetric(userId, timeField, tabSwitchTime);
      console.log(
        `User ${userId}: Tab ${tabIndex} switched in ${tabSwitchTime}s`
      );
    } catch (error) {
      console.error(
        `User ${userId}: Failed to switch tab ${tabIndex}: ${error.message}`
      );
      
      // Take screenshot on tab switch failure
      await this.takeTestScreenshot(userId, `tab_switch_${tabIndex}_failure`, browserManager, testResults, error);
      
      throw new Error(`Tab switch failed: ${error.message}`);
    }
  }
  async performFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting filter test`);

    //performing filter tests
    const testStartTime = new Date();
    const filterData = getRandomFilterData();

    await this.performRegionFilterTest(
      userId,
      testResults,
      browserManager,
      filterData.Region
    );

    await this.performAreaFilterTest(
      userId,
      testResults,
      browserManager,
      filterData.Area
    );

    await this.performTerritoryFilterTest(
      userId,
      testResults,
      browserManager,
      filterData.territory
    );

    const TotalFilterTestTime = (new Date() - testStartTime) / 1000;
    testResults.TotalFilterTestTime = TotalFilterTestTime;
    this.metrics.addMetric(userId, "TotalFilterTestTime", TotalFilterTestTime);
    console.log(
      `User ${userId}: Filter test completed in ${TotalFilterTestTime}s`
    );
  }
  async performAreaFilterTest(
    userId,
    testResults,
    browserManager,
    timeField = "areaFilterTime1"
  ) {
    console.log(`User ${userId}: Starting area filter test`);

    try {
      await browserManager.waitForElement(CONFIG.selectors.searchInput);

    await this.clickElementByXPath(
      browserManager.page,
      CONFIG.selectors.areaEle
    );

    // Apply each area filter
    for (const ele of ["AA", "AB", "AC", "ZR"]) {
      await this.searchAndSelectValue(ele, browserManager);
    }

    // Apply the filter
    await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
    await browserManager.page.click(CONFIG.selectors.filterApplyBtn);
    const areaFilterStartTime = new Date();
    await this.waitForChartToLoad(browserManager);
    await browserManager.waitForAppLoader();
    console.log(`User ${userId}: Waiting for All API calls to complete`);
    await browserManager.page.waitForNetworkIdle({
      idleTime: 500,
      timeout: 60000,
    });
    console.log(`User ${userId}: All API calls completed`);
    const areaFilterTime = (new Date() - areaFilterStartTime) / 1000;
    testResults[timeField] = areaFilterTime;
    this.metrics.addMetric(userId, timeField, areaFilterTime);
    console.log(`User ${userId}: Area filter completed in ${areaFilterTime}s`);
    
    } catch (error) {
      console.error(`User ${userId}: Area filter test failed:`, error.message);
      
      // Take screenshot on area filter failure
      await this.takeTestScreenshot(userId, 'area_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }
  async performRegionFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting region filter test`);

    try {
      await browserManager.waitForElement(CONFIG.selectors.searchInput);

    // Use XPath to click the second search input (Region filter)
    await this.clickElementByXPath(
      browserManager.page,
      CONFIG.selectors.regionEle
    );

    // Apply each region filter
    for (const ele of ["AA21", "AB20", "AC20", "AA30", "ZR99"]) {
      await this.searchAndSelectValue(ele, browserManager);
    }

    // Apply the filter
    await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
    await browserManager.page.click(CONFIG.selectors.filterApplyBtn);
    const regionFilterStartTime = new Date();
    await this.waitForChartToLoad(browserManager);
    await browserManager.waitForAppLoader();
    console.log(`User ${userId}: Waiting for All API calls to complete`);
    await browserManager.page.waitForNetworkIdle({
      idleTime: 500,
      timeout: 60000,
    });
    console.log(`User ${userId}: All API calls completed`);
    const regionFilterTime = (new Date() - regionFilterStartTime) / 1000;
    testResults.regionFilterTime = regionFilterTime;
    this.metrics.addMetric(userId, "regionFilterTime", regionFilterTime);
    console.log(
      `User ${userId}: Region filter completed in ${regionFilterTime}s`
    );
    
    } catch (error) {
      console.error(`User ${userId}: Region filter test failed:`, error.message);
      
      // Take screenshot on region filter failure
      await this.takeTestScreenshot(userId, 'region_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }

  async searchAndSelectValue(value, browserManager) {
    const { page } = browserManager;
    const inputSelector = CONFIG.selectors.searchValueInput;
    const checkboxSelector = CONFIG.selectors.checkBox;

    // Wait for the input to be available
    await browserManager.waitForElement(inputSelector);

    // Ensure the element is visible and clickable
    await page.waitForFunction(
      (selector) => {
        const element = document.querySelector(selector);
        return element && element.offsetParent !== null && !element.disabled;
      },
      { timeout: 10000 },
      inputSelector
    );

    await page.focus(inputSelector);
    await page.click(inputSelector, { clickCount: 3 }); // triple click to select all
    await page.keyboard.press("Backspace");

    // Type the search value
    await page.type(inputSelector, value);

    // Optional: small debounce wait to allow frontend filtering
    await browserManager.delay(500);

    // Press Enter (if required to trigger search)
    await page.keyboard.press("Enter");

    // Wait for checkbox or result to appear
    await browserManager.waitForElement(checkboxSelector, { timeout: 500000 });

    // Ensure checkbox is clickable before clicking
    await page.waitForFunction(
      (selector) => {
        const element = document.querySelector(selector);
        return element && element.offsetParent !== null && !element.disabled;
      },
      { timeout: 10000 },
      checkboxSelector
    );

    // Click the checkbox
    await page.click(checkboxSelector);

    // Optional: short confirmation wait
    await browserManager.delay(500);
  }
  async selectFirstNResults(count, browserManager) {
    const { page } = browserManager;
    const checkboxSelector = CONFIG.selectors.checkBox; // Assuming this matches multiple checkboxes

    // Wait for results to be available
    await browserManager.waitForElement(checkboxSelector);

    // Use retry mechanism for more robust checkbox selection
    await page.evaluate(
      (selector, limit) => {
        const checkboxes = document.querySelectorAll(selector);

        if (checkboxes.length === 0) {
          throw new Error("No checkboxes found to select.");
        }

        // Ensure count doesn't exceed available results
        const actualLimit = Math.min(limit, checkboxes.length);

        for (let i = 0; i < actualLimit; i++) {
          checkboxes[i].click();
        }

        console.log(`✅ Selected first ${actualLimit} results`);
      },
      checkboxSelector,
      count
    );
  }

  async performTerritoryFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting territory filter test`);

    try {
      console.log(`User ${userId}: Waiting for search input elements...`);
      await browserManager.waitForElement(CONFIG.selectors.searchInput);

      // Use XPath to click the third search input (Territory filter)
      console.log(`User ${userId}: Attempting to click third search input...`);
      await this.clickElementByXPath(
        browserManager.page,
        CONFIG.selectors.territoryEle
      );

      // Apply each territory filter
      for (const ele of ["008A", "010A", "019A", "021A", "025A"]) {
        await this.searchAndSelectValue(ele, browserManager);
      }

      console.log(`User ${userId}: Applying filter...`);
      // Apply the filter
      await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
      await browserManager.page.click(CONFIG.selectors.filterApplyBtn);

      // Wait for chart to reload after filter application
      const territoryFilterStartTime = new Date();
      console.log(`User ${userId}: Waiting for chart to load...`);
      await this.waitForChartToLoad(browserManager);
      await browserManager.waitForAppLoader();

      console.log(`User ${userId}: Waiting for All API calls to complete`);
      await browserManager.page.waitForNetworkIdle({
        idleTime: 500,
        timeout: 60000,
      });

      console.log(`User ${userId}: All API calls completed`);
      const territoryFilterTime =
        (new Date() - territoryFilterStartTime) / 1000;
      testResults.territoryFilterTime = territoryFilterTime;
      this.metrics.addMetric(
        userId,
        "territoryFilterTime",
        territoryFilterTime
      );
      console.log(
        `User ${userId}: Territory filter completed in ${territoryFilterTime}s`
      );
    } catch (error) {
      console.error(
        `User ${userId}: Error in territory filter test: ${error.message}`
      );
      
      // Take screenshot on territory filter failure
      await this.takeTestScreenshot(userId, 'territory_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }
  async performTimeFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting time filter test`);
    
    try {
      // Get random time data
      const timeData = getRandomData("time");
    console.log(
      `User ${userId}: Testing with time range: ${timeData.startDate} to ${timeData.endDate}`
    );

    // Wait for any chart loading to complete before attempting hover
    console.log(
      `User ${userId}: Checking for chart loading state before hover`
    );

    // Check if "Chart is loading..." text exists and wait for it to disappear
    const chartLoadingText = await browserManager.page.evaluate(() => {
      const elements = document.querySelectorAll(
        "span, div, p, h1, h2, h3, h4, h5, h6"
      );
      return Array.from(elements).some((el) =>
        el.textContent.includes("Chart is loading...")
      );
    });

    if (chartLoadingText) {
      console.log(
        `User ${userId}: Found "Chart is loading..." text, waiting for it to disappear`
      );
      await browserManager.page.waitForFunction(
        () => {
          const elements = document.querySelectorAll(
            "span, div, p, h1, h2, h3, h4, h5, h6"
          );
          return !Array.from(elements).some((el) =>
            el.textContent.includes("Chart is loading...")
          );
        },
        { timeout: CONFIG.timeouts.element }
      );
      console.log(
        `User ${userId}: Chart loading completed, proceeding with hover`
      );
    } else {
      console.log(
        `User ${userId}: No "Chart is loading..." text found, chart is stable`
      );
    }

    const chartElement = await browserManager.page.$(
      CONFIG.selectors.vizpadChart
    );
    if (!chartElement) {
      throw new Error(
        `Chart element not found: ${CONFIG.selectors.vizpadChart}`
      );
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
    await browserManager.page.type(
      CONFIG.selectors.filterColumnInput,
      CONFIG.data.DateColumn
    );
    await browserManager.waitForElement(CONFIG.selectors.filterColumnValue);
    await browserManager.page.click(CONFIG.selectors.filterColumnValue);
    await browserManager.waitForElement(
      CONFIG.selectors.filterColumnValueInput
    );
    await browserManager.page.click(CONFIG.selectors.filterColumnValueInput);
    // Select date selection type
    await browserManager.page.waitForNetworkIdle({
      idleTime: 500,
      timeout: 30000,
    });
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
        element.value = "";
        element.focus();
        // Trigger input event to ensure the field is properly cleared
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, CONFIG.selectors.startDate);

    // Alternative clear method using keyboard shortcuts
    await browserManager.page.focus(CONFIG.selectors.startDate);
    await browserManager.page.keyboard.down("Meta");
    await browserManager.page.keyboard.press("A");
    await browserManager.page.keyboard.up("Meta");
    await browserManager.page.keyboard.press("Backspace");
    // Type the new date
    await browserManager.page.type(
      CONFIG.selectors.startDate,
      timeData.startDate
    );

    console.log(`User ${userId}: Set start date to: ${timeData.startDate}`);

    // Set end date
    await browserManager.waitForElement(CONFIG.selectors.endDate);
    await browserManager.page.click(CONFIG.selectors.endDate);

    // Clear the field using multiple methods for reliability
    await browserManager.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.value = "";
        element.focus();
        // Trigger input event to ensure the field is properly cleared
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, CONFIG.selectors.endDate);

    // Alternative clear method using keyboard shortcuts
    await browserManager.page.focus(CONFIG.selectors.endDate);
    await browserManager.page.keyboard.down("Meta");
    await browserManager.page.keyboard.press("A");
    await browserManager.page.keyboard.up("Meta");
    await browserManager.page.keyboard.press("Backspace");

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
    this.metrics.addMetric(userId, "timeFilterTime", timeFilterTime);
    console.log(`User ${userId}: Time filter completed in ${timeFilterTime}s`);
    
    } catch (error) {
      console.error(`User ${userId}: Time filter test failed:`, error.message);
      
      // Take screenshot on time filter failure
      await this.takeTestScreenshot(userId, 'time_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }

  async performAPILogin(userId, testResults, browserManager, credentials) {
    console.log(`User ${userId}: Starting API login process`);
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
    const loginStartTime = new Date();
  
    try {
      // Build login API URL
      const currentUrl = CONFIG.login.baseUrl;
  
      console.log(`User ${userId}: Making API login request to: ${currentUrl}`);
  
      // Make API login request from Node (not inside the page)

      console.log(`User ${userId}: Making API login request to: ${currentUrl}`);
      console.log(`User ${userId}: API login request body:`, JSON.stringify({
        username: CONFIG.login.username,
        password: CONFIG.login.password,
        session: true,
      }));
      
      const response = await fetch(currentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: CONFIG.login.username,
          password: CONFIG.login.password,
          session: true,
        }),
      });
      
      console.log(`User ${userId}: API login response status: ${response.status}`);
      const loginEndTime = new Date();
      const loginTime = (loginEndTime - loginStartTime) / 1000;
      
      const responseData = await response.json();
      const headers = Object.fromEntries(response.headers.entries());
      console.log(`User ${userId}: Response headers:`, headers);
  
      // Check for success
      if (!response.ok) {
        throw new Error(`API login failed with status ${response.status}: ${response.statusText}`);
      }
  
      // Extract session cookie from header
      const setCookieHeader = headers['set-cookie'];
      let sessionValue = null;
  
      if (setCookieHeader) {
        const sessionMatch = setCookieHeader.match(/tellius_session=([^;]+)/);
        if (sessionMatch) {
          sessionValue = sessionMatch[1];
          console.log(`User ${userId}: Session cookie extracted successfully`);
        }
      }
  
      // Set cookie in Puppeteer
      if (sessionValue) {
        const cookieObj = {
          name: 'tellius_session',
          value: sessionValue,
          domain: new URL(CONFIG.login.baseUrl).hostname,
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'None',
        };
        await browserManager.page.setCookie(cookieObj);
        console.log(`User ${userId}: tellius_session cookie set in browser`);
      } else {
        console.warn(`User ${userId}: No tellius_session cookie found in response`);
      }
  
      // Navigate to Vizpad
      await browserManager.navigateTo(CONFIG.vizpadUrl);
  
      // Set user data in localStorage
      const userData = {
        role: 'admin',
        id: responseData?.id,
      };
  
      await browserManager.page.evaluate((data) => {
        console.log(data, "data")
        localStorage.setItem('userInfo', JSON.stringify(data));
        console.log('User data set in localStorage:', data);
      }, userData);
  
      console.log(`User ${userId}: User data set in localStorage`);
  
      // Measure total login time

      console.log(`User ${userId}: API login completed in ${loginTime}s`);
  
      // Store results
      testResults.loginTime = loginTime;
      testResults.apiLoadTime = loginTime; // Set API Load Time to login time
  
      return true;
    } catch (error) {
      console.error(`User ${userId}: API login failed:`, error.message);
  
      await browserManager.takeScreenshot(userId, 'api_login_failure', error);
  
      testResults.errors.push({
        step: 'API Login',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
  
      throw error;
    }
  }
  

  async performLogin(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting login process`);

    const loginStartTime = new Date();

    // Navigate to base URL
    await browserManager.navigateTo(CONFIG.login.baseUrl);

    // Click standard login if available
    try {
      const element = await browserManager.page.waitForSelector(CONFIG.selectors.standardLogin, { timeout: 5000 });
      if (element) {
        await browserManager.page.click(CONFIG.selectors.standardLogin);
        console.log(`User ${userId}: Standard login clicked`);
      }
    } catch (error) {
      console.log(`User ${userId}: Standard login not found, proceeding with direct login`);
    }

    // Fill username
    await browserManager.waitForElement(CONFIG.selectors.userNameInput);
    await browserManager.page.type(CONFIG.selectors.userNameInput, CONFIG.login.username);

    // Fill password
    await browserManager.waitForElement(CONFIG.selectors.passwordInput);
    await browserManager.page.type(CONFIG.selectors.passwordInput, CONFIG.login.password);

    // Click login button
    await browserManager.waitForElement(CONFIG.selectors.loginButton);
    await browserManager.page.click(CONFIG.selectors.loginButton);

    console.log(`User ${userId}: Login form submitted`);

    // Wait for login APIs
    console.log(`User ${userId}: Waiting for Login APIs...`);
    const apiStartTime = new Date();

    try {
      await Promise.all([
        browserManager.page.waitForResponse(
          response => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
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
      ]);

      const apiEndTime = new Date();
      const apiLoadTime = (apiEndTime - apiStartTime) / 1000;
      
      console.log(`User ${userId}: Login APIs completed in ${apiLoadTime}s`);
      
      // Store login metrics
      const loginEndTime = new Date();
      const loginTime = (loginEndTime - loginStartTime) / 1000;
      
      testResults.loginTime = loginTime;
      testResults.apiLoadTime = apiLoadTime;
      
      this.metrics.addMetric(userId, "loginTime", loginTime);
      this.metrics.addMetric(userId, "apiLoadTime", apiLoadTime);
      
      console.log(`User ${userId}: Login completed in ${loginTime}s`);
      await browserManager.waitForAppLoader();
      
    } catch (error) {
      console.log(`User ${userId}: Login API Load failed: ${error.message}`);
      
      // Take screenshot on login failure
      try {
        const screenshotPath = await browserManager.takeScreenshot(userId, 'login_failure', error);
        if (screenshotPath) {
          testResults.screenshots.push(screenshotPath);
        }
        testResults.errors.push({
          step: 'login',
          error: error.message,
          timestamp: new Date().toISOString(),
          screenshot: screenshotPath
        });
      } catch (screenshotError) {
        console.error(`Failed to capture login screenshot for User ${userId}:`, screenshotError.message);
      }
      
      throw new Error(`Login failed: ${error.message}`);
    }

    // Wait for app loader to disappear
    await browserManager.waitForAppLoader();
    
    return browserManager;
  }

  async takeTestScreenshot(userId, testStep, browserManager, testResults, error = null) {
    try {
      const screenshotPath = await browserManager.takeScreenshot(userId, testStep, error);
      if (screenshotPath) {
        testResults.screenshots.push(screenshotPath);
        console.log(`📸 Screenshot captured for User ${userId} at step: ${testStep}`);
      }
      return screenshotPath;
    } catch (screenshotError) {
      console.error(`❌ Failed to capture screenshot for User ${userId} at step ${testStep}:`, screenshotError.message);
      return null;
    }
  }

  async cleanupFiles(screenshots, csvFiles) {
    try {
      console.log("🧹 Starting cleanup of generated files...");
      
      // Clean up screenshots
      if (screenshots && screenshots.length > 0) {
        for (const screenshot of screenshots) {
          if (fs.existsSync(screenshot)) {
            fs.unlinkSync(screenshot);
            console.log(`🗑️  Deleted screenshot: ${screenshot}`);
          }
        }
      }
      
      // Clean up CSV files
      if (csvFiles && csvFiles.length > 0) {
        for (const csvFile of csvFiles) {
          if (fs.existsSync(csvFile)) {
            fs.unlinkSync(csvFile);
            console.log(`🗑️  Deleted CSV file: ${csvFile}`);
          }
        }
      }
      
      // Clean up error info files
      const screenshotsDir = 'testReports/screenshots';
      if (fs.existsSync(screenshotsDir)) {
        const files = fs.readdirSync(screenshotsDir);
        for (const file of files) {
          if (file.endsWith('_error.txt')) {
            const filePath = `${screenshotsDir}/${file}`;
            fs.unlinkSync(filePath);
            console.log(`🗑️  Deleted error file: ${filePath}`);
          }
        }
      }
      
      console.log("✅ Cleanup completed successfully");
    } catch (error) {
      console.error("❌ Error during cleanup:", error.message);
    }
  }

  async runAllTests() {
    const numUsers = parseInt(process.argv[3]) || 1;

    console.log(`Starting vizpad performance test with ${numUsers} users`);
    console.log(`Vizpad URL: ${CONFIG.vizpadUrl}`);

    // Global crash handler for unexpected errors
    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught Exception:', error);
      console.log('📸 Attempting to capture crash screenshot...');
      
      // Try to capture a crash screenshot if possible
      try {
        const crashScreenshotPath = `testReports/screenshots/crash_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        if (fs.existsSync('testReports/screenshots')) {
          // This is a best-effort attempt - may not work in all crash scenarios
          console.log('⚠️  Crash screenshot capture attempted');
        }
      } catch (crashError) {
        console.error('❌ Failed to capture crash screenshot:', crashError.message);
      }
      
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      console.log('📸 Attempting to capture rejection screenshot...');
      
      // Try to capture a rejection screenshot if possible
      try {
        const rejectionScreenshotPath = `testReports/screenshots/rejection_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        if (fs.existsSync('testReports/screenshots')) {
          console.log('⚠️  Rejection screenshot capture attempted');
        }
      } catch (rejectionError) {
        console.error('❌ Failed to capture rejection screenshot:', rejectionError.message);
      }
    });

    // Create test promises for concurrent execution
    const testPromises = Array(numUsers)
      .fill(null)
      .map((_, index) => this.runTest(index));

    // Run all tests concurrently using Promise.all
    const results = await Promise.all(testPromises);

    // Generate report
    await this.generateReport(results, numUsers);

    console.log("Vizpad performance test completed successfully");
  }

  async generateReport(results, numUsers) {
    const scriptRunTime = this.metrics.getScriptRunTime();

    // Debug: Log the results to see what we're working with
    console.log(`\n=== DEBUG: Results Summary ===`);
    console.log(`Number of results: ${results.length}`);
    // console.log(`Results structure:`, JSON.stringify(results[0], null, 2));

    // Display network timings
    console.log('\n📡 Network Timings:\n');
    
    // Collect all network requests from all test results
    const allNetworkRequests = [];
    results.forEach(result => {
      if (result.networkRequests) {
        allNetworkRequests.push(...result.networkRequests);
      }
    });
    
    // Sort by duration and display top 15
    const sorted = allNetworkRequests
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 15);

    for (const req of sorted) {
      let extraInfo = '';
      if (req.chartName) {
        extraInfo = ` [Chart: ${req.chartName}]`;
      } else if (req.datasetName) {
        extraInfo = ` [Dataset: ${req.datasetName}]`;
      }
      console.log(`${req.method.padEnd(6)} ${req.status || '-'}  ${req.durationMs.toString().padStart(5)} ms  ${req.url}${extraInfo}`);
    }

    // Save network logs to text file
    const networkLogFilename = `testReports/network_logs_${numUsers}_users.txt`;
    let networkLogContent = `Network Performance Log - ${new Date().toISOString()}\n`;
    networkLogContent += `Test URL: ${CONFIG.vizpadUrl}\n`;
    networkLogContent += `Number of Users: ${numUsers}\n`;
    networkLogContent += `Total Network Requests: ${allNetworkRequests.length}\n`;
    networkLogContent += `Script Runtime: ${scriptRunTime}s\n\n`;
    
    networkLogContent += `Top 15 Slowest Network Requests:\n`;
    networkLogContent += `${'Method'.padEnd(6)} ${'Status'.padEnd(6)} ${'Duration'.padStart(8)} ${'Chart/Dataset Name'.padEnd(30)} ${'URL'}\n`;
    networkLogContent += `${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(30)} ${'-'.repeat(50)}\n`;
    
    for (const req of sorted) {
      const name = req.chartName || req.datasetName || 'N/A';
      networkLogContent += `${req.method.padEnd(6)} ${(req.status || '-').toString().padEnd(6)} ${req.durationMs.toString().padStart(8)} ms  ${name.padEnd(30)} ${req.url}\n`;
    }
    
    // Add all network requests (not just top 15) for complete analysis
    networkLogContent += `\n\nAll Network Requests (sorted by duration):\n`;
    networkLogContent += `${'Method'.padEnd(6)} ${'Status'.padEnd(6)} ${'Duration'.padStart(8)} ${'Chart/Dataset Name'.padEnd(30)} ${'MIME Type'.padEnd(20)} ${'URL'}\n`;
    networkLogContent += `${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(30)} ${'-'.repeat(20)} ${'-'.repeat(50)}\n`;
    
    const allSorted = allNetworkRequests.sort((a, b) => b.durationMs - a.durationMs);
    for (const req of allSorted) {
      const name = req.chartName || req.datasetName || 'N/A';
      networkLogContent += `${req.method.padEnd(6)} ${(req.status || '-').toString().padEnd(6)} ${req.durationMs.toString().padStart(8)} ms  ${name.padEnd(30)} ${(req.mimeType || '-').padEnd(20)} ${req.url}\n`;
    }
    
    // Add summary statistics
    const totalDuration = allNetworkRequests.reduce((sum, req) => sum + (req.durationMs || 0), 0);
    const avgDuration = allNetworkRequests.length > 0 ? totalDuration / allNetworkRequests.length : 0;
    const maxDuration = Math.max(...allNetworkRequests.map(req => req.durationMs || 0));
    const minDuration = Math.min(...allNetworkRequests.map(req => req.durationMs || 0));
    
    networkLogContent += `\n\nNetwork Performance Summary:\n`;
    networkLogContent += `Total Requests: ${allNetworkRequests.length}\n`;
    networkLogContent += `Total Duration: ${totalDuration.toFixed(2)} ms\n`;
    networkLogContent += `Average Duration: ${avgDuration.toFixed(2)} ms\n`;
    networkLogContent += `Max Duration: ${maxDuration} ms\n`;
    networkLogContent += `Min Duration: ${minDuration} ms\n`;
    
    // Group by status codes
    const statusGroups = {};
    allNetworkRequests.forEach(req => {
      const status = req.status || 'unknown';
      statusGroups[status] = (statusGroups[status] || 0) + 1;
    });
    
    networkLogContent += `\nRequests by Status Code:\n`;
    Object.entries(statusGroups).forEach(([status, count]) => {
      networkLogContent += `${status}: ${count} requests\n`;
    });
    
    fs.writeFileSync(networkLogFilename, networkLogContent);
    console.log(`📄 Network logs saved to: ${networkLogFilename}`);

    // Save CSV file using manual generation (more reliable)
    const filename = `testReports/vizpad_test_${numUsers}_users.csv`;

    let csvContent = "Script Time (s),Number of Users,Vizpad URL\n";
    csvContent += `${scriptRunTime},${numUsers},"${CONFIG.vizpadUrl}"\n\n`;

    // Add headers with tab index information
    let headerRow =
      "User ID,Login Time (s),API Load Time (s),Vizpad Load (s),Chart Load (s),Area Filter 1 (s),Tab Switch 1 (s) - Tab Index,Area Filter 2 (s),Tab Switch 2 (s) - Tab Index,Region Filter (s),Territory Filter (s),Tab Switch 3 (s) - Tab Index,Area Filter 3 (s),Status,Error Message\n";
    csvContent += headerRow;

    // Add data rows with tab index information
    results.forEach((result) => {
      let dataRow = `${result.userId || 0},${result.loginTime || 0},${result.apiLoadTime || 0},${result.vizpadLoadTime || 0},${
        result.chartLoadTime || 0
      }`;
      dataRow += `,${result.areaFilterTime1 || 0}`;
      dataRow += `,${result.tabSwitchTime1 || 0}`;
      dataRow += `,${result.areaFilterTime2 || 0}`;
      dataRow += `,${result.tabSwitchTime2 || 0}`;
      dataRow += `,${result.regionFilterTime || 0}`;
      dataRow += `,${result.territoryFilterTime || 0}`;
      dataRow += `,${result.tabSwitchTime3 || 0}`;
      dataRow += `,${result.areaFilterTime3 || 0}`;

      // Add status and error message
      const status = result.success ? "SUCCESS" : "FAILED";
      const errorMessage =
        this.metrics.errors
          .filter((error) => error.userId === result.userId)
          .map((error) => error.error)
          .join("; ") || "";

      dataRow += `,${status},"${errorMessage}"\n`;
      csvContent += dataRow;
    });

    fs.writeFileSync(filename, csvContent);
    console.log(`CSV file saved successfully: ${filename}`);
    console.log(`CSV contains ${results.length} user records`);

    // Create detailed network requests CSV file
    const networkCsvFilename = `testReports/network_requests_${numUsers}_users.csv`;
    let networkCsvContent = "User ID,Request ID,Method,Status,Duration (ms),Chart Name,Dataset Name,MIME Type,URL,Start Time,End Time\n";
    
    results.forEach((result, resultIndex) => {
      if (result.networkRequests) {
        result.networkRequests.forEach((req, reqIndex) => {
          const userRow = `${result.userId || resultIndex + 1},${req.requestId || reqIndex + 1},${req.method || 'N/A'},${req.status || 'N/A'},${req.durationMs || 0},${req.chartName || 'N/A'},${req.datasetName || 'N/A'},${req.mimeType || 'N/A'},"${req.url || 'N/A'}",${req.startTime || 0},${req.endTime || 0}\n`;
          networkCsvContent += userRow;
        });
      }
    });
    
    fs.writeFileSync(networkCsvFilename, networkCsvContent);
    console.log(`📊 Detailed network requests CSV saved: ${networkCsvFilename}`);

    // Print summary
    console.log("\n=== VIZPAD PERFORMANCE TEST SUMMARY ===");
    console.log(`Total script runtime: ${scriptRunTime}s`);
    console.log(`Users tested: ${numUsers}`);
    console.log(`Successful tests: ${results.filter((r) => r.success).length}`);
    console.log(`Failed tests: ${results.filter((r) => !r.success).length}`);
    console.log(`CSV report saved: ${filename}`);

    // Display results in table format
    console.log("\n=== DETAILED RESULTS TABLE ===");

    // Prepare table data with dynamic column names based on actual tab selections
    const tableData = results.map((result) => {
      const status = result.success ? "✅ Success" : "❌ Failed";

      const row = {
        "User ID": result.userId,
        "Login Time (s)": result.loginTime.toFixed(2),
        "API Load Time (s)": result.apiLoadTime.toFixed(2),
        "Vizpad Load (s)": result.vizpadLoadTime.toFixed(2),
        "Chart Load (s)": result.chartLoadTime.toFixed(2),
        // 'Area Filter 1 (s)': result.areaFilterTime1.toFixed(2),
        "Tab Switch 1 (s)": `${result.tabSwitchTime1.toFixed(2)} (Tab ${
          result.randomTab1 || "N/A"
        })`,
        // 'Area Filter 2 (s)': result.areaFilterTime2.toFixed(2),
        "Tab Switch 2 (s)": `${result.tabSwitchTime2.toFixed(2)} (Tab ${
          result.randomTab2 || "N/A"
        })`,
        // 'Region Filter (s)': result.regionFilterTime.toFixed(2),
        // 'Territory Filter (s)': result.territoryFilterTime.toFixed(2),
        "Tab Switch 3 (s)": `${result.tabSwitchTime3.toFixed(2)} (Tab ${
          result.randomTab3 || "N/A"
        })`,
        // 'Area Filter 3 (s)': result.areaFilterTime3.toFixed(2),
        Status: status,
      };

      return row;
    });

    // Display the table
    console.table(tableData);

    // Display random tab selection summary
    console.log("\n=== RANDOM TAB SELECTION SUMMARY ===");
    results.forEach((result) => {
      console.log(
        `User ${result.userId}: Random tabs selected - Tab 1: ${
          result.randomTab1 || "N/A"
        }, Tab 2: ${result.randomTab2 || "N/A"}, Tab 3: ${
          result.randomTab3 || "N/A"
        }`
      );
    });

    // Calculate and display averages
    const successfulResults = results.filter((r) => r.success);
    if (successfulResults.length > 0) {
      console.log("\n=== AVERAGE PERFORMANCE METRICS ===");
      const averages = {
        "Average Login Time (s)": (
          successfulResults.reduce((sum, r) => sum + r.loginTime, 0) /
          successfulResults.length
        ).toFixed(2),
        "Average API Load Time (s)": (
          successfulResults.reduce((sum, r) => sum + r.apiLoadTime, 0) /
          successfulResults.length
        ).toFixed(2),
        "Average Vizpad Load (s)": (
          successfulResults.reduce((sum, r) => sum + r.vizpadLoadTime, 0) /
          successfulResults.length
        ).toFixed(2),
        "Average Chart Load (s)": (
          successfulResults.reduce((sum, r) => sum + r.chartLoadTime, 0) /
          successfulResults.length
        ).toFixed(2),
        // 'Average Area Filter 1 (s)': (successfulResults.reduce((sum, r) => sum + r.areaFilterTime1, 0) / successfulResults.length).toFixed(2),
        "Average Tab Switch 1 (s)": (
          successfulResults.reduce((sum, r) => sum + r.tabSwitchTime1, 0) /
          successfulResults.length
        ).toFixed(2),
        // 'Average Area Filter 2 (s)': (successfulResults.reduce((sum, r) => sum + r.areaFilterTime2, 0) / successfulResults.length).toFixed(2),
        "Average Tab Switch 2 (s)": (
          successfulResults.reduce((sum, r) => sum + r.tabSwitchTime2, 0) /
          successfulResults.length
        ).toFixed(2),
        // 'Average Region Filter (s)': (successfulResults.reduce((sum, r) => sum + r.regionFilterTime, 0) / successfulResults.length).toFixed(2),
        // 'Average Territory Filter (s)': (successfulResults.reduce((sum, r) => sum + r.territoryFilterTime, 0) / successfulResults.length).toFixed(2),
        "Average Tab Switch 3 (s)": (
          successfulResults.reduce((sum, r) => sum + r.tabSwitchTime3, 0) /
          successfulResults.length
        ).toFixed(2),
        // 'Average Area Filter 3 (s)': (successfulResults.reduce((sum, r) => sum + r.areaFilterTime3, 0) / successfulResults.length).toFixed(2),
      };
      console.table(averages);
    }

    if (this.metrics.errors.length > 0) {
      console.log("\n==== ERRORS ====");
      this.metrics.errors.forEach((error) => {
        console.log(`User ${error.userId}: ${error.error} (${error.context})`);
      });
    }

    // Send email if enabled
    if (CONFIG.enableEmail) {
      try {
        console.log("\n📧 Sending email report...");
        
        // Collect all screenshots from failed tests
        const allScreenshots = [];
        results.forEach(result => {
          console.log(`📸 User ${result.userId} screenshots:`, result.screenshots);
          if (result.screenshots && result.screenshots.length > 0) {
            allScreenshots.push(...result.screenshots);
          }
        });
        
        console.log(`📸 Found ${allScreenshots.length} screenshot(s) to attach`);
        console.log(`📸 Screenshot paths:`, allScreenshots);
        
        const emailService = new EmailService();
        await emailService.sendTestResults(
          results,
          numUsers,
          scriptRunTime,
          CONFIG.vizpadUrl,
          filename,
          networkCsvFilename,
          networkLogFilename,
          null, // comprehensiveNetworkCsvFilePath (not used in current implementation)
          allScreenshots
        );
        console.log("✅ Email report sent successfully!");
        
        // Clean up files after successful email sending
        const csvFiles = [filename, networkCsvFilename, networkLogFilename].filter(f => f);
        await this.cleanupFiles(allScreenshots, csvFiles);
        
      } catch (error) {
        console.error("❌ Failed to send email report:", error.message);
        console.log("Continuing without email...");
        
        // Still clean up files even if email fails
        const csvFiles = [filename, networkCsvFilename, networkLogFilename].filter(f => f);
        await this.cleanupFiles(allScreenshots, csvFiles);
      }
    } else {
      // Clean up files even if email is disabled
      const csvFiles = [filename, networkCsvFilename, networkLogFilename].filter(f => f);
      const allScreenshots = [];
      results.forEach(result => {
        if (result.screenshots && result.screenshots.length > 0) {
          allScreenshots.push(...result.screenshots);
        }
      });
      await this.cleanupFiles(allScreenshots, csvFiles);
    }
  }
}

// Main execution
async function main() {
  try {
    const runner = new VizpadTestRunner();
    await runner.runAllTests();
  } catch (error) {
    console.error("Vizpad test execution failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { VizpadTestRunner, BrowserManager, PerformanceMetrics, LoaderComponent  };
