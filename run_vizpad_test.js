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
    // const vizUrl = await askQuestion('Enter the complete vizpad URL: ');
    const url = 'https://galaxyai.bayer.com/dashboard/72ed4cae-f8c3-4d20-a8d3-897355f56d36/875c7d53-6502-4b78-a1e7-588104950912?utm_source=c2cd4d7b-be2e-4938-812d-f8e0fb4c1bbd';
    
    // 2. Ask for number of users
    const numUsers = await askQuestion('How many users do you want to test? (default: 1): ');
    const users = numUsers.trim();
    
    // 3. Ask for tab index
    // const isTabSwitch = await askQuestion('Enter the tab switch (default: false): ');
    const tabSwitch = 'true';
    
    // 4. Ask for email configuration
    // const enableEmail = await askQuestion('Send results via email? (y/n, default: n): ');
    const enableEmail = 'y';
    const emailEnabled = enableEmail.trim().toLowerCase() === 'y' || enableEmail.trim().toLowerCase() === 'yes';
    
    console.log(`\nRunning vizpad test with:`);
    console.log(`- Vizpad URL: ${url}`);
    console.log(`- Users: ${users}`);
    console.log(`- Tab Index: ${tabSwitch}`);
    console.log(`- Email enabled: ${emailEnabled ? 'Yes' : 'No'}\n`);
    
    // Close readline interface
    rl.close();
    
    // Run the vizpad test script with the provided parameters
    const testProcess = spawn('node', ['vizpadTest.js', url, users, tabSwitch, emailEnabled.toString()], {
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