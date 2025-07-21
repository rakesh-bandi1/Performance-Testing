# Email Setup Guide for Vizpad Performance Tests

This guide explains how to configure and use the email functionality to automatically send test results after running vizpad performance tests.

## Features

- ✅ **Beautiful HTML Email Reports** with detailed test results
- ✅ **CSV Attachment** with raw test data
- ✅ **Multiple Email Provider Support** (Gmail, Outlook, Office 365, Custom SMTP)
- ✅ **Environment Variable Configuration** for secure credential management
- ✅ **Configurable Recipients** (To, CC, BCC)
- ✅ **Error Handling** - continues test execution even if email fails

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Email Settings

Choose one of the following methods:

#### Method A: Environment Variables (Recommended)

Create a `.env` file in your project root:

```bash
# Gmail Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password

# Email Recipients
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=recipient@company.com
EMAIL_CC=manager@company.com
EMAIL_BCC=archive@company.com

# Optional: Custom Subject
EMAIL_SUBJECT=Vizpad Test Results - {date}
```

#### Method B: Direct Configuration

Edit `emailConfig.js` and update the values:

```javascript
gmail: {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
}
```

### 3. Run Tests with Email

```bash
# Using the interactive runner
npm run vizpad

# Direct execution with email enabled
node vizpadTest.js "https://your-vizpad-url" 5 0 true
```

## Email Provider Setup

### Gmail Setup

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. **Use the App Password** in your configuration (not your regular password)

```bash
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-16-character-app-password
```

### Outlook/Hotmail Setup

```bash
OUTLOOK_USER=your-email@outlook.com
OUTLOOK_PASS=your-password
```

### Office 365 Setup

```bash
OFFICE365_USER=your-email@company.com
OFFICE365_PASS=your-password
```

### Custom SMTP Setup

```bash
SMTP_HOST=smtp.your-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
```

## Email Content

The email includes:

### 📊 Summary Section
- Total users tested
- Success/failure counts
- Success rate percentage
- Total script runtime

### 📈 Performance Metrics
- Average load times for each test phase
- Detailed breakdown of performance data

### 📋 Detailed Results Table
- Individual user results
- All timing metrics
- Success/failure status

### 📎 Attachments
- CSV file with raw test data
- Formatted for easy analysis

### ⚠️ Error Section (if any failures)
- List of failed tests
- Error messages and context

## Command Line Usage

### Interactive Mode
```bash
npm run vizpad
# Answer prompts for URL, users, tab index, and email preference
```

### Direct Mode
```bash
node vizpadTest.js <vizpad-url> <num-users> <tab-index> <enable-email>
```

Examples:
```bash
# Run with 5 users, tab 0, email enabled
node vizpadTest.js "https://your-vizpad-url" 5 0 true

# Run with 10 users, tab 1, email disabled
node vizpadTest.js "https://your-vizpad-url" 10 1 false
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `GMAIL_USER` | Gmail username | - |
| `GMAIL_PASS` | Gmail app password | - |
| `OUTLOOK_USER` | Outlook username | - |
| `OUTLOOK_PASS` | Outlook password | - |
| `OFFICE365_USER` | Office 365 username | - |
| `OFFICE365_PASS` | Office 365 password | - |
| `SMTP_HOST` | Custom SMTP host | - |
| `SMTP_PORT` | Custom SMTP port | 587 |
| `SMTP_SECURE` | Use SSL/TLS | false |
| `SMTP_USER` | Custom SMTP username | - |
| `SMTP_PASS` | Custom SMTP password | - |
| `EMAIL_FROM` | Sender email address | - |
| `EMAIL_TO` | Recipient email address | - |
| `EMAIL_CC` | CC recipients (comma-separated) | - |
| `EMAIL_BCC` | BCC recipients (comma-separated) | - |
| `EMAIL_SUBJECT` | Email subject line | "Vizpad Performance Test Results - {date}" |
| `ENABLE_EMAIL` | Enable email globally | false |

## Troubleshooting

### Common Issues

#### 1. Authentication Failed
```
Error: Invalid login: 535 5.7.8 Username and Password not accepted
```
**Solution**: Use App Password for Gmail, not regular password

#### 2. Connection Timeout
```
Error: Connection timeout
```
**Solution**: Check firewall settings and SMTP port configuration

#### 3. Email Not Sending
```
Error: No recipients defined
```
**Solution**: Ensure `EMAIL_TO` is set in environment variables

#### 4. Gmail "Less secure app" error
**Solution**: Use App Passwords instead of regular passwords

### Debug Mode

To see detailed email configuration, add this to your test script:

```javascript
console.log('Email config:', JSON.stringify(emailConfig, null, 2));
```

### Testing Email Configuration

Create a test script to verify email setup:

```javascript
const EmailService = require('./emailService.js');
const { getEmailConfig } = require('./emailConfig.js');

async function testEmail() {
  try {
    const config = getEmailConfig('gmail');
    const emailService = new EmailService(config);
    await emailService.createTransporter();
    console.log('✅ Email configuration is valid!');
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
  }
}

testEmail();
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data
3. **Use App Passwords** for Gmail (not regular passwords)
4. **Limit email recipients** to necessary personnel
5. **Regularly rotate passwords** and app passwords

## Customization

### Modify Email Template

Edit the `generateEmailContent` method in `emailService.js` to customize:
- Email styling and layout
- Content sections
- Metrics displayed
- Branding and colors

### Add Custom Metrics

Extend the email content to include additional performance metrics or custom data.

### Multiple Email Providers

Configure multiple email providers and switch between them based on environment or requirements.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your email provider settings
3. Test with a simple email configuration first
4. Check console logs for detailed error messages 