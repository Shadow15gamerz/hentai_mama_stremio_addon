// Shadzop scraper
// Made by Shadzop
// SITE_URL is your site address (set it on Render under Environment).

const axios = require('axios');
const cheerio = require('cheerio');

const SITE_URL = 'https://hentaimama.io/'
const SHOW_PATH = '/tvshows/';

const http = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Shadzop Anime Addon',
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

async function getHtml(url) {
  const res = await http.get(url);
  return res.data.toString();
}

function load(html) {
  return cheerio.load(html);
}

function absolute(href, base) {
  if (!href) return null;
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function slugToName(url) {
  let last = '';
  try {
    last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    last = '';
  }
  return cleanText(last.replace(/[-_]+/g, ' ')).replace(/\b\w/g, (c) => c.toUpperCase());
}

// Finds the picture inside a link, including lazy-loaded images
function imageFrom($root, base) {
  const img = $root.find('img').first();
  const raw =
    img.attr('data-src') ||
    img.attr('data-lazy-src') ||
    img.attr('src') ||
    (img.attr('srcset') || '').split(' ')[0];
  return absolute(raw, base);
}

function episodeNumber(url, text, fallback) {
  const m =
    url.match(/episode[-_]?(\d+)/i) ||
    text.match(/episode\s*(\d+)/i) ||
    text.match(/^(\d+)$/) ||
    url.match(/(\d+)\/?$/);
  return m ? parseInt(m[1], 10) : fallback;
}

// Returns [{ id, name, poster, url }] for every show on the list page
async function getAnimeList() {
  if (!SITE_URL) return [];
  const $ = load(await getHtml(SITE_URL));
  const siteOrigin = new URL(SITE_URL).origin;
  const shows = new Map();

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const url = absolute($a.attr('href'), SITE_URL);
    if (!url) return;
    const u = new URL(url);
    if (u.origin !== siteOrigin) return;
    if (!u.pathname.startsWith(SHOW_PATH)) return;
    if (u.pathname === SHOW_PATH || u.pathname.includes('/page/')) return;

    const name =
      cleanText($a.text()) ||
      cleanText($a.attr('title')) ||
      cleanText($a.find('img').attr('alt')) ||
      slugToName(url);
    const poster = imageFrom($a, SITE_URL);

    if (!shows.has(url)) {
      shows.set(url, { url, name, poster });
    } else {
      const s = shows.get(url);
      s.poster = s.poster || poster;
      if (s.name === slugToName(url) && name !== s.name) s.name = name;
    }
  });

  return [...shows.values()].map((s) => ({
    id: 'shadzop:' + Buffer.from(s.url).toString('base64url'),
    name: s.name,
    poster: s.poster,
    url: s.url
  }));
}

// Returns { name, description, poster, episodes: [{ season, number, title, url }] }
async function getAnimeDetails(animeUrl) {
  const $ = load(await getHtml(animeUrl));
  const origin = new URL(animeUrl).origin;
  const found = new Map();

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const url = absolute($a.attr('href'), animeUrl);
    if (!url || url === animeUrl) return;
    if (new URL(url).origin !== origin) return;

    const text = cleanText($a.text());
    const looksLikeEpisode =
      /episode/i.test(url) || /episode\s*\d+/i.test(text) || /^\d+$/.test(text);
    if (!looksLikeEpisode || found.has(url)) return;

    const number = episodeNumber(url, text, found.size + 1);
    found.set(url, { url, title: text || `Episode ${number}`, number });
  });

  const episodes = [...found.values()]
    .sort((a, b) => a.number - b.number)
    .map((e) => ({ season: 1, number: e.number, title: e.title, url: e.url }));

  const name =
    cleanText($('h1').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content')) ||
    cleanText($('title').text()) ||
    slugToName(animeUrl);

  const description = cleanText(
    $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content')
  );

  const poster =
    absolute($('meta[property="og:image"]').attr('content'), animeUrl) ||
    imageFrom($('body'), animeUrl);

  return { name, description, poster, episodes };
}

// Returns a direct playable video link for one episode page, or null
async function getEpisodeStream(episodeUrl) {
  // Turn "https:\/\/site\/video.mp4" into "https://site/video.mp4"
  const html = (await getHtml(episodeUrl)).replace(/\\\//g, '/');

  // Look for a real .mp4 or .m3u8 address anywhere in the page code
  const direct = html.match(
    /https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m3u8)(?:\?[^\s"'<>\\]*)?(?=[\s"'<>\\]|$)/i
  );
  if (direct) return { url: direct[0], title: 'Shadzop' };

  return null;
}

module.exports = { getAnimeList, getAnimeDetails, getEpisodeStream };
