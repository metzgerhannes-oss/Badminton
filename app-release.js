"use strict";
/* Single browser-visible release identifier. The Pages build stamps commit/build
   into this file; PWA cache and current UI are deployed from the same artifact. */
(function () {
  const release = Object.freeze({version:"v232", build:"source", commit:""});
  function renderVersion() {
    const detail = release.commit
      ? "Version " + release.version + " · Build " + release.build + " · Commit " + release.commit
      : "Version " + release.version + " · lokaler Quellstand";
    document.querySelectorAll("[data-app-version]").forEach(node => {
      // A Pages-stamped HTML shell is authoritative even if JS is fetched from a newer release.
      if (node.getAttribute?.("data-release-build")) return;
      node.textContent = release.version;
      node.setAttribute("aria-label", "App-Version " + release.version);
      node.title = detail;
    });
    const info = document.getElementById("app-build-info");
    if (info && !info.getAttribute?.("data-release-build")) info.textContent = detail;
  }
  window.SchmetterlingeRelease = release;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderVersion, {once:true});
  } else {
    renderVersion();
  }
})();
