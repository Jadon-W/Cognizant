const fetch = require("node-fetch");

async function fetchTestResults() {
  try {
    let response = await fetch("http://127.0.0.1:8000/test-results/");
    let data = await response.json();
    console.log("Fetched test results:", data);
  } catch (error) {
    console.error("Failed to fetch test results:", error);
  }
}

async function fetchUsageLogs() {
  try {
    let response = await fetch("http://127.0.0.1:8000/usage-logs/");
    let data = await response.json();
    console.log("Fetched usage logs:", data);
  } catch (error) {
    console.error("Failed to fetch usage logs:", error);
  }
}

module.exports = {
  fetchTestResults,
  fetchUsageLogs
};