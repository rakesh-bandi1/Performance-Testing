const fs = require('fs');
const path = require('path');
const EmailService = require('./emailService.js');

// Test script to verify screenshot email functionality
async function testScreenshotEmail() {
  try {
    console.log('🧪 Testing screenshot email functionality...');
    
    // Create a test screenshot directory
    const screenshotsDir = 'testReports/screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    // Create a dummy screenshot file (1x1 pixel PNG)
    const testScreenshotPath = `${screenshotsDir}/test_screenshot.png`;
    const dummyImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(testScreenshotPath, dummyImageData);
    
    console.log(`📸 Created test screenshot: ${testScreenshotPath}`);
    console.log(`📸 File exists: ${fs.existsSync(testScreenshotPath)}`);
    console.log(`📸 File size: ${fs.statSync(testScreenshotPath).size} bytes`);
    
    // Create test results
    const testResults = [{
      userId: 0,
      loginTime: 1.5,
      apiLoadTime: 2.3,
      vizpadLoadTime: 3.2,
      chartLoadTime: 1.8,
      success: false,
      screenshots: [testScreenshotPath],
      errors: [{
        step: 'login',
        error: 'Test error for screenshot verification',
        timestamp: new Date().toISOString(),
        screenshot: testScreenshotPath
      }]
    }];
    
    // Test email service
    const emailService = new EmailService();
    
    console.log('📧 Testing email with screenshot...');
    await emailService.sendTestResults(
      testResults,
      1,
      10.5,
      'https://test.example.com',
      null, // csvFilePath
      null, // networkCsvFilePath  
      null, // networkLogsFilePath
      null, // comprehensiveNetworkCsvFilePath
      [testScreenshotPath] // screenshots
    );
    
    console.log('✅ Test completed successfully!');
    
    // Clean up test file
    if (fs.existsSync(testScreenshotPath)) {
      fs.unlinkSync(testScreenshotPath);
      console.log('🗑️  Cleaned up test screenshot');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testScreenshotEmail();
}

module.exports = { testScreenshotEmail };
