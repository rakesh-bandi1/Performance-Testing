const EmailService = require('./emailService.js');

// Test email configuration
async function testEmailConfiguration() {
  console.log('🧪 Testing Email Configuration...\n');
  
  try {
    // Create email service with default configuration
    const emailService = new EmailService();
    
    // Test connection
    console.log('📡 Testing SMTP connection...');
    await emailService.createTransporter();
    console.log('✅ SMTP connection successful!\n');
    
    // Test email content generation
    console.log('📝 Testing email content generation...');
    const mockResults = [
      {
        userId: 0,
        vizpadLoadTime: 2.5,
        chartLoadTime: 1.8,
        areaFilterTime: 0.9,
        territoryFilterTime: 1.2,
        timeFilterTime: 2.1,
        TotalFilterTestTime: 4.2,
        success: true
      },
      {
        userId: 1,
        vizpadLoadTime: 2.8,
        chartLoadTime: 2.1,
        areaFilterTime: 1.1,
        territoryFilterTime: 1.4,
        timeFilterTime: 2.3,
        TotalFilterTestTime: 4.8,
        success: true
      }
    ];
    
    const { html, text } = emailService.generateEmailContent(mockResults, 2, 15.5, 'https://test-vizpad-url.com');
    console.log('✅ Email content generated successfully!');
    console.log(`   HTML length: ${html.length} characters`);
    console.log(`   Text length: ${text.length} characters\n`);
    
    // Check if email is configured
    if (!emailService.config.to) {
      console.log('⚠️  Warning: No recipient email configured (EMAIL_TO)');
      console.log('   Email will not be sent without a recipient address\n');
    }
    
    if (!emailService.config.user || !emailService.config.pass) {
      console.log('⚠️  Warning: SMTP credentials not configured');
      console.log('   Please set SMTP_USER and SMTP_PASS environment variables\n');
    }
    
    console.log('📋 Configuration Summary:');
    console.log(`   SMTP Host: ${emailService.config.host}`);
    console.log(`   SMTP Port: ${emailService.config.port}`);
    console.log(`   SMTP Secure: ${emailService.config.secure}`);
    console.log(`   From: ${emailService.config.from}`);
    console.log(`   To: ${emailService.config.to || 'Not configured'}`);
    console.log(`   CC: ${emailService.config.cc || 'Not configured'}`);
    console.log(`   BCC: ${emailService.config.bcc || 'Not configured'}`);
    console.log(`   Subject: ${emailService.config.subject}\n`);
    
    console.log('✅ Email configuration test completed successfully!');
    console.log('\n📧 To send a test email, run:');
    console.log('   node vizpadTest.js "your-vizpad-url" 1 0 true');
    
  } catch (error) {
    console.error('❌ Email configuration test failed:');
    console.error(`   Error: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your environment variables');
    console.log('   2. Verify SMTP credentials');
    console.log('   3. Ensure network connectivity');
    console.log('   4. For Gmail, use App Password instead of regular password');
  }
}

// Run the test
testEmailConfiguration(); 