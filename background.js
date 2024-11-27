let timer = {};
let watchlist = ["facebook.com", "instagram.com", "youtube.com"]; // Websites to monitor
let contentScriptReady = {};
let currentSessionGoal = "focus"; // Default goal if not set by user

chrome.storage.local.get({ reminderThreshold: 60, sessionGoal: "focus" }, (data) => {
  timer.threshold = data.reminderThreshold; // Set default threshold
  currentSessionGoal = data.sessionGoal;    // Set current goal
});

chrome.tabs.onActivated.addListener(activeInfo => {
  clearInterval(timer.interval);
  startTimerForTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    clearInterval(timer.interval);
    startTimerForTab(tabId);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Update watchlist with custom blocked sites
  if (request.message === "updateWatchlist") {
    watchlist = request.watchlist;
    console.log("Updated watchlist: ", watchlist);
  }
});

async function postUsageLogToServer(log) {
  try {
    let response = await fetch("http://127.0.0.1:8000/usage-logs/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(log)
    });
    let responseData = await response.json();
    console.log("Usage log posted to server:", responseData);
  } catch (error) {
    console.error("Failed to post usage log to server:", error);
  }
}

function startTimerForTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (tab && tab.url) {
      const domain = extractDomain(tab.url);
      if (watchlist.some(site => domain.includes(site))) {
        timer.startTime = new Date();
        timer.tabId = tabId;
        timer.interval = setInterval(() => {
          let timeSpent = Math.round((new Date() - timer.startTime) / 1000); // in seconds
          console.log(`Time spent on ${domain}: ${timeSpent} seconds`);

          if (timeSpent >= timer.threshold) {
            if (contentScriptReady[tabId]) {
              let reminderMessage = getReminderMessage(domain);
              chrome.tabs.sendMessage(tabId, { message: "gentleReminder", reminderMessage }, async (response) => {
                if (chrome.runtime.lastError) {
                  console.error("Content script not ready, retrying...");
                } else {
                  clearInterval(timer.interval); // Stop tracking after sending reminder

                  // Save usage log and post to server
                  let usageLog = {
                    domain: domain,
                    timestamp: new Date().toISOString(),
                    duration: timeSpent
                  };
                  await postUsageLogToServer(usageLog);
                }
              });
            } else {
              console.error("Content script not ready for tab: ", tabId);
            }
          }
        }, 1000);
      }
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "contentScriptReady") {
    console.log("Content script is ready for tab: ", sender.tab.id);
    contentScriptReady[sender.tab.id] = true;
  }

  if (request.message === "restartTimer") {
    console.log("Restarting timer after user chose to continue.");
    clearInterval(timer.interval);
    timer.startTime = new Date();
    timer.interval = setInterval(() => {
      let timeSpent = Math.round((new Date() - timer.startTime) / 1000); // in seconds
      console.log(`Time spent after restart: ${timeSpent} seconds`);
      if (timeSpent >= timer.threshold) {
        if (contentScriptReady[timer.tabId]) {
          let reminderMessage = getReminderMessage(extractDomain(sender.tab.url));
          chrome.tabs.sendMessage(timer.tabId, { message: "gentleReminder", reminderMessage });
          clearInterval(timer.interval); // Stop tracking after sending reminder again
        } else {
          console.error("Content script not ready for tab: ", timer.tabId);
        }
      }
    }, 1000);
  }

  if (request.message === "updateThreshold") {
    chrome.storage.local.get({ reminderThreshold: 60 }, (data) => {
      timer.threshold = data.reminderThreshold;
      console.log(`Updated threshold: ${timer.threshold} seconds`);
      if (timer.interval) {
        clearInterval(timer.interval);
      }
      startTimerForTab(sender.tab.id); // Restart the timer with the new threshold
    });
  }

  if (request.message === "updateSessionGoal") {
    currentSessionGoal = request.sessionGoal;
    console.log(`Updated session goal: ${currentSessionGoal}`);
  }
});

// Get reminder message based on the user's session goal
function getReminderMessage(domain) {
  switch (currentSessionGoal) {
    case "study":
      return `It seems you're spending time on ${domain}. Would you like to get back to studying? Let's refocus!`;
    case "focus":
      return `You've been on ${domain} for a while. Would you like to continue or take a short focus test?`;
    case "relax":
      return `You’re in relax mode, feel free to take it easy. Would you still like a reminder to refocus?`;
    default:
      return `Time spent on ${domain} is getting high. Would you like to refocus now?`;
  }
}

function extractDomain(url) {
  let domain;
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch (e) {
    console.error("Invalid URL:", e);
    domain = "";
  }
  return domain;
}
