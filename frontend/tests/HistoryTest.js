import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";  // Add fs to check if the file exists

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async function testHistoryFilters() {
  let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();

  try {
    await driver.get("http://localhost:5173");

    // Wait for the disclaimer popup to appear
    let disclaimerPopup = await driver.wait(
      until.elementLocated(By.css(".MuiDialog-root")),
      10000 
    );

    // Check if the disclaimer checkbox is present and click it
    let disclaimerCheckbox = await driver.findElement(By.css('input[type="checkbox"]'));
    await disclaimerCheckbox.click();

    // Click the proceed button
    let proceedButton = await driver.findElement(By.xpath("//button[contains(text(), 'Proceed')]"));
    await proceedButton.click();

    // Upload an image
    console.log("Looking for the Upload Image button...");
    let uploadButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Upload Image')]")), 5000);
    await uploadButton.click();

    console.log("Uploading test.png...");
    let fileInput = await driver.wait(until.elementLocated(By.xpath("//input[@type='file']")), 5000);

    let filePath = path.resolve(__dirname, "test_images", "test.png");
    if (!fs.existsSync(filePath)) {
      console.error("Test image file does not exist at:", filePath);
      throw new Error("Test image file not found");
    }

    await fileInput.sendKeys(filePath);
    await driver.sleep(2000);

    console.log("Waiting for navigation to confirmation page...");
    await driver.wait(until.urlContains("/confirmupload"), 10000);

    console.log("Image uploaded and navigated to confirmation page.");
    await driver.sleep(1000);

    console.log("Filling out identifier field...");
    let identifierInput = await driver.findElement(By.xpath("//input[@id=//label[contains(text(), 'Unique Patient Identifier')]/@for]"));
    await identifierInput.sendKeys("TestIdentifier123");
    await driver.sleep(500);

    console.log("Filling out age field...");
    let ageInput = await driver.findElement(By.xpath("//input[@id=//label[contains(text(), 'Age')]/@for]"));
    await ageInput.sendKeys("25");
    await driver.sleep(500);

    console.log("Selecting patient status...");
    let patientStatusDropdown = await driver.findElement(By.xpath("//label[contains(text(), 'Patient Status')]/following-sibling::div"));
    await patientStatusDropdown.click();
    let firstPatientStatusOption = await driver.findElement(By.xpath("//li[contains(text(), 'Pre-treatment')]"));
    await firstPatientStatusOption.click();
    await driver.sleep(500);

    console.log("Selecting location type...");
    let locationTypeInput = await driver.findElement(By.xpath("//label[contains(text(), 'Location')]/following-sibling::div//input"));
    await locationTypeInput.sendKeys("Canada");
    await driver.sleep(3000); // Wait for 3 seconds

    console.log("Waiting for location suggestions...");
    let locationSuggestions = await driver.wait(
      until.elementsLocated(By.xpath("//ul[contains(@class, 'MuiList-root')]/li")),
      10000
    );
    console.log(`Found ${locationSuggestions.length} location suggestions.`);
    if (locationSuggestions.length > 0) {
      await locationSuggestions[0].click();
      console.log("Clicked the first location suggestion.");
    } else {
      console.error("No location suggestions found.");
    }
    await driver.sleep(500);

    console.log("Selecting gender...");
    let maleButton = await driver.findElement(By.xpath("//button[@value='male' and @aria-pressed='false']"));
    await maleButton.click();
    await driver.sleep(500);

    console.log("Clicking Confirm button...");
    let confirmButton = await driver.findElement(By.xpath("//button[contains(text(), 'Confirm')]"));
    await confirmButton.click();

    console.log("Handling confirmation popup...");
    let yesButton = await driver.findElement(By.xpath("//button[contains(text(), 'Confirm')]"));
    await driver.wait(
      until.elementIsVisible(yesButton),
      5000
    );
    
    await driver.wait(
      until.elementIsEnabled(yesButton),
      5000);
    
    await yesButton.click();

    console.log("Waiting for diagnosis and navigation to result page...");
    await driver.wait(until.urlContains("/ecg-results"), 30000); // Increased wait time to 30 seconds
    console.log("Successfully navigated to result page.");

    // Navigate to home page by clicking the logo in the top left
    console.log("Navigating to home page...");
    let logoButton = await driver.findElement(By.css(".logo"));
    await logoButton.click();
    await driver.wait(until.urlContains("/home"), 10000);
    console.log("Successfully navigated to /home.");

    // Wait for the dropdown button to appear in the top right
    let dropdownButton = await driver.wait(
      until.elementLocated(By.css(".MuiIconButton-root")),
      10000 
    );
    await dropdownButton.click();

    // Wait for the History button to appear and click it
    let historyButton = await driver.wait(
      until.elementLocated(By.xpath("//li[contains(text(), 'History')]")),
      10000 
    );
    await historyButton.click();

    // Wait for the History page to load
    await driver.sleep(5000);

    // Wait for a few seconds after reaching the history page
    console.log("Waiting for a few seconds on the history page...");
    await driver.sleep(5000);

    console.log("History filters test passed successfully!");

  } catch (error) {
    console.error("Test failed:", error);
    let debugUrl = await driver.getCurrentUrl();
    console.log("Current URL at error:", debugUrl);
  } finally {
    await driver.quit();
  }
})();