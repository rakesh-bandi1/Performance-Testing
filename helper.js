// Import chart data from JSON file
const chartData = require('./data/chartData.json');

const AreaChartData = chartData.areaData;
const TerritoryChartData = chartData.territoryData;

/**
 * Get random data from JSON based on data type
 * @param {string} dataType - Type of data ('area', 'territory', 'time')
 * @param {number} minCount - Minimum count (optional, uses config default)
 * @param {number} maxCount - Maximum count (optional, uses config default)
 * @returns {string[]|object} Random data based on type
 */
function getRandomData(dataType, minCount = null, maxCount = null) {
  const config = chartData.config;
  
  // Handle time data differently (returns object)
  if (dataType === 'time') {
    const timeData = chartData.timeData;
    
    // Get the date range from JSON
    const dateRange = timeData.dateRanges[0]; // Since there's only one range now
    const minStartDate = new Date(dateRange.startDate);
    const maxEndDate = new Date(dateRange.endDate);
    
    // Calculate the maximum possible start date to ensure 5-month gap
    const fiveMonthsInMs = 5 * 30 * 24 * 60 * 60 * 1000; 
    const maxStartDate = new Date(maxEndDate.getTime() - fiveMonthsInMs);
    
    // Generate random start date between minStartDate and maxStartDate
    const randomStartTime = minStartDate.getTime() + Math.random() * (maxStartDate.getTime() - minStartDate.getTime());
    const randomStartDate = new Date(randomStartTime);
    
    // Generate random end date between (startDate + 5 months) and maxEndDate
    const minEndDate = new Date(randomStartDate.getTime() + fiveMonthsInMs);
    const randomEndTime = minEndDate.getTime() + Math.random() * (maxEndDate.getTime() - minEndDate.getTime());
    const randomEndDate = new Date(randomEndTime);
    
    // Format dates as "MMM DD, YYYY" (e.g., 'Jun 28, 2025')
    const formatDate = (date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate(); // No padding, just the number
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    };
    
    return {
      startDate: formatDate(randomStartDate),
      endDate: formatDate(randomEndDate),
      startDateObj: randomStartDate,
      endDateObj: randomEndDate
    };
  }
  
  // Handle array data (area, territory, etc.)
  let dataArray;
  switch (dataType.toLowerCase()) {
    case 'area':
      dataArray = chartData.areaData;
      break;
    case 'territory':
      dataArray = chartData.territoryData;
      break;
    case 'region':
      dataArray = chartData.regionData;
      break;
    default:
      throw new Error(`Unknown data type: ${dataType}. Supported types: 'area', 'territory', 'time', 'region'`);
  }
  
  // Generate random count between min and max
  const min = minCount || config.minRandomCount;
  const max = maxCount || config.maxRandomCount;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  
  // Create a copy of the array to avoid modifying the original
  const shuffled = [...dataArray];
  
  // Fisher-Yates shuffle algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Return the first 'count' elements
  return shuffled.slice(0, count);
}
function getRandomFilterData() {
  const filterData = chartData.filterData;
  const randomIndex = Math.floor(Math.random() * filterData.length);
  return filterData[randomIndex];
}

module.exports = {
  AreaChartData,
  TerritoryChartData,
  chartData,
  getRandomData,
  getRandomFilterData
};