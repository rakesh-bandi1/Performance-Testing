const readline = require('readline');
const { spawn } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function runInteractiveTest() {
  try {
    console.log('=== Performance Test Configuration ===\n');
    
    // 1. Ask for URL first
    const baseURL = await askQuestion('Enter the base URL (default: https://demo.app.tellius.com): ');
    const url = baseURL.trim() === '' ? 'https://demo.app.tellius.com' : baseURL.trim();
    
    // 2. Ask for username
    const username = await askQuestion('Enter username (default: performanceTest): ');
    const user = username.trim() === '' ? 'performanceTest' : username.trim();
    
    // 3. Ask for password
    const password = await askQuestion('Enter password: ');
    const pwd = password.trim() === '' ? 'auto_TEST4321!' : password.trim();
    
    // 4. Ask for number of users
    const numUsers = await askQuestion('How many users do you want to test? (default: 1): ');
    const users = numUsers.trim() === '' ? '1' : numUsers.trim();
    
    // 5. Ask for dashboard testing
    const dashboardResponse = await askQuestion('Do you want to test dashboard? (y/n, default: n): ');
    const dashboard = dashboardResponse.toLowerCase().trim() === 'y' || dashboardResponse.toLowerCase().trim() === 'yes' ? 'true' : 'false';
    
    console.log(`\nRunning test with:`);
    console.log(`- Base URL: ${url}`);
    console.log(`- Username: ${user}`);
    console.log(`- Users: ${users}`);
    console.log(`- Dashboard testing: ${dashboard === 'true' ? 'enabled' : 'disabled'}\n`);
    
    // Close readline interface
    rl.close();
    
    // Run the test_optimized.js script with the provided parameters
    const testProcess = spawn('node', ['test_optimized.js', users, dashboard, url, user, pwd], {
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      console.log(`\nTest completed with exit code: ${code}`);
      process.exit(code);
    });
    
    testProcess.on('error', (error) => {
      console.error('Error running test:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Error in interactive test:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the interactive test
runInteractiveTest(); 