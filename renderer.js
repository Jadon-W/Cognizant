let focusChartInstance; // Define globally to manage the instance
let memoryChartInstance;

const parseDate = (dateString) => {
  // Convert the date string to ISO format for reliable parsing
  return new Date(dateString).toISOString();
};

document.addEventListener('DOMContentLoaded', async () => {
  const focusSummary = document.getElementById('focus-summary');
  const memorySummary = document.getElementById('memory-summary');

  try {
    // Fetch test results from the backend server initially
    await updateDashboard();

    // Establish WebSocket connection to receive real-time updates
    const socket = new WebSocket('ws://127.0.0.1:8000/ws');
    
    socket.onmessage = function (event) {
      console.log('New data received via WebSocket:', event.data);
      // Re-fetch data to update the dashboard after receiving a new test result or usage log
      updateDashboard();
    };

  } catch (error) {
    console.error('Failed to fetch test results or establish WebSocket:', error);
    focusSummary.innerHTML = `<p>Error loading focus data.</p>`;
    memorySummary.innerHTML = `<p>Error loading memory data.</p>`;
  }
});

// Function to update the dashboard with current data
async function updateDashboard() {
  const focusSummary = document.getElementById('focus-summary');
  const memorySummary = document.getElementById('memory-summary');

  try {
    const response = await fetch('http://127.0.0.1:8000/test-results/');
    const testResults = await response.json();

    // Process the data to calculate averages and insights
    let focusScores = [];
    let memoryScores = [];
    let focusDataPoints = [];
    let memoryDataPoints = [];

    testResults.forEach(result => {
      if (result.type === 'focus') {
        // Convert the timestamp
        result.timestamp = parseDate(result.timestamp);
        focusDataPoints.push({
          x: result.timestamp,
          y: result.result.correct ? 100 : 0
        });
      } else if (result.type === 'memory') {
        // Convert the timestamp
        result.timestamp = parseDate(result.timestamp);
        memoryDataPoints.push({
          x: result.timestamp,
          y: result.result.correct ? 100 : 0
        });
      }
    });

    // Calculate average scores
    const averageFocusScore = focusDataPoints.length > 0
      ? Math.round(focusDataPoints.reduce((a, b) => a + b.y, 0) / focusDataPoints.length)
      : 0;
    const averageMemoryScore = memoryDataPoints.length > 0
      ? Math.round(memoryDataPoints.reduce((a, b) => a + b.y, 0) / memoryDataPoints.length)
      : 0;

    // Display data on the dashboard
    focusSummary.innerHTML = `
      <h2>Focus Performance</h2>
      <p>Average Focus Score: ${averageFocusScore}</p>
      <p>Peak Focus Times: Morning (9am - 11am)</p>
      <p>Improvement Areas: Afternoon focus dips (2pm - 4pm)</p>
    `;

    memorySummary.innerHTML = `
      <h2>Memory Performance</h2>
      <p>Average Memory Score: ${averageMemoryScore}</p>
      <p>Best Category: Short-term Memory</p>
      <p>Needs Improvement: Long-term recall of detailed sequences</p>
    `;

    // Update focus and memory charts
    updateCharts(focusDataPoints, memoryDataPoints);

  } catch (error) {
    console.error('Failed to fetch test results:', error);
    focusSummary.innerHTML = `<p>Error loading focus data.</p>`;
    memorySummary.innerHTML = `<p>Error loading memory data.</p>`;
  }
}

// Function to update the charts using Chart.js
function updateCharts(focusDataPoints, memoryDataPoints) {
  // Destroy existing charts before creating new ones to avoid 'canvas in use' errors
  if (focusChartInstance) {
    focusChartInstance.destroy();
  }
  if (memoryChartInstance) {
    memoryChartInstance.destroy();
  }

  // Create the Focus Chart
  focusChartInstance = new Chart(document.getElementById("focusChart"), {
    type: "line",
    data: {
      datasets: [{
        label: "Focus Performance",
        data: focusDataPoints,
        borderColor: "blue",
        fill: false
      }]
    },
    options: {
      scales: {
        x: {
          type: "time",
          time: {
            unit: "minute" // Change this to 'hour', 'day', etc. to adjust granularity
          }
        },
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });

  // Create the Memory Chart
  memoryChartInstance = new Chart(document.getElementById("memoryChart"), {
    type: "line",
    data: {
      datasets: [{
        label: "Memory Performance",
        data: memoryDataPoints,
        borderColor: "green",
        fill: false
      }]
    },
    options: {
      scales: {
        x: {
          type: "time",
          time: {
            unit: "minute" // Change this to 'hour', 'day', etc. to adjust granularity
          }
        },
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}