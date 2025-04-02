import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async function testComparingUploads() {
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

    // Function to upload and confirm an image
    async function uploadAndConfirmImage() {
      console.log("Looking for the Upload Image button...");
      let uploadButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Upload Image')]")), 5000);
      await uploadButton.click();

      console.log("Uploading test.jpg...");
      let fileInput = await driver.wait(until.elementLocated(By.xpath("//input[@type='file']")), 5000);

      let filePath = path.resolve(__dirname, "test_images", "test.jpg");
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
      let confirmPopupButton = await driver.wait(
          until.elementLocated(By.xpath("//div[contains(@class, 'MuiDialog-root')]//button[contains(text(), 'Confirm')]")),
          5000
      ).catch((error) => {
          console.error("Failed to find Confirm button in popup:", error);
          throw new Error("Confirm button not found in confirmation popup");
      });
      await driver.sleep(1000);
      await confirmPopupButton.click();

      console.log("Waiting for diagnosis and navigation to result page...");
      await driver.wait(until.urlContains("/ecg-results"), 30000);
      console.log("Successfully navigated to result page.");

      console.log("Staying on the result page for 5 seconds...");
      await driver.sleep(5000);

      // Navigate to home page by clicking the logo in the top left
      console.log("Navigating to home page...");
      let logoButton = await driver.findElement(By.css(".logo"));
      await logoButton.click();
      await driver.wait(until.urlContains("/home"), 10000);
      console.log("Successfully navigated to /home.");
    }

    // First upload and confirm
    await uploadAndConfirmImage();

    // Refresh the page to reset the state
    console.log("Refreshing the page...");
    await driver.navigate().refresh();
    await driver.sleep(5000);

    // Second upload and confirm
    await uploadAndConfirmImage();

    // Navigate to history
    console.log("Navigating to history...");
    let dropdownButton = await driver.wait(
      until.elementLocated(By.css(".MuiIconButton-root")),
      10000
    );
    await dropdownButton.click();

    let historyButton = await driver.wait(
      until.elementLocated(By.xpath("//li[contains(text(), 'History')]")),
      10000
    );
    await historyButton.click();

    // Wait for the History page to load
    await driver.wait(until.urlContains("/history"), 10000);
    await driver.sleep(3000);

    // Get all history cards
    let historyCards = await driver.findElements(By.css(".MuiCard-root"));
    console.log(`Found ${historyCards.length} history cards`);

    if (historyCards.length < 2) {
      throw new Error("Need at least 2 history items for comparison test");
    }

    // Updated comparison checkbox selection logic
    console.log("Selecting first two cards for comparison...");

    // Wait for compare checkboxes to be present
    let compareCheckboxes = await driver.wait(
      until.elementsLocated(By.xpath("//span[contains(text(), 'Compare')]/preceding-sibling::span/input")),
      10000
    );

    if (compareCheckboxes.length < 2) {
      throw new Error(`Found only ${compareCheckboxes.length} compare checkboxes, need at least 2`);
    }

    // Click first checkbox using JavaScript
    await driver.executeScript("arguments[0].click();", compareCheckboxes[0]);
    await driver.sleep(1000);

    // Verify first checkbox is checked
    let isFirstChecked = await driver.executeScript("return arguments[0].checked;", compareCheckboxes[0]);
    if (!isFirstChecked) {
      throw new Error("First checkbox did not get checked");
    }

    // Click second checkbox using JavaScript
    await driver.executeScript("arguments[0].click();", compareCheckboxes[1]);
    await driver.sleep(1000);

    // Verify second checkbox is checked
    let isSecondChecked = await driver.executeScript("return arguments[0].checked;", compareCheckboxes[1]);
    if (!isSecondChecked) {
      throw new Error("Second checkbox did not get checked");
    }

    // Verify exactly 2 checkboxes are selected
    let selectedCheckboxes = await driver.findElements(By.css('input[type="checkbox"]:checked'));
    if (selectedCheckboxes.length !== 2) {
      throw new Error(`Expected 2 checkboxes to be checked, found ${selectedCheckboxes.length}`);
    }

    // Verify comparison dialog appears
    console.log("Checking for comparison dialog...");
    let comparisonDialog = await driver.wait(
      until.elementLocated(By.xpath("//div[contains(@class, 'MuiDialog-root') and contains(.//h2, 'Compare The Leads of Two ECG Images')]")),
      5000
    );
    
    // Verify two images are shown in the dialog
    let comparisonImages = await comparisonDialog.findElements(By.css("img"));
    if (comparisonImages.length !== 2) {
      throw new Error(`Expected 2 images in comparison dialog, found ${comparisonImages.length}`);
    }
    console.log("Comparison dialog shows 2 images as expected");

    // Close the comparison dialog
    let closeButton = await comparisonDialog.findElement(By.xpath(".//button[contains(text(), 'Close')]"));
    await closeButton.click();
    await driver.sleep(1000);

    // Verify dialog is closed
    let dialogs = await driver.findElements(By.css(".MuiDialog-root"));
    let comparisonDialogClosed = true;
    for (let dialog of dialogs) {
      let isDisplayed = await dialog.isDisplayed();
      if (isDisplayed) {
        comparisonDialogClosed = false;
        break;
      }
    }
    if (!comparisonDialogClosed) {
      throw new Error("Comparison dialog did not close properly");
    }

    console.log("Comparing uploads test passed successfully!");

  } catch (error) {
    console.error("Test failed:", error);
    let debugUrl = await driver.getCurrentUrl();
    console.log("Current URL at error:", debugUrl);
    
    // Take screenshot for debugging
    let screenshot = await driver.takeScreenshot();
    fs.writeFileSync('test-failure.png', screenshot, 'base64');
    console.log("Screenshot saved as test-failure.png");
  } finally {
    await driver.quit();
  }
})();