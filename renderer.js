let focusChartInstance; // Define globally to manage the instance
let memoryChartInstance;
let reactionChartInstance;

const parseDate = (dateString) => {
  // Convert the date string to ISO format for reliable parsing
  return new Date(dateString).toISOString();
};

// Function to calculate average score from an array of data points
function calculateAverage(dataPoints) {
  if (dataPoints.length === 0) {
    return 0;
  }
  const total = dataPoints.reduce((sum, point) => sum + point.y, 0);
  return Math.round(total / dataPoints.length);
}

document.addEventListener('DOMContentLoaded', async () => {
  const focusSummary = document.getElementById('focus-summary');
  const memorySummary = document.getElementById('memory-summary');
  const reactionSummary = document.getElementById('reaction-summary');

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
    reactionSummary.innerHTML = `<p>Error loading reaction data.</p>`;
  }
});

// Function to update the dashboard with current data
async function updateDashboard() {
  const focusSummary = document.getElementById('focus-summary');
  const memorySummary = document.getElementById('memory-summary');
  const reactionSummary = document.getElementById('reaction-summary');

  try {
    const response = await fetch('http://127.0.0.1:8000/test-results/');
    const testResults = await response.json();

    // Process the data to calculate averages and insights
    let focusDataPoints = [];
    let memoryDataPoints = [];
    let reactionDataPoints = [];

    let totalReactionTimes = [];
    
    testResults.forEach(result => {
      if (result.type === 'focus') {
        result.timestamp = parseDate(result.timestamp);
        focusDataPoints.push({
          x: result.timestamp,
          y: result.result.correct ? 100 : 0
        });
      } else if (result.type === 'memory') {
        result.timestamp = parseDate(result.timestamp);
        memoryDataPoints.push({
          x: result.timestamp,
          y: result.result.correct ? 100 : 0
        });
      } else if (result.type === 'reaction') {
        result.timestamp = parseDate(result.timestamp);
        // Push each reaction time for averaging
        if (result.result.reactionTimes && result.result.reactionTimes.length > 0) {
          totalReactionTimes.push(...result.result.reactionTimes);
          reactionDataPoints.push({
            x: result.timestamp,
            y: result.result.averageReactionTime
          });
        }
      }
    });

    // Calculate average scores
    const averageFocusScore = calculateAverage(focusDataPoints);
    const averageMemoryScore = calculateAverage(memoryDataPoints);
    const averageReactionTime = totalReactionTimes.length > 0
      ? Math.round(totalReactionTimes.reduce((a, b) => a + b, 0) / totalReactionTimes.length)
      : 0;

    // Display data on the dashboard
    focusSummary.innerHTML = `
      <h2>Focus Performance</h2>
      <p>Average Focus Score: ${averageFocusScore}%</p>
      <p>Peak Focus Times: Morning (9am - 11am)</p>
      <p>Improvement Areas: Afternoon focus dips (2pm - 4pm)</p>
    `;

    memorySummary.innerHTML = `
      <h2>Memory Performance</h2>
      <p>Average Memory Score: ${averageMemoryScore}%</p>
      <p>Best Category: Short-term Memory</p>
      <p>Needs Improvement: Long-term recall of detailed sequences</p>
    `;

    reactionSummary.innerHTML = `
      <h2>Reaction Time Performance</h2>
      <p>Average Reaction Time: ${averageReactionTime} ms</p>
      <p>Best Performance: Quickest reactions recorded during evening hours.</p>
      <p>Areas for Improvement: Reaction time variability between rounds.</p>
    `;

    // Update focus, memory, and reaction charts
    updateCharts(focusDataPoints, memoryDataPoints, reactionDataPoints);

  } catch (error) {
    console.error('Failed to fetch test results:', error);
    focusSummary.innerHTML = `<p>Error loading focus data.</p>`;
    memorySummary.innerHTML = `<p>Error loading memory data.</p>`;
    reactionSummary.innerHTML = `<p>Error loading reaction data.</p>`;
  }
}

// Function to update the charts using Chart.js
function updateCharts(focusDataPoints, memoryDataPoints, reactionDataPoints) {
  // Destroy existing charts before creating new ones to avoid 'canvas in use' errors
  if (focusChartInstance) {
    focusChartInstance.destroy();
  }
  if (memoryChartInstance) {
    memoryChartInstance.destroy();
  }
  if (reactionChartInstance) {
    reactionChartInstance.destroy();
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
            unit: "minute"
          }
        },
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });

  // Create the Reaction Chart
  reactionChartInstance = new Chart(document.getElementById("reactionChart"), {
    type: "line",
    data: {
      datasets: [{
        label: "Reaction Time",
        data: reactionDataPoints,
        borderColor: "red",
        fill: false
      }]
    },
    options: {
      scales: {
        x: {
          type: "time",
          time: {
            unit: "minute"
          }
        },
        y: {
          beginAtZero: true
        }
      }
    }
  });
}
