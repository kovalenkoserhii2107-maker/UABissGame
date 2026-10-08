const test = require("node:test");
const assert = require("node:assert/strict");
const { game, business, stock } = require("./helpers.cjs");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("prepared initial state validates and closes a day", () => {
  const g = game();
  g.PERSISTENCE.validate(g.STATE);
  g.GAME.nextDay();
  assert.equal(g.STATE.time.day, 2);
  g.PERSISTENCE.validate(g.STATE);
});
for (const qty of [NaN, Infinity, -10, 0, 1.5, Number.MAX_SAFE_INTEGER + 1])
  test(`invalid quantity ${qty} leaves inventory and money intact`, () => {
    const g = game(),
      b = business(g);
    stock(g);
    const before = JSON.stringify(g.STATE);
    assert.equal(
      g.OPERATIONS.transferToStore("bakery", "odesa", b.uid, qty),
      0,
    );
    assert.equal(JSON.stringify(g.STATE), before);
    g.MARKET.buy("bakery", qty, "odesa");
    g.MARKET.sell("bakery", qty, "odesa");
    assert.equal(JSON.stringify(g.STATE), before);
  });
test("transfer preserves weighted costs, quality, brand and pays delivery", () => {
  const g = game(),
    b = business(g);
  stock(g, "bakery", 100, 5, "odesa", 2, 3);
  const cash = g.STATE.finances.balance;
  assert.equal(g.OPERATIONS.transferToStore("bakery", "odesa", b.uid, 30), 30);
  const inv = b.localInventory.bakery;
  assert.equal(inv.qty, 30);
  assert.equal(inv.quality, 2);
  assert.equal(inv.brand, 3);
  near(inv.qty * inv.avgCost, 150 + cash - g.STATE.finances.balance);
  assert.equal(g.STATE.company.warehouses.odesa.inventory.bakery.qty, 70);
});
test("autosupply respects shared capacity, delivery costs and available cash", () => {
  const g = game(),
    b = business(g);
  stock(g, "furniture", 1000, 10);
  b.autoSupplyRules = { furniture: 1000 };
  const cash = g.STATE.finances.balance;
  g.WAREHOUSE.processDaily();
  assert.ok(
    g.OPERATIONS.inventoryVolume(b.localInventory) <=
      g.OPERATIONS.storeCapacity(b),
  );
  assert.ok(b.localInventory.furniture.qty > 0);
  assert.ok(
    cash - g.STATE.finances.balance > g.WAREHOUSE.getDailyRent("odesa"),
  );
  const inv = JSON.stringify(b.localInventory);
  g.STATE.finances.balance = 0;
  g.WAREHOUSE.processDaily();
  assert.equal(JSON.stringify(b.localInventory), inv);
});
test("digital inventory consumes zero volume", () => {
  const g = game();
  stock(g, "software", 100000, 0);
  assert.equal(g.WAREHOUSE.getCurrentVolume("odesa"), 0);
});
test("separate warehouse purchases and upgrades conserve net worth", () => {
  const g = game(),
    nw = g.FINANCE.calculateNetWorth();
  g.WAREHOUSE.upgrade("kyiv");
  near(g.FINANCE.calculateNetWorth(), nw);
  g.WAREHOUSE.upgrade("kyiv");
  near(g.FINANCE.calculateNetWorth(), nw);
  assert.equal(g.STATE.company.warehouses.kyiv.capitalCost, 22500);
});
test("deposits, principal, interest and actual cash movements reconcile", () => {
  const g = game();
  g.FINANCE.openDeposit(10000, 30, "end");
  near(g.FINANCE.calculateNetWorth(), 25000);
  g.FINANCE.takeLoan(1000, 30);
  near(g.STATE.ledger.cashFlow.today.financing, 970);
  near(g.FINANCE.calculateNetWorth(), 24970);
  const cf = g.STATE.ledger.cashFlow.today;
  near(cf.closing - cf.opening, cf.operating + cf.investing + cf.financing);
  g.FINANCE.processDailyClearing();
  g.PERSISTENCE.validate(g.STATE);
});
test("wholesale sales recognize once, preserve receivables and settle once", () => {
  const g = game();
  stock(g);
  const before = g.FINANCE.calculateNetWorth(),
    price = g.MARKET.getCurrentPrice("bakery");
  g.MARKET.sell("bakery", 10, "odesa");
  near(g.FINANCE.calculateNetWorth(), before + 10 * (price - 5));
  assert.equal(g.STATE.ledger.total.rev_b2b, 10 * price);
  g.LOGISTICS.processDaily();
  g.LOGISTICS.processDaily();
  assert.equal(g.STATE.ledger.total.rev_b2b, 10 * price);
  assert.equal(g.STATE.logistics.receivables.length, 0);
});
test("cancel order cannot unwind unrelated expense entries", () => {
  const g = game();
  g.WAREHOUSE.upgrade("odesa");
  g.LEDGER.record("exp_logistics", 50);
  g.LEDGER.record("exp_materials", 70);
  const cash = g.STATE.finances.balance;
  g.MARKET.buy("bakery", 10, "odesa");
  g.MARKET.cancelOrder(g.STATE.logistics.deliveries[0].id);
  near(g.STATE.finances.balance, cash);
  assert.equal(g.STATE.ledger.today.exp_logistics, 50);
  assert.equal(g.STATE.ledger.today.exp_materials, 70);
});
test("arrivals are available for autosupply and sales on arrival day", () => {
  const g = game(),
    b = business(g);
  g.HR.hire("store_manager");
  g.HR.hire("salesman");
  g.HR.assignToBusiness(b.uid, "store_manager");
  g.HR.assignToBusiness(b.uid, "salesman");
  b.autoSupplyRules = { bakery: 100 };
  g.MARKET.buy("bakery", 100, "odesa");
  g.GAME.nextDay();
  assert.equal(g.STATE.time.day, 2);
  assert.ok(g.STATE.ledger.yesterday.rev_b2c > 0);
  assert.equal(g.STATE.logistics.deliveries.length, 0);
});
test("factory route persists on shelves across later production calls", () => {
  const g = game(),
    f = business(g, "bakery_fab"),
    s = business(g);
  g.STATE.hr.staff.senior = 2;
  f.assigned.senior = 2;
  f.equipment.count = 1;
  f.routing = { [s.uid]: 30 };
  stock(g, "grain", 1000, 1);
  g.PRODUCTION.processProduction();
  assert.equal(f.stats.lastOutput, 30);
  assert.equal(s.localInventory.bakery.qty, 30);
  f.equipment.count = 0;
  g.PRODUCTION.processProduction();
  assert.equal(s.localInventory.bakery.qty, 30);
});
test("direct route can produce with a full fallback warehouse", () => {
  const g = game(),
    f = business(g, "bakery_fab"),
    s = business(g);
  g.STATE.hr.staff.senior = 2;
  f.assigned.senior = 2;
  f.equipment.count = 1;
  f.routing = { [s.uid]: 30 };
  f.localInventory = { grain: { qty: 100, avgCost: 1, quality: 1 } };
  stock(
    g,
    "wood",
    Math.floor(g.WAREHOUSE.getMaxVolume("odesa") / g.OPERATIONS.volume("wood")),
    1,
  );
  g.PRODUCTION.processProduction();
  assert.equal(f.stats.lastOutput, 30);
  assert.equal(s.localInventory.bakery.qty, 30);
});
test("payroll tax uses salary paid before graduation", () => {
  const g = game();
  g.STATE.hr.trainingQueue = [
    {
      fromGrade: "scientist",
      toGrade: "lead_scientist",
      salary: 150,
      daysLeft: 1,
    },
  ];
  g.GAME.nextDay();
  assert.equal(g.STATE.ledger.yesterday.exp_salary, 150);
  near(g.STATE.ledger.yesterday.exp_taxes_payroll, 33);
  assert.equal(g.STATE.hr.staff.lead_scientist, 1);
});
test("old chapter rewards remain claimable, cannot be claimed twice", () => {
  const g = game();
  g.STATE.quests.completed = g.QUESTS.LIST.filter((q) => q.chapter === 1).map(
    (q) => q.id,
  );
  g.QUESTS.checkProgress();
  assert.equal(g.STATE.quests.currentChapter, 2);
  const cash = g.STATE.finances.balance;
  g.QUESTS.claimReward("q1_capital_goal");
  g.QUESTS.claimReward("q1_capital_goal");
  near(g.STATE.finances.balance, cash + 5000);
});
test("installing a new PC into broken R&D equipment averages condition", () => {
  const g = game();
  g.RND.upgradeFacility();
  g.STATE.rnd.facility.equipment = { count: 1, condition: 0, bookValue: 0 };
  stock(g, "smart_pc", 1, 900);
  g.RND.installEquipment(1);
  assert.equal(g.STATE.rnd.facility.equipment.condition, 50);
  assert.equal(g.STATE.rnd.facility.equipment.bookValue, 900);
});
test("R&D idle equipment does not wear", () => {
  const g = game();
  g.RND.upgradeFacility();
  g.STATE.rnd.facility.equipment.count = 1;
  g.RND.processDaily();
  assert.equal(g.STATE.rnd.facility.equipment.condition, 100);
  assert.equal(g.STATE.rnd.lastRP, 0);
});
test("NPC orders reject inactive or full warehouses", () => {
  const g = game();
  g.STATE.b2bOffers = [
    {
      id: "offer",
      expiresDay: 7,
      itemId: "bakery",
      qty: 10,
      totalPrice: 100,
      quality: 2,
      brandPower: 1,
    },
  ];
  const cash = g.STATE.finances.balance;
  g.B2B_AI.acceptOffer("offer");
  near(g.STATE.finances.balance, cash);
  assert.equal(g.STATE.logistics?.deliveries?.length ?? 0, 0);
  g.WAREHOUSE.upgrade("odesa");
  stock(
    g,
    "wood",
    Math.floor(g.WAREHOUSE.getMaxVolume("odesa") / g.OPERATIONS.volume("wood")),
    1,
  );
  const second = g.STATE.finances.balance;
  g.B2B_AI.acceptOffer("offer");
  near(g.STATE.finances.balance, second);
});
test("NPC offers cannot be regenerated repeatedly or immediately arbitraged", () => {
  const g = game();
  assert.equal(g.B2B_AI.generateOffers(), true);
  const offers = JSON.stringify(g.STATE.b2bOffers);
  assert.equal(g.B2B_AI.generateOffers(), false);
  assert.equal(JSON.stringify(g.STATE.b2bOffers), offers);
  for (const o of g.STATE.b2bOffers)
    assert.ok(
      o.totalPrice >= g.MARKET.getCurrentPrice(o.itemId) * o.quality * o.qty,
    );
});
test("takeover reaches 51% and conserves issued shares", () => {
  const g = game();
  g.LEDGER.cash(5000000);
  const id = Object.keys(g.STATE.stockMarket.companies)[0];
  assert.equal(g.STOCK_MARKET.acquire(id), true);
  const c = g.STATE.stockMarket.companies[id],
    owned = g.STATE.stockMarket.portfolio[id];
  assert.equal(owned, 51000);
  assert.equal(c.isAcquired, true);
  assert.equal(owned + c.sharesAvailable + c.founderShares, 100000);
  g.PERSISTENCE.validate(g.STATE);
});
test("share purchase/sale records only gain and fees in income", () => {
  const g = game(),
    id = Object.keys(g.STATE.stockMarket.companies)[0];
  g.STOCK_MARKET.buyShares(id, 10);
  const price = g.STATE.stockMarket.companies[id].sharePrice;
  g.STATE.stockMarket.companies[id].sharePrice = price + 2;
  g.STOCK_MARKET.sellShares(id, 10);
  near(g.STATE.ledger.total.fin_income, 20);
  near(g.STATE.stockMarket.costBasis[id], 0);
});
test("price history records real days, view initialization is immutable", () => {
  const g = game();
  const before = JSON.stringify(g.STATE.market.priceHistory);
  g.MARKET.init();
  g.MARKET.init();
  assert.equal(JSON.stringify(g.STATE.market.priceHistory), before);
  g.GAME.nextDay();
  assert.equal(g.STATE.market.priceHistory.bakery.length, 2);
  assert.equal(g.STATE.market.priceHistory.bakery[1].day, 2);
});
test("failed day rolls back every state mutation and releases processing lock", () => {
  const g = game();
  const before = JSON.stringify(g.STATE);
  g.RETAIL.processDaily = () => {
    throw Error("forced failure");
  };
  g.GAME.nextDay();
  assert.equal(JSON.stringify(g.STATE), before);
  assert.equal(g.GAME.processing, false);
});
test("persistence restores progress and rejects invalid imports without changing state", () => {
  const g = game();
  g.PERSISTENCE.ready = true;
  business(g);
  g.GAME.nextDay();
  assert.equal(g.PERSISTENCE.save(), true);
  const saved = g.storage.get(g.PERSISTENCE.KEY);
  g.STATE.time.day = 100;
  assert.equal(g.PERSISTENCE.load(), true);
  assert.equal(g.STATE.time.day, 2);
  assert.equal(g.STATE.company.businesses.length, 1);
  const original = JSON.stringify(g.STATE);
  for (const mutate of [
    (s) => (s.finances.balance = null),
    (s) =>
      (s.company.warehouses.odesa.inventory.bakery = { qty: -2, avgCost: 5 }),
    (s) => (s.hr.staff.salesman = -1),
    (s) => (s.stockMarket.portfolio.unknown = 10),
    (s) => (s.ledger.today.exp_salary = "50"),
  ]) {
    const p = JSON.parse(saved);
    mutate(p.state);
    assert.throws(() => g.PERSISTENCE.parse(JSON.stringify(p)));
    assert.equal(JSON.stringify(g.STATE), original);
  }
});
for (const days of [30, 90, 365])
  test(`seeded staffed grocery survives ${days} days with normal buying and autosupply`, () => {
    const g = game(730),
      b = business(g);
    g.HR.hire("store_manager");
    g.HR.hire("salesman");
    g.HR.assignToBusiness(b.uid, "store_manager");
    g.HR.assignToBusiness(b.uid, "salesman");
    b.autoSupplyRules = { bakery: 150, vegetables: 150 };
    for (let i = 0; i < days; i++) {
      const wh = g.STATE.company.warehouses.odesa;
      for (const item of ["bakery", "vegetables"]) {
        const onHand =
          (wh.inventory[item]?.qty ?? 0) +
          (b.localInventory[item]?.qty ?? 0) +
          (g.STATE.logistics?.deliveries ?? [])
            .filter((d) => d.item === item)
            .reduce((n, d) => n + d.qty, 0);
        if (onHand < 150) g.MARKET.buy(item, 200 - onHand, "odesa");
      }
      if (b.equipment.count && b.equipment.condition < 70)
        g.PRODUCTION.repairEquipment(b.uid);
      g.GAME.nextDay();
      assert.equal(g.STATE.time.day, i + 2);
      assert.ok(g.STATE.finances.balance > 0, `bankrupt on day ${i + 2}`);
      g.PERSISTENCE.validate(g.STATE);
      const cf = g.STATE.ledger.cashFlow.yesterday;
      near(cf.closing - cf.opening, cf.operating + cf.investing + cf.financing);
    }
    assert.ok(g.STATE.ledger.total.rev_b2c > 0);
    assert.equal(g.STATE.ledger.cashFlow.history.length, Math.min(days, 365));
  });
