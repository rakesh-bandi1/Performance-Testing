const CONFIG = {
    userNameInput: '[data-cy-id="cy-usrnm"]',
    passwordInput: '[data-cy-id="cy-pswrd"]',
    loginButton: '[data-cy-id="cy-lgn-btn"]',
    standardLogin: '[data-cy-id="cy-stndrd-lgn"]',
}
async function login(browserManager,baseURL, username, password) {

    await browserManager.navigateTo(baseURL);
    let element = await browserManager.page.waitForSelector(CONFIG.standardLogin);
    if (element) {
        await browserManager.page.click(CONFIG.standardLogin);
    }
    await browserManager.waitForElement(CONFIG.userNameInput);
    await browserManager.page.type(CONFIG.userNameInput, username);
    await browserManager.waitForElement(CONFIG.passwordInput);
    await browserManager.page.type(CONFIG.passwordInput, password);
    await browserManager.waitForElement(CONFIG.loginButton);
    await browserManager.page.click(CONFIG.loginButton);
    console.log(`User ${userId}: Waiting for Login API...`);
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
    ]).then(() => {
        console.log(`Login API Load completed`);
        console.log(`User ${userId}: APIs Load completed`);
      }).catch((error) => {
        console.log(`User ${userId}: Login API Load failed: ${error}`);
        throw new Error(error);
    });

  return browserManager;
}