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
    // 2. Get number of users from command line argument or default to 1
    // Usage: npm run run_vizpad_test --users=5
    const usersArg = process.argv.find(arg => arg.startsWith('--users='));
    const users = usersArg ? usersArg.split('=')[1] : '1';
    const tabArg = process.argv.find(arg => arg.startsWith('--tabCount='));
    const tabCount = tabArg ? tabArg.split('=')[1] : '3';
    const usernameArg = process.argv.find(arg => arg.startsWith('username='));
    const username = usernameArg ? usernameArg.split('=')[1] : '';
    const passwordArg = process.argv.find(arg => arg.startsWith('password='));
    const password = passwordArg ? passwordArg.split('=')[1] : '';
    const loginUrlArg = process.argv.find(arg => arg.startsWith('loginUrl='));
    const loginUrl = loginUrlArg ? loginUrlArg.split('=')[1] : '';
    const vizpadUrlArg = process.argv.find(arg => arg.startsWith('vizpadUrl='));
    const vizpadUrl = vizpadUrlArg ? vizpadUrlArg.split('=')[1] : '';
    
    // 3. Ask for tab index
    // const isTabSwitch = await askQuestion('Enter the tab switch (default: false): ');
    const tabSwitch = 'true';
    
    // 4. Ask for email configuration
    // const enableEmail = await askQuestion('Send results via email? (y/n, default: n): ');
    const enableEmail = 'n';
    const emailEnabled = enableEmail.trim().toLowerCase() === 'y' || enableEmail.trim().toLowerCase() === 'yes';
    
    console.log(`\nRunning vizpad test with:`);
    console.log(`- Users: ${users}`);
    console.log(`- Tab Count: ${tabCount}`);
    console.log(`- Username: ${username}`);
    console.log(`- Password: ${password}`);
    console.log(`- Login URL: ${loginUrl}`);
    console.log(`- Vizpad URL: ${vizpadUrl}`);
    console.log(`- Tab Switch: ${tabSwitch}`);
    console.log(`- Email enabled: ${emailEnabled ? 'Yes' : 'No'}\n`);
    
    // Close readline interface
    rl.close();
    
    // Run the vizpad test script with the provided parameters
    const testProcess = spawn('node', ['vizpadTest.js', users, tabCount, username, password, loginUrl, vizpadUrl, tabSwitch, emailEnabled.toString()], {
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