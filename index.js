const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const site = require("./site-adapter");

const PORT = process.env.PORT || 7000;

const manifest = {
  id: "com.shadzop.anime",
  version: "26.10.12",
  name: "Shadzop H_Anime",
  description: "Watch your favourite H_Anime for Free in full HD.<br>Follow for more crazy content:<br><a href=\"https://youtube.com/@shadzop\" target=\"_blank\">YT</a> | <a href=\"https://youtube.com/@shadzop2\" target=\"_blank\">YT✌️</a>",
  logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1NV-WZmNsulKAR_2gdf0gzfygyNRlW9SL9tgbcLulhASgBbtBnEfpJZs&s=10",
  resources: [
    "catalog",
    { "name": "meta", "types": ["hanime"], "idPrefixes": ["shadzop"] },
    { "name": "stream", "types": ["hanime"], "idPrefixes": ["shadzop"] }
  ],
  types: ["hanime"],
  idPrefixes: ["shadzop"],
  catalogs: [
    {
      type: "hanime",
      id: "shadzop-h-anime",
      name: "Shadzop H_Anime",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    }
  ]
};

const builder = new addonBuilder(manifest);

// Catalog: browse list, or search
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (type !== "hanime" || id !== "shadzop-h-anime") return { metas: [] };
  const metas = await site.getCatalog({
    search: extra && extra.search,
    skip: Number((extra && extra.skip) || 0)
  });
  return { metas };
});

// Meta: details + episode list
builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== "hanime") return { meta: null };
  const meta = await site.getMeta(id);
  return { meta };
});

// Stream: direct playable links
builder.defineStreamHandler(async ({ type, id }) => {
  if (type !== "hanime") return { streams: [] };
  const streams = await site.getStreams(id);
  return { streams };
});

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Shadzop Anime addon running on http://localhost:${PORT}/manifest.json`);
