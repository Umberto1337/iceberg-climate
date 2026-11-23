/**
 * Браузерная проверка сайта через Chrome DevTools Protocol.
 * Требует запущенный Chrome с --remote-debugging-port=9222
 * и локальный сервер на http://127.0.0.1:5500.
 *
 * Запуск: node tools/visual-check.mjs
 */
import fs from "node:fs";
import path from "node:path";

const PORT = 9222;
const BASE = "http://127.0.0.1:5500";
const OUT_DIR = path.join("tools", "screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const step = (label) => console.error(`[check] ${label}`);

const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("Не найден page-target Chrome");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
let scenarioErrors = [];
const results = { screenshots: [], issues: [], console: [] };

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);

  if (message.id) {
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
    return;
  }

  const method = message.method;
  const params = message.params || {};

  if (method === "Runtime.exceptionThrown") {
    const details = params.exceptionDetails;
    scenarioErrors.push({
      kind: "exception",
      text: `${details.text} ${details.exception?.description || ""}`.trim()
    });
  }

  if (method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(params.type)) {
    scenarioErrors.push({
      kind: `console.${params.type}`,
      text: params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ")
    });
  }

  if (method === "Log.entryAdded" && ["error", "warning"].includes(params.entry.level)) {
    scenarioErrors.push({
      kind: `log.${params.entry.level}`,
      text: params.entry.text
    });
  }

  if (method === "Network.responseReceived" && params.response.status >= 400) {
    scenarioErrors.push({
      kind: `http.${params.response.status}`,
      text: params.response.url
    });
  }

  if (method === "Network.loadingFailed" && params.errorText !== "net::ERR_ABORTED") {
    scenarioErrors.push({
      kind: "network",
      text: `${params.errorText} (${params.type || "unknown"})`
    });
  }
});

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Log.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
step("CDP готов");

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });

  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    throw new Error(`${details.text}: ${details.exception?.description || ""}`);
  }

  return result.result.value;
}

async function waitForReady() {
  for (let i = 0; i < 160; i += 1) {
    const state = await evaluate("document.readyState");
    if (state === "complete") break;
    await sleep(100);
  }

  await evaluate("document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true");
  await sleep(900);
}

async function navigate(url, viewport) {
  step(`Открываю ${url} (${viewport.width}px)`);
  scenarioErrors = [];
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dsf || 1,
    mobile: Boolean(viewport.mobile)
  });

  if (viewport.mobile) {
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  } else {
    await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  }

  await send("Page.navigate", { url });
  await waitForReady();

  await evaluate(`
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    true;
  `);
  await sleep(350);
}

async function primeLazyImages() {
  await evaluate(`
    new Promise((resolve) => {
      document.querySelectorAll('img[loading="lazy"]').forEach((image) => {
        image.loading = 'eager';
      });

      const height = document.documentElement.scrollHeight;
      let position = 0;
      const timer = setInterval(() => {
        window.scrollTo(0, position);
        position += 550;
        if (position > height) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          setTimeout(resolve, 350);
        }
      }, 45);
    })
  `);

  await evaluate(`
    Promise.race([
      Promise.all(Array.from(document.images).map((image) => {
        if (image.complete) return true;
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      })),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ]).then(() => true)
  `);

  await sleep(400);
}

async function screenshot(name, fullPage = true) {
  await evaluate("window.scrollTo(0, 0); true");
  await sleep(200);

  if (fullPage) await primeLazyImages();

  let params = { format: "png", fromSurface: true };

  if (fullPage) {
    const metrics = await send("Page.getLayoutMetrics");
    const content = metrics.cssContentSize || metrics.contentSize;
    params = {
      ...params,
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: Math.ceil(content.width),
        height: Math.min(Math.ceil(content.height), 15000),
        scale: 1
      }
    };
  }

  const shot = await send("Page.captureScreenshot", params);
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  results.screenshots.push({ name, bytes: fs.statSync(file).size });
  step(`Скриншот ${name}`);
}

async function sectionScreenshot(selector, name) {
  await evaluate(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center' }); true`
  );
  await sleep(600);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  results.screenshots.push({ name, bytes: fs.statSync(file).size });
  step(`Скриншот ${name}`);
}

