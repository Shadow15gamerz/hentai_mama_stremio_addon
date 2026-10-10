const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const manifest = {
  id: "com.customanime.player",
  version: "1.0.0",
  name: "Custom Anime Direct Stream",
  description: "Streams directly in Stremio",
  resources: ["stream"],
  types: ["series", "movie"],
  idPrefixes: ["kitsu", "tt"]
};

const builder = new addonBuilder(manifest);

const MY_SITE_URL = "https://hentaimama.io";

builder.defineStreamHandler(async ({ type, id }) => {
  try {
    const parts = id.split(":");
    const animeId = parts[1];
    const episode = parts[2] || 1;

    const targetUrl = `${MY_SITE_URL}/watch/${animeId}?ep=${episode}`;
    const pageResponse = await axios.get(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(pageResponse.data);

    let videoSource = $("video source").attr("src") \vert{}\vert{} $("video").attr("src");

    if (!videoSource) {
      return { streams: [] };
    }

    if (videoSource.startsWith("/")) {
      videoSource = `${MY_SITE_URL}${videoSource}`;
    }

    return {
      streams: [
        {
          name: "Direct Stream",
          title: "In-App Player",
          url: videoSource
        }
      ]
    };
  } catch (err) {
    return { streams: [] };
  }
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });
