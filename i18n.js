"use strict";
/* Schmetterlinge i18n: static JSON language packs; no translation service or personal-data transfer. */
(function () {
  const STORAGE_KEY = "schmetterlinge.uiLanguage";
  const DEFAULT_CDN = "https://schmetterlinge-language-packs.pages.dev";
  const SUPPORTED = ["de","en","fr","uk","ru","zh-Hans","tr","ar","it","es","pl"];
  const directions = {"ar":"rtl"};
  let selected = "auto";
  let active = "de";
  let messages = Object.create(null);
  let generation = 0;
  let translating = false;
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const loaded = new Map();
  const OMIT = "script,style,textarea,code,pre,[data-i18n-skip],.player-name,.friend-name,.report-title";
  function normalize(code) {
    if (!code) return "de";
    const lower = String(code).replace("_","-").toLowerCase();
    if (lower.startsWith("zh")) return "zh-Hans";
    const primary = lower.split("-")[0];
    return SUPPORTED.includes(primary) ? primary : "de";
  }
  function automatic() {
    return normalize(navigator.languages?.[0] || navigator.language || "de");
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "auto" || SUPPORTED.includes(saved)) selected = saved;
  } catch (_) {}
  const chosen = () => selected === "auto" ? automatic() : selected;
  function translate(text) { return messages[text] || text; }
  function updateNode(node) {
    if (!node || !node.parentElement || node.parentElement.closest(OMIT)) return;
    const value = node.nodeValue;
    const tracked = originals.get(node);
    // Observe newly rendered German UI, never use translated text as the source.
    const base = tracked && tracked.translated === value ? tracked.base : value;
    const trimmed = base.trim();
    if (!trimmed || !Object.hasOwn(messages, trimmed) && !tracked) return;
    const output = trimmed ? base.replace(trimmed, translate(trimmed)) : base;
    originals.set(node, {base, translated: output});
    if (value !== output) node.nodeValue = output;
  }
  const TRANSLATED_ATTRS = ["placeholder", "aria-label", "title"];
  function updateAttributes(el) {
    if (!el || !el.getAttribute || el.closest(OMIT)) return;
    const old = attributes.get(el) || {};
    for (const attr of TRANSLATED_ATTRS) {
      const value = el.getAttribute(attr);
      if (value == null) continue;
      const tracked = old[attr];
      const base = tracked && tracked.translated === value ? tracked.base : value;
      if (!Object.hasOwn(messages, base) && !tracked) continue;
      const output = translate(base);
      old[attr] = {base, translated: output};
      if (value !== output) el.setAttribute(attr, output);
    }
    attributes.set(el, old);
  }
  function apply(root) {
    if (!root || translating) return;
    translating = true;
    try {
      const target = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
      if (!target) return;
      if (target.nodeType === Node.TEXT_NODE) updateNode(target);
      if (target.nodeType === Node.ELEMENT_NODE) updateAttributes(target);
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode()) {
        const current = walker.currentNode;
        if (current.nodeType === Node.TEXT_NODE) updateNode(current);
        else updateAttributes(current);
      }
    } finally { translating = false; }
  }
  async function fetchPack(lang) {
    if (lang === "de") return {meta:{locale:"de",direction:"ltr"},messages:{}};
    if (loaded.has(lang)) return loaded.get(lang);
    const local = new URL("./locales/" + lang + ".json", document.baseURI).href;
    const cdn = typeof window.SCHMETTERLINGE_LANGUAGE_BASE_URL === "string"
      ? window.SCHMETTERLINGE_LANGUAGE_BASE_URL.trim() : DEFAULT_CDN;
    const candidates = cdn ? [cdn.replace(/\/+$/,"") + "/" + lang + ".json", local] : [local];
    for (const url of candidates) {
      try {
        let response;
        const controller = url !== local && typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 1200) : null;
        try { response = await fetch(url, {cache:"no-cache", ...(controller ? {signal:controller.signal} : {})}); }
        catch (_) {} finally { if (timer !== null) clearTimeout(timer); }
        if ((!response || !response.ok) && "caches" in window) response = await caches.match(url);
        if (!response || !response.ok) continue;
        const json = await response.json();
        if (json.meta?.locale !== lang || !json.messages || typeof json.messages !== "object") continue;
        loaded.set(lang, json);
        // Explicit cache of cross-origin Cloudflare JSON, also on Safari without an active SW.
        if ("caches" in window) caches.open("schmetterlinge-i18n-v1")
          .then(cache => cache.put(url, new Response(JSON.stringify(json),
            {headers:{"Content-Type":"application/json"}}))).catch(() => {});
        return json;
      } catch (_) {}
    }
    throw new Error("Language pack unavailable: " + lang);
  }
  async function choose(value) {
    if (value !== "auto" && !SUPPORTED.includes(value)) return false;
    const ticket = ++generation;
    selected = value;
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
    const lang = chosen();
    let pack;
    try { pack = await fetchPack(lang); }
    catch (_) { pack = {messages:{}}; } // German fallback, even offline.
    if (ticket !== generation) return false;
    active = lang;
    messages = pack.messages;
    document.documentElement.lang = lang;
    document.documentElement.dir = directions[lang] || "ltr";
    document.querySelectorAll("[data-language-select]").forEach(select => { select.value = selected; });
    apply(document);
    window.dispatchEvent(new CustomEvent("schmetterlinge:language-change",
      {detail:{selected,locale:active,fallback: !Object.keys(messages).length && lang !== "de"}}));
    return true;
  }
  function install() {
    document.querySelectorAll("[data-language-select]").forEach(select => {
      select.value = selected;
      select.addEventListener("change", () => choose(select.value));
    });
    const observer = new MutationObserver(records => {
      if (translating) return;
      // Dynamic cards are rendered asynchronously by separate legacy modules.
      if (records.some(r => r.type === "childList" || r.type === "characterData")) {
        Promise.resolve().then(() => apply(document));
      }
    });
    observer.observe(document.documentElement, {subtree:true,childList:true,characterData:true});
    choose(selected);
  }
  window.SchmetterlingeI18n = Object.freeze({
    supported: SUPPORTED.slice(), current: () => active,
    selected: () => selected, t: translate, choose, apply
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once:true});
  else install();
})();