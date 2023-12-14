/* node:coverage disable */
// import test utils
const { describe, it, after, afterEach, before, beforeEach } = require('node:test'); // read about the builtin Node.js test framework here: https://nodejs.org/docs/latest-v18.x/api/test.html
const assert = require('node:assert');
const { Builder, Browser, By, Key, until, WebDriver } = require('selenium-webdriver'); // read about selenium here: https://www.selenium.dev/documentation/en/webdriver/
const chrome = require('selenium-webdriver/chrome'); // read about chrome options here: https://chromedriver.chromium.org/capabilities
const { captureConsole } = require('./utils.js');
captureConsole('./test.client.log');

describe('Client', () => {
  /** @type {number} */
  let port;

  /** @type {import('node:http2').Http2Server} */
  let listener;

  /** @type {WebDriver} */
  let driver;

  /** @type {number} How many ms to wait for automated browser actions before failing */
  const TIMEOUT = 2000;

  function supportsGoogleSignIn() {
    return process.env.TEST_EMAIL && process.env.TEST_PASSWORD && [undefined, "chrome"].includes(process.env.SELENIUM_BROWSER);
  }

  async function findDeep(path, element = null) {
    if (!element) {
      element = driver;
    }
    const getShadow = "return arguments[0].shadowRoot;";
    const parts = path.split('->');
    for (let i = 0; i < parts.length; i++) {
      try {
        element = await element.findElement(By.css(parts[i]));
      } catch (e) {
        const shadowRoot = await driver.executeScript(getShadow, element);
        element = await shadowRoot.findElement(By.css(parts[i]));
      }
    }
    return element;
  }

  before(async () => {
    // spin up the server
    process.env.DEVELOPMENT = supportsGoogleSignIn() ? 'false' : 'true';
    ({ listener } = require('../server.js'));
    port = listener.address().port;

    // spin up the browser
    const chromeOptions = new chrome.Options();
    if (supportsGoogleSignIn()) {
      chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
      chromeOptions.addArguments('--excludeSwitches=enable-automation');
      chromeOptions.addArguments('--useAutomationExtension=false');
    }

    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(chromeOptions)
      .build();
  });

  describe('Authentication', () => {
    it('Should signin and redirect correctly via dev login', { skip: supportsGoogleSignIn() }, async () => {
      await driver.get(`http://localhost:${port}/login.html?redirect=http://localhost:${port}`);
      await driver.findElement(By.id('signInAsAlex')).click();
      await driver.wait(until.titleIs('Home'), TIMEOUT);

      // if login worked, trying to login again should redirect directly
      await driver.get(`http://localhost:${port}/login.html?redirect=http://localhost:${port}`);
      await driver.wait(until.titleIs('Home'), TIMEOUT);
    });

    it('Should not show dev login in prod', { todo: true, skip: true }, async () => {
      // does not currently work because the client uses the hostname to determine if it's in development
      await driver.get(`http://localhost:${port}/login.html?redirect=http://localhost:${port}`);
      const signInAsAlex = await driver.findElement(By.id('signInAsAlex'));
      assert.strictEqual(await signInAsAlex.isDisplayed(), false);
    });

    it('Should signin and redirect correctly via prod login', { skip: !supportsGoogleSignIn() }, async () => {
      // navigate to the login page
      await driver.get(`http://localhost:${port}/login.html?redirect=http://localhost:${port}`);
      // sign in with google
      await driver.findElement(By.id('signInWithGoogle')).click();
      // wait for the popup to open
      await driver.wait(async () => (await driver.getAllWindowHandles()).length === 2, TIMEOUT);
      // figure out which window is the popup
      const handles = await driver.getAllWindowHandles();
      const main_handle = await driver.getWindowHandle();
      const popup_handle = handles.filter(handle => handle !== main_handle)[0];
      // switch to the popup
      await driver.switchTo().window(popup_handle);
      // wait for the popup to load
      await driver.wait(until.titleIs('Sign in - Google Accounts'), TIMEOUT);
      await driver.sleep(100);
      // enter the email
      await driver.actions()
        .sendKeys(process.env.TEST_EMAIL)
        .sendKeys(Key.RETURN)
        .perform();
      // wait for the password page to load
      await driver.sleep(3000);
      // enter the password
      await driver.actions()
        .sendKeys(process.env.TEST_PASSWORD)
        .sendKeys(Key.RETURN)
        .perform();
      // wait for the popup to close
      await driver.wait(async () => (await driver.getAllWindowHandles()).length === 1, 60_000);
      // switch back to the main window
      await driver.switchTo().window(main_handle);
      await driver.wait(until.titleIs('Home'), TIMEOUT);
      // if login worked, trying to login again should redirect directly
      await driver.get(`http://localhost:${port}/login.html?redirect=http://localhost:${port}`);
      await driver.wait(until.titleIs('Home'), TIMEOUT);
    });

    it('Signout should work', async () => {
      await driver.get(`http://localhost:${port}`);
      await driver.sleep(1000);
      const user_icon = await findDeep("navigation-manager->navigation-bar->user-icon");
      await user_icon.click();
      const profile = await findDeep("#profile", user_icon);
      await driver.wait(until.elementIsVisible(profile), TIMEOUT);
      assert.strictEqual(await profile.isDisplayed(), true);
      const logout = await findDeep("button:nth-of-type(3)", profile);
      await logout.click();

      // if logout worked, trying to login again should stay on the login page
      await driver.get(`http://localhost:${port}/login.html?redirect=http://localhost:${port}`);
      await driver.wait(until.titleIs('Login'), TIMEOUT);
      try {
        await driver.wait(until.titleIs('Home'), TIMEOUT);
        assert.fail('Should not redirect to home page after logout');
      } catch (e) {
        assert.strictEqual(JSON.stringify(e), "{\"name\":\"TimeoutError\",\"remoteStacktrace\":\"\"}");
      }
    });
  });

  after(async () => {
    // close the browser
    await driver.quit();

    // close the server
    await new Promise((resolve, reject) => listener.close(resolve));
  });
});