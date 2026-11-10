const api = browser;
const form = document.querySelector("#timer-form");
const secondsInput = document.querySelector("#seconds");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const status = document.querySelector("#status");
let tabId;
let enabled = false;
let busy = false;

function updateControls() {
  startButton.disabled = busy || tabId === undefined;
  stopButton.disabled = busy || tabId === undefined || !enabled;
  startButton.textContent = enabled ? "Update timer" : "Start";
}

function display(result) {
  if (!result?.ok) throw new Error(result?.error || "No response from the extension.");
  enabled = result.enabled;
  if (enabled) {
    secondsInput.value = result.seconds;
    const next = result.nextReload
      ? ` Next reload around ${new Date(result.nextReload).toLocaleTimeString()}.`
      : "";
    status.textContent = `Running every ${result.seconds} seconds.${next}`;
  } else {
    status.textContent = "Automatic reload is off for this tab.";
  }
  updateControls();
}

async function request(type, extra = {}) {
  busy = true;
  updateControls();
  try {
    display(await api.runtime.sendMessage({ type, tabId, ...extra }));
  } catch (error) {
    status.textContent = error.message || "Unable to update the timer.";
  } finally {
    busy = false;
    updateControls();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (form.reportValidity()) request("start", { seconds: Number(secondsInput.value) });
});
stopButton.addEventListener("click", () => request("stop"));

async function initialize() {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab || !Number.isInteger(tab.id)) throw new Error("Select an open tab first.");
    tabId = tab.id;
    await request("status");
  } catch (error) {
    status.textContent = error.message || "Unable to find the current tab.";
    updateControls();
  }
}
initialize();
