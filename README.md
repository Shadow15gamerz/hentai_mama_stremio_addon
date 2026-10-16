# Shadzop Anime Addon

Made by Shadzop. A Stremio addon that lists anime from your site, so Stremio and Nuvio users can search and play episodes.

## Setup

1. Install Node.js 18 or newer.
2. In this folder, run:
   ```
   npm install
   ```
3. Set your site address, then start the addon:
   ```
   SITE_URL=https://your-site.example npm start
   ```
   On Windows (PowerShell): `$env:SITE_URL="https://your-site.example"; npm start`

## Install in Nuvio or Stremio

Paste this into the addon search box of Nuvio or Stremio:

```
http://localhost:7000/manifest.json
```

For other people to use it, deploy the addon to a host with HTTPS (Render, Railway, or a VPS) and use `https://your-domain/manifest.json` instead.

## Before it works on your site

`scraper.js` contains placeholder selectors. Each function has a `TODO` comment marking what needs to match your site's HTML: the anime listing, the episode list, and the video source. Send the site link and these get filled in.

## Files

- `index.js`: addon server (catalog, search, meta, streams)
- `scraper.js`: reads your site
- `package.json`: dependencies

## Made by Shadzop

Watch more projects and tutorials on YouTube: https://www.youtube.com/@shadzop
