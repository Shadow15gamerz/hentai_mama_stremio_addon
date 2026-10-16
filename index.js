// Shadzop Anime Addon for Stremio and Nuvio
// Made by Shadzop

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { getAnimeList, getAnimeDetails, getEpisodeStream } = require('./scraper');

const PORT = process.env.PORT || 7000;

const manifest = {
  id: 'com.shadzop.anime',
  version: '1.0.0',
  name: 'Shadzop Anime',
  description: 'Anime from the Shadzop site. Made by Shadzop.',
  logo: 'https://via.placeholder.com/256x256.png?text=Shadzop',
  resources: ['catalog', 'meta', 'stream'],
  types: ['anime', 'series'],
  idPrefixes: ['shadzop:'],
  catalogs: [
    {
      type: 'anime',
      id: 'shadzop-anime',
      name: 'Shadzop Anime',
      extra: [{ name: 'search', isRequired: false }]
    }
  ]
};

const builder = new addonBuilder(manifest);

// Catalog and search
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (type !== 'anime' || id !== 'shadzop-anime') return { metas: [] };
  try {
    let list = await getAnimeList();
    const query = extra && extra.search ? extra.search.toLowerCase() : null;
    if (query) list = list.filter((a) => a.name.toLowerCase().includes(query));
    const metas = list.map((a) => ({
      id: a.id,
      type: 'anime',
      name: a.name,
      poster: a.poster
    }));
    return { metas };
  } catch (err) {
    console.error('Catalog error:', err.message);
    return { metas: [] };
  }
});

// Details and episode list
builder.defineMetaHandler(async ({ type, id }) => {
  if (!id.startsWith('shadzop:')) return { meta: null };
  try {
    const url = Buffer.from(id.slice('shadzop:'.length), 'base64url').toString();
    const details = await getAnimeDetails(url);
    return {
      meta: {
        id,
        type: 'anime',
        name: details.name,
        poster: details.poster,
        description: details.description,
        videos: details.episodes.map((ep) => ({
          id: `${id}:${ep.season}:${ep.number}`,
          title: ep.title,
          season: ep.season,
          episode: ep.number,
          released: new Date(0).toISOString()
        }))
      }
    };
  } catch (err) {
    console.error('Meta error:', err.message);
    return { meta: null };
  }
});

// Play links for each episode
builder.defineStreamHandler(async ({ type, id }) => {
  // Episode ids look like: shadzop:<encoded>:<season>:<episode>
  const parts = id.split(':');
  if (parts[0] !== 'shadzop' || parts.length < 4) return { streams: [] };
  try {
    const animeUrl = Buffer.from(parts[1], 'base64url').toString();
    const season = parts[2];
    const number = parts[3];
    const details = await getAnimeDetails(animeUrl);
    const ep = details.episodes.find(
      (e) => String(e.season) === season && String(e.number) === number
    );
    if (!ep) return { streams: [] };
    const stream = await getEpisodeStream(ep.url);
    if (!stream) return { streams: [] };
    return {
      streams: [{ title: `Shadzop - ${ep.title}`, url: stream.url }]
    };
  } catch (err) {
    console.error('Stream error:', err.message);
    return { streams: [] };
  }
});

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Shadzop Anime addon running on port ${PORT}`);
console.log(`Install in Nuvio/Stremio: http://localhost:${PORT}/manifest.json`);
