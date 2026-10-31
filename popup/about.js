document.getElementById("extensionVersion").textContent =
  `v${chrome.runtime.getManifest().version}`;
