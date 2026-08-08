import { writeFileSync } from "node:fs";

const endpoint = "http://127.0.0.1:9223";
const pages = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("No Chrome page target found.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const events = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  } else if (message.method && events.has(message.method)) {
    events.get(message.method).splice(0).forEach((resolve) => resolve(message.params));
  }
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const event = (method) => new Promise((resolve) => {
  if (!events.has(method)) events.set(method, []);
  events.get(method).push(resolve);
});
const evaluate = async (expression) => {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
};

await command("Page.enable");
const results = [];
for (const width of [320, 360, 390, 768, 1024, 1440]) {
  await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  const loaded = event("Page.loadEventFired");
  await command("Page.navigate", { url: "http://localhost:8088/" });
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 350));
  if (width === 390 || width === 1440) {
    const capture = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(new URL(`../audit/responsive-${width}.png`, import.meta.url), Buffer.from(capture.data, "base64"));
  }
  const layout = await evaluate(`(() => {
    const viewport = document.documentElement.clientWidth;
    const overflowing = [...document.querySelectorAll('body *')].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.position !== 'fixed' && style.display !== 'none' && rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1);
    }).slice(0, 8).map((element) => ({tag: element.tagName, className: element.className, text: element.textContent.trim().slice(0, 45)}));
    const smallTargets = [...document.querySelectorAll('a, button, input, select, textarea')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && (rect.width < 44 || rect.height < 44);
    }).slice(0, 8).map((element) => ({tag: element.tagName, text: element.textContent.trim().slice(0, 35), width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height)}));
    return {viewport, scrollWidth: document.documentElement.scrollWidth, overflowing, smallTargets};
  })()`);
  results.push({ width, ...layout });
}

await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
let loaded = event("Page.loadEventFired");
await command("Page.navigate", { url: "http://localhost:8088/" });
await loaded;
const menuOpened = await evaluate(`(() => { document.querySelector('.menu-toggle').click(); return {expanded: document.querySelector('.menu-toggle').getAttribute('aria-expanded'), hidden: document.querySelector('#mobile-menu').hidden, bodyLocked: document.body.classList.contains('menu-open')}; })()`);
const menuClosed = await evaluate(`(() => { document.querySelector('#mobile-menu a').click(); return {expanded: document.querySelector('.menu-toggle').getAttribute('aria-expanded'), hidden: document.querySelector('#mobile-menu').hidden, bodyLocked: document.body.classList.contains('menu-open')}; })()`);
const formValidation = await evaluate(`(() => { document.querySelector('.contact-form').requestSubmit(); return {status: document.querySelector('.form-status').textContent, focusedField: document.activeElement.id, errors: [...document.querySelectorAll('.error')].map((item) => item.textContent).filter(Boolean)}; })()`);

console.log(JSON.stringify({ results, menuOpened, menuClosed, formValidation }, null, 2));
socket.close();
