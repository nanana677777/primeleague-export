# Prime League Stats Export

Chrome extension: adds an export button on Prime League group pages (picks, bans, teams, players → Excel) plus a stats dashboard.

## Install
1. Click **Code → Download ZIP** on this page and unzip it somewhere permanent (e.g. `Documents/primeleague-export`).
2. Open `chrome://extensions`, switch on **Developer mode** (top right).
3. **Load unpacked** → select the unzipped folder.

## Use
Open a Prime League group page (the one with "Gruppenspiele"). Click the purple **Export stats (.xlsx)** button, then import the file in the dashboard (extension icon → Open dashboard).

## Updating
When a new version is released the extension icon shows a **NEW** badge. Click the icon → **Update to vX.Y**.
The first time, pick the extension folder once; after that it's a single click and the extension reloads itself.

## Releasing (maintainer)
Edit the files, **bump `version` in `manifest.json`**, commit and push to `main`. Users see the update within ~6 h (or immediately when they open the popup; GitHub caches raw files for up to ~5 min).
