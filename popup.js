const $ = (id) => document.getElementById(id);
let lastExport = "";

async function tab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

async function send(type) {
  const t = await tab();
  try {
    return await chrome.tabs.sendMessage(t.id, { type });
  } catch (e) {
    return null;
  }
}

async function refresh() {
  const s = await send("status");
  const el = $("status");
  if (!s) {
    el.textContent = "Bitte öffne x.com/i/bookmarks und lade die Seite einmal neu (F5).";
    return;
  }
  const hint = s.onBookmarks ? "" : `\n(Hinweis: Seite ${s.path} – Start trotzdem möglich)`;
  const text = s.running
    ? `Sammle … ${s.count} Bookmarks`
    : lastExport
    ? lastExport
    : s.finished
    ? `✓ Fertig: ${s.count} Bookmarks. Jetzt unten ein Format anklicken, um zu speichern.`
    : `${s.count} Bookmarks gesammelt (gestoppt)`;
  el.textContent = text + hint;
  ["csv", "json", "md"].forEach((id) =>
    $(id).classList.toggle("ready", s.finished && !s.running && !lastExport)
  );
}

function csvEscape(v) {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  return '"' + s.replace(/"/g, '""') + '"';
}

function toCSV(items) {
  const head = ["Name", "URL", "Autor", "Handle", "Datum", "Text", "Bilder", "Video"];
  const rows = items.map((i) => [
    (i.text || i.url).slice(0, 80),
    i.url,
    i.author,
    i.handle,
    i.date,
    i.text,
    i.images,
    i.hasVideo ? "ja" : "",
  ]);
  return "\ufeff" + [head, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function toMD(items) {
  return items
    .map((i) => {
      const d = i.date ? i.date.slice(0, 10) : "";
      return `### ${i.author} (${i.handle}) – ${d}\n\n${i.text}\n\n${i.url}\n`;
    })
    .join("\n---\n\n");
}

function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportAs(kind) {
  const r = await send("data");
  if (!r || !r.items.length) {
    $("status").textContent = "Noch keine Daten – erst „Sammeln starten“.";
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  lastExport = "✓ Heruntergeladen (siehe Download-Ordner)";
  if (kind === "csv") download(`x-bookmarks-${stamp}.csv`, toCSV(r.items), "text/csv;charset=utf-8");
  if (kind === "json") download(`x-bookmarks-${stamp}.json`, JSON.stringify(r.items, null, 2), "application/json");
  if (kind === "md") download(`x-bookmarks-${stamp}.md`, toMD(r.items), "text/markdown;charset=utf-8");
}

$("start").onclick = async () => { await send("start"); refresh(); };
$("stop").onclick = async () => { await send("stop"); refresh(); };
$("reset").onclick = async () => { lastExport = ""; await send("reset"); refresh(); };
$("csv").onclick = () => exportAs("csv");
$("json").onclick = () => exportAs("json");
$("md").onclick = () => exportAs("md");

refresh();
setInterval(refresh, 700);
