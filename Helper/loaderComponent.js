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

module.exports = loaderComponent;