test("tender fulfillment respects quality and last permitted day", () => {
  const g = game();
  const c = {
    id: g.OPERATIONS.id(),
    item: "bakery",
    qty: 10,
    price: 20,
    minQuality: 2,
    totalReward: 200,
    penalty: 80,
    deadline: 1,
  };
  g.STATE.contracts.active.push(c);
  stock(g, "bakery", 20, 5, "odesa", 1);
  const cash = g.STATE.finances.balance;
  g.CONTRACTS.fulfill(c.id);
  assert.equal(g.STATE.contracts.active.length, 1);
  near(g.STATE.finances.balance, cash);
  g.CONTRACTS.processDaily();
  assert.equal(c.deadline, 0);
  g.STATE.company.warehouses.odesa.inventory.bakery.quality = 2;
  g.CONTRACTS.fulfill(c.id);
  assert.equal(g.STATE.contracts.active.length, 0);
  near(g.STATE.finances.balance, cash + 200);
});
test("full destination retains arrived cargo until space is available", () => {
  const g = game();
  g.WAREHOUSE.upgrade("odesa");
  g.MARKET.buy("bakery", 100, "odesa");
  stock(
    g,
    "wood",
    Math.floor(g.WAREHOUSE.getMaxVolume("odesa") / g.OPERATIONS.volume("wood")),
    1,
  );
  g.LOGISTICS.processDaily();
  assert.equal(g.STATE.logistics.deliveries.length, 1);
  assert.equal(g.STATE.logistics.deliveries[0].daysLeft, 0);
  delete g.STATE.company.warehouses.odesa.inventory.wood;
  g.LOGISTICS.processDaily();
  assert.equal(g.STATE.logistics.deliveries.length, 0);
  assert.equal(g.STATE.company.warehouses.odesa.inventory.bakery.qty, 100);
});
test("equipment install conserves book value and repairs do not invent assets", () => {
  const g = game(),
    b = business(g);
  stock(g, "retail_display", 1, 1234);
  const nw = g.FINANCE.calculateNetWorth();
  g.PRODUCTION.installEquipment(b.uid, 1);
  near(g.FINANCE.calculateNetWorth(), nw);
  assert.equal(b.equipment.bookValue, 1234);
  g.OPERATIONS.wear(b.equipment, 50, "retail_display");
  assert.equal(b.equipment.bookValue, 617);
  const before = g.FINANCE.calculateNetWorth(),
    cash = g.STATE.finances.balance;
  g.PRODUCTION.repairEquipment(b.uid);
  assert.equal(b.equipment.condition, 100);
  assert.equal(b.equipment.bookValue, 617);
  near(
    g.FINANCE.calculateNetWorth(),
    before - (cash - g.STATE.finances.balance),
  );
});
test("import creates backup and replaces only validated data", async () => {
  const g = game();
  g.PERSISTENCE.ready = true;
  g.PERSISTENCE.save();
  const initial = g.storage.get(g.PERSISTENCE.KEY);
  business(g);
  const imported = g.PERSISTENCE.serialize();
  g.PERSISTENCE.replace(g.PERSISTENCE.parse(initial));
  g.PERSISTENCE.save();
  await g.PERSISTENCE.importFile({ text: async () => imported });
  assert.equal(g.STATE.company.businesses.length, 1);
  assert.equal(g.storage.get(g.PERSISTENCE.KEY + "_backup"), initial);
  const saved = g.storage.get(g.PERSISTENCE.KEY);
  const original = JSON.stringify(g.STATE);
  await g.PERSISTENCE.importFile({ text: async () => "{broken" });
  assert.equal(JSON.stringify(g.STATE), original);
  assert.equal(g.storage.get(g.PERSISTENCE.KEY), saved);
});
test("unsafe handler identifiers and extreme quality are rejected on import", () => {
  const g = game();
  g.WAREHOUSE.upgrade("odesa");
  g.MARKET.buy("bakery", 1, "odesa");
  g.CONTRACTS.generateContract();
  const text = g.PERSISTENCE.serialize();
  for (const mutate of [
    (s) => (s.logistics.deliveries[0].id = "x');alert(1)//"),
    (s) => (s.contracts.available[0].id = "alert(1)"),
    (s) =>
      (s.company.warehouses.odesa.inventory.bakery = {
        qty: 1,
        avgCost: 1,
        quality: 1000000,
      }),
  ]) {
    const p = JSON.parse(text);
    mutate(p.state);
    assert.throws(() => g.PERSISTENCE.parse(JSON.stringify(p)));
  }
});
test("low wholesale prices never generate zero-price tenders", () => {
  const g = game();
  g.MARKET.trends.vegetables = 0.2;
  for (let i = 0; i < 150; i++) {
    g.CONTRACTS.generateContract();
    const c = g.STATE.contracts.available.at(-1);
    assert.ok(c.price > 0);
    assert.ok(c.totalReward > 0);
  }
  g.PERSISTENCE.validate(g.STATE);
});
