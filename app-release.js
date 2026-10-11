"use strict";
/* Single browser-visible release identifier. The Pages build stamps commit/build
   into this file; PWA cache and current UI are deployed from the same artifact. */
(function () {
  const release = Object.freeze({version:"v81", build:"source", commit:""});
  function renderVersion() {
    const detail = release.commit
      ? "Version " + release.version + " · Build " + release.build + " · Commit " + release.commit
      : "Version " + release.version + " · lokaler Quellstand";
    document.querySelectorAll("[data-app-version]").forEach(node => {
      node.textContent = release.version;
      node.setAttribute("aria-label", "App-Version " + release.version);
      node.title = detail;
    });
    const info = document.getElementById("app-build-info");
    if (info) info.textContent = detail;
  }
  window.SchmetterlingeRelease = release;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderVersion, {once:true});
  } else {
    renderVersion();
  }
})();
