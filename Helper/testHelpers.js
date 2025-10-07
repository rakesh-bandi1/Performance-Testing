const fs = require('fs');

class TestHelpers {
  constructor() {
    this.metrics = null;
  }

  setMetrics(metrics) {
    this.metrics = metrics;
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
        { timeout: 300000 },
        loadingTexts
      );
      console.log("Chart loading completed");
    } catch (error) {
      console.log("Chart loading detection failed, trying fallback method...");

      // Fallback: Wait for chart container or highcharts to appear
      try {
        await browserManager.waitForElement('.vizContainer', {
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

  async searchAndSelectValue(value, browserManager) {
    const { page } = browserManager;
    const inputSelector = '[data-cy-id="cy-search-value"]';
    const checkboxSelector = '.checkbox-available';

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
    const checkboxSelector = '.checkbox-available'; // Assuming this matches multiple checkboxes

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
}

module.exports = TestHelpers;
