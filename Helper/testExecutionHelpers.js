const fs = require('fs');
const { getRandomData, getRandomFilterData } = require("../helper.js");
const EmailService = require("../emailService.js");

class TestExecutionHelpers {
  constructor(metrics, testHelpers) {
    this.metrics = metrics;
    this.testHelpers = testHelpers;
  }

  async performTabSwitch(userId, testResults, browserManager, tabIndex, timeField, CONFIG) {
    console.log(`User ${userId}: Starting tab switch to tab index ${tabIndex}`);
    const tabSelector = `[data-cy-id='cy-tb${tabIndex}']`;
    try {
      await browserManager.waitForElement(tabSelector);
      await browserManager.page.click(tabSelector);
      console.log(`User ${userId}: Tab clicked successfully`);

      let tabSwitchStartTime = new Date();
      await this.testHelpers.waitForChartToLoad(browserManager);
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
      await this.testHelpers.takeTestScreenshot(userId, `tab_switch_${tabIndex}_failure`, browserManager, testResults, error);
      
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

  async performAreaFilterTest(userId, testResults, browserManager, timeField = "areaFilterTime1", CONFIG) {
    console.log(`User ${userId}: Starting area filter test`);

    try {
      await browserManager.waitForElement(CONFIG.selectors.searchInput);

      await this.testHelpers.clickElementByXPath(
        browserManager.page,
        CONFIG.selectors.areaEle
      );

      // Apply each area filter
      for (const ele of ["AA", "AB", "AC", "ZR"]) {
        await this.testHelpers.searchAndSelectValue(ele, browserManager);
      }

      // Apply the filter
      await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
      await browserManager.page.click(CONFIG.selectors.filterApplyBtn);
      const areaFilterStartTime = new Date();
      await this.testHelpers.waitForChartToLoad(browserManager);
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
      await this.testHelpers.takeTestScreenshot(userId, 'area_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }

  async performRegionFilterTest(userId, testResults, browserManager, CONFIG) {
    console.log(`User ${userId}: Starting region filter test`);

    try {
      await browserManager.waitForElement(CONFIG.selectors.searchInput);

      // Use XPath to click the second search input (Region filter)
      await this.testHelpers.clickElementByXPath(
        browserManager.page,
        CONFIG.selectors.regionEle
      );

      // Apply each region filter
      for (const ele of ["AA21", "AB20", "AC20", "AA30", "ZR99"]) {
        await this.testHelpers.searchAndSelectValue(ele, browserManager);
      }

      // Apply the filter
      await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
      await browserManager.page.click(CONFIG.selectors.filterApplyBtn);
      const regionFilterStartTime = new Date();
      await this.testHelpers.waitForChartToLoad(browserManager);
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
      await this.testHelpers.takeTestScreenshot(userId, 'region_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }

  async performTerritoryFilterTest(userId, testResults, browserManager, CONFIG) {
    console.log(`User ${userId}: Starting territory filter test`);

    try {
      console.log(`User ${userId}: Waiting for search input elements...`);
      await browserManager.waitForElement(CONFIG.selectors.searchInput);

      // Use XPath to click the third search input (Territory filter)
      console.log(`User ${userId}: Attempting to click third search input...`);
      await this.testHelpers.clickElementByXPath(
        browserManager.page,
        CONFIG.selectors.territoryEle
      );

      // Apply each territory filter
      for (const ele of ["008A", "010A", "019A", "021A", "025A"]) {
        await this.testHelpers.searchAndSelectValue(ele, browserManager);
      }

      console.log(`User ${userId}: Applying filter...`);
      // Apply the filter
      await browserManager.waitForElement(CONFIG.selectors.filterApplyBtn);
      await browserManager.page.click(CONFIG.selectors.filterApplyBtn);

      // Wait for chart to reload after filter application
      const territoryFilterStartTime = new Date();
      console.log(`User ${userId}: Waiting for chart to load...`);
      await this.testHelpers.waitForChartToLoad(browserManager);
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
      await this.testHelpers.takeTestScreenshot(userId, 'territory_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }

  async performTimeFilterTest(userId, testResults, browserManager, CONFIG) {
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
      await this.testHelpers.waitForChartToLoad(browserManager);

      const timeFilterTime = (new Date() - timeFilterStartTime) / 1000;
      testResults.timeFilterTime = timeFilterTime;
      this.metrics.addMetric(userId, "timeFilterTime", timeFilterTime);
      console.log(`User ${userId}: Time filter completed in ${timeFilterTime}s`);
      
    } catch (error) {
      console.error(`User ${userId}: Time filter test failed:`, error.message);
      
      // Take screenshot on time filter failure
      await this.testHelpers.takeTestScreenshot(userId, 'time_filter_failure', browserManager, testResults, error);
      
      throw error;
    }
  }

  async performAPILogin(userId, testResults, browserManager, CONFIG) {
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
      const loginRequest = {
        url: currentUrl,
        method: 'POST',
        startTime: loginStartTime.getTime(),
        endTime: loginEndTime.getTime(),
        durationMs: Math.round(loginTime * 1000),
        status: response.status,
        mimeType: 'application/json',
        requestId: `login-${userId}-${Date.now()}`,
        chartName: 'API Login',
        datasetName: null,
        responseStructure: {
          success: true,
          message: responseData.message
        }
      };

      // Add to browser manager's requests map so it gets included in network logs
      browserManager.requests.set(loginRequest.requestId, loginRequest);
  
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

  async performVizpadTest(userId, testResults, browserManager, CONFIG) {
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
          name: "auth/runtimeConfig",
          promise: browserManager.page.waitForResponse(
            (response) =>
              response.url().includes("/auth/runtimeConfig") &&
              response.request().method() === "GET",
              {timeout:90000}
          ),
        },
        {
          name: "businessViews",
          promise: browserManager.page.waitForResponse(
            (response) =>
              response.url().includes("/businessViews") &&
              response.request().method() === "GET",
              {timeout:90000}
          ),
        },
      {
        name: "vizpadView",
        promise: browserManager.page.waitForResponse(
          (response) =>
            response.url().includes("/vizpadView") &&
            response.request().method() === "GET",
            {timeout:90000}
        ),
      },
      {
        name: "vizItem",
        promise: browserManager.page.waitForResponse(
          (response) =>
            response.url().includes("/vizItem") &&
            response.request().method() === "GET",
            {timeout:90000}
        ),
      }
      
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
        await this.testHelpers.takeTestScreenshot(userId, 'api_failure', browserManager, testResults, error);

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
    await this.testHelpers.waitForChartToLoad(browserManager);
    await browserManager.waitForAppLoader();
    const chartLoadTime = (new Date() - testStartTime) / 1000;

    testResults.chartLoadTime = chartLoadTime;
    this.metrics.addMetric(userId, "chartLoadTime", chartLoadTime);
    console.log(`User ${userId}: Charts loaded in ${chartLoadTime}s`);
    
    } catch (error) {
      console.error(`User ${userId}: Vizpad test failed:`, error.message);
      
      // Take screenshot on vizpad test failure
      await this.testHelpers.takeTestScreenshot(userId, 'vizpad_failure', browserManager, testResults, error);
      
      throw error;
    }
  }

  async generateReport(results, numUsers, CONFIG) {
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
      if (result?.networkRequests) {
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

    // Generate dynamic headers based on enabled features
    let headerRow = "User ID,Login Time (s),API Load Time (s),Vizpad Load (s)";
    
    // Add tab switching headers if tabCount > 0
    if (CONFIG.tabCount > 0 && CONFIG.availableTabs > 1) {
      let tabCount = Math.min(CONFIG.tabCount, CONFIG.availableTabs);
      console.log(tabCount, "HEADER TAB COUNT")
      for (let i = 1; i <= tabCount; i++) {
        headerRow += `,Tab Switch ${i} (s)`;
      }
    }
    
    // Add filter headers if filters are enabled
    if (CONFIG.enableFilters) {
      headerRow += ",Area Filter (s),Region Filter (s),Territory Filter (s)";
    }
    
    // Add time filter if enabled
    if (CONFIG.enableTimeFilter) {
      headerRow += ",Time Filter (s)";
    }
    
    headerRow += ",Status,Error Message\n";
    csvContent += headerRow;

    // Add data rows
    results.forEach((result) => {
      let dataRow = `${result?.userId || 0},${result?.loginTime || 0},${result?.apiLoadTime || 0},${result?.chartLoadTime || 0}`;
      
      // Add tab switching data if tabCount > 0
      if (CONFIG.tabCount > 0 && CONFIG.availableTabs > 1) {
        for (let i = 1; i <= CONFIG.tabCount; i++) {
          dataRow += `,${result[`tabSwitch${i}`] || 0}`;
        }
      }
      
      // Add filter data if filters are enabled
      if (CONFIG.enableFilters) {
        dataRow += `,${result.areaFilterTime1 || 0},${result.regionFilterTime || 0},${result.territoryFilterTime || 0}`;
      }
      
      // Add time filter data if enabled
      if (CONFIG.enableTimeFilter) {
        dataRow += `,${result.timeFilterTime || 0}`;
      }

      // Add status and error message
      const status = result?.success ? "SUCCESS" : "FAILED";
      const errorMessage =
        this.metrics.errors
          .filter((error) => error?.userId === result?.userId)
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
      if (result?.networkRequests) {
        result?.networkRequests.forEach((req, reqIndex) => {
          const userRow = `${result?.userId || resultIndex + 1},${req?.requestId || reqIndex + 1},${req?.method || 'N/A'},${req?.status || 'N/A'},${req.durationMs || 0},${req.chartName || 'N/A'},${req.datasetName || 'N/A'},${req.mimeType || 'N/A'},"${req.url || 'N/A'}",${req.startTime || 0},${req.endTime || 0}\n`;
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
    // Create table data for display based on enabled features
    const tableData = results.map((result) => {
      const status = result.success ? "✅ Success" : "❌ Failed";
      const row = {
        "User ID": result.userId,
        "Login Time (s)": result.loginTime.toFixed(2),
        "API Load Time (s)": result.apiLoadTime.toFixed(2),
        "Vizpad Load (s)": result.chartLoadTime.toFixed(2),
      };

      // Add tab switching columns if tabCount > 0
      if (CONFIG.tabCount > 0 && CONFIG.availableTabs > 1) {
        let tabCount = Math.min(CONFIG.tabCount, CONFIG.availableTabs);
        for (let i = 1; i <= tabCount; i++) {
          row[`Tab Switch ${i} (s)`] = (result[`tabSwitch${i}`] || 0).toFixed(2);
        }
      }
      
      // Add filter columns if filters are enabled
      if (CONFIG.enableFilters) {
        row["Area Filter (s)"] = (result.areaFilterTime1 || 0).toFixed(2);
        row["Region Filter (s)"] = (result.regionFilterTime || 0).toFixed(2);
        row["Territory Filter (s)"] = (result.territoryFilterTime || 0).toFixed(2);
      }
      
      // Add time filter if enabled
      if (CONFIG.enableTimeFilter) {
        row["Time Filter (s)"] = (result.timeFilterTime || 0).toFixed(2);
      }

      // Add Status at the end
      row["Status"] = status;

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
          successfulResults.reduce((sum, r) => sum + (r.loginTime || 0), 0) /
          successfulResults.length
        ).toFixed(2),
        "Average API Load Time (s)": (
          successfulResults.reduce((sum, r) => sum + (r.apiLoadTime || 0), 0) /
          successfulResults.length
        ).toFixed(2),
        "Average Vizpad Load (s)": (
          successfulResults.reduce((sum, r) => sum + (r.chartLoadTime || 0), 0) /
          successfulResults.length
        ).toFixed(2),
      };

      // Add dynamic tab switching averages
      if (CONFIG.tabCount > 0 && CONFIG.availableTabs > 1) {
        let tabCount = Math.min(CONFIG.tabCount, CONFIG.availableTabs);
        for (let i = 1; i <= tabCount; i++) {
          averages[`Average Tab Switch ${i} (s)`] = (
            successfulResults.reduce((sum, r) => sum + (r[`tabSwitch${i}`] || 0), 0) /
            successfulResults.length
          ).toFixed(2);
        }
      }

      // Add filter averages if filters are enabled
      if (CONFIG.enableFilters) {
        averages["Average Area Filter (s)"] = (
          successfulResults.reduce((sum, r) => sum + (r.areaFilterTime1 || 0), 0) /
          successfulResults.length
        ).toFixed(2);
        averages["Average Region Filter (s)"] = (
          successfulResults.reduce((sum, r) => sum + (r.regionFilterTime || 0), 0) /
          successfulResults.length
        ).toFixed(2);
        averages["Average Territory Filter (s)"] = (
          successfulResults.reduce((sum, r) => sum + (r.territoryFilterTime || 0), 0) /
          successfulResults.length
        ).toFixed(2);
      }

      // Add time filter average if enabled
      if (CONFIG.enableTimeFilter) {
        averages["Average Time Filter (s)"] = (
          successfulResults.reduce((sum, r) => sum + (r.timeFilterTime || 0), 0) /
          successfulResults.length
        ).toFixed(2);
      }
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
          console.log(`📸 User ${result.userId} screenshots:`, result?.screenshots);
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
          allScreenshots,
          CONFIG
        );
        console.log("✅ Email report sent successfully!");
        
        // Clean up files after successful email sending
        const csvFiles = [filename, networkCsvFilename, networkLogFilename].filter(f => f);
        await this.testHelpers.cleanupFiles(allScreenshots, csvFiles);
        
      } catch (error) {
        console.error("❌ Failed to send email report:", error.message);
        console.log("Continuing without email...");
        
        // Still clean up files even if email fails
        const csvFiles = [filename, networkCsvFilename, networkLogFilename].filter(f => f);
        await this.testHelpers.cleanupFiles(allScreenshots, csvFiles);
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
      await this.testHelpers.cleanupFiles(allScreenshots, csvFiles);
    }
  }
}

module.exports = TestExecutionHelpers;
