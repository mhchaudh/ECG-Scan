import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async function testHistoryDelete() {
    let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();
  
    try {
      await driver.get("http://localhost:5173");
  
      // Handle disclaimer
      await driver.wait(until.elementLocated(By.css(".MuiDialog-root")), 10000);
      await driver.findElement(By.css('input[type="checkbox"]')).click();
      await driver.findElement(By.xpath("//button[contains(text(), 'Proceed')]")).click();
  
      // Upload test image function (unchanged)
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
      console.log("Uploading first test image...");
      await uploadTestImage();
      await driver.sleep(2000);
  
      // Upload second image
      console.log("Uploading second test image...");
      await uploadTestImage();
      await driver.sleep(2000);
  
      // Navigate to history
      await driver.findElement(By.css(".MuiIconButton-root")).click();
      await driver.wait(until.elementLocated(By.xpath("//li[contains(text(), 'History')]")), 5000).click();
      await driver.wait(until.urlContains("/history"), 10000);
      await driver.sleep(2000);
  
      // Helper function for reliable clicking (unchanged)
      async function safeClick(element) {
        await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", element);
        await driver.wait(until.elementIsEnabled(element), 5000);
        await driver.sleep(500);
        try {
          await element.click();
        } catch (err) {
          await driver.executeScript("arguments[0].click();", element);
        }
      }
  
      // Test 1: Delete one item
      console.log("Testing Delete Item...");
      const initialItems = await driver.wait(until.elementsLocated(By.css(".MuiCard-root")), 10000);
      const initialCount = initialItems.length;
      
      if (initialCount < 2) {
        throw new Error("Need at least 2 items for delete test");
      }
  
      // Delete the first item
      const firstDeleteBtn = await driver.wait(
        until.elementLocated(By.xpath("(//div[contains(@class, 'MuiCard-root')])[1]//button[contains(text(), 'Delete')]")),
        10000
      );
      await safeClick(firstDeleteBtn);
      await driver.sleep(2000);
  
      // Verify deletion
      const afterDeleteItems = await driver.findElements(By.css(".MuiCard-root"));
      if (afterDeleteItems.length !== initialCount - 1) {
        throw new Error(`Expected ${initialCount - 1} items after deletion, found ${afterDeleteItems.length}`);
      }
      console.log("Delete Item test passed");
  
      // Test 2: Clear History
      console.log("Testing Clear History...");
      const clearHistoryBtn = await driver.wait(
        until.elementLocated(By.xpath("//button[contains(text(), 'Clear History')]")),
        10000
      );
      await safeClick(clearHistoryBtn);
      await driver.sleep(2000);
  
      // Verify all items are cleared
      await driver.wait(async () => {
        const items = await driver.findElements(By.css(".MuiCard-root"));
        return items.length === 0;
      }, 10000, "History was not cleared");
  
      const finalItems = await driver.findElements(By.css(".MuiCard-root"));
      if (finalItems.length > 0) {
        throw new Error(`Expected 0 items after clear, found ${finalItems.length}`);
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