const ObjectsToCsv = require("objects-to-csv");
const puppeteer = require("puppeteer");
const { getRandomData, getRandomFilterData } = require("./helper.js");
const EmailService = require("./emailService.js");

// Configuration
const CONFIG = {
  vizpadUrl:
    process.argv[2] ||
    "https://galaxyai.bayer.com/dashboard/270c03b/a5986ed7-28c8-4739-bc84-8ef2dfead134?utm_source=546bf610-3e40-4ebb-b57e-78a7f5a076fc",
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
  },
  data: {
    DateColumn: "CONVERSION_DATE",
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
      }
    });
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
    };

    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();

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
    } catch (error) {
      testResults.success = false;
      this.metrics.addError(userId, error, "Vizpad test execution");
      console.error(`User ${userId} test failed:`, error.message);
    } finally {
      // Store network requests in test results before closing browser
      testResults.networkRequests = Array.from(browserManager.requests.values())
        .filter(r => r.durationMs)
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
  }
  async performRegionFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting region filter test`);

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
      throw error;
    }
  }
  async performTimeFilterTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting time filter test`);
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

    console.log("Vizpad performance test completed successfully");
  }

  async generateReport(results, numUsers) {
    const scriptRunTime = this.metrics.getScriptRunTime();

    // Debug: Log the results to see what we're working with
    console.log(`\n=== DEBUG: Results Summary ===`);
    console.log(`Number of results: ${results.length}`);
    console.log(`Results structure:`, JSON.stringify(results[0], null, 2));

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
      console.log(`${req.method.padEnd(6)} ${req.status || '-'}  ${req.durationMs.toString().padStart(5)} ms  ${req.url}`);
    }

    // Save network logs to text file
    const networkLogFilename = `testReports/network_logs_${numUsers}_users.txt`;
    let networkLogContent = `Network Performance Log - ${new Date().toISOString()}\n`;
    networkLogContent += `Test URL: ${CONFIG.vizpadUrl}\n`;
    networkLogContent += `Number of Users: ${numUsers}\n`;
    networkLogContent += `Total Network Requests: ${allNetworkRequests.length}\n`;
    networkLogContent += `Script Runtime: ${scriptRunTime}s\n\n`;
    
    networkLogContent += `Top 15 Slowest Network Requests:\n`;
    networkLogContent += `${'Method'.padEnd(6)} ${'Status'.padEnd(6)} ${'Duration'.padStart(8)} ${'URL'}\n`;
    networkLogContent += `${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(50)}\n`;
    
    for (const req of sorted) {
      networkLogContent += `${req.method.padEnd(6)} ${(req.status || '-').toString().padEnd(6)} ${req.durationMs.toString().padStart(8)} ms  ${req.url}\n`;
    }
    
    // Add all network requests (not just top 15) for complete analysis
    networkLogContent += `\n\nAll Network Requests (sorted by duration):\n`;
    networkLogContent += `${'Method'.padEnd(6)} ${'Status'.padEnd(6)} ${'Duration'.padStart(8)} ${'MIME Type'.padEnd(20)} ${'URL'}\n`;
    networkLogContent += `${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(20)} ${'-'.repeat(50)}\n`;
    
    const allSorted = allNetworkRequests.sort((a, b) => b.durationMs - a.durationMs);
    for (const req of allSorted) {
      networkLogContent += `${req.method.padEnd(6)} ${(req.status || '-').toString().padEnd(6)} ${req.durationMs.toString().padStart(8)} ms  ${(req.mimeType || '-').padEnd(20)} ${req.url}\n`;
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
      "User ID,Vizpad Load (s),Chart Load (s),Area Filter 1 (s),Tab Switch 1 (s) - Tab Index,Area Filter 2 (s),Tab Switch 2 (s) - Tab Index,Region Filter (s),Territory Filter (s),Tab Switch 3 (s) - Tab Index,Area Filter 3 (s),Status,Error Message\n";
    csvContent += headerRow;

    // Add data rows with tab index information
    results.forEach((result) => {
      let dataRow = `${result.userId || 0},${result.vizpadLoadTime || 0},${
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
        const emailService = new EmailService();
        await emailService.sendTestResults(
          results,
          numUsers,
          scriptRunTime,
          CONFIG.vizpadUrl,
          filename
        );
        console.log("✅ Email report sent successfully!");
      } catch (error) {
        console.error("❌ Failed to send email report:", error.message);
        console.log("Continuing without email...");
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
    console.error("Vizpad test execution failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { VizpadTestRunner, BrowserManager, PerformanceMetrics };
