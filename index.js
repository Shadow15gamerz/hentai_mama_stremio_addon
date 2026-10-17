const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE = 'https://hentaimama.io';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const manifest = {
  id: 'com.hentaimama.addon',
  version: '1.0.0',
  name: 'HentaiMama',
  description: 'Browse and open titles from hentaimama.io (external links only – no direct video files)',
  logo: 'https://hentaimama.io/wp-content/themes/dooplay/assets/img/favicon.png',
  background: 'https://hentaimama.io/wp-content/themes/dooplay/assets/img/large-logo.png',
  resources: ['catalog', 'meta', 'stream'],
  types: ['series', 'movie'],
  catalogs: [
    {
      type: 'series',
      id: 'hentaimama-search',
      name: 'HentaiMama Search',
      extra: [{ name: 'search', isRequired: true }]
    },
    {
      type: 'series',
      id: 'hentaimama-recent',
      name: 'HentaiMama Recent',
      extra: [{ name: 'skip' }]
    }
  ],
  idPrefixes: ['hentaimama'],
  behaviorHints: {
    adult: true,
    configurable: false
  }
};

const builder = new addonBuilder(manifest);

async function getHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 15000
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function slugFromUrl(url) {
  // https://hentaimama.io/tvshows/overflow/ → overflow
  const m = url.match(/\/tvshows\/([^/]+)\/?/);
  return m ? m[1] : null;
}

function parseSearchOrList(html) {
  const $ = cheerio.load(html);
  const metas = [];

  // Current site uses article.series-card
  $('article.series-card, div.result-item article, article').each((_, el) => {
    const $el = $(el);
    const a = $el.find('h3.sc-title a, div.title a, a.sc-poster, a').first();
    const href = a.attr('href') || '';
    if (!href.includes('/tvshows/')) return;

    const slug = slugFromUrl(href);
    if (!slug) return;

    const name = $el.find('h3.sc-title a, div.title a, h3 a').first().text().trim()
      || a.attr('title')
      || slug.replace(/-/g, ' ');

    const img = $el.find('img').first();
    const poster = img.attr('data-src') || img.attr('src') || img.attr('data-lazy-src') || null;

    // Avoid duplicates
    if (metas.some(m => m.id === `hentaimama:${slug}`)) return;

    metas.push({
      id: `hentaimama:${slug}`,
      type: 'series',
      name,
      poster: poster && poster.startsWith('http') ? poster : null,
      posterShape: 'poster'
    });
  });

  return metas;
}

function parseSeriesPage(html, slug) {
  const $ = cheerio.load(html);

  const name = $('h1.dsc-title, h1').first().text().trim() || slug.replace(/-/g, ' ');
  const posterMeta = $('meta[property="og:image"]').attr('content');
  const poster = posterMeta || $('img').first().attr('src') || null;

  let description = '';
  const descEl = $('.wp-content p, .sbox p, .dsc-content p, p').first();
  if (descEl.length) description = descEl.text().trim();

  // Collect unique episode links
  const episodeMap = new Map();
  $('a[href*="/episodes/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/\/episodes\/([^/]+)-episode-(\d+)\/?/);
    if (!m) return;
    const epSlug = m[1];
    const epNum = parseInt(m[2], 10);
    if (epSlug !== slug && !slug.startsWith(epSlug) && !epSlug.startsWith(slug)) {
      // allow if close
    }
    if (!episodeMap.has(epNum)) {
      episodeMap.set(epNum, {
        id: `hentaimama:${slug}:${epNum}`,
        title: `Episode ${epNum}`,
        season: 1,
        episode: epNum,
        released: new Date().toISOString()
      });
    }
  });

  const videos = Array.from(episodeMap.values()).sort((a, b) => a.episode - b.episode);

  // Fallback: if no episodes found, still return meta so user can open series page
  if (videos.length === 0) {
    videos.push({
      id: `hentaimama:${slug}:1`,
      title: 'Open on HentaiMama',
      season: 1,
      episode: 1,
      released: new Date().toISOString()
    });
  }

  return {
    id: `hentaimama:${slug}`,
    type: 'series',
    name,
    poster: poster && poster.startsWith('http') ? poster : null,
    posterShape: 'poster',
    description,
    background: poster,
    videos,
    behaviorHints: { defaultVideoId: videos[0]?.id }
  };
}

// ---------- Catalog ----------
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  try {
    if (id === 'hentaimama-search' && extra && extra.search) {
      const q = encodeURIComponent(extra.search.trim());
      const html = await getHtml(`${BASE}/?s=${q}`);
      const metas = parseSearchOrList(html);
      return { metas };
    }

    if (id === 'hentaimama-recent') {
      // Recent series / homepage
      const html = await getHtml(`${BASE}/`);
      let metas = parseSearchOrList(html);

      // Also try recent episodes page for more items
      try {
        const recentHtml = await getHtml(`${BASE}/recent-episodes/`);
        const more = parseSearchOrList(recentHtml);
        const seen = new Set(metas.map(m => m.id));
        for (const m of more) {
          if (!seen.has(m.id)) {
            metas.push(m);
            seen.add(m.id);
          }
        }
      } catch (_) {}

      // Simple skip pagination
      const skip = parseInt(extra?.skip || '0', 10) || 0;
      metas = metas.slice(skip, skip + 50);
      return { metas };
    }

    return { metas: [] };
  } catch (err) {
    console.error('Catalog error:', err.message);
    return { metas: [] };
  }
});

// ---------- Meta ----------
builder.defineMetaHandler(async ({ type, id }) => {
  try {
    if (!id.startsWith('hentaimama:')) return { meta: null };

    const parts = id.replace('hentaimama:', '').split(':');
    const slug = parts[0];
    if (!slug) return { meta: null };

    const html = await getHtml(`${BASE}/tvshows/${slug}/`);
    const meta = parseSeriesPage(html, slug);
    return { meta };
  } catch (err) {
    console.error('Meta error:', err.message);
    return { meta: null };
  }
});

// ---------- Stream (externalUrl only) ----------
builder.defineStreamHandler(async ({ type, id }) => {
  try {
    if (!id.startsWith('hentaimama:')) return { streams: [] };

    // Formats:
    // hentaimama:slug          → series page
    // hentaimama:slug:epNum    → specific episode page
    const parts = id.replace('hentaimama:', '').split(':');
    const slug = parts[0];
    const epNum = parts[1] ? parseInt(parts[1], 10) : null;

    let externalUrl;
    let name;

    if (epNum && !isNaN(epNum)) {
      externalUrl = `${BASE}/episodes/${slug}-episode-${epNum}/`;
      name = `HentaiMama – Episode ${epNum}`;
    } else {
      externalUrl = `${BASE}/tvshows/${slug}/`;
      name = 'HentaiMama – Series Page';
    }

    return {
      streams: [
        {
          name,
          title: 'Open on hentaimama.io',
          description: 'Opens the page in your browser. No direct video stream.',
          externalUrl
        }
      ]
    };
  } catch (err) {
    console.error('Stream error:', err.message);
    return { streams: [] };
  }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
console.log(`HentaiMama addon running on port ${port}`);
console.log(`Manifest: http://localhost:${port}/manifest.json`);
