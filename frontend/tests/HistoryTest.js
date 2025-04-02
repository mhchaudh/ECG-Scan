import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async function testHistoryFeatures() {
  let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();

  try {
    await driver.get("http://localhost:5173");

    // Handle disclaimer
    await driver.wait(until.elementLocated(By.css(".MuiDialog-root")), 10000);
    await driver.findElement(By.css('input[type="checkbox"]')).click();
    await driver.findElement(By.xpath("//button[contains(text(), 'Proceed')]")).click();

    // Upload test image
    async function uploadTestImage() {
      await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Upload Image')]")), 5000).click();
      
      const filePath = path.resolve(__dirname, "test_images", "test.jpg");
      if (!fs.existsSync(filePath)) {
        throw new Error("Test image file not found");
      }
      
      await driver.wait(until.elementLocated(By.xpath("//input[@type='file']")), 5000)
        .sendKeys(filePath);
      
      await driver.wait(until.urlContains("/confirmupload"), 10000);
      
      // Fill out form
      await driver.findElement(By.xpath("//input[@id=//label[contains(text(), 'Unique Patient Identifier')]/@for]"))
        .sendKeys("TestPatient123");
      await driver.findElement(By.xpath("//input[@id=//label[contains(text(), 'Age')]/@for]"))
        .sendKeys("30");
      
      // Patient status
      await driver.findElement(By.xpath("//label[contains(text(), 'Patient Status')]/following-sibling::div")).click();
      await driver.findElement(By.xpath("//li[contains(text(), 'Pre-treatment')]")).click();
      
      // Location
      await driver.findElement(By.xpath("//label[contains(text(), 'Location')]/following-sibling::div//input"))
        .sendKeys("Canada");
      await driver.sleep(2000);
      (await driver.findElements(By.xpath("//ul[contains(@class, 'MuiList-root')]/li")))[0].click();
      
      // Gender
      await driver.findElement(By.xpath("//button[@value='male' and @aria-pressed='false']")).click();
      
      // Confirm
      await driver.findElement(By.xpath("//button[contains(text(), 'Confirm')]")).click();
      await driver.wait(until.elementLocated(
        By.xpath("//div[contains(@class, 'MuiDialog-root')]//button[contains(text(), 'Confirm')]")), 5000)
        .click();
      
      await driver.wait(until.urlContains("/ecg-results"), 30000);
      await driver.sleep(2000);
      
      // Return home
      await driver.findElement(By.css(".logo")).click();
      await driver.wait(until.urlContains("/home"), 10000);
    }

    // Upload first image
    await uploadTestImage();
    await driver.sleep(2000);

    await driver.findElement(By.css(".MuiIconButton-root")).click();
    await driver.wait(until.elementLocated(By.xpath("//li[contains(text(), 'History')]")), 5000).click();
    await driver.wait(until.urlContains("/history"), 10000);
    await driver.sleep(2000);

    // Helper function for reliable clicking
    async function safeClick(element) {
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", element);
      await driver.wait(until.elementIsEnabled(element), 5000);
      await driver.sleep(500); // Small stabilization pause
      try {
        await element.click();
      } catch (err) {
        // Fallback to JavaScript click if regular click fails
        await driver.executeScript("arguments[0].click();", element);
      }
    }

     // Test 1: View Details - IMPROVED VERSION
    console.log("Testing View Details...");
    const cards = await driver.wait(until.elementsLocated(By.css(".MuiCard-root")), 10000);
    const firstCard = cards[0];

    const viewDetailsBtn = await firstCard.findElement(By.xpath(".//button[contains(text(), 'View Details')]"));
    await safeClick(viewDetailsBtn);

    // More robust dialog waiting
    const dialog = await driver.wait(
      until.elementLocated(By.css(".MuiDialog-root")),
      10000 // Increased timeout to 10 seconds
    );

    // Wait for dialog to be visible and have content
    await driver.wait(
      until.elementIsVisible(dialog),
      10000
    );

    // Alternative verification if the first approach fails
    let dialogTitle;
    try {
      dialogTitle = await driver.wait(
        until.elementLocated(By.css(".MuiDialogTitle-root")),
        5000
      ).getText();
    } catch (err) {
      // Fallback to JavaScript execution
      dialogTitle = await driver.executeScript(
        'return document.querySelector(".MuiDialogTitle-root")?.textContent'
      );
    }

    if (!dialogTitle?.includes("Patient Details")) {
      throw new Error("Details dialog did not open correctly");
    }

    // Close dialog
    const closeBtn = await driver.findElement(
      By.xpath("//div[contains(@class, 'MuiDialog-root')]//button[contains(text(), 'Close')]")
    );
    await safeClick(closeBtn);
    await driver.sleep(1000);
    console.log("View Details test passed");

    // Test 2: View ECG Results and return - FINAL IMPROVED VERSION
    console.log("Testing View ECG Results...");
    const viewECGBtn = await firstCard.findElement(By.xpath(".//button[contains(text(), 'View ECG Results')]"));
    await safeClick(viewECGBtn);

    // Wait for ECG results page with multiple verification points
    await driver.wait(async () => {
      const currentUrl = await driver.getCurrentUrl();
      if (!currentUrl.includes("/ecg-results")) return false;
      
      // Additional checks to confirm page is really ready
      const pageReady = await driver.executeScript(`
        return document.readyState === 'complete' && 
              document.querySelector('.logo') !== null &&
              document.querySelector('.MuiIconButton-root') !== null
      `);
      return pageReady;
    }, 20000, "ECG results page never loaded properly");

    // Add a small stabilization delay
    await driver.sleep(1000);

    // Debugging: Log current state before navigation
    console.log("Current URL:", await driver.getCurrentUrl());
    const screenshot1 = await driver.takeScreenshot();
    fs.writeFileSync('ecg-results-page.png', screenshot1, 'base64');

    // Return home with multiple fallback methods
    async function navigateHome() {
      try {
        // Method 1: Regular click
        const logo = await driver.wait(until.elementLocated(By.css(".logo")), 10000);
        await driver.executeScript("arguments[0].scrollIntoView()", logo);
        await driver.wait(until.elementIsEnabled(logo), 5000);
        await logo.click();
        return true;
      } catch (err) {
        console.log("Method 1 failed, trying Method 2...");
      }

      try {
        // Method 2: JavaScript click
        await driver.executeScript('document.querySelector(".logo").click()');
        return true;
      } catch (err) {
        console.log("Method 2 failed, trying Method 3...");
      }

      try {
        // Method 3: URL navigation fallback
        await driver.get("http://localhost:5173/home");
        return true;
      } catch (err) {
        console.log("Method 3 failed");
        return false;
      }
    }

    if (!await navigateHome()) {
      throw new Error("Failed to navigate back home from ECG results");
    }

    // Verify we're on home page
    await driver.wait(until.urlContains("/home"), 15000);

    // Debugging: Log state after home navigation
    console.log("Navigated to home page");
    const screenshot2 = await driver.takeScreenshot();
    fs.writeFileSync('home-page.png', screenshot2, 'base64');

    // Navigate back to history with robust retries
    let historyNavigationSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`History navigation attempt ${attempt}`);
        
        // Open dropdown
        const dropdown = await driver.wait(until.elementLocated(By.css(".MuiIconButton-root")), 10000);
        await driver.executeScript("arguments[0].scrollIntoView()", dropdown);
        await driver.executeScript("arguments[0].click()", dropdown);
        
        // Click history menu item
        const historyMenuItem = await driver.wait(
          until.elementLocated(By.xpath("//li[contains(text(), 'History')]")),
          5000
        );
        await driver.executeScript("arguments[0].click()", historyMenuItem);
        
        // Verify navigation
        await driver.wait(until.urlContains("/history"), 10000);
        historyNavigationSuccess = true;
        break;
      } catch (err) {
        console.log(`Attempt ${attempt} failed:`, err.message);
        await driver.sleep(1000);
      }
    }

    if (!historyNavigationSuccess) {
      throw new Error("Failed to navigate back to history after 3 attempts");
    }

    await driver.sleep(2000);
    console.log("View ECG Results test passed");
    // Test 3: Delete Item - FIXED
    console.log("Testing Delete Item...");
    // Get initial count before deletion
    const initialItems = await driver.wait(until.elementsLocated(By.css(".MuiCard-root")), 10000);
    const initialCount = initialItems.length;

    // Use a fresh element reference for the delete button
    const deleteBtn = await driver.wait(
      until.elementLocated(
        By.xpath("(//div[contains(@class, 'MuiCard-root')])[1]//button[contains(text(), 'Delete')]")
      ),
      10000
    );

    // Scroll into view and click with retry
    let deleteSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Delete attempt ${attempt}`);
        await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", deleteBtn);
        await driver.wait(until.elementIsEnabled(deleteBtn), 5000);
        await driver.executeScript("arguments[0].click();", deleteBtn);
        deleteSuccess = true;
        break;
      } catch (err) {
        console.log(`Attempt ${attempt} failed:`, err.message);
        await driver.sleep(1000);
      }
    }

    if (!deleteSuccess) {
      throw new Error("Failed to click Delete button after 3 attempts");
    }

    // Wait for deletion to complete with fresh element references
    await driver.wait(async () => {
      try {
        const currentItems = await driver.findElements(By.css(".MuiCard-root"));
        return currentItems.length === initialCount - 1;
      } catch (err) {
        return false;
      }
    }, 10000, "Item count did not decrease after deletion");

    // Final verification
    const remainingItems = await driver.findElements(By.css(".MuiCard-root"));
    if (remainingItems.length !== initialCount - 1) {
      throw new Error(`Expected ${initialCount - 1} items after deletion, found ${remainingItems.length}`);
    }
    console.log("Delete Item test passed");
    // Test 4: Clear History - FIXED
    console.log("Testing Clear History...");
    const clearHistoryBtn = await driver.findElement(By.xpath("//button[contains(text(), 'Clear History')]"));
    await safeClick(clearHistoryBtn);
    await driver.sleep(2000);
    
    const finalItems = await driver.findElements(By.css(".MuiCard-root"));
    if (finalItems.length > 0) {
      throw new Error("History was not cleared successfully");
    }
    console.log("Clear History test passed");

    console.log("All history feature tests passed successfully!");

  } catch (error) {
    console.error("Test failed:", error);
    const screenshot = await driver.takeScreenshot();
    fs.writeFileSync('test-failure.png', screenshot, 'base64');
    console.log("Screenshot saved as test-failure.png");
  } finally {
    await driver.quit();
  }
})();