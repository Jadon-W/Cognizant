chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "gentleReminder") {
    displayGentleReminder();
    sendResponse({ status: "reminderDisplayed" });
  }
});

// Notify the background script that the content script is ready
chrome.runtime.sendMessage({ message: "contentScriptReady" });

function displayGentleReminder() {
  // Remove existing reminder if present
  if (document.getElementById("cognizant-reminder")) {
    document.getElementById("cognizant-reminder").remove();
  }

  // Create new reminder div
  const reminderDiv = document.createElement("div");
  reminderDiv.id = "cognizant-reminder";
  reminderDiv.style.position = "fixed";
  reminderDiv.style.top = "30%"; // Move closer to the center
  reminderDiv.style.left = "50%";
  reminderDiv.style.transform = "translate(-50%, -30%)"; // Center horizontally and adjust vertically
  reminderDiv.style.width = "350px";
  reminderDiv.style.backgroundColor = "rgba(255, 0, 0, 0.85)";
  reminderDiv.style.color = "white";
  reminderDiv.style.padding = "20px";
  reminderDiv.style.borderRadius = "15px";
  reminderDiv.style.boxShadow = "0 0 15px rgba(0, 0, 0, 0.5)";
  reminderDiv.style.zIndex = "9999";
  reminderDiv.style.textAlign = "center";
  reminderDiv.style.fontFamily = "Arial, sans-serif";
  reminderDiv.style.fontSize = "16px";
  reminderDiv.style.animation = "fadeIn 1s ease-in-out";

  reminderDiv.innerHTML = `
    <p><strong>Hey, you've been on this site for a while!</strong></p>
    <button id="cognizant-continue" style="margin: 10px; padding: 10px;">Continue</button>
    <button id="cognizant-focus" style="margin: 10px; padding: 10px;">Take a Focus Test</button>
  `;

  document.body.appendChild(reminderDiv);

  // Add event listeners for buttons
  document.getElementById("cognizant-continue").addEventListener("click", () => {
    reminderDiv.remove();
    chrome.runtime.sendMessage({ message: "restartTimer" });
  
    // Positive reinforcement after navigating away from a distracting site
    setTimeout(() => {
      alert("Great job staying focused! Want to keep the momentum going with a quick focus exercise?");
    }, 2000);
  });

  document.getElementById("cognizant-focus").addEventListener("click", () => {
    reminderDiv.remove();
    chrome.runtime.sendMessage({ message: "startFocusTest" });
  });
}