const ObjectsToCsv = require("objects-to-csv");
const fs = require("fs");
const { getRandomData, getRandomFilterData } = require("./helper.js");
const EmailService = require("./emailService.js");
// Using built-in fetch API (Node.js 18+)
const fetch = globalThis.fetch;

// Import helper modules
const BrowserManager = require("./Helper/browserManager.js");
const PerformanceMetrics = require("./Helper/performanceMetrics.js");
const TestHelpers = require("./Helper/testHelpers.js");
const TestExecutionHelpers = require("./Helper/testExecutionHelpers.js");
const CONFIG = {
  vizpadUrl:
    process.argv[2] ||
    "https://galaxyai-dev.bayer.com/dashboard/57fdc931-8066-482b-af84-a411e64dfc4d/05dbc228-6c8c-49f5-9acb-856eab64dd75",
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
    username: process.argv[6] || "performanceTest",
    password: process.argv[7] || "auto_TEST4321!",
    baseUrl: process.argv[8] || "https://galaxyai-dev.bayer.com/api/login",
  },
  delays: {
    pageLoad: 2000,
  },
};


// Vizpad test runner class
class VizpadTestRunner {
  constructor() {
    this.metrics = new PerformanceMetrics();
    this.testHelpers = new TestHelpers();
    this.testHelpers.setMetrics(this.metrics);
    this.testExecutionHelpers = new TestExecutionHelpers(this.metrics, this.testHelpers);
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
        await this.testExecutionHelpers.performAPILogin(userId, testResults, browserManager, CONFIG);

      // Step 1: Open the Embed URL and wait for all charts to load
      console.log(
        `User ${userId}: Step 1 - Loading Vizpad and waiting for charts`
      );
      await this.testExecutionHelpers.performVizpadTest(userId, testResults, browserManager, CONFIG);

      // Step 2: Apply Area filter and wait for all charts to load
      // console.log(`User ${userId}: Step 2 - Applying Area filter`);
      // await this.performAreaFilterTest(userId, testResults, browserManager, 'areaFilterTime1');

      // Step 3: Switch to a random tab and wait for all charts to load
      // const availableTabs = [1, 2, 3, 4];
      // const randomTab1 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // testResults.randomTab1 = randomTab1;
      // console.log(`User ${userId}: Step 3 - Switching to random Tab ${randomTab1}`);
      for (let i = 0; i < 3; i++) { 
        await this.testExecutionHelpers.performTabSwitch(
          userId,
          testResults,
          browserManager,
          i+2,
          "tabSwitchTime" + (i+1),
          CONFIG
        );
      }
      // await this.performAreaFilterTest(userId, testResults, browserManager, 'areaFilterTime2');

      // Step 4: Switch to another random tab and wait for all charts to load
      // let randomTab2 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // // Ensure we don't select the same tab as the previous one
      // while (randomTab2 === randomTab1) {
      //   randomTab2 = availableTabs[Math.floor(Math.random() * availableTabs.length)];
      // }
      // testResults.randomTab2 = randomTab2;
      // console.log(`User ${userId}: Step 4 - Switching to random Tab ${randomTab2}`);
      // await this.testExecutionHelpers.performTabSwitch(
      //   userId,
      //   testResults,
      //   browserManager,
      //   3,
      //   "tabSwitchTime2",
      //   CONFIG
      // );

      // Step 5: Apply Region filter and wait for all charts to load
      // console.log(`User ${userId}: Step 5 - Applying Region filter`);
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
      // await this.testExecutionHelpers.performTabSwitch(
      //   userId,
      //   testResults,
      //   browserManager,
      //   4,
      //   "tabSwitchTime3",
      //   CONFIG
      // );

      // Step 5: Apply Area filter and wait for all charts to load
      // console.log(`User ${userId}: Step 5 - Applying Area filter`);
      // await this.performAreaFilterTest(userId, testResults, browserManager, 'areaFilterTime3');
      
      // Take a final screenshot to verify screenshot functionality
      console.log(`User ${userId}: Taking final test completion screenshot`);
      await this.testHelpers.takeTestScreenshot(userId, 'test_completion', browserManager, testResults);
      
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
        '/api/login',
        '/vizResponse',
        '/tqlSpark', 
        '/getVizMetadata',
        '/annotations/chartFormMappings',
        '/customCalendars',
        '/auth/runtimeConfig',
        '/businessViews',
        '/datasetMetadata',
        '/api/config',
        '/vizpadView'
      ];
      
      // Debug: Log all requests before filtering
      const allRequests = Array.from(browserManager.requests.values());
      
      testResults.networkRequests = allRequests
        .filter(r => r.durationMs && targetAPIs.some(api => r.url.includes(api)))
        .sort((a, b) => b.durationMs - a.durationMs);
              
      await browserManager.close();
    }

    return testResults;
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
      .map((_, index) => this.runTest(index + 1));

    // Run all tests concurrently using Promise.all
    const results = await Promise.all(testPromises);

    // Generate report
    await this.testExecutionHelpers.generateReport(results, numUsers, CONFIG);

    console.log("Vizpad performance test completed successfully");
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

module.exports = { 
  VizpadTestRunner, 
  BrowserManager, 
  PerformanceMetrics, 
  TestHelpers,
  TestExecutionHelpers 
};
