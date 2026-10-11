// ============================================================
// SITE ADAPTER - the ONLY file that depends on your website.
// Replace the sample data + TODOs once you send the site link.
// Stremio ids look like:  shadzop:<animeSlug>            (show)
//                         shadzop:<animeSlug>:<ep>       (episode)
// ============================================================

const SITE_URL = process.env.SITE_URL || "https://hentaimama.io";

// Sample data so the addon runs end-to-end before the scraper is wired up
const SAMPLE = [
  {
    slug: "secret-mission---udercover-agents-never-back-down",
    name: "Secret Mission – Undercover Agents Never Back Down!",
    poster: "https://hentaimama.io/tvshows/secret-mission-undercover-agents-never-back-down/",
    description: "Two undercover officers are posing as a married couple to surveil a drug manufacturing operation.When the neighbors grow suspicious of their lack of intimacy, they stage increasingly explicit sexual sounds to maintain their cover. The fake performance blurs into real physical contact, forcing the female officer to wrestle with humiliation and unwanted arousal. Their act successfully convinces the criminals, but leaves her shaken as she insists it was all just part of the job.",
    episodes: [
      { number: 1, title: "Episode 1", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-1/" },
      { number: 2, title: "Episode 2", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-2/" },
      { number: 3, title: "Episode 3", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-3/" },
      { number: 4, title: "Episode 4", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-4/" },
      { number: 5, title: "Episode 5", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-5/" },
      { number: 6, title: "Episode 6", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-6/" },
      { number: 7, title: "Episode 7", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-7/" },
      { number: 8, title: "Episode 8", url: "https://hentaimama.io/episodes/secret-mission-undercover-agents-never-back-down-episode-8/" }
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
