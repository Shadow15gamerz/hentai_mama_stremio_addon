const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

// 1. Tell Stremio what your addon handles
const manifest = {
  id: "com.customanime.player",
  version: "1.0.0",
  name: "Custom Anime Direct Stream",
  description: "Streams directly in Stremio",
  resources: ["stream"],
  types: ["series", "movie"],
  idPrefixes: ["kitsu", "tt"] // Matches Nuvio and standard catalogs
};

const builder = new addonBuilder(manifest);

// Change this to your website URL
const BASE_URL = "https://hentaimama.io";

// 2. Handle Stream requests
builder.defineStreamHandler(async ({ type, id }) => {
  try {
    // Stremio sends IDs like "kitsu:1234:2" (Show ID: 1234, Episode: 2)
    const parts = id.split(":");
    const animeId = parts[1];
    const episode = parts[2] || 1;

    // Fetch the target webpage
    const targetUrl = `${BASE_URL}/watch/${animeId}?ep=${episode}`;
    const pageResponse = await axios.get(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    const $ = cheerio.load(pageResponse.data);

    // Grab direct media sources (.m3u8 or .mp4)
    let videoSource = $("video source").attr("src") \vert{}\vert{} $("video").attr("src");

    // Fallback placeholder if no direct source is located
    if (!videoSource) {
      videoSource = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    } else if (videoSource.startsWith("/")) {
      videoSource = `${BASE_URL}${videoSource}`;
    }

    // 3. Return directly to the Stremio player
    return {
      streams: [
        {
          name: "Direct Stream",
          title: "In-App Player",
          url: videoSource // Using 'url' plays it directly in Stremio
        }
      ]
    };
  } catch (err) {
    return { streams: [] };
  }
});

// Run server on the assigned port
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
