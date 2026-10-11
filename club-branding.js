"use strict";
/* Personal club appearance. Never writes to public DBV/Supabase data or the family profile store. */
(function () {
  const KEY = "schmetterlinge.clubBranding.v1";
  const DEFAULT_LOGO = "./assets/spvgg-schmetterlinge.svg";
  const DEFAULT_SUBTITLE = "SPVGG MÖSSINGEN · BADMINTON JUGEND";
  const DEFAULT_ACCENT = "#0c83c8";
  const MAX_INPUT_BYTES = 2 * 1024 * 1024;
  const MAX_LOGO_CHARS = 230000;
  const TYPES = ["image/png", "image/jpeg", "image/webp"];
  const $ = id => document.getElementById(id);
  const hex = color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : DEFAULT_ACCENT;
  const cleanName = value => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
  const safeLogo = value => typeof value === "string" && value.length <= MAX_LOGO_CHARS &&
    /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) ? value : "";
  const normalized = value => ({
    name: cleanName(value?.name),
    logo: safeLogo(value?.logo),
    accent: hex(value?.accent)
  });
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalized(JSON.parse(raw)) : normalized(null);
    } catch (_) { return normalized(null); }
  }
  function contrastColor(value) {
    const rgb = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
    const linear = rgb.map(v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
    const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    return (luminance + .05) / .05 >= (1.05 / (luminance + .05)) ? "#111827" : "#ffffff";
  }
  const rgbHex = c => "#" + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
  function dominantColor(context, size) {
    const data = context.getImageData(0, 0, size, size).data;
    const bins = Array.from({length: 12}, () => ({score: 0, color: [0, 0, 0]}));
    for (let i = 0; i < data.length; i += 64) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const saturation = max ? (max - min) / max : 0;
      if (saturation < .22 || max < 48 || min > 222) continue;
      const delta = max - min;
      let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
      hue = (hue * 60 + 360) % 360;
      const bin = bins[Math.floor(hue / 30)];
      const weight = saturation * saturation * (max / 255);
      bin.score += weight;
      bin.color[0] += r * weight;
      bin.color[1] += g * weight;
      bin.color[2] += b * weight;
    }
    bins.sort((a, b) => b.score - a.score);
    return bins[0].score > 0.3 ? rgbHex(bins[0].color.map(v => v / bins[0].score)) : DEFAULT_ACCENT;
  }
  function processImage(file) {
    if (!file || !TYPES.includes(file.type) || file.size > MAX_INPUT_BYTES || file.size === 0) {
      return Promise.reject(Error("Bitte PNG, JPG oder WebP mit maximal 2 MB auswählen."));
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth > 4096 || img.naturalHeight > 4096) {
          reject(Error("Das Bild hat ungültige oder zu große Abmessungen.")); return;
        }
        try {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext("2d", {willReadFrequently: true});
          if (!context) throw Error("Bildverarbeitung ist auf diesem Gerät nicht verfügbar.");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, size, size);
          const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          context.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
          const accent = dominantColor(context, size);
          let logo = canvas.toDataURL("image/webp", .8);
          if (!logo.startsWith("data:image/webp;")) logo = canvas.toDataURL("image/jpeg", .78);
          if (!safeLogo(logo)) throw Error("Das Logo ist zu groß. Bitte ein kleineres Bild wählen.");
          resolve({logo, accent});
        } catch (error) { reject(error); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Error("Das Bild konnte nicht gelesen werden.")); };
      img.src = url;
    });
  }
  function applyBranding(value) {
    const p = normalized(value);
    const customized = Boolean(p.name || p.logo || p.accent !== DEFAULT_ACCENT);
    document.documentElement.classList.toggle("club-themed", customized);
    document.documentElement.style.setProperty("--club-accent", p.accent);
    document.documentElement.style.setProperty("--club-contrast", contrastColor(p.accent));
    const logo = document.querySelector(".topbar .brand-logo");
    if (logo) {
      logo.src = p.logo || DEFAULT_LOGO;
      logo.alt = p.logo ? "Logo von " + (p.name || "deinem Verein") : "Schmetterlingslogo der SpVgg Mössingen";
    }
    const subtitle = $("club-brand-subtitle");
    if (subtitle) subtitle.textContent = p.name || DEFAULT_SUBTITLE;
  }
  let saved = read();
  let draft = {...saved};
  let fileGeneration = 0;
  function feedback(message, error) {
    const status = $("club-branding-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("club-error", Boolean(error));
  }
  function preview() {
    const name = $("club-preview-name"), image = $("club-preview-logo"), frame = $("club-preview");
    if (!name || !image || !frame) return;
    name.textContent = draft.name || "Standarddesign Schmetterlinge";
    image.src = draft.logo || DEFAULT_LOGO;
    image.alt = draft.logo ? "Vorschau des Vereinslogos" : "Schmetterlinge-Standardlogo";
    frame.style.setProperty("--club-accent", draft.accent);
    frame.style.setProperty("--club-contrast", contrastColor(draft.accent));
    const sample = $("club-preview-accent");
    if (sample) sample.style.backgroundColor = draft.accent;
    const colorLabel = $("club-accent-value");
    if (colorLabel) colorLabel.textContent = draft.accent.toUpperCase();
    const remove = $("club-logo-remove");
    if (remove) remove.disabled = !draft.logo;
  }
  function fill() {
    const name = $("club-name"), accent = $("club-accent"), file = $("club-logo");
    if (!name || !accent) return;
    name.value = draft.name;
    accent.value = draft.accent;
    if (file) file.value = "";
    preview();
  }
  function install() {
    applyBranding(saved);
    const form = $("club-branding-form");
    if (!form) return;
    fill();
    $("club-name").addEventListener("input", event => {
      draft.name = cleanName(event.target.value);
      preview();
    });
    $("club-accent").addEventListener("input", event => {
      draft.accent = hex(event.target.value);
      preview();
    });
    $("club-logo").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const ticket = ++fileGeneration;
      feedback("Logo wird lokal verarbeitet …");
      try {
        const processed = await processImage(file);
        if (ticket !== fileGeneration) return;
        draft.logo = processed.logo;
        draft.accent = processed.accent;
        $("club-accent").value = draft.accent;
        preview();
        feedback("Logo bereit. Farbe aus dem Logo vorgeschlagen; zum Übernehmen speichern.");
      } catch (error) {
        if (ticket === fileGeneration) feedback(error?.message || "Logo konnte nicht geladen werden.", true);
      } finally { event.target.value = ""; }
    });
    $("club-logo-remove").addEventListener("click", () => {
      ++fileGeneration;
      draft.logo = "";
      preview();
      feedback("Logo in der Vorschau entfernt. Zum Übernehmen speichern.");
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      ++fileGeneration;
      const p = normalized(draft);
      try {
        localStorage.setItem(KEY, JSON.stringify(p));
        saved = p;
        draft = {...p};
        fill();
        applyBranding(saved);
        feedback("Vereinsdesign auf diesem Gerät gespeichert.");
      } catch (_) { feedback("Speichern nicht möglich. Bitte Gerätespeicher prüfen.", true); }
    });
    $("club-branding-cancel").addEventListener("click", () => {
      ++fileGeneration;
      draft = {...saved};
      fill();
      feedback("Änderungen verworfen.");
    });
    $("club-branding-reset").addEventListener("click", () => {
      ++fileGeneration;
      try {
        localStorage.removeItem(KEY);
        saved = normalized(null);
        draft = {...saved};
        fill();
        applyBranding(saved);
        feedback("Standarddesign Schmetterlinge wiederhergestellt.");
      } catch (_) { feedback("Zurücksetzen nicht möglich. Bitte Gerätespeicher prüfen.", true); }
    });
    // Suggestions come from the current device's profiles, never the official DBV affiliation.
    try {
      const players = JSON.parse(localStorage.getItem("shuttleboard-v1") || "{}")?.players;
      const names = Array.isArray(players) ? [...new Set(players.map(p => cleanName(p?.club)).filter(Boolean))] : [];
      const suggestions = $("club-name-suggestions");
      if (suggestions) names.slice(0, 30).forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        suggestions.appendChild(option);
      });
    } catch (_) {}
    window.addEventListener("storage", event => {
      if (event.key !== KEY) return;
      saved = read();
      draft = {...saved};
      fill();
      applyBranding(saved);
      feedback("Vereinsdesign von einem anderen Tab aktualisiert.");
    });
  }
  window.SchmetterlingeBranding = Object.freeze({current: () => ({...saved})});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once: true});
  else install();
})();
