const ObjectsToCsv = require('objects-to-csv');
const puppeteer = require('puppeteer');

// Configuration
const CONFIG = {
  baseURL: process.argv[4] || 'https://demo.app.tellius.com',
  loginDetails: {
    userName: process.argv[5] || 'performanceTest',
    pwd: process.argv[6] || 'auto_TEST4321!',
    query: 'Show me Address_state and customerID',
  },
  timeouts: {
    navigation: 100000,
    element: 200000,
    longNavigation: 1000000,
  },
  filterData: {
    columnName: "Gender",
    operator: "Equals",
    value: "Female",
  },
  viewport: { width: 1366, height: 768 },
  selectors: {
    welcomeText: 'span',
    standardLogin: '[data-cy-id="cy-stndrd-lgn"]',
    username: '[data-cy-id="cy-usrnm"]',
    password: '[data-cy-id="cy-pswrd"]',
    loginButton: '[data-cy-id="cy-lgn-btn"]',
    searchIcon: '[data-cy-id="cy-srch"]',
    searchQuery: '[data-cy-id="cy-srch-qry"]',
    vizContainer: '.vizContainer',
    dashboardCards: '[data-testid^="vizpad-card-"]',
    chart0: '[data-cy-id="cy-vzpd-chart0"]',
    highcharts: '.highcharts-container',
    createDashboard: '[data-testid="create-new-vizpad"]',
    chartLoading: 'Vizpad is loading...',
    chartLoadingSpan: 'span',
    applyFilterBtn: "[data-cy-id='cy-vzpd-add-tab-fltr-btn']",
    globalFilterToggle: "[data-testid='cy-global-filter-tgl']",
    searchColumn: "[data-cy-id='cy-multi-bv-search-input']",
    columnName: "[data-cy-id='cy-multi-bv-search-column-0']",
    operatorInput: "[data-cy-id='cy-popup-oprtr-slct-input']",
    operatorValue: "[data-cy-id='cy-popup-oprtr-item2']",
    filterValue: "[data-cy-id='cy-popup-vl-input']",
    filterValueInput: "[data-cy-id='cy-popup-vl-item0']",
    applyBtn: "[data-cy-id='cy-popup-aply']"
  },
  delays: {
    searchFocus: 4000,
    queryType: 3000,
    searchSubmit: 10000,
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
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeouts.navigation,
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
    await this.page.waitForSelector(selector, { ...defaultOptions, ...options });
  }

  async waitForText(text, timeout = CONFIG.timeouts.element) {
    await this.page.waitForFunction(
      (searchText) => {
        const elements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
        return Array.from(elements).some(el => el.textContent.includes(searchText));
      },
      { timeout },
      text
    );
  }

  async delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Test runner class
class PerformanceTestRunner {
  constructor() {
    this.metrics = new PerformanceMetrics();
  }

  async runTest(userId, userConfig) {
    const testResults = {
      userId,
      loginRenderTime: 0,
      homePageRender: 0,
      searchResponseTime: 0,
      initialVizRender: 0,
      afterSuccessfulLoad: 0,
      filterApplyTime: 0,
      success: true,
    };

    // Create independent browser instance for each test
    const browserManager = new BrowserManager();

    try {
      await browserManager.launch();
      
      // Login flow
      await this.performLogin(userId, userConfig, testResults, browserManager);
      
      // Search flow
      await this.performSearch(userId, userConfig, testResults, browserManager);
      
      // Dashboard flow (if enabled)
      if (process.argv[3] === 'true') {
        await this.performDashboardTest(userId, testResults, browserManager);
      }

    } catch (error) {
      testResults.success = false;
      this.metrics.addError(userId, error, 'Test execution');
      console.error(`User ${userId} test failed:`, error.message);
    } finally {
      await browserManager.close();
    }

    return testResults;
  }
  async performLogin(userId, userConfig, testResults, browserManager) {
    console.log(`User ${userId}: Starting login process`);
    
    const loginStartTime = new Date();
    
    // Navigate to login page
    await browserManager.navigateTo(`${CONFIG.baseURL}/login`);
    
    // Wait for welcome text
    await browserManager.waitForText('Welcome to');
    console.log(`User ${userId}: Welcome text loaded`);
    // Record login render time
    const loginRenderTime = (new Date() - loginStartTime) / 1000;
    testResults.loginRenderTime = loginRenderTime;
    this.metrics.addMetric(userId, 'loginRenderTime', loginRenderTime);
    console.log(`User ${userId}: Login screen rendered in ${loginRenderTime}s`);
    // Wait for login form
    await browserManager.waitForElement(CONFIG.selectors.standardLogin);
  
    // Click standard login and fill credentials
    await browserManager.page.click(CONFIG.selectors.standardLogin);
    await browserManager.page.type(CONFIG.selectors.username, userConfig.userName);
    await browserManager.page.type(CONFIG.selectors.password, userConfig.pwd);
    
    // Submit login and wait for API call
    const loginSubmitTime = new Date();
    
    // Click login button first
    await browserManager.page.click(CONFIG.selectors.loginButton);
    console.log(`User ${userId}: Login button clicked, waiting for API response...`);
    
    // Wait for the login API call to complete and capture response
    const loginResponse = await browserManager.page.waitForResponse(
      response => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
      { timeout: CONFIG.timeouts.navigation }
    );
    
    // Check if the API call was successful
    if (!loginResponse.ok()) {
      const errorStatus = loginResponse.status();
      const errorText = await loginResponse.text().catch(() => 'Unable to read error response');
      const errorMessage = `Login API failed: ${errorStatus} ${loginResponse.statusText()} - ${errorText}`;
      
      console.error(`User ${userId}: ${errorMessage}`);
      this.metrics.addError(userId, new Error(errorMessage), 'Login API call');
      
      // Mark the test as failed
      testResults.success = false;
      testResults.loginRenderTime = 0;
      testResults.homePageRender = 0;
      testResults.searchResponseTime = 0;
      testResults.initialVizRender = 0;
      testResults.afterSuccessfulLoad = 0;
      testResults.filterApplyTime = 0;
      
      throw new Error(errorMessage);
    }
    
    console.log(`User ${userId}: Login API call completed successfully (${loginResponse.status()})`);
    
    // Record home page render time
    const homePageRenderTime = (new Date() - loginSubmitTime) / 1000;
    testResults.homePageRender = homePageRenderTime;
    this.metrics.addMetric(userId, 'homePageRender', homePageRenderTime);
    console.log(`User ${userId}: Home page rendered in ${homePageRenderTime}s`);
  }

  async performSearch(userId, userConfig, testResults, browserManager) {
    console.log(`User ${userId}: Starting search process`);
    
    // Navigate to search page
    await browserManager.navigateTo(`${CONFIG.baseURL}/search`, {
      timeout: CONFIG.timeouts.longNavigation,
    });
    
    // Wait for search query input
    await browserManager.waitForElement(CONFIG.selectors.searchQuery);
    
    // Focus and type query
    await browserManager.delay(CONFIG.delays.searchFocus);
    await browserManager.page.focus(CONFIG.selectors.searchQuery);
    await browserManager.page.keyboard.type(userConfig.query);
    
    // Submit query
    await browserManager.delay(CONFIG.delays.queryType);
    await browserManager.page.focus(CONFIG.selectors.searchQuery);
    await browserManager.page.keyboard.press('Enter');
    const searchStartTime = new Date();
    
    try {
      await browserManager.waitForElement(CONFIG.selectors.vizContainer);
      const searchResponseTime = (new Date() - searchStartTime) / 1000;
      testResults.searchResponseTime = searchResponseTime;
      this.metrics.addMetric(userId, 'searchResponseTime', searchResponseTime);
      console.log(`User ${userId}: Search results rendered in ${searchResponseTime}s`);
    } catch (error) {
      testResults.searchResponseTime = 0;
      this.metrics.addError(userId, error, 'Search results rendering');
      console.error(`User ${userId}: Failed to render search results`);
    }
  }
  async waitForChartToLoad(browserManager) { 
    console.log('Waiting for chart to load...');
    
    try {
      // First, wait for the loading text to appear (chart started loading)
      await browserManager.waitForText(CONFIG.selectors.chartLoading);
      console.log('Chart loading text appeared');
      
      // Then wait for the loading text to disappear (chart finished loading)
      await browserManager.page.waitForFunction(
        (loadingText) => {
          const spans = document.querySelectorAll('span');
          for (let span of spans) {
            if (span.textContent && span.textContent.includes(loadingText)) {
              return false; // Loading text still exists in a span, keep waiting
            }
          }
          return true; // Loading text no longer exists in any span, loading is complete
        },
        { timeout: CONFIG.timeouts.element },
        CONFIG.selectors.chartLoading
      );
      console.log('Chart loading completed');
    } catch (error) {
      console.log('Chart loading detection failed, trying fallback method...');
      
      // Fallback: Wait for chart container or highcharts to appear
      try {
        await browserManager.waitForElement(CONFIG.selectors.vizContainer, { timeout: 30000 });
        console.log('Chart loaded (fallback method)');
      } catch (fallbackError) {
        console.log('Fallback method also failed, proceeding anyway...');
      }
    }
  }

  async performDashboardTest(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting dashboard test`);
    
    // Navigate to dashboard
    await browserManager.navigateTo(`${CONFIG.baseURL}/dashboard`, {
      timeout: CONFIG.timeouts.longNavigation,
    });
    
    // Wait for dashboard cards
    await browserManager.waitForElement(CONFIG.selectors.createDashboard);
    console.log(`User ${userId}: Dashboard list loaded`);
    
    // Click on a specific dashboard
    const createDashboard = await browserManager.page.$$(CONFIG.selectors.createDashboard);
    await browserManager.delay(2000);
    const elements = await browserManager.page.$$(CONFIG.selectors.dashboardCards);
    if (createDashboard.length === 2) {
      console.log('There is no dashboard to test, Please create a dashboard first');
      return;
    }
    
    if (elements.length > 0) {
      await elements[0].click();
      const dashboardStartTime = new Date();
      try {
        // Wait for chart to load using the improved method
        await this.waitForChartToLoad(browserManager);
        
        const initialVizRender = (new Date() - dashboardStartTime) / 1000;
        testResults.initialVizRender = initialVizRender;
        this.metrics.addMetric(userId, 'initialVizRender', initialVizRender);
        console.log(`User ${userId}: Initial viz rendered in ${initialVizRender}s`);
      } catch (error) {
        testResults.initialVizRender = 0;
        this.metrics.addError(userId, error, 'Initial viz rendering');
        console.error(`User ${userId}: Failed to render initial viz`);
      }
        try {
          await browserManager.waitForElement(CONFIG.selectors.highcharts);
          const afterSuccessfulLoad = (new Date() - dashboardStartTime) / 1000;
          testResults.afterSuccessfulLoad = afterSuccessfulLoad;
          this.metrics.addMetric(userId, 'afterSuccessfulLoad', afterSuccessfulLoad);
          console.log(`User ${userId}: After successful load in ${afterSuccessfulLoad}s`);
          // Apply filter after chart is loaded
          await this.applyFilter(userId, testResults, browserManager);

        } catch (error) {
          testResults.afterSuccessfulLoad = 0;
          this.metrics.addError(userId, error, 'After successful load');
          console.error(`User ${userId}: Failed to load after success`);
        }
    } else {
      console.error(`User ${userId}: No dashboard cards found`);
      throw new Error('No dashboard cards found');
    }
  }

  async applyFilter(userId, testResults, browserManager) {
    console.log(`User ${userId}: Starting filter apply`);
    try {
      // Click on apply filter button
      await browserManager.waitForElement(CONFIG.selectors.applyFilterBtn);
      await browserManager.page.click(CONFIG.selectors.applyFilterBtn);
      // Click on global filter toggle
      await browserManager.waitForElement(CONFIG.selectors.globalFilterToggle);
      await browserManager.page.click(CONFIG.selectors.globalFilterToggle);
      // Click on search column
      await browserManager.waitForElement(CONFIG.selectors.searchColumn);
      await browserManager.page.click(CONFIG.selectors.searchColumn);
      await browserManager.page.keyboard.type(CONFIG.filterData.columnName);
      await browserManager.waitForElement(CONFIG.selectors.columnName);
      await browserManager.page.click(CONFIG.selectors.columnName);
      // Click on operator input
      await browserManager.waitForElement(CONFIG.selectors.operatorInput);
      await browserManager.page.click(CONFIG.selectors.operatorInput);
      // Click on operator value
      await browserManager.waitForElement(CONFIG.selectors.operatorValue);
      await browserManager.page.click(CONFIG.selectors.operatorValue);
      // Click on filter value
      await browserManager.waitForElement(CONFIG.selectors.filterValue);
      await browserManager.page.click(CONFIG.selectors.filterValue);
      // Type filter value
      await browserManager.page.keyboard.type(CONFIG.filterData.value);
      await browserManager.waitForElement(CONFIG.selectors.filterValueInput);
      await browserManager.page.click(CONFIG.selectors.filterValueInput);
      // Click on apply button
      await browserManager.waitForElement(CONFIG.selectors.applyBtn);
      await browserManager.delay(1000);
      await browserManager.page.click(CONFIG.selectors.applyBtn);
      const filterStartTime = new Date();
      // Record filter response time
      await this.waitForChartToLoad(browserManager);
      const filterApplyTime = (new Date() - filterStartTime) / 1000;
      testResults.filterApplyTime = filterApplyTime;
      this.metrics.addMetric(userId, 'filterApplyTime', filterApplyTime);
      console.log(`User ${userId}: Filter applied in ${filterApplyTime}s`);
    } catch (error) {
      testResults.filterApplyTime = 0;
      this.metrics.addError(userId, error, 'Filter applying');
      console.error(`User ${userId}: Failed to apply filter`);
    }

  }

  async runAllTests() {
    const numUsers = parseInt(process.argv[2]) || 1;
    const shouldCheckDashboard = process.argv[3] === 'true';
    
    console.log(`Starting performance test with ${numUsers} users`);
    console.log(`Dashboard testing: ${shouldCheckDashboard ? 'enabled' : 'disabled'}`);
    
    // Create test promises like in the original test.js
    const testPromises = Array(numUsers)
      .fill(null)
      .map((_, index) => this.runTest(index, CONFIG.loginDetails));
    
    // Run all tests concurrently using Promise.all
    const results = await Promise.all(testPromises);
    
    // Generate report
    await this.generateReport(results, numUsers);
    
    console.log('Performance test completed successfully');
  }

  async generateReport(results, numUsers) {
    const scriptRunTime = this.metrics.getScriptRunTime();
    
    // Debug: Log the results to see what we're working with
    console.log(`\n=== DEBUG: Results Summary ===`);
    console.log(`Number of results: ${results.length}`);
    console.log(`Results structure:`, JSON.stringify(results[0], null, 2));
    console.log(`Dashboard testing enabled: ${process.argv[3] === 'true'}`);
    
    // Prepare CSV data
    const header = ['User ID', 'Login Render Time (s)', 'Home Page Render (s)', 'Search Response Time (s)'];
    if (process.argv[3] === 'true') {
      header.push('Initial Viz Render (s)', 'After Successful Load (s)', 'Filter Apply Time (s)');
    }
    
    // Create CSV data as objects (ObjectsToCsv expects objects)
    const csvData = results.map(result => {
      const row = {
        'User ID': result.userId || 0,
        'Login Render Time (s)': result.loginRenderTime || 0,
        'Home Page Render (s)': result.homePageRender || 0,
        'Search Response Time (s)': result.searchResponseTime || 0,
      };
      
      if (process.argv[3] === 'true') {
        row['Initial Viz Render (s)'] = result.initialVizRender || 0;
        row['After Successful Load (s)'] = result.afterSuccessfulLoad || 0;
        row['Filter Apply Time (s)'] = result.filterApplyTime || 0;
      }
      
      return row;
    });
    
    // Save CSV file using manual generation (more reliable)
    const filename = `testReport/${process.argv[3] === 'true' ? 'dashboard' : 'no_dashboard'}_with_${numUsers}_users.csv`;
    const fs = require('fs');
    
    let csvContent = 'Script Time (s),Number of Users,Dashboard Testing\n';
    csvContent += `${scriptRunTime},${numUsers},${process.argv[3] === 'true' ? 'Enabled' : 'Disabled'}\n\n`;
    
    // Add headers
    csvContent += 'User ID,Login Render Time (s),Home Page Render (s),Search Response Time (s)';
    if (process.argv[3] === 'true') {
      csvContent += ',Initial Viz Render (s),After Successful Load (s),Filter Apply Time (s)';
    }
    csvContent += ',Status,Error Message\n';
    
    // Add data rows
    results.forEach(result => {
      csvContent += `${result.userId || 0},${result.loginRenderTime || 0},${result.homePageRender || 0},${result.searchResponseTime || 0}`;
      if (process.argv[3] === 'true') {
        csvContent += `,${result.initialVizRender || 0},${result.afterSuccessfulLoad || 0},${result.filterApplyTime || 0}`;
      }
      
      // Add status and error message
      const status = result.success ? 'SUCCESS' : 'FAILED';
      const errorMessage = this.metrics.errors
        .filter(error => error.userId === result.userId)
        .map(error => error.error)
        .join('; ') || '';
      
      csvContent += `,${status},"${errorMessage}"\n`;
    });
    
    fs.writeFileSync(filename, csvContent);
    console.log(`CSV file saved successfully: ${filename}`);
    console.log(`CSV contains ${results.length} user records`);
    
    // Print summary
    console.log('\n=== PERFORMANCE TEST SUMMARY ===');
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
      
      return {
        'User ID': result.userId,
        'Login (s)': result.loginRenderTime.toFixed(2),
        'Home Page (s)': result.homePageRender.toFixed(2),
        'Search Response (s)': result.searchResponseTime.toFixed(2),
        ...(process.argv[3] === 'true' ? {
          'Initial Viz Render (s)': result.initialVizRender.toFixed(2),
          'After Successful Load (s)': result.afterSuccessfulLoad.toFixed(2),
          'Filter Apply Time (s)': result.filterApplyTime.toFixed(2)
        } : {}),
        'Status': status
      };
    });
    
    // Display the table
    console.table(tableData);
    
    // Calculate and display averages
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
      console.log('\n=== AVERAGE PERFORMANCE METRICS ===');
      const averages = {
        'Average Login Render (s)': (successfulResults.reduce((sum, r) => sum + r.loginRenderTime, 0) / successfulResults.length).toFixed(2),
        'Average Home Page (s)': (successfulResults.reduce((sum, r) => sum + r.homePageRender, 0) / successfulResults.length).toFixed(2),
        'Average Search Response (s)': (successfulResults.reduce((sum, r) => sum + r.searchResponseTime, 0) / successfulResults.length).toFixed(2),
        ...(process.argv[3] === 'true' ? {
          'Average Initial Viz Render (s)': (successfulResults.reduce((sum, r) => sum + r.initialVizRender, 0) / successfulResults.length).toFixed(2),
          'Average After Successful Load (s)': (successfulResults.reduce((sum, r) => sum + r.afterSuccessfulLoad, 0) / successfulResults.length).toFixed(2),
          'Average Filter Apply Time (s)': (successfulResults.reduce((sum, r) => sum + r.filterApplyTime, 0) / successfulResults.length).toFixed(2)
        } : {})
      };
      console.table(averages);
    }
    
    if (this.metrics.errors.length > 0) {
      console.log('\n==== ERRORS ====');
      this.metrics.errors.forEach(error => {
        console.log(`User ${error.userId}: ${error.error} (${error.context})`);
      });
    }
  }
}

// Main execution
async function main() {
  try {
    const runner = new PerformanceTestRunner();
    await runner.runAllTests();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { PerformanceTestRunner, BrowserManager, PerformanceMetrics }; 