// Email Configuration for Vizpad Performance Tests
// This file contains email settings for sending test results

// You can configure email settings in several ways:
// 1. Environment variables (recommended for production)
// 2. Direct configuration in this file
// 3. Command line arguments

const emailConfig = {
  // SMTP Configuration
  smtp: {
    // Gmail Configuration
    gmail: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER || 'your-email@gmail.com',
        pass: process.env.GMAIL_PASS || 'your-app-password' // Use App Password, not regular password
      }
    },
    
    // Outlook/Hotmail Configuration
    outlook: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.OUTLOOK_USER || 'your-email@outlook.com',
        pass: process.env.OUTLOOK_PASS || 'your-password'
      }
    },
    
    // Office 365 Configuration
    office365: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.OFFICE365_USER || 'your-email@company.com',
        pass: process.env.OFFICE365_PASS || 'your-password'
      }
    },
    
    // Custom SMTP Configuration
    custom: {
      host: process.env.SMTP_HOST || 'smtp.your-server.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_USER || 'your-username',
        pass: process.env.SMTP_PASS || 'your-password'
      }
    }
  },
  
  // Email Content Configuration
  email: {
    from: process.env.EMAIL_FROM || 'vizpad-test@your-company.com',
    to: process.env.EMAIL_TO || 'recipient@your-company.com',
    cc: process.env.EMAIL_CC || '',
    bcc: process.env.EMAIL_BCC || '',
    subject: process.env.EMAIL_SUBJECT || 'Vizpad Performance Test Results - {date}',
    
    // Customize subject with date
    getSubject: function() {
      const date = new Date().toLocaleDateString();
      return this.subject.replace('{date}', date);
    }
  }
};

// Helper function to get email configuration
function getEmailConfig(provider = 'gmail') {
  const smtpConfig = emailConfig.smtp[provider];
  if (!smtpConfig) {
    throw new Error(`Email provider '${provider}' not configured. Available providers: ${Object.keys(emailConfig.smtp).join(', ')}`);
  }
  
  return {
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    user: smtpConfig.auth.user,
    pass: smtpConfig.auth.pass,
    from: emailConfig.email.from,
    to: emailConfig.email.to,
    cc: emailConfig.email.cc,
    bcc: emailConfig.email.bcc,
    subject: emailConfig.email.getSubject()
  };
}

// Helper function to validate email configuration
function validateEmailConfig(config) {
  const required = ['host', 'port', 'user', 'pass', 'from', 'to'];
  const missing = required.filter(field => !config[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`);
  }
  
  return true;
}

module.exports = {
  emailConfig,
  getEmailConfig,
  validateEmailConfig
}; 