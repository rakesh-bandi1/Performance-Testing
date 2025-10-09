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
// Parse command line arguments
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const config = {
    users: 1,
    tabCount: 3,
    username: "",
    password: "",
    loginUrl: "",
    vizpadUrl: "",
    enableFilters: false,
    enableTimeFilter: false,
    enableEmail: false,
    tabSwitch: "false"
  };

  args.forEach(arg => {
    if (arg.startsWith('--users=')) {
      config.users = parseInt(arg.split('=')[1]) || 1;
    } else if (arg.startsWith('--tabCount=')) {
      config.tabCount = parseInt(arg.split('=')[1]) || 3;
    } else if (arg.startsWith('--username=')) {
      config.username = arg.split('=')[1] || "";
    } else if (arg.startsWith('--password=')) {
      config.password = arg.split('=')[1] || "";
    } else if (arg.startsWith('--loginUrl=')) {
      config.loginUrl = arg.split('=')[1] || "";
    } else if (arg.startsWith('--vizpadUrl=')) {
      config.vizpadUrl = arg.split('=')[1] || "";
    } else if (arg.startsWith('--enableFilters=')) {
      config.enableFilters = arg.split('=')[1] === 'true';
    } else if (arg.startsWith('--enableTimeFilter=')) {
      config.enableTimeFilter = arg.split('=')[1] === 'true';
    } else if (arg.startsWith('--enableEmail=')) {
      config.enableEmail = arg.split('=')[1] === 'true';
    } else if (arg.startsWith('--tabSwitch=')) {
      config.tabSwitch = arg.split('=')[1] || "false";
    }
  });

  return config;
}

const commandLineConfig = parseCommandLineArgs();

const CONFIG = {
  users: commandLineConfig.users,
  tabCount: commandLineConfig.tabCount,
  username: commandLineConfig.username,
  password: commandLineConfig.password,
  loginUrl: commandLineConfig.loginUrl,
  vizpadUrl: commandLineConfig.vizpadUrl,
  enableFilters: commandLineConfig.enableFilters,
  enableTimeFilter: commandLineConfig.enableTimeFilter,
  enableEmail: commandLineConfig.enableEmail,
  tabSwitch: commandLineConfig.tabSwitch,
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
    username: commandLineConfig.username,
    password: commandLineConfig.password,
    baseUrl: commandLineConfig.loginUrl,
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
      regionFilterTime: 0,
      territoryFilterTime: 0,
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

      // Step 2: Switch to tabs and apply filters randomly
      if (CONFIG.tabCount > 0) {
        // Create array of available filters for random selection
        const availableFilters = ['area', 'region', 'territory'];
        
        for (let i = 0; i < parseInt(CONFIG.tabCount); i++) { 
          console.log(`User ${userId}: Step ${i+2} - Switching to Tab ${i+2}`);
          await this.testExecutionHelpers.performTabSwitch(
            userId,
            testResults,
            browserManager,
            i+2,
            "tabSwitch" + (i+1),
            CONFIG
          );

          // Apply random filter if filters are enabled
          if (CONFIG.enableFilters && availableFilters.length > 0) {
            const randomFilterIndex = Math.floor(Math.random() * availableFilters.length);
            const selectedFilter = availableFilters[randomFilterIndex];
            availableFilters.splice(randomFilterIndex, 1); // Remove to avoid duplicates
            
            console.log(`User ${userId}: Step ${i+2} - Applying ${selectedFilter} filter on Tab ${i+2}`);
            
            switch (selectedFilter) {
              case 'area':
                await this.testExecutionHelpers.performAreaFilterTest(userId, testResults, browserManager, 'areaFilterTime1', CONFIG);
                break;
              case 'region':
                await this.testExecutionHelpers.performRegionFilterTest(userId, testResults, browserManager, CONFIG);
                break;
              case 'territory':
                await this.testExecutionHelpers.performTerritoryFilterTest(userId, testResults, browserManager, CONFIG);
                break;
            }
          }
        }
      }

      // Step 3: Apply Time filter if enabled (separate from other filters)
      if (CONFIG.enableTimeFilter) {
        console.log(`User ${userId}: Step ${CONFIG.tabCount + 2} - Applying Time filter`);
        await this.testExecutionHelpers.performTimeFilterTest(userId, testResults, browserManager, CONFIG);
      }
      
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
    const numUsers = CONFIG.users;

    console.log(`Starting vizpad performance test with ${numUsers} users`);
    console.log(`Configuration:`);
    console.log(`- Users: ${CONFIG.users}`);
    console.log(`- Tab Count: ${CONFIG.tabCount}`);
    console.log(`- Username: ${CONFIG.username}`);
    console.log(`- Login URL: ${CONFIG.loginUrl}`);
    console.log(`- Vizpad URL: ${CONFIG.vizpadUrl}`);
    console.log(`- Enable Filters: ${CONFIG.enableFilters}`);
    console.log(`- Enable Time Filter: ${CONFIG.enableTimeFilter}`);
    console.log(`- Enable Email: ${CONFIG.enableEmail}`);
    console.log(`- Tab Switch: ${CONFIG.tabSwitch}`);
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
