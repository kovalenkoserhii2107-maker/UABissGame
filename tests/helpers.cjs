const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function game(seed = 1) {
  const storage = new Map(),
    notifications = [];
  const context = vm.createContext({
    console: {
      ...console,
      error: (...args) => notifications.push({ type: "console-error", args }),
    },
    setTimeout,
    clearTimeout,
    URL,
    Blob,
    confirm: () => true,
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    window: { addEventListener() {} },
    document: {
      getElementById() {
        return null;
      },
    },
    NOTIFY: Object.fromEntries(
      ["info", "error", "success", "warning"].map((k) => [
        k,
        (...args) => notifications.push({ type: k, args }),
      ]),
    ),
    UI_DASHBOARD: { update() {}, updateTopPanel() {}, closeStoreModal() {} },
    TUTORIAL: { init() {} },
    ACCESSIBILITY: { init() {} },
  });
  const files = [
    ...fs
      .readFileSync(path.join(root, "index.html"), "utf8")
      .matchAll(/<script src="([^"]+)"/g),
  ]
    .map((m) => m[1])
    .filter(
      (f) =>
        f.startsWith("js/") &&
        !f.startsWith("js/ui/") &&
        !f.startsWith("js/vendor/"),
    );
  for (const file of files)
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, {
      filename: file,
    });
  const run = (source) => vm.runInContext(source, context);
  run(
    `let randomSeed = ${seed}; Math.random = () => ((randomSeed = (Math.imul(1664525, randomSeed) + 1013904223) >>> 0) / 4294967296); GAME.prepare();`,
  );
  const api = run(
    "({ STATE, GAME, OPERATIONS, LEDGER, PERSISTENCE, MARKET, WAREHOUSE, FINANCE, HR, RND, RETAIL, STOCK_MARKET, PRODUCTION, CONTRACTS, TAXES, B2B_AI, GEO, RECIPES, QUESTS, LOGISTICS, EVENTS })",
  );
  api.UI_DASHBOARD = context.UI_DASHBOARD;
  context.UI_DASHBOARD.update = () => {
    if (!api.GAME.processing) api.QUESTS.checkProgress();
    api.PERSISTENCE.save();
  };
  return { ...api, run, storage, notifications };
}
function business(g, type = "retail_store", city = "odesa") {
  g.PRODUCTION.buyBusiness(type, city);
  return g.STATE.company.businesses.at(-1);
}
function stock(
  g,
  item = "bakery",
  qty = 100,
  cost = 5,
  city = "odesa",
  quality = 1,
  brand = 0,
) {
  const wh = g.STATE.company.warehouses[city];
  wh.level ||= 1;
  wh.capitalCost ??= 0;
  g.OPERATIONS.add(wh.inventory, item, qty, qty * cost, quality, brand);
}
module.exports = { game, business, stock };
