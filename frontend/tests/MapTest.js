import { Builder, By, until, Key } from "selenium-webdriver";

(async function testMapButton() {
  let driver = await new Builder().forBrowser("chrome").build();

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

    // Wait for the dropdown button to appear in the top right
    let dropdownButton = await driver.wait(
      until.elementLocated(By.css(".MuiIconButton-root")),
      10000
    );
    await dropdownButton.click();

    // Wait for the Map button to appear and click it
    let mapButton = await driver.wait(
      until.elementLocated(By.xpath("//li[contains(text(), 'Map')]")),
      10000
    );
    await mapButton.click();

    // Wait for 3 seconds after reaching the page
    await driver.sleep(3000);

    // Click on the page to dismiss any initial dropdown
    let pageBackground = await driver.wait(
      until.elementLocated(By.css("body")),
      10000
    );
    await pageBackground.click();

    // Wait for the "Filter by Diagnosis" dropdown to appear
    let filterDropdown = await driver.wait(
      until.elementLocated(By.xpath("//div[contains(@class, 'MuiFormControl-root')]//div[contains(@class, 'MuiSelect-root')]")),
      10000
    );

    // Click the dropdown
    await filterDropdown.click();

    // Wait for 3 seconds after clicking the dropdown
    await driver.sleep(3000);

    // Wait for the second option in the dropdown to appear
    let secondOption = await driver.wait(
      until.elementLocated(By.xpath("//li[contains(@class, 'MuiMenuItem-root')][2]")),
      10000
    );

    // Click the second option
    await secondOption.click();

    // Wait for 5 seconds after selecting the second option
    await driver.sleep(5000);

    // Click on the screen to ensure the map has focus
    let pageBackground1 = await driver.wait(
      until.elementLocated(By.css("body")), 
      10000
    );
    await pageBackground1.click();

    // Simulate pressing the '-' key to zoom out
    await driver.actions().sendKeys(Key.SUBTRACT).perform();

    console.log("Test passed successfully!");

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await driver.quit();
  }
})();