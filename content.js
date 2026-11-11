(() => {
  if (window.__xbeLoaded) return;
  window.__xbeLoaded = true;

  const items = new Map(); // tweetId -> Datensatz
  let running = false;
  let finished = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function extract(article) {
    const timeEl = article.querySelector("time");
    const link = timeEl && timeEl.closest("a");
    if (!link) return null;
    const href = link.getAttribute("href") || "";
    const m = href.match(/^\/([^/]+)\/status\/(\d+)/);
    if (!m) return null;

    const nameBlock = article.querySelector('[data-testid="User-Name"]');
    const name = nameBlock ? nameBlock.innerText.split("\n")[0].trim() : "";
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const text = textEl ? textEl.innerText.trim() : "";

    const images = [...article.querySelectorAll('[data-testid="tweetPhoto"] img')]
      .map((i) => i.src)
      .filter(Boolean);
    const hasVideo = !!article.querySelector("video, [data-testid='videoPlayer']");

    return {
      id: m[2],
      url: "https://x.com" + href.split("?")[0],
      author: name,
      handle: "@" + m[1],
      date: timeEl.getAttribute("datetime") || "",
      text,
      images: images.join(" "),
      hasVideo,
    };
  }

  function collect() {
    let added = 0;
    document.querySelectorAll('article[data-testid="tweet"]').forEach((a) => {
      const d = extract(a);
      if (d && !items.has(d.id)) {
        items.set(d.id, d);
        added++;
      }
    });
    return added;
  }

  async function run() {
    if (running) return;
    running = true;
    finished = false;
    let idle = 0;
    let lastHeight = 0;

    while (running && idle < 8) {
      const added = collect();
      const h = document.documentElement.scrollHeight;
      if (added === 0 && h === lastHeight) idle++;
      else idle = 0;
      lastHeight = h;
      window.scrollBy(0, Math.round(window.innerHeight * 0.8));
      await sleep(1100 + Math.random() * 500);
    }
    collect();
    running = false;
    finished = idle >= 8;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "start") {
      run();
      sendResponse({ ok: true });
    } else if (msg.type === "stop") {
      running = false;
      sendResponse({ ok: true });
    } else if (msg.type === "reset") {
      items.clear();
      finished = false;
      sendResponse({ ok: true });
    } else if (msg.type === "status") {
      sendResponse({
        running,
        finished,
        count: items.size,
        onBookmarks: /^\/i\/(bookmarks|history)/.test(location.pathname),
        path: location.pathname,
      });
    } else if (msg.type === "data") {
      sendResponse({ items: [...items.values()] });
    }
    return true;
  });
})();
