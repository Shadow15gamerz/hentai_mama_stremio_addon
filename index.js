const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE = 'https://hentaimama.io';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const manifest = {
  id: 'com.shadzop.anime',
  version: '26.10.15',
  name: 'Shadzop H_Anime',
  description:
    'Watch your favourite H_Anime for Free in full HD.<br>Follow for more crazy content:<br><a href="https://youtube.com/@shadzop" target="_blank">YT</a> | <a href="https://youtube.com/@shadzop2" target="_blank">YT✌️</a>',
  logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1NV-WZmNsulKAR_2gdf0gzfygyNRlW9SL9tgbcLulhASgBbtBnEfpJZs&s=10',
  background:
    'https://hentaimama.io/wp-content/themes/dooplay/assets/img/large-logo.png',
  resources: ['catalog', 'meta', 'stream'],
  types: ['series', 'movie'],
  catalogs: [
    {
      type: 'series',
      id: 'h-anime-all',
      name: 'H_Anime All',
      extra: [{ name: 'skip' }]
    },
    {
      type: 'series',
      id: 'h-anime-uncensored',
      name: 'H_Anime Uncensored',
      extra: [{ name: 'skip' }]
    },
    {
      type: 'series',
      id: 'h-anime-search',
      name: 'H_Anime Search',
      extra: [{ name: 'search', isRequired: true }]
    }
  ],
  idPrefixes: ['hentaimama'],
  behaviorHints: {
    adult: true,
    configurable: false
  }
};

const builder = new addonBuilder(manifest);

const headers = (referer) => ({
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  ...(referer ? { Referer: referer } : {})
});

