# Prime League Stats Export

Chrome extension: adds an export button on Prime League group pages (picks, bans, teams, players → Excel) plus a stats dashboard.

## Install
1. Click **Code → Download ZIP** on this page and unzip it somewhere permanent (e.g. `Documents/primeleague-export`).
2. Open `chrome://extensions`, switch on **Developer mode** (top right).
3. **Load unpacked** → select the unzipped folder.

## Use
Open a Prime League group page (the one with "Gruppenspiele"). Click the purple **Export stats (.xlsx)** button, then import the file in the dashboard (extension icon → Open dashboard).

## Updating
When a new version is released, users are notified three ways: a **NEW** badge on the extension icon, a button in the popup (**Update to vX.Y**), and a bar at the top of Prime League pages (**Update now**).
Clicking it downloads the changed files and reloads the extension. The very first time, a page asks you to pick the extension folder once (Chrome remembers it; if Chrome asks to re-allow access later, the same page opens automatically).

## Releasing (maintainer)
Edit the files, **bump `version` in `manifest.json`**, commit and push to `main`. Users see the update within ~3 h (or immediately when they open the popup; GitHub caches raw files for up to ~5 min).
