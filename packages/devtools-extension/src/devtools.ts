/**
 * DevTools entry. Its only job is to register a panel tab. The panel
 * itself is a separate HTML document (`panel.html`) that Chrome
 * displays in an iframe inside the inspected tab's DevTools window.
 */

chrome.devtools.panels.create("Kinem", "icons/icon48.png", "panel.html")
