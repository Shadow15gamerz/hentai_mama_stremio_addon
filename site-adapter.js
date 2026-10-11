// ============================================================
// SITE ADAPTER - the ONLY file that depends on your website.
// Replace the sample data + TODOs once you send the site link.
// Stremio ids look like:  shadzop:<animeSlug>            (show)
//                         shadzop:<animeSlug>:<ep>       (episode)
// ============================================================

const SITE_URL = process.env.SITE_URL || "https://your-site.example";

// Sample data so the addon runs end-to-end before the scraper is wired up
const SAMPLE = [
  {
    slug: "sample-anime",
    name: "Sample Anime",
    poster: "https://placehold.co/300x450?text=Sample",
    description: "Placeholder entry. Replace with real site data.",
    episodes: [
      { number: 1, title: "Episode 1", url: "https://example.com/video1.mp4" },
      { number: 2, title: "Episode 2", url: "https://example.com/video2.mp4" }
    ]
  }
];

// Browse or search the anime list
async function getCatalog({ search, skip }) {
  // TODO: fetch the site's listing/search page and parse it
  let items = SAMPLE;
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(a => a.name.toLowerCase().includes(q));
  }
  return items.slice(skip, skip + 50).map(a => ({
    id: `shadzop:${a.slug}`,
    type: "series",
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
  // TODO: fetch the anime's page on the site for real details and episodes
  return {
    id,
    type: "series",
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

// Playable links for one episode (the "Play" options)
async function getStreams(id) {
  const [, slug, ep] = id.split(":");
  const a = SAMPLE.find(x => x.slug === slug);
  if (!a) return [];
  const e = a.episodes.find(x => String(x.number) === ep);
  if (!e) return [];
  // TODO: resolve the real direct video URL (.mp4 or .m3u8) from the site's episode page
  return [
    {
      title: "Shadzop",
      url: e.url,
      behaviorHints: {
        notWebReady: true // plays in the Stremio/Nuvio app only, not in the web player
        // If the site needs a Referer/User-Agent to serve the video, add:
        // proxyHeaders: { request: { Referer: SITE_URL, "User-Agent": "Mozilla/5.0" } }
      }
    }
  ];
}

module.exports = { getCatalog, getMeta, getStreams, SITE_URL };
