document.getElementById("startAssessment").addEventListener("click", function() {
  alert("Assessment Started! (Placeholder)");
});

document.getElementById("startFocusTest").addEventListener("click", function() {
  startFocusTest();
});

document.getElementById("startMemoryTest").addEventListener("click", function() {
  startMemoryTest();
});

document.getElementById("saveSettings").addEventListener("click", () => {
  const reminderThreshold = parseInt(document.getElementById("reminderThreshold").value);
  chrome.storage.local.set({ reminderThreshold: reminderThreshold }, () => {
    alert("Settings saved!");

    // Restart the timer with the new threshold if tracking
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { message: "updateThreshold" });
    });
  });
});
document.getElementById("saveGoal").addEventListener("click", () => {
  const selectedGoal = document.getElementById("sessionGoal").value;
  chrome.storage.local.set({ sessionGoal: selectedGoal }, () => {
    alert("Session goal saved!");

    // Inform the active tab about the updated session goal
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        chrome.tabs.sendMessage(tabId, { message: "updateSessionGoal", sessionGoal: selectedGoal });
      }
    });
  });
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "startFocusTest") {
    console.log("Focus test triggered from content reminder.");
    startFocusTest();
  }
});
document.getElementById("saveBlockedSites").addEventListener("click", () => {
  const blockedSites = document.getElementById("blockedSites").value.split(",").map(site => site.trim());
  chrome.storage.local.set({ customBlockedSites: blockedSites }, () => {
    alert("Blocked sites saved!");
    console.log("Custom blocked sites: ", blockedSites);
  });
});

// Update the watchlist in the background script when the user saves new blocked sites
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "updateBlockedSites") {
    chrome.storage.local.get({ customBlockedSites: [] }, (data) => {
      chrome.runtime.sendMessage({ message: "updateWatchlist", watchlist: data.customBlockedSites });
    });
  }
});
async function startFocusTest() {
  let sequence = generateSequence(3);
  alert(`Remember this sequence: ${sequence.join(", ")}`);

  setTimeout(() => {
    let userResponse = prompt("Enter the sequence (numbers separated by commas):");

    // Validate user input
    if (userResponse !== null && userResponse.trim() !== "") {
      let formattedUserResponse = userResponse.replace(/\s+/g, "").split(",").map(Number);
      let formattedSequence = sequence.map(Number);

      const correct = arraysEqual(formattedUserResponse, formattedSequence);
      if (correct) {
        alert("Correct! Great focus!");
      } else {
        alert("Oops! Keep practicing your focus.");
      }

      // Post the result directly to the backend server
      postTestResultToServer({
        type: 'focus',
        timestamp: new Date().toISOString(),
        result: { sequence, userResponse, correct }
      });
    } else {
      alert("No input provided. Please try again.");
    }
  }, 3000);
}
async function startMemoryTest() {
  let words = ["apple", "car", "house", "tree", "phone"];
  let selectedWords = shuffle(words).slice(0, 3); // Select 3 random words
  alert(`Remember these words: ${selectedWords.join(", ")}`);

  setTimeout(() => {
    let userResponse = prompt("Enter the words you remember (separated by commas):");

    // Validate user input
    if (userResponse !== null && userResponse.trim() !== "") {
      let formattedUserResponse = userResponse.replace(/\s+/g, "").split(",");
      let correct = arraysEqualIgnoreCase(formattedUserResponse, selectedWords);

      if (correct) {
        alert("Correct! Your memory is sharp!");
      } else {
        alert("Oops! Keep practicing your memory.");
      }

      // Post the result directly to the backend server
      postTestResultToServer({
        type: 'memory',
        timestamp: new Date().toISOString(),
        result: { words: selectedWords, userResponse, correct }
      });
    } else {
      alert("No input provided. Please try again.");
    }
  }, 5000);
}

function generateSequence(length) {
  let sequence = [];
  for (let i = 0; i < length; i++) {
    sequence.push(Math.floor(Math.random() * 10));
  }
  return sequence;
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

function arraysEqualIgnoreCase(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i].toLowerCase() !== arr2[i].toLowerCase()) return false;
  }
  return true;
}

function initDB() {
  return new Promise((resolve, reject) => {
    let request = indexedDB.open("cognizantDB", 1);

    request.onerror = function(event) {
      console.error("Database error:", event.target.errorCode);
      reject("Database failed to open");
    };

    request.onsuccess = function(event) {
      console.log("Database opened successfully");
      resolve(event.target.result);
    };

    request.onupgradeneeded = function(event) {
      let db = event.target.result;
      if (!db.objectStoreNames.contains("testResults")) {
        let objectStore = db.createObjectStore("testResults", { keyPath: "id", autoIncrement: true });
        objectStore.createIndex("type", "type", { unique: false });
        objectStore.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains("usageLogs")) {
        let usageStore = db.createObjectStore("usageLogs", { keyPath: "id", autoIncrement: true });
        usageStore.createIndex("domain", "domain", { unique: false });
        usageStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

// Save Test Result to IndexedDB
async function saveTestResult(type, result) {
  let db = await initDB();
  let transaction = db.transaction(["testResults"], "readwrite");
  let objectStore = transaction.objectStore("testResults");
  
  let data = {
    type: type,
    timestamp: new Date().toISOString(),
    result: result
  };

  let request = objectStore.add(data);
  
  request.onsuccess = async function(event) {
    console.log("Test result saved successfully.");

    // Post result to server
    await postTestResultToServer(data);
  };

  request.onerror = function(event) {
    console.error("Failed to save test result:", event.target.errorCode);
  };
}
async function postTestResultToServer(result) {
  try {
    let response = await fetch("http://127.0.0.1:8000/test-results/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    });
    let responseData = await response.json();
    console.log("Test result posted to server:", responseData);
  } catch (error) {
    console.error("Failed to post test result to server:", error);
  }
}