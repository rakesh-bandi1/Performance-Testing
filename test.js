console.log("puppeteer running");
const ObjectsToCsv = require('objects-to-csv');
const puppeteer = require("puppeteer");
let baseURL = "https://qa2.dev.tellius.com";
let loginDetails = {
  userName: "autotest",
  pwd: "auto_TEST4321!",
  query: "Show me Address_state and customerID",
};
let inputNumbers = + (process.argv[2] || 1)
let shouldCheckDashboard = process.argv[3] == "true"
const CSVArrays = []
const header = ["User ID","loginRenderTime","homePageRender","searchResoponseTime"]
const globalValues = []
if(shouldCheckDashboard){
  header.push("chart1Response")
  header.push("chart2Response")
}
console.log("Script running");
async function runScript() {
  let startTime = new Date()
  let promises = await Array(inputNumbers)
    .fill(loginDetails)
    .map(async (user, index) => {
      let errorMap = {
        id: index,
      };
      let values = [index]
      console.log("launching browser");
      const browser = await puppeteer.launch({
            headless: false,
        });
      console.log("Opening page");
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      await page.goto(baseURL + "/login", {
        waitUntil: "networkidle2",
        timeout: 100000,
      });
      console.log("Page rendered");
      await page.waitForFunction(
        () => !!document.querySelector("span")?.textContent.includes("Welcome to"),
        { timeout: 100000 }
      );
      console.log("Welcome to rendered");
      await page.waitForSelector("[data-cy-id='cy-stndrd-lgn']", { timeout: 100000 });
      let loginRenderTime = timeDifference(new Date() , startTime, "loginRenderTime")
      console.log( "Login screen rendered within :" + loginRenderTime);
      errorMap.loginRenderTime = loginRenderTime
      values.push(loginRenderTime)
      await page.click("[data-cy-id='cy-stndrd-lgn']")
      await page.type("[data-cy-id='cy-usrnm']", user.userName);
      await page.type("[data-cy-id='cy-pswrd']", user.pwd);
      let loginButtonClickTime = new Date()
      await page.click("[data-cy-id='cy-lgn-btn']", {
        waitUntil: "networkidle2",
        timeout: 100000,
      });
      try {
        await page.waitForSelector("[data-cy-id='cy-srch']", { timeout: 100000 });
        let loginTime = timeDifference(new Date() , loginButtonClickTime, "loginTime")
        console.log( "Home page rendered :" + loginTime);
        errorMap.homePage = loginTime
        values.push(loginTime)
      } catch (err) {
        console.error("Failed to load page - " + index + "  ", err);
        values.push(0)
      }
      await page.goto(baseURL + "/search", {
        waitUntil: "networkidle2",
        timeout: 1000000,
      });
      await page.waitForSelector("[data-cy-id='cy-srch-qry']", { timeout: 100000 });
      await new Promise(resolve => setTimeout(resolve, 4000));
      await page.focus("[data-cy-id='cy-srch-qry']");
      console.log("Submitting query for user - " + index);
      await page.keyboard.type(user.query);
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.focus("[data-cy-id='cy-srch-qry']");
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 10000));
      let searchSubmissionTIme = new Date()
      try {
        await page.waitForSelector(".vizContainer", { timeout: 100000 });
        console.log("Search result rendered");
        let searchResoponseTime = timeDifference(new Date() , searchSubmissionTIme, "searchResoponseTime")
        console.log( "Search result rendered :" + searchResoponseTime);
        errorMap.searchResoponseTime = searchResoponseTime
        values.push(searchResoponseTime)
      } catch (err) {
        errorMap.searchResoponseTime = "fail";
        values.push(0)
        console.error("Failed to render search for user - " + index);
      }
      if(shouldCheckDashboard){
        await page.goto(baseURL + "/dashboard", {
          waitUntil: "networkidle2",
          timeout: 1000000,
        });
        await page.waitForSelector("[data-testid^='vizpad-card-']", { timeout: 100000 });
        console.log("dashboard list loaded");
        let elements = await page.$$("[data-testid^='vizpad-card-']");
        let dashBoardFireTime = new Date()
        elements[4].click();
        try {
          await page.waitForSelector("[data-cy-id='cy-vzpd-chart0']", { timeout: 100000 });
          console.log("rendered kpi-" + index + " " + new Date());
          let chart1Response = timeDifference(new Date() , dashBoardFireTime, "chart1Response")
          errorMap.chart1Response = chart1Response
          values.push(chart1Response)
        } catch (err) {
          values.push(0)
          errorMap.chart1Response = "fail";
          console.error("failed to render KPI");
        }
        try {
          await page.waitForSelector(".highcharts-container", {
            timeout: 100000,
          });
          console.log("rendered chart -" + index + " " + new Date());
          let chart2Response = timeDifference(new Date() , dashBoardFireTime, "chart2Response")
          errorMap.chart2Response = chart2Response
          values.push(chart2Response)
        } catch (err) {
          values.push(0)
          errorMap.chart2Response = "fail";
          console.error("failed to render chart");
        }
      }
      console.log(
        "User numner - " + index + " completed with " + JSON.stringify(errorMap)
      );
      globalValues.push(values)
      return errorMap;
    });
  const errorList = await Promise.all(promises);
  let scriptRunTime = timeDifference(new Date(), startTime, "scriptRunTime")
  errorList.unshift({
    scriptTime : scriptRunTime,
    usersRan : inputNumbers
  })
  CSVArrays.push([
    "Script Time", "Number of users",".","."
  ])
  CSVArrays.push([
    scriptRunTime, inputNumbers, ".", "."
  ])
  CSVArrays.push([])
  CSVArrays.push(header)
  console.log("Script completed", errorList);
  console.log("Script completed", CSVArrays.concat(globalValues));
  const csv = new ObjectsToCsv(CSVArrays.concat(globalValues));
  await csv.toDisk('./'+inputNumbers+'USERS.csv');
  process.exit(1);
}
function timeDifference(max, min,action){
  console.log("finding difference between " + min +" and  " + max + "for " + action)
  diff = (max - min) / 1000;
  return diff
}
runScript();