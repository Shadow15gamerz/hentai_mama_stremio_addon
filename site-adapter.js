// ============================================================
// SITE ADAPTER
// Stremio ids look like:  shadzop:<animeSlug>            (show)
//                         shadzop:<animeSlug>:<ep>       (episode)
// ============================================================

const SITE_URL = process.env.SITE_URL || "https://hentaimama.io";

// Shows come from catalog.json
const SAMPLE = require("./catalog.json");

// Browse or search the anime list
async function getCatalog({ search, skip }) {
  let items = SAMPLE;
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(a => a.name.toLowerCase().includes(q));
  }
  return items.slice(skip, skip + 50).map(a => ({
    id: `shadzop:${a.slug}`,
    type: "hanime",
    name: a.name,
    poster: a.poster,
    description: a.description
  }));
}

// Details + episode list for one anime
async function getMeta(id) {
  const slug = id.split(":")[1];
  const a = SAMPLE.find(x => x.slug === slug);
  if (!a) return null;

  return {
    id,
    type: "hanime",
    name: a.name,
    poster: a.poster,
    description: a.description,
    videos: a.episodes.map(e => ({
      id: `shadzop:${a.slug}:${e.number}`,
      title: e.title,
      season: 1,
      episode: e.number,
      released: new Date(2020, 0, e.number).toISOString()
    }))
  };
}

// Playable links for one episode (the "Play" options with qualities)
async function getStreams(id) {
  const [, slug, ep] = id.split(":");
  const a = SAMPLE.find(x => x.slug === slug);
  if (!a) return [];

  const e = a.episodes.find(x => String(x.number) === String(ep));
  if (!e || !e.qualities) return [];

  // Map each quality entry (1080p, 720p, 420p) to a Stremio stream object
  return Object.entries(e.qualities).map(([quality, streamUrl]) => ({
    name: "Shadzop",
    title: `${quality} - Direct MP4`,
    url: streamUrl,
    behaviorHints: {
      notWebReady: false,
      proxyHeaders: {
        request: {
          "Referer": SITE_URL,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }
    }
  }));
}

module.exports = { getCatalog, getMeta, getStreams, SITE_URL };
