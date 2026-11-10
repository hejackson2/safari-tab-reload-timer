/* Safari Web Extension background event page. Timers are per tab. */
const PREFIX = "tab-reload:";
const MIN_SECONDS = 60;
const MAX_SECONDS = 86400;
const api = browser;

function alarmName(tabId) {
  return `${PREFIX}${tabId}`;
}

function validTabId(tabId) {
  return Number.isInteger(tabId) && tabId >= 0;
}

async function updateBadge(tabId, enabled) {
  try {
    await api.action.setBadgeText({ tabId, text: enabled ? "ON" : "" });
    if (enabled) {
      await api.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
    }
  } catch {
    // A tab can close before its badge is updated.
  }
}

async function handleMessage(message) {
  if (!message || !validTabId(message.tabId)) {
    return { ok: false, error: "Select an open tab first." };
  }
  const { tabId } = message;
  const name = alarmName(tabId);
  try {
    if (message.type === "status") {
      const alarm = await api.alarms.get(name);
      return {
        ok: true,
        enabled: Boolean(alarm),
        seconds: alarm ? Math.round(alarm.periodInMinutes * 60) : MIN_SECONDS,
        nextReload: alarm ? alarm.scheduledTime : null
      };
    }
    if (message.type === "start") {
      const seconds = Number(message.seconds);
      if (!Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
        return { ok: false, error: "Choose a whole number from 60 to 86400 seconds." };
      }
      const tab = await api.tabs.get(tabId);
      if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
        return { ok: false, error: "Open a regular HTTP or HTTPS page first." };
      }
      await api.alarms.create(name, {
        delayInMinutes: seconds / 60,
        periodInMinutes: seconds / 60
      });
      await updateBadge(tabId, true);
      const alarm = await api.alarms.get(name);
      return { ok: true, enabled: true, seconds, nextReload: alarm?.scheduledTime ?? null };
    }
    if (message.type === "stop") {
      await api.alarms.clear(name);
      await updateBadge(tabId, false);
      return { ok: true, enabled: false, seconds: MIN_SECONDS, nextReload: null };
    }
    return { ok: false, error: "Unknown request." };
  } catch (error) {
    return { ok: false, error: error.message || "Safari could not update this timer." };
  }
}

api.runtime.onMessage.addListener((message, sender) => {
  // Only the extension's own popup can manage timers.
  if (sender.id !== api.runtime.id || sender.tab) return;
  return handleMessage(message);
});

api.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(PREFIX)) return;
  const tabId = Number(alarm.name.slice(PREFIX.length));
  if (!validTabId(tabId)) {
    await api.alarms.clear(alarm.name);
    return;
  }
  try {
    const tab = await api.tabs.get(tabId);
    if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
      await api.alarms.clear(alarm.name);
      await updateBadge(tabId, false);
      return;
    }
    // Avoid interrupting a load already in progress.
    if (tab.status !== "loading") await api.tabs.reload(tabId);
  } catch {
    await api.alarms.clear(alarm.name);
    await updateBadge(tabId, false);
  }
});

api.tabs.onRemoved.addListener((tabId) => api.alarms.clear(alarmName(tabId)));

api.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
  const alarm = await api.alarms.get(alarmName(removedTabId));
  await api.alarms.clear(alarmName(removedTabId));
  if (!alarm) return;
  await api.alarms.create(alarmName(addedTabId), {
    when: Math.max(Date.now() + 1000, alarm.scheduledTime),
    periodInMinutes: alarm.periodInMinutes
  });
  await updateBadge(addedTabId, true);
});

api.runtime.onStartup.addListener(async () => {
  // Tab IDs are not stable across browser sessions. Never restore old timers.
  const alarms = await api.alarms.getAll();
  await Promise.all(alarms.filter((alarm) => alarm.name.startsWith(PREFIX))
    .map((alarm) => api.alarms.clear(alarm.name)));
  const tabs = await api.tabs.query({});
  await Promise.all(tabs.map((tab) => updateBadge(tab.id, false)));
});
