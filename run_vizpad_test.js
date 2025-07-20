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

async function runInteractiveVizpadTest() {
  try {
    console.log('=== Vizpad Performance Test Configuration ===\n');
    
    // 1. Ask for complete vizpad URL
    const vizpadUrl = await askQuestion('Enter the complete vizpad URL: ');
    const url = vizpadUrl.trim() === '' ? 'https://galaxyai.bayer.com/dashboard/270c03b/a5986ed7-28c8-4739-bc84-8ef2dfead134?utm_source=546bf610-3e40-4ebb-b57e-78a7f5a076fc' : vizpadUrl.trim();
    
    // 2. Ask for number of users
    const numUsers = await askQuestion('How many users do you want to test? (default: 1): ');
    const users = numUsers.trim() === '' ? '1' : numUsers.trim();
    
    // 3. Ask for tab index
    const tabIndex = await askQuestion('Enter the tab index (default: 0): ');
    const tab = tabIndex.trim() === '' ? '0' : tabIndex.trim();
    
    console.log(`\nRunning vizpad test with:`);
    console.log(`- Vizpad URL: ${url}`);
    console.log(`- Users: ${users}`);
    console.log(`- Tab Index: ${tab}\n`);
    
    // Close readline interface
    rl.close();
    
    // Run the vizpad test script with the provided parameters
    const testProcess = spawn('node', ['vizpadTest.js', url, users, tab], {
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      console.log(`\nVizpad test completed with exit code: ${code}`);
      process.exit(code);
    });
    
    testProcess.on('error', (error) => {
      console.error('Error running vizpad test:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Error in interactive vizpad test:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the interactive vizpad test
runInteractiveVizpadTest(); 