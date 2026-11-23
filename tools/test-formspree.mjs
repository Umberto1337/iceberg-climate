/**
 * Проверка реальной отправки в Formspree без изменения файлов:
 * 1) подменяем ответ js/config.js на endpoint https://formspree.io/f/testdemo
 * 2) перехватываем POST и отвечаем 200
 * 3) проверяем тост, очистку формы и тело запроса
 */
import fs from "node:fs";

const targets = await fetch("http://127.0.0.1:9222/json/list").then((r) => r.json());
const page = targets.find((item) => item.type === "page");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
const posts = [];
const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const commandId = ++id;
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}

async function handlePaused(params) {
  const request = params.request;

  try {
    if (request.url.endsWith("/js/config.js")) {
      const result = await send("Fetch.getResponseBody", { requestId: params.requestId });
      const body = result.base64Encoded
        ? Buffer.from(result.body, "base64").toString("utf8")
        : result.body;
      const modified = body.replace(
        /formspreeEndpoint:\s*""/,
        'formspreeEndpoint: "https://formspree.io/f/testdemo"'
      );

      await send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/javascript; charset=utf-8" },
          { name: "Cache-Control", value: "no-store" }
        ],
        body: Buffer.from(modified, "utf8").toString("base64")
      });
      return;
    }

    if (request.url.startsWith("https://formspree.io/")) {
      if (request.method === "OPTIONS") {
        await send("Fetch.fulfillRequest", {
          requestId: params.requestId,
          responseCode: 204,
          responseHeaders: [
            { name: "Access-Control-Allow-Origin", value: "*" },
            { name: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
            { name: "Access-Control-Allow-Headers", value: "Accept, Content-Type" }
          ]
        });
        return;
      }

      posts.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        postData: request.postData || ""
      });

      await send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: "*" }
        ],
        body: Buffer.from(JSON.stringify({ ok: true })).toString("base64")
      });
      return;
    }

    await send("Fetch.continueRequest", { requestId: params.requestId });
  } catch (error) {
    errors.push(String(error));
    try {
      await send("Fetch.continueRequest", { requestId: params.requestId });
    } catch (ignored) {
      // ignore
    }
  }
}

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);

  if (message.id) {
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result);
    return;
  }

  if (message.method === "Fetch.requestPaused") {
    handlePaused(message.params);
  }

  if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params.exceptionDetails.text);
  }
});

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Fetch.enable", {
  patterns: [
    { urlPattern: "*://127.0.0.1:5500/js/config.js*", requestStage: "Response" },
    { urlPattern: "https://formspree.io/*", requestStage: "Request" }
  ]
});

await send("Page.navigate", { url: "http://127.0.0.1:5500/index.html" });
await sleep(1800);

const configState = await send("Runtime.evaluate", {
  expression: `({
    endpoint: window.SITE_CONFIG.formspreeEndpoint,
    demoNoteHidden: document.querySelector('#form-demo-note').hidden,
    action: document.querySelector('#request-form').getAttribute('action')
  })`,
  returnByValue: true
});

await send("Runtime.evaluate", {
  expression: `
    (() => {
      const name = document.querySelector('#name');
      name.value = 'Иван';
      name.dispatchEvent(new Event('input', { bubbles: true }));

      const phone = document.querySelector('#phone');
      phone.value = '+79991234567';
      phone.dispatchEvent(new Event('input', { bubbles: true }));

      const comment = document.querySelector('#comment');
      comment.value = 'Квартира 42 м, нужен кондиционер в спальню';
      comment.dispatchEvent(new Event('input', { bubbles: true }));

      const consent = document.querySelector('#consent');
      consent.checked = true;
      consent.dispatchEvent(new Event('change', { bubbles: true }));

      document.querySelector('#submit-btn').click();
      return true;
    })()
  `,
  returnByValue: true
});

await sleep(1800);

const result = await send("Runtime.evaluate", {
  expression: `({
    toastVisible: document.querySelector('#toast').classList.contains('is-visible'),
    title: document.querySelector('#toast-title').textContent,
    text: document.querySelector('#toast-text').textContent,
    isError: document.querySelector('#toast').classList.contains('is-error'),
    nameValue: document.querySelector('#name').value,
    phoneValue: document.querySelector('#phone').value,
    commentValue: document.querySelector('#comment').value,
    demoNoteHidden: document.querySelector('#form-demo-note').hidden
  })`,
  returnByValue: true
});

const output = {
  config: configState.result.value,
  posts: posts.map((post) => ({
    method: post.method,
    url: post.url,
    hasName: post.postData.includes('name="Иван"') || post.postData.includes("Иван"),
    hasPhone: post.postData.includes("+7 (999) 123-45-67"),
    hasComment: post.postData.includes("Квартира 42"),
    hasSubject: post.postData.includes("_subject"),
    hasGotcha: post.postData.includes("_gotcha")
  })),
  ui: result.result.value,
  errors
};

console.log(JSON.stringify(output, null, 2));

await send("Fetch.disable");
socket.close();
