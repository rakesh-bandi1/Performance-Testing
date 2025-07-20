# Performance Testing Script

This is a performance testing script for Tellius application with interactive configuration, comprehensive reporting, and modern practices.

## 🚀 Key Features

### 1. **Interactive Configuration**
- **Interactive prompts** for URL, username, password, users, and dashboard testing
- **Default values** for quick testing
- **Flexible input** with fallback to defaults

### 2. **Object-Oriented Design**
- **PerformanceMetrics Class**: Centralized metrics collection and error tracking
- **BrowserManager Class**: Encapsulated browser operations with better resource management
- **PerformanceTestRunner Class**: Main orchestrator with clear separation of concerns

### 3. **Enhanced Reporting**
- **Beautiful table display** in terminal using `console.table`
- **Detailed performance metrics** with averages
- **CSV export** for further analysis
- **Success/failure indicators** with emojis

### 4. **Better Error Handling**
- Comprehensive try-catch blocks for each test phase
- Detailed error logging with context
- Graceful failure handling without stopping entire test suite
- Browser cleanup in finally blocks

### 5. **Configuration Management**
- **Command line arguments** support
- **Interactive configuration** via prompts
- Centralized configuration object (`CONFIG`)
- Easy to modify timeouts, selectors, and delays

## 📁 File Structure

```
Tests/
├── test.js                    # Original script
├── test_optimized.js          # Optimized version
├── run_test.js               # Interactive configuration script
├── package.json               # Dependencies and scripts
└── README_optimized.md        # This file
```

## 🛠️ Usage

### Interactive Mode (Recommended)
```bash
npm run test
```

