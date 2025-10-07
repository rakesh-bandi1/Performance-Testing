const puppeteer = require("puppeteer");
const fs = require("fs");

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
    await this.page.setViewport({ width: 1512, height: 864 });

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
    const defaultOptions = {
      timeout: 1000000,
    };
    try {
      await this.page.goto(url, { ...defaultOptions, ...options });
    } catch (error) {
      console.log(`Navigation to ${url} failed, retrying...`);
      await this.page.goto(url, { ...defaultOptions, ...options });
    }
  }

  async waitForElement(selector, options = {}) {
    const defaultOptions = { timeout: 300000 };
    try {
      await this.page.waitForSelector(selector, {
        ...defaultOptions,
        ...options,
      });
    } catch (error) {
      throw new Error(
        `Element not found: ${selector} (timeout: ${defaultOptions.timeout}ms)`
      );
    }
  }

  async waitForText(text, timeout = 300000) {
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
    const loaderComponent = require("./loaderComponent");
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
      timeout: 300000,
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

module.exports = BrowserManager;
