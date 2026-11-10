const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const alarms = new Map();
  const tabs = new Map([[7, { id: 7, url: 'https://example.com', status: 'complete' }]]);
  const reloads = [];
  const badges = new Map();
  const listeners = {};
  const event = (name) => ({ addListener(fn) { listeners[name] = fn; } });
  const browser = {
    runtime: { id: 'test-extension', onMessage: event('message'), onStartup: event('startup') },
    action: {
      async setBadgeText({ tabId, text }) { badges.set(tabId, text); },
      async setBadgeBackgroundColor() {}
    },
    alarms: {
      async get(name) { return alarms.get(name); },
      async getAll() { return [...alarms.values()]; },
      async create(name, options) {
        alarms.set(name, { name, periodInMinutes: options.periodInMinutes,
          scheduledTime: options.when ?? Date.now() + options.delayInMinutes * 60000 });
      },
      async clear(name) { return alarms.delete(name); },
      onAlarm: event('alarm')
    },
    tabs: {
      async get(id) { if (!tabs.has(id)) throw new Error('No such tab'); return tabs.get(id); },
      async query() { return [...tabs.values()]; },
      async reload(id) { reloads.push(id); },
      onRemoved: event('removed'), onReplaced: event('replaced')
    }
  };
  vm.runInNewContext(fs.readFileSync('extension/background.js', 'utf8'), { browser, Date });
  const send = (message) => listeners.message(message, { id: browser.runtime.id });
  return { alarms, tabs, reloads, badges, listeners, send };
}

test('starts, reports, updates and stops a per-tab timer', async () => {
  const s = setup();
  assert.equal((await s.send({ type: 'status', tabId: 7 })).enabled, false);
  const result = await s.send({ type: 'start', tabId: 7, seconds: 90 });
  assert.equal(result.ok, true);
  assert.equal(result.seconds, 90);
  assert.equal(s.alarms.get('tab-reload:7').periodInMinutes, 1.5);
  assert.equal(s.badges.get(7), 'ON');
  assert.equal((await s.send({ type: 'status', tabId: 7 })).seconds, 90);
  await s.send({ type: 'start', tabId: 7, seconds: 120 });
  assert.equal(s.alarms.size, 1);
  assert.equal(s.alarms.get('tab-reload:7').periodInMinutes, 2);
  await s.send({ type: 'stop', tabId: 7 });
  assert.equal(s.alarms.size, 0);
  assert.equal(s.badges.get(7), '');
});

test('rejects invalid intervals, missing tabs and non-web pages', async () => {
  const s = setup();
  for (const seconds of [0, 59, 86401, 60.5, 'invalid']) {
    assert.equal((await s.send({ type: 'start', tabId: 7, seconds })).ok, false);
  }
  assert.equal((await s.send({ type: 'start', tabId: -1, seconds: 60 })).ok, false);
  assert.equal((await s.send({ type: 'start', tabId: 99, seconds: 60 })).ok, false);
  s.tabs.get(7).url = 'safari://settings';
  assert.equal((await s.send({ type: 'start', tabId: 7, seconds: 60 })).ok, false);
  assert.equal(s.alarms.size, 0);
});

test('reloads only idle web tabs and ignores unrelated alarms', async () => {
  const s = setup();
  await s.send({ type: 'start', tabId: 7, seconds: 60 });
  await s.listeners.alarm(s.alarms.get('tab-reload:7'));
  assert.deepEqual(s.reloads, [7]);
  s.tabs.get(7).status = 'loading';
  await s.listeners.alarm(s.alarms.get('tab-reload:7'));
  await s.listeners.alarm({ name: 'unrelated' });
  assert.deepEqual(s.reloads, [7]);
  s.tabs.get(7).url = 'file:///tmp/example.html';
  await s.listeners.alarm(s.alarms.get('tab-reload:7'));
  assert.equal(s.alarms.size, 0);
  assert.equal(s.badges.get(7), '');
});

test('closing a tab clears only its timer', async () => {
  const s = setup();
  s.tabs.set(8, { id: 8, url: 'https://example.org' });
  await s.send({ type: 'start', tabId: 7, seconds: 60 });
  await s.send({ type: 'start', tabId: 8, seconds: 120 });
  await s.listeners.removed(7);
  assert.equal(s.alarms.has('tab-reload:7'), false);
  assert.equal(s.alarms.has('tab-reload:8'), true);
});

test('missing tabs clear their alarms', async () => {
  const s = setup();
  await s.send({ type: 'start', tabId: 7, seconds: 60 });
  s.tabs.delete(7);
  await s.listeners.alarm(s.alarms.get('tab-reload:7'));
  assert.equal(s.alarms.size, 0);
});

test('replacement tabs inherit the timer', async () => {
  const s = setup();
  await s.send({ type: 'start', tabId: 7, seconds: 180 });
  await s.listeners.replaced(8, 7);
  assert.equal(s.alarms.has('tab-reload:7'), false);
  assert.equal(s.alarms.get('tab-reload:8').periodInMinutes, 3);
  assert.equal(s.badges.get(8), 'ON');
});

test('startup clears stale timers but not unrelated alarms', async () => {
  const s = setup();
  await s.send({ type: 'start', tabId: 7, seconds: 60 });
  s.alarms.set('unrelated', { name: 'unrelated' });
  await s.listeners.startup();
  assert.equal(s.alarms.has('tab-reload:7'), false);
  assert.equal(s.alarms.has('unrelated'), true);
  assert.equal(s.badges.get(7), '');
});

test('ignores messages from content scripts or other extensions', () => {
  const s = setup();
  const message = { type: 'start', tabId: 7, seconds: 60 };
  assert.equal(s.listeners.message(message, { id: 'other' }), undefined);
  assert.equal(s.listeners.message(message, { id: 'test-extension', tab: { id: 7 } }), undefined);
  assert.equal(s.alarms.size, 0);
});
