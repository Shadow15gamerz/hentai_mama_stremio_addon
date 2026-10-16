// Shadzop scraper
// Reads anime from your site so you only need to give the site link once.
// Set SITE_URL in your environment (or .env) to your site's address.

const axios = require('axios');
const cheerio = require('cheerio');

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

const http = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Shadzop Anime Addon)',
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

async function getHtml(url) {
  const res = await http.get(url);
  return cheerio.load(res.data);
}

// Returns [{ id, name, poster, url }] for the anime shown on the site's home/listing page.
// TODO: replace the selectors below with the ones matching your site's HTML.
async function getAnimeList() {
  if (!SITE_URL) return [];
  const $ = await getHtml(SITE_URL);
  const items = [];
  $('a[href]').each((_, el) => {
    // Placeholder selector. Update once we see the site.
    const href = $(el).attr('href');
    const name = $(el).text().trim();
    if (!href || !name) return;
    items.push({
      id: 'shadzop:' + Buffer.from(href).toString('base64url'),
      name,
      poster: $(el).find('img').attr('src') || null,
      url: new URL(href, SITE_URL).toString()
    });
  });
  return items;
}

// Returns { name, description, poster, episodes: [{ season, number, title, url }] }
// TODO: update selectors for the site's anime page.
async function getAnimeDetails(animeUrl) {
  const $ = await getHtml(animeUrl);
  const episodes = [];
  $('a[href]').each((_, el) => {
    // Placeholder selector. Update once we see the site.
    const href = $(el).attr('href');
    if (!href || !/episode/i.test(href)) return;
    const number = episodes.length + 1;
    episodes.push({
      season: 1,
      number,
      title: $(el).text().trim() || `Episode ${number}`,
      url: new URL(href, animeUrl).toString()
    });
  });
  return {
    name: $('h1').first().text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
    poster: $('img').first().attr('src') || null,
    episodes
  };
}

// Returns a playable video URL for one episode page.
// TODO: update to match how the site exposes its video (direct link, iframe, API).
async function getEpisodeStream(episodeUrl) {
  const $ = await getHtml(episodeUrl);
  const src =
    $('video source').attr('src') ||
    $('video').attr('src') ||
    $('iframe').attr('src');
  if (!src) return null;
  return { url: new URL(src, episodeUrl).toString(), title: 'Shadzop' };
}

module.exports = { getAnimeList, getAnimeDetails, getEpisodeStream };