async function getHtml(url, referer) {
  const res = await fetch(url, { headers: headers(referer), timeout: 20000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function slugFromUrl(url) {
  const m = (url || '').match(/\/tvshows\/([^/]+)\/?/);
  return m ? m[1] : null;
}

function parseSearchOrList(html) {
  const $ = cheerio.load(html);
  const metas = [];

  $('article.series-card, div.result-item article, article').each((_, el) => {
    const $el = $(el);
    const a = $el.find('h3.sc-title a, div.title a, a.sc-poster, a').first();
    const href = a.attr('href') || '';
    if (!href.includes('/tvshows/')) return;

    const slug = slugFromUrl(href);
    if (!slug) return;

    const name =
      $el.find('h3.sc-title a, div.title a, h3 a').first().text().trim() ||
      a.attr('title') ||
      slug.replace(/-/g, ' ');

    const img = $el.find('img').first();
    const poster =
      img.attr('data-src') || img.attr('src') || img.attr('data-lazy-src') || null;

    if (metas.some((m) => m.id === `hentaimama:${slug}`)) return;

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

  const name =
    $('h1.dsc-title, h1').first().text().trim() || slug.replace(/-/g, ' ');
  const posterMeta = $('meta[property="og:image"]').attr('content');
  const poster = posterMeta || $('img').first().attr('src') || null;

  let description = '';
  const descEl = $('.wp-content p, .sbox p, .dsc-content p, p').first();
  if (descEl.length) description = descEl.text().trim();

  const episodeMap = new Map();
  $('a[href*="/episodes/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/\/episodes\/([^/]+)-episode-(\d+)\/?/);
    if (!m) return;
    const epNum = parseInt(m[2], 10);
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

  const videos = Array.from(episodeMap.values()).sort(
    (a, b) => a.episode - b.episode
  );

  if (videos.length === 0) {
    videos.push({
      id: `hentaimama:${slug}:1`,
      title: 'Episode 1',
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

/** Extract JWPlayer-style sources from embed HTML */
function extractSourcesFromEmbed(html) {
  const results = [];
  const seen = new Set();

  // Preferred: objects with explicit label (1080p / 720p / 480p)
  const labeled = /\{\s*"file"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"([^"]+)"/gi;
  let m;
  while ((m = labeled.exec(html))) {
    const file = m[1].replace(/\\\//g, '/');
    if (!file.includes('.mp4') && !file.includes('.m3u8')) continue;
    if (file.includes('thumbnail') || file.includes('.vtt')) continue;
    if (seen.has(file)) continue;
    seen.add(file);
    results.push({
      url: file,
      quality: m[2] || guessQuality(file) || 'HD',
      type: file.includes('.m3u8') ? 'hls' : 'mp4'
    });
  }

  // label before file
  if (results.length === 0) {
    const labeled2 = /\{\s*"label"\s*:\s*"([^"]+)"\s*,\s*"file"\s*:\s*"([^"]+)"/gi;
    while ((m = labeled2.exec(html))) {
      const file = m[2].replace(/\\\//g, '/');
      if (!file.includes('.mp4') && !file.includes('.m3u8')) continue;
      if (file.includes('thumbnail') || file.includes('.vtt')) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      results.push({
        url: file,
        quality: m[1] || guessQuality(file) || 'HD',
        type: file.includes('.m3u8') ? 'hls' : 'mp4'
      });
    }
  }

  // Any file: "url" (mp4 / m3u8)
  if (results.length === 0) {
    const fileRe = /["']file["']\s*:\s*["']([^"']+)["']/gi;
    while ((m = fileRe.exec(html))) {
      const file = m[1].replace(/\\\//g, '/');
      if (!file.includes('.mp4') && !file.includes('.m3u8')) continue;
      if (file.includes('thumbnail') || file.includes('.vtt')) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      results.push({
        url: file,
        quality: guessQuality(file) || 'HD',
        type: file.includes('.m3u8') ? 'hls' : 'mp4'
      });
    }
  }

  return results;
}

function guessQuality(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('1080')) return '1080p';
  if (u.includes('720')) return '720p';
  if (u.includes('480')) return '480p';
  if (u.includes('360')) return '360p';
  if (u.includes('master.m3u8') || u.includes('/hls/')) return 'HLS Auto';
  return null;
}

function qualityRank(q) {
  const s = String(q || '').toLowerCase();
  if (s.includes('1080')) return 1080;
  if (s.includes('720')) return 720;
  if (s.includes('480')) return 480;
  if (s.includes('360')) return 360;
  if (s.includes('hls')) return 900;
  return 500;
}

async function getPlayerId(episodeHtml) {
  // Prefer JS: a: '7360' next to get_player_contents
  const m1 = episodeHtml.match(
    /get_player_contents['"]?\s*,\s*a:\s*['"]?(\d+)/
  );
  if (m1) return m1[1];

  const m2 = episodeHtml.match(/a:\s*['"](\d+)['"]\s*,\s*i:/);
  if (m2) return m2[1];

  const m3 = episodeHtml.match(/name=["']idpost["']\s+value=["'](\d+)["']/);
  if (m3) return m3[1];

  const m4 = episodeHtml.match(/value=["'](\d+)["']\s+name=["']idpost["']/);
  if (m4) return m4[1];

  const m5 = episodeHtml.match(/a:\s*['"]?(\d+)/);
  if (m5) return m5[1];

  return null;
}

async function fetchAjaxPlayers(postId, episodeUrl) {
  const res = await fetch(`${BASE}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    headers: {
      ...headers(episodeUrl),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `action=get_player_contents&a=${encodeURIComponent(postId)}`,
    timeout: 20000
  });
  if (!res.ok) throw new Error(`AJAX HTTP ${res.status}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const embeds = [];
  for (const html of data) {
    const srcMatch = String(html).match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    // decode &#038; etc
    const src = srcMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&#038;/g, '&')
      .replace(/\\\//g, '/');
    embeds.push(src);
  }
  return embeds;
}

/**
 * Prefer multi-quality mp4 embeds, then other mirrors.
 * Order: hls-mp4, r2-mp4, hls, newjav, rtmp
 */
function rankEmbed(url) {
  const u = url.toLowerCase();
  if (u.includes('hls-mp4')) return 0;
  if (u.includes('r2-mp4')) return 1;
  if (u.includes('dt_embed=hls') && !u.includes('mp4')) return 2;
  if (u.includes('newjav')) return 3;
  if (u.includes('rtmp')) return 4;
  return 5;
}

async function resolveStreamsForEpisode(slug, epNum) {
  const episodeUrl = `${BASE}/episodes/${slug}-episode-${epNum}/`;
  const episodeHtml = await getHtml(episodeUrl);
  const postId = await getPlayerId(episodeHtml);
  if (!postId) {
    console.error('No post id for', episodeUrl);
    return [];
  }

  const embeds = await fetchAjaxPlayers(postId, episodeUrl);
  embeds.sort((a, b) => rankEmbed(a) - rankEmbed(b));

  const allSources = [];
  const seenUrls = new Set();

  for (const embedUrl of embeds) {
    try {
      const embedHtml = await getHtml(embedUrl, episodeUrl);
      const sources = extractSourcesFromEmbed(embedHtml);
      for (const s of sources) {
        if (seenUrls.has(s.url)) continue;
        seenUrls.add(s.url);
        allSources.push(s);
      }
      // If we already have multiple qualities from hls-mp4, stop early
      const hasMulti =
        allSources.filter((s) => /1080|720|480/.test(String(s.quality))).length >=
        2;
      if (hasMulti) break;
    } catch (err) {
      console.error('Embed fetch failed', embedUrl, err.message);
    }
  }

  // Sort: highest quality first, mp4 preferred over pure hls when same rank
  allSources.sort((a, b) => {
    const qr = qualityRank(b.quality) - qualityRank(a.quality);
    if (qr !== 0) return qr;
    if (a.type === 'mp4' && b.type !== 'mp4') return -1;
    if (b.type === 'mp4' && a.type !== 'mp4') return 1;
    return 0;
  });

  return allSources.map((s) => {
    const isHls = s.type === 'hls' || s.url.includes('.m3u8');
    return {
      name: `HentaiMama ${s.quality}`,
      title: s.quality,
      description: `${s.quality} • ${isHls ? 'HLS' : 'MP4'}`,
      url: s.url,
      behaviorHints: {
        bingeGroup: `hentaimama-${slug}-${s.quality}`,
        // some CDNs need notWebReady for non-mp4 or special headers
        ...(isHls ? { notWebReady: true } : {})
      }
    };
  });
}

// ---------- Catalog ----------
// Site lists ~24 series per listing page
const PAGE_SIZE = 24;

function listingUrl(basePath, page) {
  if (page <= 1) return `${BASE}${basePath}`;
  return `${BASE}${basePath}page/${page}/`;
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  try {
    const skip = parseInt(extra?.skip || '0', 10) || 0;
    const page = Math.floor(skip / PAGE_SIZE) + 1;

    // All series (includes uncensored + everything else)
    if (id === 'h-anime-all') {
      const html = await getHtml(listingUrl('/tvshows/', page));
      return { metas: parseSearchOrList(html) };
    }

    // Uncensored only
    if (id === 'h-anime-uncensored') {
      const html = await getHtml(listingUrl('/genre/uncensored/', page));
      return { metas: parseSearchOrList(html) };
    }

    if (id === 'h-anime-search' && extra && extra.search) {
      const q = encodeURIComponent(extra.search.trim());
      const html = await getHtml(`${BASE}/?s=${q}`);
      return { metas: parseSearchOrList(html) };
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
    return { meta: parseSeriesPage(html, slug) };
  } catch (err) {
    console.error('Meta error:', err.message);
    return { meta: null };
  }
});

// ---------- Stream (direct in-app URLs, multi quality) ----------
builder.defineStreamHandler(async ({ type, id }) => {
  try {
    if (!id.startsWith('hentaimama:')) return { streams: [] };

    const parts = id.replace('hentaimama:', '').split(':');
    const slug = parts[0];
    const epNum = parts[1] ? parseInt(parts[1], 10) : 1;
    if (!slug || isNaN(epNum)) return { streams: [] };

    const streams = await resolveStreamsForEpisode(slug, epNum);
    return { streams };
  } catch (err) {
    console.error('Stream error:', err.message);
    return { streams: [] };
  }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
console.log(`HentaiMama addon running on port ${port}`);
console.log(`Manifest: http://localhost:${port}/manifest.json`);
