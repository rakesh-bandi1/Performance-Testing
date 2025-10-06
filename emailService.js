const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor(config = {}) {
    this.config = {
      // SMTP Configuration
      host: config.host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: config.port || process.env.SMTP_PORT || 587,
      secure: config.secure || process.env.SMTP_SECURE === 'true' || false,
      
      // Authentication
      user: config.user || process.env.SMTP_USER || 'learnmern2024@gmail.com',
      pass: config.pass || process.env.SMTP_PASS || 'fwfn wasd lvfm omrl',
      
      // Email Configuration
      from: config.from || process.env.EMAIL_FROM || 'learnmern2024@gmail.com',
      to: config.to || process.env.EMAIL_TO || 'rakesh.bandi@tellius.com',
      subject: config.subject || 'Vizpad Performance Test Results',
      
      // Optional settings
      cc: config.cc || process.env.EMAIL_CC || 'ankur.gollen@tellius.com',
      bcc: config.bcc || process.env.EMAIL_BCC || '',
      
      ...config
    };
    
    this.transporter = null;
  }

  async createTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    // Verify connection
    try {
      await this.transporter.verify();
      console.log('Email service configured successfully');
      return this.transporter;
    } catch (error) {
      console.error('Email service configuration failed:', error.message);
      throw error;
    }
  }

  generateEmailContent(results, numUsers, scriptRunTime, vizpadUrl) {
    const successfulTests = results.filter(r => r.success).length;
    const failedTests = results.filter(r => !r.success).length;
    
    // Calculate averages for successful tests
    const successfulResults = results.filter(r => r.success);
    let averages = {};
    
    if (successfulResults.length > 0) {
      averages = {
        vizpadLoad: (successfulResults.reduce((sum, r) => sum + r.vizpadLoadTime, 0) / successfulResults.length).toFixed(2),
        chartLoad: (successfulResults.reduce((sum, r) => sum + r.chartLoadTime, 0) / successfulResults.length).toFixed(2),
        areaFilter: (successfulResults.reduce((sum, r) => sum + r.areaFilterTime, 0) / successfulResults.length).toFixed(2),
        tabSwitch1: (successfulResults.reduce((sum, r) => sum + r.tabSwitchTime1, 0) / successfulResults.length).toFixed(2),
        tabSwitch2: (successfulResults.reduce((sum, r) => sum + r.tabSwitchTime2, 0) / successfulResults.length).toFixed(2),
        regionFilter: (successfulResults.reduce((sum, r) => sum + r.regionFilterTime, 0) / successfulResults.length).toFixed(2),
        territoryFilter: (successfulResults.reduce((sum, r) => sum + r.territoryFilterTime, 0) / successfulResults.length).toFixed(2),
        tabSwitch3: (successfulResults.reduce((sum, r) => sum + r.tabSwitchTime3, 0) / successfulResults.length).toFixed(2),
      };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Vizpad Performance Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; }
        .summary { background-color: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .metrics { background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .error { background-color: #ffe6e6; padding: 15px; margin: 20px 0; border-radius: 5px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .success { color: green; }
        .failed { color: red; }
        .metric-value { font-weight: bold; color: #333; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Vizpad Performance Test Results</h1>
        <p><strong>Test URL:</strong> ${vizpadUrl}</p>
        <p><strong>Test Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Script Runtime:</strong> <span class="metric-value">${scriptRunTime.toFixed(2)} seconds</span></p>
    </div>

    <div class="summary">
        <h2>📈 Test Summary</h2>
        <p><strong>Total Users Tested:</strong> <span class="metric-value">${numUsers}</span></p>
        <p><strong>Successful Tests:</strong> <span class="success">${successfulTests}</span></p>
        <p><strong>Failed Tests:</strong> <span class="failed">${failedTests}</span></p>
        <p><strong>Success Rate:</strong> <span class="metric-value">${((successfulTests / numUsers) * 100).toFixed(1)}%</span></p>
    </div>

    ${successfulResults.length > 0 ? `
    <div class="metrics">
        <h2>📊 Average Performance Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Average Time (seconds)</th>
            </tr>
            <tr>
                <td>Vizpad Load</td>
                <td class="metric-value">${averages.vizpadLoad}</td>
            </tr>
            <tr>
                <td>Chart Load</td>
                <td class="metric-value">${averages.chartLoad}</td>
            </tr>
            <tr>
                <td>Area Filter</td>
                <td class="metric-value">${averages.areaFilter}</td>
            </tr>
            <tr>
                <td>Tab Switch 1</td>
                <td class="metric-value">${averages.tabSwitch1}</td>
            </tr>
            <tr>
                <td>Tab Switch 2</td>
                <td class="metric-value">${averages.tabSwitch2}</td>
            </tr>
            <tr>
                <td>Region Filter</td>
                <td class="metric-value">${averages.regionFilter}</td>
            </tr>
            <tr>
                <td>Territory Filter</td>
                <td class="metric-value">${averages.territoryFilter}</td>
            </tr>
            <tr>
                <td>Tab Switch 3</td>
                <td class="metric-value">${averages.tabSwitch3}</td>
            </tr>
        </table>
    </div>
    ` : ''}

    <div class="metrics">
        <h2>📋 Detailed Results</h2>
        <table>
            <tr>
                <th>User ID</th>
                <th>Vizpad Load (s)</th>
                <th>Chart Load (s)</th>
                <th>Area Filter (s)</th>
                <th>Tab Switch 1 (s) - Tab Index</th>
                <th>Tab Switch 2 (s) - Tab Index</th>
                <th>Region Filter (s)</th>
                <th>Territory Filter (s)</th>
                <th>Tab Switch 3 (s) - Tab Index</th>
                <th>Status</th>
            </tr>
            ${results.map(result => `
            <tr>
                <td>${result.userId}</td>
                <td>${result.vizpadLoadTime ? result.vizpadLoadTime.toFixed(2) : 'N/A'}</td>
                <td>${result.chartLoadTime ? result.chartLoadTime.toFixed(2) : 'N/A'}</td>
                <td>${result.areaFilterTime ? result.areaFilterTime.toFixed(2) : 'N/A'}</td>
                <td>${result.tabSwitchTime1 ? `${result.tabSwitchTime1.toFixed(2)} (Tab ${result.randomTab1 || 'N/A'})` : 'N/A'}</td>
                <td>${result.tabSwitchTime2 ? `${result.tabSwitchTime2.toFixed(2)} (Tab ${result.randomTab2 || 'N/A'})` : 'N/A'}</td>
                <td>${result.regionFilterTime ? result.regionFilterTime.toFixed(2) : 'N/A'}</td>
                <td>${result.territoryFilterTime ? result.territoryFilterTime.toFixed(2) : 'N/A'}</td>
                <td>${result.tabSwitchTime3 ? `${result.tabSwitchTime3.toFixed(2)} (Tab ${result.randomTab3 || 'N/A'})` : 'N/A'}</td>
                <td class="${result.success ? 'success' : 'failed'}">${result.success ? '✅ Success' : '❌ Failed'}</td>
            </tr>
            `).join('')}
        </table>
    </div>

    ${failedTests > 0 ? `
    <div class="error">
        <h2>⚠️ Failed Tests</h2>
        <p>The following tests encountered errors:</p>
        <ul>
            ${results.filter(r => !r.success).map(result => `
            <li><strong>User ${result.userId}:</strong> ${result.error || 'Unknown error'}</li>
            `).join('')}
        </ul>
    </div>
    ` : ''}

    <p><em>This email was automatically generated by the Vizpad Performance Test Suite.</em></p>
</body>
</html>
    `;

    const textContent = `
Vizpad Performance Test Results
==============================

Test URL: ${vizpadUrl}
Test Date: ${new Date().toLocaleString()}
Total Script Runtime: ${scriptRunTime.toFixed(2)} seconds

Test Summary:
- Total Users Tested: ${numUsers}
- Successful Tests: ${successfulTests}
- Failed Tests: ${failedTests}
- Success Rate: ${((successfulTests / numUsers) * 100).toFixed(1)}%

${successfulResults.length > 0 ? `
Average Performance Metrics:
- Vizpad Load: ${averages.vizpadLoad} seconds
- Chart Load: ${averages.chartLoad} seconds
- Area Filter: ${averages.areaFilter} seconds
- Tab Switch 1: ${averages.tabSwitch1} seconds
- Tab Switch 2: ${averages.tabSwitch2} seconds
- Region Filter: ${averages.regionFilter} seconds
- Territory Filter: ${averages.territoryFilter} seconds
- Tab Switch 3: ${averages.tabSwitch3} seconds
` : ''}

Detailed Results:
${results.map(result => `
User ${result.userId}:
  Vizpad Load: ${result.vizpadLoadTime ? result.vizpadLoadTime.toFixed(2) : 'N/A'}s
  Chart Load: ${result.chartLoadTime ? result.chartLoadTime.toFixed(2) : 'N/A'}s
  Area Filter: ${result.areaFilterTime ? result.areaFilterTime.toFixed(2) : 'N/A'}s
  Tab Switch 1: ${result.tabSwitchTime1 ? `${result.tabSwitchTime1.toFixed(2)}s (Tab ${result.randomTab1 || 'N/A'})` : 'N/A'}
  Tab Switch 2: ${result.tabSwitchTime2 ? `${result.tabSwitchTime2.toFixed(2)}s (Tab ${result.randomTab2 || 'N/A'})` : 'N/A'}
  Region Filter: ${result.regionFilterTime ? result.regionFilterTime.toFixed(2) : 'N/A'}s
  Territory Filter: ${result.territoryFilterTime ? result.territoryFilterTime.toFixed(2) : 'N/A'}s
  Tab Switch 3: ${result.tabSwitchTime3 ? `${result.tabSwitchTime3.toFixed(2)}s (Tab ${result.randomTab3 || 'N/A'})` : 'N/A'}
  Status: ${result.success ? 'SUCCESS' : 'FAILED'}
`).join('')}

${failedTests > 0 ? `
Failed Tests:
${results.filter(r => !r.success).map(result => `- User ${result.userId}: ${result.error || 'Unknown error'}`).join('\n')}
` : ''}

This email was automatically generated by the Vizpad Performance Test Suite.
    `;

    return { html: htmlContent, text: textContent };
  }

  async sendTestResults(results, numUsers, scriptRunTime, vizpadUrl, csvFilePath = null, networkCsvFilePath = null, networkLogsFilePath = null, comprehensiveNetworkCsvFilePath = null, screenshots = []) {
    try {
      await this.createTransporter();
      
      const { html, text } = this.generateEmailContent(results, numUsers, scriptRunTime, vizpadUrl);
      
      const mailOptions = {
        from: this.config.from,
        to: this.config.to,
        subject: this.config.subject,
        html: html,
        text: text,
        attachments: []
      };

      // Add CC and BCC if configured
      if (this.config.cc) {
        mailOptions.cc = this.config.cc;
      }
      if (this.config.bcc) {
        mailOptions.bcc = this.config.bcc;
      }

      // Attach main CSV file if it exists
      if (csvFilePath && fs.existsSync(csvFilePath)) {
        mailOptions.attachments.push({
          filename: path.basename(csvFilePath),
          path: csvFilePath,
          contentType: 'text/csv'
        });
      }

      // Attach network requests CSV file if it exists
      if (networkCsvFilePath && fs.existsSync(networkCsvFilePath)) {
        mailOptions.attachments.push({
          filename: path.basename(networkCsvFilePath),
          path: networkCsvFilePath,
          contentType: 'text/csv'
        });
      }

      // Attach network logs text file if it exists
      if (networkLogsFilePath && fs.existsSync(networkLogsFilePath)) {
        mailOptions.attachments.push({
          filename: path.basename(networkLogsFilePath),
          path: networkLogsFilePath,
          contentType: 'text/plain'
        });
      }

      // Attach screenshots if any exist
      if (screenshots && screenshots.length > 0) {
        console.log(`📸 Attaching ${screenshots.length} screenshot(s) to email...`);
        console.log(`📸 Screenshot paths:`, screenshots);
        screenshots.forEach((screenshotPath, index) => {
          console.log(`📸 Checking screenshot ${index + 1}: ${screenshotPath}`);
          if (fs.existsSync(screenshotPath)) {
            console.log(`📸 Adding screenshot ${index + 1} to attachments`);
            mailOptions.attachments.push({
              filename: `screenshot_${index + 1}_${path.basename(screenshotPath)}`,
              path: screenshotPath,
              contentType: 'image/png'
            });
          } else {
            console.log(`❌ Screenshot file not found: ${screenshotPath}`);
          }
        });
        console.log(`📸 Total attachments: ${mailOptions.attachments.length}`);
      } else {
        console.log(`📸 No screenshots to attach (screenshots: ${screenshots})`);
      }

      console.log('Sending email with test results...');
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully!');
      console.log(`Message ID: ${info.messageId}`);
      console.log(`Recipients: ${info.accepted.join(', ')}`);
      
      return info;
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      throw error;
    }
  }
}

module.exports = EmailService; 