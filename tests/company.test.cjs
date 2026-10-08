const assert = require("node:assert/strict");
const { test } = require("node:test");
const { game, business } = require("./helpers.cjs");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("an unopened company keeps its cash and net worth through 90 days", () => {
  const g = game(730);
  for (let i = 0; i < 90; i++) {
    g.GAME.nextDay();
    assert.equal(g.STATE.time.day, i + 2);
    near(g.STATE.finances.balance, 25000);
    near(g.FINANCE.calculateNetWorth(), 25000);
    assert.equal(g.STATE.stockMarket.companies.player, undefined);
    assert.equal(g.STATE.eventLog.length, 0);
    assert.equal(g.STATE.ledger.cashFlow.yesterday.movements.length, 0);
  }
});

test("fire inspection requires premises and its fine has a cash description", () => {
  const g = game();
  g.run(
    "let rolls = [.05, .5, .214]; Math.random = () => rolls.shift() ?? .5;",
  );
  g.EVENTS.simulate();
  near(g.STATE.finances.balance, 25000);
  assert.equal(g.run("rolls.length"), 3);
  business(g);
  g.run("rolls = [.05, .5, .214];");
  g.EVENTS.simulate();
  const fine = g.STATE.ledger.cashFlow.today.movements.find(
    (m) => m.description === "Штраф пожарной инспекции",
  );
  assert.equal(fine.amount, -821);
  assert.equal(g.STATE.ledger.today.exp_fines, 821);
  assert.match(g.STATE.eventLog[0].msg, /пожарной безопасности/);
});

test("cash explanations reconcile manual transactions and daily operating costs", () => {
  const g = game();
  business(g);
  g.HR.hire("salesman");
  g.run("EVENTS.simulate = () => {};");
  const netWorthBefore = g.FINANCE.calculateNetWorth();
  g.GAME.nextDay();
  const report = g.STATE.ledger.cashFlow.yesterday;
  near(
    report.movements.reduce((sum, m) => sum + m.amount, 0),
    report.closing - report.opening,
  );
  near(report.netWorthBefore, netWorthBefore);
  near(report.netWorthAfter, g.FINANCE.calculateNetWorth());
  assert.ok(
    report.movements.some((m) => m.description === "Зарплаты" && m.amount < 0),
  );
  assert.ok(
    report.movements.some(
      (m) => m.description.includes("Аренда") && m.amount < 0,
    ),
  );
  assert.equal(report.day, g.STATE.time.day);
  const saved = g.PERSISTENCE.serialize();
  g.PERSISTENCE.replace(g.PERSISTENCE.parse(saved));
  assert.equal(g.PERSISTENCE.serialize(), saved);
  g.GAME.nextDay();
  assert.equal(report.day, 2);
});

test("IPO is voluntary, requires the threshold, and never moves cash", () => {
  const g = game();
  assert.equal(g.STOCK_MARKET.launchIPO(), false);
  g.LEDGER.cash(475000);
  g.GAME.nextDay();
  assert.equal(g.STATE.stockMarket.companies.player, undefined);
  const balance = g.STATE.finances.balance;
  const operations = g.STATE.ledger.cashFlow.today.operations;
  assert.equal(g.STOCK_MARKET.launchIPO(), true);
  assert.equal(g.STATE.stockMarket.companies.player.isPlayer, true);
  assert.equal(g.STATE.stockMarket.ipoDay, g.STATE.time.day);
  assert.equal(g.STATE.finances.balance, balance);
  assert.equal(g.STATE.ledger.cashFlow.today.operations, operations);
  assert.equal(g.STOCK_MARKET.launchIPO(), false);
  g.LEDGER.cash(-490000);
  g.STOCK_MARKET.init();
  assert.ok(g.STATE.stockMarket.companies.player);
});

test("stock repricing changes owned assets, never free cash", () => {
  const g = game();
  const id = Object.keys(g.STATE.stockMarket.companies)[0];
  assert.equal(g.STOCK_MARKET.buyShares(id, 10), true);
  const balance = g.STATE.finances.balance;
  const netWorth = g.FINANCE.calculateNetWorth();
  g.STOCK_MARKET.processDaily();
  near(g.STATE.finances.balance, balance);
  assert.notEqual(g.FINANCE.calculateNetWorth(), netWorth);
});

test("new movement data is validated and old saves without it still load", () => {
  const g = game();
  g.LEDGER.cash(-10, "operating", "Тест");
  const copy = () => JSON.parse(JSON.stringify(g.STATE));
  const invalid = copy();
  invalid.ledger.cashFlow.today.movements[0].amount = "10";
  assert.throws(() => g.PERSISTENCE.validate(invalid));
  const old = copy();
  delete old.ledger.cashFlow.today.movements;
  g.PERSISTENCE.validate(old);
  g.PERSISTENCE.replace(old);
  g.LEDGER.cash(-5, "operating", "Новая операция");
  g.PERSISTENCE.validate(g.STATE);
  assert.equal(g.STATE.ledger.cashFlow.today.movements[0].amount, -5);
});

test("company restart can be cancelled and preserves a backup when confirmed", () => {
  const g = game();
  g.PERSISTENCE.ready = true;
  g.LEDGER.cash(475000);
  g.STOCK_MARKET.launchIPO();
  business(g);
  g.GAME.nextDay();
  g.PERSISTENCE.save();
  const saved = g.storage.get(g.PERSISTENCE.KEY);
  g.run("confirm = () => false;");
  g.PERSISTENCE.newGame();
  assert.equal(g.storage.get(g.PERSISTENCE.KEY), saved);
  assert.ok(g.STATE.stockMarket.companies.player);
  g.run("confirm = () => true;");
  g.PERSISTENCE.newGame();
  assert.equal(g.storage.get(g.PERSISTENCE.KEY + "_backup"), saved);
  assert.equal(g.STATE.time.day, 1);
  near(g.STATE.finances.balance, 25000);
  assert.equal(g.STATE.company.businesses.length, 0);
  assert.equal(g.STATE.stockMarket.companies.player, undefined);
  assert.equal(g.STATE.stockMarket.ipoDay, undefined);
  assert.equal(g.STATE.ledger.cashFlow.history.length, 0);
});