async function checkLayout(label) {
  const metrics = await evaluate(`({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight
  })`);

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    results.issues.push(
      `${label}: горизонтальный скролл ${metrics.scrollWidth}px > ${metrics.clientWidth}px`
    );
  }

  return metrics;
}

function finishScenario(label) {
  const unique = [];
  const seen = new Set();

  for (const error of scenarioErrors) {
    const key = `${error.kind}|${error.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(error);
  }

  if (unique.length) {
    results.console.push({ scenario: label, errors: unique });
  }

  step(`Сценарий завершён: ${label}`);
}

async function closeOverlays() {
  await evaluate(`
    (() => {
      const nav = document.querySelector('#main-nav');
      if (nav && nav.classList.contains('is-open')) document.querySelector('.burger').click();
      const toast = document.querySelector('#toast');
      if (toast && toast.classList.contains('is-visible')) toast.querySelector('.toast__close').click();
      return true;
    })()
  `);
  await sleep(250);
}

/* ============================================================
   Сценарий 1. Главная, desktop
   ============================================================ */
await navigate(`${BASE}/`, { width: 1440, height: 950 });
await checkLayout("Главная desktop");
await screenshot("index-desktop-full.png");
await screenshot("index-desktop-hero.png", false);
await sectionScreenshot(".works-slider", "works-desktop.png");
await sectionScreenshot("#contact", "form-desktop.png");

const heroDesktop = await evaluate(`({
  title: document.querySelector('.hero__title')?.innerText,
  cards: document.querySelectorAll('.service-card').length,
  slides: document.querySelectorAll('.work-slide').length,
  form: Boolean(document.querySelector('#request-form')),
  products: window.PRODUCTS?.length || 0
})`);

if (heroDesktop.cards !== 4) results.issues.push(`Главная: услуг ${heroDesktop.cards}, ожидалось 4`);
if (heroDesktop.slides !== 6) results.issues.push(`Главная: слайдов ${heroDesktop.slides}, ожидалось 6`);
if (!heroDesktop.form) results.issues.push("Главная: не найдена форма");

await evaluate("document.querySelectorAll('.slider-dot')[0].click(); true");
await sleep(800);
await evaluate("document.querySelector('[data-slider-next]').click(); true");
await sleep(800);
const afterNext = await evaluate("document.querySelector('[data-slider-current]').textContent");
if (afterNext !== "02") results.issues.push(`Слайдер: после «вперёд» счётчик ${afterNext}`);

await evaluate("document.querySelectorAll('.slider-dot')[3].click(); true");
await sleep(800);
const afterDot = await evaluate("document.querySelector('[data-slider-current]').textContent");
if (afterDot !== "04") results.issues.push(`Слайдер: после точки счётчик ${afterDot}`);

finishScenario("Главная desktop");

/* ============================================================
   Сценарий 2. Каталог, desktop
   ============================================================ */
await navigate(`${BASE}/catalog.html`, { width: 1440, height: 950 });
await checkLayout("Каталог desktop");
await screenshot("catalog-desktop-full.png");
await screenshot("catalog-desktop-hero.png", false);

const initialCards = await evaluate("document.querySelectorAll('.product-card').length");
if (initialCards !== 8) results.issues.push(`Каталог: карточек ${initialCards}, ожидалось 8`);

await evaluate("document.querySelector('[data-filter=\"mobile\"]').click(); true");
await sleep(250);
const mobileCards = await evaluate("document.querySelectorAll('.product-card').length");
const mobileCount = await evaluate("document.querySelector('[data-products-count]').textContent");
if (mobileCards !== 2) results.issues.push(`Фильтр «Мобильные»: карточек ${mobileCards}, ожидалось 2`);
if (mobileCount !== "2") results.issues.push(`Фильтр «Мобильные»: счётчик ${mobileCount}`);

await evaluate("document.querySelector('[data-reset-filters]').click(); true");
await sleep(200);
await evaluate(`
  (() => {
    const search = document.querySelector('#catalog-search');
    search.value = 'Daikin';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
await sleep(250);
const searchCards = await evaluate("document.querySelectorAll('.product-card').length");
if (searchCards !== 1) results.issues.push(`Поиск Daikin: карточек ${searchCards}, ожидалась 1`);

await evaluate("document.querySelector('[data-reset-filters]').click(); true");
await sleep(200);
await evaluate(`
  (() => {
    const sort = document.querySelector('#catalog-sort');
    sort.value = 'price-asc';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()
`);
await sleep(250);
const cheapest = await evaluate(`({
  name: document.querySelector('.product-card__name')?.textContent,
  price: document.querySelector('.product-card .price strong')?.textContent
})`);
if (cheapest.name !== "BSAG-09HN8") {
  results.issues.push(`Сортировка по цене: первая карточка ${cheapest.name}`);
}

await evaluate("document.querySelector('[data-reset-filters]').click(); true");
await sleep(250);

await evaluate(`
  (() => {
    const search = document.querySelector('#catalog-search');
    search.value = 'zzz-ничего-нет';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
await sleep(250);
const emptyState = await evaluate(`({
  emptyVisible: !document.querySelector('#catalog-empty').hidden,
  gridHidden: document.querySelector('#product-grid').hidden,
  count: document.querySelector('[data-products-count]').textContent
})`);
if (!emptyState.emptyVisible || !emptyState.gridHidden || emptyState.count !== "0") {
  results.issues.push(`Пустой результат поиска: ${JSON.stringify(emptyState)}`);
}

await evaluate("document.querySelector('#catalog-empty [data-reset-filters]').click(); true");
await sleep(250);
const resetCards = await evaluate("document.querySelectorAll('.product-card').length");
if (resetCards !== 8) results.issues.push(`Сброс фильтров: карточек ${resetCards}`);

finishScenario("Каталог desktop");

/* ============================================================
   Сценарий 3. Главная, mobile + меню
   ============================================================ */
await navigate(`${BASE}/`, { width: 390, height: 844, mobile: true });
await checkLayout("Главная mobile");
await screenshot("index-mobile-full.png");
await screenshot("index-mobile-hero.png", false);
await sectionScreenshot(".works-slider", "works-mobile.png");
await evaluate("window.scrollTo(0, 0); true");
await sleep(300);

await evaluate("document.querySelector('.burger').click(); true");
await sleep(450);
const menuState = await evaluate(`({
  expanded: document.querySelector('.burger').getAttribute('aria-expanded'),
  visible: getComputedStyle(document.querySelector('#main-nav')).visibility,
  bodyLocked: document.body.classList.contains('nav-open')
})`);
if (menuState.expanded !== "true" || menuState.visible !== "visible" || !menuState.bodyLocked) {
  results.issues.push(`Мобильное меню не открылось: ${JSON.stringify(menuState)}`);
}
await screenshot("menu-mobile.png", false);

await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true");
await sleep(350);
const menuClosed = await evaluate("document.querySelector('.burger').getAttribute('aria-expanded')");
if (menuClosed !== "false") results.issues.push("Мобильное меню не закрылось по Escape");

finishScenario("Главная mobile");

/* ============================================================
   Сценарий 4. Каталог, mobile
   ============================================================ */
await navigate(`${BASE}/catalog.html`, { width: 390, height: 844, mobile: true });
await checkLayout("Каталог mobile");
await screenshot("catalog-mobile-full.png");
finishScenario("Каталог mobile");

/* ============================================================
   Сценарий 5. Форма: предзаполнение, валидация, демо-отправка
   ============================================================ */
await navigate(`${BASE}/index.html?product=daikin-ftxb25c#contact`, {
  width: 390,
  height: 844,
  mobile: true
});

const prefill = await evaluate(`({
  comment: document.querySelector('#comment')?.value,
  product: document.querySelector('#form-product')?.value
})`);
const normalizedComment = String(prefill.comment || "").replace(/\u00a0/g, " ");
if (!normalizedComment.includes("Daikin") || !normalizedComment.includes("32 900")) {
  results.issues.push(`Предзаполнение формы не сработало: ${JSON.stringify(prefill)}`);
}

await evaluate("document.querySelector('#contact').scrollIntoView({ block: 'center' }); true");
await sleep(500);

await evaluate("document.querySelector('#submit-btn').click(); true");
await sleep(300);
const emptyValidation = await evaluate(`({
  invalidFields: document.querySelectorAll('.field.is-invalid').length,
  consentError: document.querySelector('#consent-error').classList.contains('is-visible'),
  active: document.activeElement.id
})`);
if (emptyValidation.invalidFields < 2) {
  results.issues.push(`Валидация пустой формы: ${JSON.stringify(emptyValidation)}`);
}
if (!emptyValidation.consentError) {
  results.issues.push("Валидация: нет ошибки согласия");
}

await evaluate(`
  (() => {
    const name = document.querySelector('#name');
    name.value = 'Иван';
    name.dispatchEvent(new Event('input', { bubbles: true }));

    const phone = document.querySelector('#phone');
    phone.value = '123';
    phone.dispatchEvent(new Event('input', { bubbles: true }));

    const consent = document.querySelector('#consent');
    consent.checked = true;
    consent.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()
`);
await evaluate("document.querySelector('#submit-btn').click(); true");
await sleep(300);
const phoneError = await evaluate("document.querySelector('#phone-error').textContent");
if (!phoneError) results.issues.push("Валидация: не показана ошибка телефона");

await evaluate(`
  (() => {
    const phone = document.querySelector('#phone');
    phone.value = '+79991234567';
    phone.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
await sleep(150);
const phoneMasked = await evaluate("document.querySelector('#phone').value");
if (phoneMasked !== "+7 (999) 123-45-67") {
  results.issues.push(`Маска телефона: ${phoneMasked}`);
}

const phoneAfterBackspace = await evaluate(`
  (() => {
    const phone = document.querySelector('#phone');
    phone.value = '+7 (999)';
    phone.focus();
    phone.setSelectionRange(phone.value.length, phone.value.length);
    phone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    return phone.value;
  })()
`);
if (phoneAfterBackspace === "+7 (999)") {
  results.issues.push("Backspace залипает на закрывающей скобке телефона");
}

await evaluate(`
  (() => {
    const phone = document.querySelector('#phone');
    phone.value = '+79991234567';
    phone.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
await sleep(150);

await evaluate("document.querySelector('#submit-btn').click(); true");
await sleep(1400);
const success = await evaluate(`({
  visible: document.querySelector('#toast').classList.contains('is-visible'),
  title: document.querySelector('#toast-title').textContent,
  text: document.querySelector('#toast-text').textContent,
  nameValue: document.querySelector('#name').value,
  phoneValue: document.querySelector('#phone').value,
  commentValue: document.querySelector('#comment').value,
  demoNote: !document.querySelector('#form-demo-note').hidden
})`);

if (!success.visible) results.issues.push("Форма: тост успеха не появился");
if (!success.title.toLowerCase().includes("отправлена")) {
  results.issues.push(`Форма: заголовок тоста «${success.title}»`);
}
if (success.nameValue !== "" || success.phoneValue !== "" || success.commentValue !== "") {
  results.issues.push(`Форма: после успеха поля не очищены ${JSON.stringify(success)}`);
}
if (!success.demoNote) results.issues.push("Форма: не показана плашка демо-режима");

await screenshot("form-success-mobile.png", false);
finishScenario("Форма mobile");

/* ============================================================
   Сценарий 6. Промежуточные ширины: нет горизонтального скролла
   ============================================================ */
for (const viewport of [
  { width: 1024, height: 900, mobile: false, label: "Главная 1024" },
  { width: 768, height: 900, mobile: false, label: "Главная 768" },
  { width: 320, height: 700, mobile: true, label: "Главная 320" }
]) {
  await navigate(`${BASE}/`, viewport);
  await checkLayout(viewport.label);
  await screenshot(`index-${viewport.width}-hero.png`, false);
  finishScenario(viewport.label);
}

await navigate(`${BASE}/catalog.html`, { width: 768, height: 900, mobile: false });
await checkLayout("Каталог 768");
finishScenario("Каталог 768");

/* ============================================================
   Сценарий 7. Правовая страница
   ============================================================ */
await navigate(`${BASE}/privacy.html`, { width: 1440, height: 950 });
await checkLayout("Политика desktop");
await screenshot("privacy-desktop-full.png");
finishScenario("Политика desktop");

/* ============================================================
   Отчёт
   ============================================================ */
await closeOverlays();
console.log(JSON.stringify(results, null, 2));

const issueCount = results.issues.length + results.console.length;
if (issueCount > 0) process.exitCode = 1;

socket.close();
