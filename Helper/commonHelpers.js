const fs = require('fs');
const loaderComponent = require("./loaderComponent");

class CommonHelpers {
    constructor(page) {
        this.page = page;
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

module.exports = CommonHelpers;