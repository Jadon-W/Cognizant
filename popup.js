document.addEventListener("DOMContentLoaded", () => {
  // Adding Event Listeners after DOM Content has been fully loaded

  document.getElementById("startFocusTest").addEventListener("click", function () {
    const level = document.getElementById("focus-level").value;
    startFocusTest(level);
  });

  document.getElementById("startMemoryTest").addEventListener("click", function () {
    const level = document.getElementById("memory-level").value;
    startMemoryTest(level);
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
});

// Define your test functions and utilities here, outside the DOMContentLoaded listener

function startFocusTest(level) {
  let sequenceLength = level === "Beginner" ? 3 : level === "Intermediate" ? 5 : 7;
  let memorizationTime = level === "Beginner" ? 10 : level === "Intermediate" ? 15 : 20;

  let sequence = generateSequence(sequenceLength);
  displayMessage(`Memorize this sequence: ${sequence.join(", ")}`);
  
  // Start memorization countdown
  startCountdown(memorizationTime, () => {
    hideMessage(); // Hide the memorization sequence immediately

    // Start the input phase directly without delay
    let inputTime = level === "Beginner" ? 15 : level === "Intermediate" ? 20 : 25;
    displayInputModal(sequence, inputTime, level, "focus");
  });
}

function startMemoryTest(level) {
  let words = ["apple", "car", "house", "tree", "phone", "computer", "ocean", "bicycle", "cloud", "flower"];
  let wordCount = level === "Beginner" ? 3 : level === "Intermediate" ? 5 : 7;
  let memorizationTime = level === "Beginner" ? 10 : level === "Intermediate" ? 15 : 20;

  let selectedWords = shuffle(words).slice(0, wordCount);
  displayMessage(`Memorize these words: ${selectedWords.join(", ")}`);
  
  // Start memorization countdown
  startCountdown(memorizationTime, () => {
    hideMessage(); // Hide the memorization words immediately

    // Start the input phase directly without delay
    let inputTime = level === "Beginner" ? 15 : level === "Intermediate" ? 20 : 25;
    displayInputModal(selectedWords, inputTime, level, "memory");
  });
}
function displayInputModal(correctSequence, inputTime, level, testType) {
  const modal = document.createElement("div");
  modal.id = "inputModal";
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-content">
      <h2>Input Phase</h2>
      <p>Enter your answer below:</p>
      <input type="text" id="userInput" placeholder="e.g., 1,2,3">
      <button id="submitInput">Submit</button>
      <div id="inputTimer">Time left: ${inputTime}s</div>
    </div>
  `;

  document.body.appendChild(modal);
  let remainingTime = inputTime;

  // Timer for input phase
  const intervalId = setInterval(() => {
    const timerElement = document.getElementById("inputTimer");
    timerElement.textContent = `Time left: ${remainingTime}s`;

    if (remainingTime <= 0) {
      clearInterval(intervalId);
      handleInputSubmission(null, correctSequence, testType, remainingTime);
      closeModal();
    } else {
      remainingTime--;
    }
  }, 1000);

  // Handle input submission
  document.getElementById("submitInput").addEventListener("click", () => {
    const userResponse = document.getElementById("userInput").value;
    handleInputSubmission(userResponse, correctSequence, testType, remainingTime);
    clearInterval(intervalId); // Stop the timer after submission
    closeModal();
  });
}

function handleInputSubmission(userResponse, correctSequence, testType, remainingTime) {
  if (userResponse !== null && userResponse.trim() !== "") {
    let formattedUserResponse = userResponse.replace(/\s+/g, "").split(",");
    let correctCount = formattedUserResponse.filter((item, index) => correctSequence[index] == item).length;
    let score = Math.round((correctCount / correctSequence.length) * 100);

    // Add a time-based bonus only if all answers are correct
    let bonus = (correctCount === correctSequence.length) ? Math.max(0, 50 - remainingTime) : 0;
    let totalScore = score + bonus;

    alert(`You got ${correctCount} out of ${correctSequence.length} correct. Score: ${score}. Bonus: ${bonus}. Total: ${totalScore}`);

    // Save the result in the database
    saveTestResult(testType, { correctSequence, userResponse, correctCount, score, bonus, totalScore });
  } else {
    alert("No input provided. Please try again.");
  }
}

function startCountdown(duration, onComplete) {
  let remainingTime = duration;
  const timerElement = document.createElement("div");
  timerElement.id = "timer";
  timerElement.style = `
    font-size: 24px;
    font-weight: bold;
    margin-top: 10px;
    text-align: center;
    color: #ff4f91;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  `;
  document.body.appendChild(timerElement);

  // Update the visual countdown
  const intervalId = setInterval(() => {
    timerElement.textContent = `Time left: ${remainingTime}s`;

    if (remainingTime <= 0) {
      clearInterval(intervalId);
      timerElement.remove(); // Remove the timer when complete
      if (onComplete) onComplete();
    } else {
      remainingTime--;
    }
  }, 1000);
}
function displayMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.id = "memorizationMessage";
  messageElement.style = `
    font-size: 24px;
    font-weight: bold;
    margin-top: 20px;
    padding: 10px;
    background-color: #f0f0f0;
    border-radius: 5px;
    text-align: center;
  `;
  messageElement.textContent = message;
  document.body.appendChild(messageElement);
}

function hideMessage() {
  const messageElement = document.getElementById("memorizationMessage");
  if (messageElement) {
    document.body.removeChild(messageElement);
  }
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