This will prompt you for:
1. **Base URL** (default: https://qa2.dev.tellius.com)
2. **Username** (default: autotest)
3. **Password** (default: *******)
4. **Number of users** (default: 1)
5. **Dashboard testing** (y/n, default: n)

### Direct Command Line Usage
```bash
# Format: node test_optimized.js [users] [dashboard] [baseURL] [username] [password]

# Example with all parameters:
npm run test:direct 2 true https://qa2.dev.tellius.com username pass!

# Example with some defaults:
npm run test:direct 1 false https://qa2.dev.tellius.com myuser mypassword

# Example with minimal parameters (uses defaults for URL, username, password):
npm run test:direct 1 false
```

### Available Scripts
```bash
npm run test          # Interactive mode
npm run test:direct   # Direct command line usage
npm run test:users    # Legacy direct usage
```

## ⚙️ Configuration

### Command Line Arguments Order
1. `process.argv[2]` - Number of users
2. `process.argv[3]` - Dashboard testing (true/false)
3. `process.argv[4]` - Base URL
4. `process.argv[5]` - Username
5. `process.argv[6]` - Password

### Default Configuration
```javascript
const CONFIG = {
  baseURL: process.argv[4] || 'https://qa2.dev.tellius.com',
  loginDetails: {
    userName: process.argv[5] || 'autotest',
    pwd: process.argv[6] || '*******',
    query: 'Show me Address_state and customerID',
  },
  timeouts: {
    navigation: 100000,      // 100 seconds
    element: 100000,         // 100 seconds
    longNavigation: 1000000, // 1000 seconds
  },
  // ... more settings
};
```

## 📊 Output

### Interactive Configuration Example
```
=== Performance Test Configuration ===

Enter the base URL (default: https://qa2.dev.tellius.com): 
Enter username (default: autotest): 
Enter password (default: auto_TEST4321!): 
How many users do you want to test? (default: 1): 
Do you want to test dashboard? (y/n, default: n): 

Running test with:
- Base URL: https://qa2.dev.tellius.com
- Username: autotest
- Users: 2
- Dashboard testing: enabled
```

### Console Output
```
Starting performance test with 2 users
Dashboard testing: enabled
User 0: Starting login process
User 0: Welcome text loaded
User 0: Login screen rendered in 2.5s
User 0: Home page rendered in 1.8s
User 0: Starting search process
User 0: Search results rendered in 3.2s
User 0: Starting dashboard test
User 0: Dashboard list loaded
User 0: KPI chart rendered in 2.1s
User 0: Highcharts rendered in 2.3s

=== PERFORMANCE TEST SUMMARY ===
Total script runtime: 45.2s
Users tested: 2
Successful tests: 2
Failed tests: 0
CSV report saved: 2USERS_optimized.csv

=== DETAILED RESULTS TABLE ===
┌─────────┬──────────┬─────────────────┬──────────────┬─────────────────────┬─────────────┬─────────────┬────────────┐
│ (index) │ User ID  │ Login Render (s) │ Home Page (s) │ Search Response (s) │ Chart 1 (s) │ Chart 2 (s) │   Status   │
├─────────┼──────────┼─────────────────┼──────────────┼─────────────────────┼─────────────┼─────────────┼────────────┤
│    0    │    0     │      2.45       │     1.23     │        3.67         │    2.34     │    4.56     │ ✅ Success │
│    1    │    1     │      2.12       │     1.45     │        3.89         │    2.67     │    4.23     │ ✅ Success │
└─────────┴──────────┴─────────────────┴──────────────┴─────────────────────┴─────────────┴─────────────┴────────────┘

=== AVERAGE PERFORMANCE METRICS ===
┌─────────────────────────┬─────────┐
│         (index)         │ Values  │
├─────────────────────────┼─────────┤
│ Average Login Render (s) │  2.29   │
│   Average Home Page (s)  │  1.34   │
│ Average Search Response  │  3.78   │
│         (s)             │         │
│    Average Chart 1 (s)   │  2.51   │
│    Average Chart 2 (s)   │  4.40   │
└─────────────────────────┴─────────┘
```

### CSV Report
The script generates a CSV file with the following structure:
- Script execution time
- Number of users tested
- Individual user performance metrics
- Error details (if any)

## 🔧 Browser Configuration

### Headless Mode
The script runs in headless mode by default for better performance:
```javascript
headless: true,
```

### Browser Optimizations
Includes browser launch arguments for better performance:
```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
]
```

## 🐛 Error Handling

The script handles errors gracefully:

1. **Individual test failures** don't stop the entire suite
2. **Detailed error logging** with context and user ID
3. **Resource cleanup** even when errors occur
4. **Error summary** in the final report
5. **Dashboard creation check** - warns if no dashboards exist

### Dashboard Testing
The script includes a check for dashboard availability:
```javascript
if (createDashboard.length === 2) {
  console.log('There is no dashboard to test, Please create a dashboard first');
  return;
}
```

## 📈 Performance Metrics

The script tracks:
- **Login render time**: Time to load login page
- **Home page render time**: Time from login submission to home page
- **Search response time**: Time to render search results
- **Chart response times**: Time to render dashboard charts (if enabled)

## 🔄 Migration from Original

To migrate from the original script:

1. **Use interactive mode**: `npm run test`
2. **Or direct usage**: `npm run test:direct [users] [dashboard] [url] [username] [password]`
3. **Enhanced reporting** with table display
4. **Better error handling** and stability

## 🚨 Troubleshooting

### Common Issues

1. **Browser launch failures**: Check if Chrome/Chromium is installed
2. **Timeout errors**: Increase timeout values in CONFIG
3. **Selector not found**: Update selectors in CONFIG.selectors
4. **Memory issues**: Reduce number of concurrent users
5. **No dashboards**: Create at least one dashboard before testing

### Debug Mode

To run in non-headless mode for debugging, change in `test_optimized.js`:
```javascript
headless: true,  // Change to false
```

## 📝 Dependencies

- `puppeteer`: ^24.14.0
- `objects-to-csv`: ^1.3.6

## 🤝 Contributing

To extend the script:

1. **Add new metrics**: Extend the `PerformanceMetrics` class
2. **Add new test phases**: Create new methods in `PerformanceTestRunner`
3. **Modify selectors**: Update the `CONFIG.selectors` object
4. **Add new configurations**: Extend the `CONFIG` object
5. **Add new interactive prompts**: Update the `run_test.js` file

## 📄 License

This script is provided as-is for performance testing purposes. 