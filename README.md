# HentaiMama Stremio / Nuvio Addon

Simple addon that lets you **search** and **browse** titles from [hentaimama.io](https://hentaimama.io/) inside Stremio or Nuvio.

**Important:** This addon only returns **external links** (`externalUrl`).  
When you click Play it opens the series / episode page on the website in your browser.  
It does **not** extract or serve any `.mp4` / stream files.

## Features

- Search catalog (`HentaiMama Search`)
- Recent catalog (`HentaiMama Recent`)
- Meta (title, poster, description, episode list)
- Stream → opens the corresponding page on hentaimama.io

## Deploy on Render (recommended)

1. Create a new GitHub repository and push these files:
   - `package.json`
   - `index.js`
   - `README.md`

2. Go to [Render.com](https://render.com) → **New** → **Web Service**

3. Connect your GitHub repo

4. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free is fine

5. Deploy. After it finishes you will get a URL like:
   ```
   https://your-service-name.onrender.com
   ```

6. Your manifest URL is:
   ```
   https://your-service-name.onrender.com/manifest.json
   ```

7. In **Nuvio** or **Stremio**:
   - Addons → Add Addon
   - Paste the manifest URL above
   - Install

## Local test

```bash
npm install
npm start
```

Then install `http://127.0.0.1:7000/manifest.json` in Stremio / Nuvio (desktop or web).

## Notes

- Marked as adult content (`behaviorHints.adult = true`)
- Site structure can change; if search/meta breaks, the selectors in `index.js` may need updating
- Free Render instances spin down after inactivity – first request after sleep can take 30–60 s

## License

MIT
