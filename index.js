const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const site = require("./site-adapter");

const PORT = process.env.PORT || 7000;

const manifest = {
  id: "com.shadzop.anime",
  version: "26.10.2",
  name: "Shadzop *H* Anime",
  description: "Browse, search and play anime from the Shadzop site",
  logo: "https://www.google.com/search?q=alya+square&client=lightning&sca_esv=835a53314b04c64e&udm=2&biw=392&bih=646&sxsrf=APpeQnsCO6VCRVQaDoeLcorxEL3Jgp-igw%3A1792149137762&ei=kQbSavX9LdDH4-EP9PyQ4Qc&oq=alya+square&gs_lp=EhJtb2JpbGUtZ3dzLXdpei1pbWciC2FseWEgc3F1YXJlMgYQABgIGB4yCBAAGIAEGKIEMggQABiABBiiBDIIEAAYgAQYogQyCBAAGIAEGKIESIIkUJAFWNIicAF4AJABAJgBkwKgAYMUqgEFMC41Lje4AQPIAQD4AQGYAgagAqcIwgICECnCAg0QLhiABBiKBRhDGLEDwgINEAAYgAQYigUYQxixA8ICBRAuGIAEwgIIEC4YgAQYsQPCAgUQABiABJgDAIgGAZIHBTEuMi4zoAfGJLIHBTAuMi4zuAedCMIHBzItMi4yLjLIB0iACAE&sclient=mobile-gws-wiz-img"
  resources: ["catalog", "meta", "stream"],
  types: ["series"],
  idPrefixes: ["shadzop"],
  catalogs: [
    {
      type: "series",
      id: "shadzop-anime",
      name: "Shadzop Anime",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    }
  ]
};

const builder = new addonBuilder(manifest);

// Catalog: browse list, or search when the user types in Stremio/Nuvio
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (type !== "series" || id !== "shadzop-anime") return { metas: [] };
  const metas = await site.getCatalog({
    search: extra && extra.search,
    skip: Number((extra && extra.skip) || 0)
  });
  return { metas };
});

// Meta: details + episode list for one anime
builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== "series") return { meta: null };
  const meta = await site.getMeta(id);
  return { meta };
});

// Stream: direct playable links for one episode
builder.defineStreamHandler(async ({ type, id }) => {
  if (type !== "series") return { streams: [] };
  const streams = await site.getStreams(id);
  return { streams };
});

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Shadzop Anime addon running on http://localhost:${PORT}/manifest.json`);
