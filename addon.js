const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "com.myanime.addon",
  version: "1.0.0",
  name: "My Anime Streams",
  description: "Streams anime directly to Android",
  resources: ["stream"],
  types: ["series", "movie"],
  idPrefixes: ["kitsu", "tt"]
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  // Your scraping code goes here to find video URLs
  const videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  return {
    streams: [
      {
        name: "My Site",
        title: "1080p Stream",
        url: videoUrl
      }
    ]
  };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
