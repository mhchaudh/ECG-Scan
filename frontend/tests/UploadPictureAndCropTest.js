import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async function testUploadImageAndConfirm() {
    let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();
    try {
        console.log("Opening the web app...");
        await driver.get("http://localhost:5173");
        await sleep(1000);

        // Handle disclaimer popup
        console.log("Handling disclaimer popup...");
        let disclaimerPopup = await driver.wait(until.elementLocated(By.css(".MuiDialog-root")), 10000);
        let disclaimerCheckbox = await driver.findElement(By.css('input[type="checkbox"]'));
        await disclaimerCheckbox.click();
        let proceedButton = await driver.findElement(By.xpath("//button[contains(text(), 'Proceed')]"));
        await proceedButton.click();
        await sleep(1000);

        console.log("Looking for the Upload Image button...");
        let uploadButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Upload Image')]")), 5000).catch((error) => {
            console.error("Failed to find the Upload Image button:", error);
            throw new Error("Upload Image button not found");
        });

        console.log("Upload Image button found. Clicking...");
        await uploadButton.click();
        await sleep(1000);

        console.log("Uploading test.jpg...");
        let fileInput = await driver.wait(until.elementLocated(By.xpath("//input[@type='file']")), 5000).catch((error) => {
            console.error("Failed to find file input field:", error);
            throw new Error("File input field not found");
        });

        // Update file path to look in test_images folder
        let filePath = path.resolve(__dirname, "test_images", "test.jpg");
        if (!fs.existsSync(filePath)) {
            console.error("Test image file does not exist at:", filePath);
            throw new Error("Test image file not found");
        }

        await fileInput.sendKeys(filePath);
        await sleep(2000);

        console.log("Waiting for navigation to confirmation page...");
        await driver.wait(until.urlContains("/confirmupload"), 10000).catch((error) => {
            console.error("Failed to navigate to confirmation page:", error);
            throw new Error("Navigation to confirmation page failed");
        });

        console.log("Image uploaded and navigated to confirmation page.");
        await sleep(1000);

        console.log("Filling out identifier field...");
        let identifierInput = await driver.wait(until.elementLocated(By.xpath("//input[@id=//label[contains(text(), 'Unique Patient Identifier')]/@for]")), 5000).catch((error) => {
            console.error("Failed to find identifier input field:", error);
            throw new Error("Identifier input field not found");
        });

        await identifierInput.sendKeys("TestIdentifier123");
        await sleep(500);

        console.log("Filling out age field...");
        let ageInput = await driver.wait(until.elementLocated(By.xpath("//input[@id=//label[contains(text(), 'Age')]/@for]")), 5000).catch((error) => {
            console.error("Failed to find age input field:", error);
            throw new Error("Age input field not found");
        });

        await ageInput.sendKeys("25");
        await sleep(500);

        console.log("Selecting patient status...");
        let patientStatusDropdown = await driver.findElement(By.xpath("//label[contains(text(), 'Patient Status')]/following-sibling::div"));
        await patientStatusDropdown.click();
        let firstPatientStatusOption = await driver.findElement(By.xpath("//li[contains(text(), 'Pre-treatment')]"));
        await firstPatientStatusOption.click();
        await sleep(500);

        console.log("Selecting location type...");
        let locationTypeInput = await driver.findElement(By.xpath("//label[contains(text(), 'Location')]/following-sibling::div//input"));
        await locationTypeInput.sendKeys("Canada");
        await sleep(3000); // Wait for 3 seconds

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
        await sleep(500);

        console.log("Selecting gender...");
        let maleButton = await driver.wait(until.elementLocated(By.xpath("//button[@value='male' and @aria-pressed='false']")), 5000).catch((error) => {
            console.error("Failed to find male gender button:", error);
            throw new Error("Male gender button not found");
        });
        await maleButton.click();
        await sleep(500);

        console.log("Clicking Confirm button...");
        let confirmButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Confirm')]")), 10000).catch((error) => {
            console.error("Failed to find Confirm button:", error);
            throw new Error("Confirm button not found");
        });

        await sleep(1000);
        await confirmButton.click();

        console.log("Handling confirmation popup...");
        let confirmPopupButton = await driver.wait(
            until.elementLocated(By.xpath("//div[contains(@class, 'MuiDialog-root')]//button[contains(text(), 'Confirm')]")),
            5000
        ).catch((error) => {
            console.error("Failed to find Confirm button in popup:", error);
            throw new Error("Confirm button not found in confirmation popup");
        });
        await sleep(1000);
        await confirmPopupButton.click();

        console.log("Waiting for navigation to result page...");
        await driver.wait(until.urlContains("/ecg-results"), 30000).catch((error) => {
            console.error("Failed to navigate to result page:", error);
            throw new Error("Navigation to result page failed");
        });
        console.log("Successfully navigated to result page.");

        // NEW TESTS FOR ECG RESULTS PAGE

        console.log("Starting ECG Results page tests...");
        await sleep(2000);

        // Test 1: Click on color box and verify dialog appears
        console.log("Testing color box interaction...");
        let colorBoxes = await driver.wait(until.elementsLocated(By.css(".color-box-force")), 5000);
        if (colorBoxes.length === 0) {
            throw new Error("No color boxes found on the page");
        }

        console.log(`Found ${colorBoxes.length} color boxes. Clicking the first one...`);
        await colorBoxes[0].click();
        await sleep(1000);

        console.log("Checking if color dialog appears...");
        let colorDialog = await driver.wait(until.elementLocated(By.css(".MuiDialog-root")), 5000).catch((error) => {
            console.error("Color dialog did not appear:", error);
            throw new Error("Color dialog not shown after clicking color box");
        });

        console.log("Color dialog appeared successfully. Closing it...");
        let closeButton = await driver.findElement(By.xpath("//div[contains(@class, 'MuiDialog-root')]//button[contains(text(), 'Close')]"));
        await closeButton.click();
        await sleep(1000);

        // Test 2: Submit feedback and verify it's displayed
        console.log("Testing feedback submission...");
        
        // Check if feedback is already submitted (in case of test reruns)
        let feedbackText;
        try {
            feedbackText = await driver.findElement(By.xpath("//*[contains(text(), 'Your feedback:')]"));
            console.log("Feedback already submitted, skipping test");
        } catch (e) {
            // Feedback not submitted yet, proceed with test
            console.log("Selecting 'Yes' feedback option...");
            let yesRadio = await driver.wait(until.elementLocated(By.xpath("//input[@value='Yes']/..")), 5000);
            await yesRadio.click();
            await sleep(500);

           // Replace the feedback verification section with this improved version:

            console.log("Submitting feedback...");
            let submitButton = await driver.findElement(By.xpath("//button[contains(text(), 'Submit Feedback')]"));
            await submitButton.click();

            // Add more robust waiting for the feedback to appear
            console.log("Waiting for feedback to be processed...");
            try {
                // Wait first for the submit button to disappear (indicating submission started)
                await driver.wait(until.stalenessOf(submitButton), 10000);
                
                // Then wait for the feedback text to appear with more flexible matching
                feedbackText = await driver.wait(until.elementLocated(By.xpath("//*[contains(translate(., 'YES', 'yes'), 'your feedback: yes')]")), 10000);
                
                console.log("Feedback text found:", await feedbackText.getText());
            } catch (error) {
                // Debug what's actually on the page
                let pageSource = await driver.getPageSource();
                console.log("Current page content:", pageSource);
                throw new Error("Feedback submission not reflected on page: " + error.message);
            }

            console.log("Feedback submitted and displayed successfully");
        }

        console.log("All ECG Results page tests passed!");

        console.log("Waiting for 5 seconds before finishing...");
        await sleep(5000);

        console.log("All tests passed successfully!");

    } catch (error) {
        console.error("Test failed:", error);
        let debugUrl = await driver.getCurrentUrl();
        console.log("Current URL at error:", debugUrl);
    } finally {
        await driver.quit();
    }
})();