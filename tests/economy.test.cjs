const test = require("node:test");
const assert = require("node:assert/strict");
const { game, business } = require("./helpers.cjs");
const near = (a, b, label = "") =>
  assert.ok(
    Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-12),
    `${label}: ${a} != ${b}`,
  );
function fund(g, amount = 1000000) {
  g.LEDGER.cash(amount, "operating", "Грант для сценария");
  g.LEDGER.record("rev_other", amount);
}
function books(g, label = "") {
  const r = g.FINANCE.getReports();
  near(r.assets.netWorth, r.totalEquity, label + " equity");
  near(r.reconciliation, 0, label + " reconciliation");
  const cf = g.STATE.ledger.cashFlow.today;
  near(cf.closing, g.STATE.finances.balance, label + " balance");
  near(
    cf.closing - cf.opening,
    cf.operating + cf.investing + cf.financing,
    label + " flows",
  );
  near(cf.inflow - cf.outflow, cf.closing - cf.opening, label + " gross flows");
  near(
    (cf.movements ?? []).reduce((n, m) => n + m.amount, 0),
    cf.closing - cf.opening,
    label + " movements",
  );
  g.PERSISTENCE.validate(g.STATE);
}

test("P&L includes every income and expense category without confusing revenue and financial income", () => {
  const g = game();
  const record = Object.fromEntries(
    Object.keys(g.LEDGER.categories).map((key, i) => [key, i + 1]),
  );
  const p = g.LEDGER.result(record);
  near(p.revenue, 1 + 2 + 3 + 4);
  near(
    p.expenses,
    Object.entries(record)
      .filter(
        ([key]) =>
          key.startsWith("exp_") || ["fin_expense", "fin_fees"].includes(key),
      )
      .reduce((sum, [, value]) => sum + value, 0),
  );
  near(p.net, p.revenue + record.fin_income - p.expenses);
  near(p.ebt, p.net + record.exp_taxes_corp);
  near(g.LEDGER.result({ rev_b2c: 100 }).net, 100);
});

test("all resource purchases, cancellation, delivery, wholesale recognition and settlement reconcile in every city", () => {
  for (const city of Object.keys(game().GEO.CITIES)) {
    const g = game();
    fund(g);
    g.WAREHOUSE.upgrade(city);
    books(g, city + " warehouse");
    for (const item of Object.keys(g.RECIPES.RESOURCES)) {
      const before = g.FINANCE.calculateNetWorth();
      g.MARKET.buy(item, 3, city);
      const order = g.STATE.logistics.deliveries.at(-1);
      assert.equal(order.item, item);
      near(g.FINANCE.calculateNetWorth(), before, item + " purchase");
      g.MARKET.cancelOrder(order.id);
      books(g, item + " cancel");
      near(g.FINANCE.calculateNetWorth(), before);
      g.MARKET.buy(item, 3, city);
      g.LOGISTICS.processDaily();
      books(g, item + " delivery");
      const revenueBefore = g.STATE.ledger.total.rev_b2b;
      const cashBefore = g.STATE.finances.balance;
      g.MARKET.sell(item, 1, city);
      books(g, item + " dispatch");
      near(g.STATE.finances.balance, cashBefore);
      assert.ok(
        g.STATE.ledger.total.rev_b2b > revenueBefore,
        item + " " + city,
      );
      const revenue = g.STATE.ledger.total.rev_b2b;
      g.LOGISTICS.processDaily();
      books(g, item + " settlement");
      assert.equal(g.STATE.ledger.total.rev_b2b, revenue);
    }
  }
});

for (const type of Object.keys(game().RECIPES.BUSINESSES))
  test(`construction, expansion, equipment and operating cost reconcile for ${type}`, () => {
    const g = game(42);
    fund(g);
    g.STATE.rnd.unlocked = Object.keys(g.RECIPES.BUSINESSES);
    const b = business(g, type, "kyiv"),
      tpl = g.RECIPES.BUSINESSES[type];
    books(g, "construction");
    const before = g.FINANCE.calculateNetWorth();
    g.PRODUCTION.upgradeBusiness(b.uid);
    books(g, "expansion");
    near(g.FINANCE.calculateNetWorth(), before);
    g.MARKET.buy(tpl.equipmentType, 1, "kyiv");
    g.LOGISTICS.processDaily();
    const beforeInstall = g.FINANCE.calculateNetWorth();
    g.PRODUCTION.installEquipment(b.uid, 1);
    books(g, "install");
    near(g.FINANCE.calculateNetWorth(), beforeInstall);
    const grade = tpl.isRetail
      ? "store_manager"
      : tpl.isMarketing
        ? "pr_manager"
        : "senior";
    for (let i = 0; i < tpl.staffReq * b.level - (tpl.isRetail ? 1 : 0); i++) {
      g.HR.hire(grade);
      g.HR.assignToBusiness(b.uid, grade);
    }
    if (tpl.isRetail) {
      g.HR.hire("salesman");
      g.HR.assignToBusiness(b.uid, "salesman");
    }
    if (tpl.isMarketing) b.campaign = 1;
    for (const [item, count] of Object.entries(tpl.inputs)) {
      g.MARKET.buy(item, Math.max(1, count * tpl.outputPerMachine), "kyiv");
    }
    g.GAME.nextDay();
    books(g, "day");
    assert.equal(g.STATE.time.day, 2);
    const expectedPayroll = g.HR.getDailySalaryFund();
    near(g.STATE.ledger.yesterday.exp_salary, expectedPayroll);
    near(
      g.STATE.ledger.yesterday.exp_taxes_payroll,
      expectedPayroll * g.TAXES.RATES.payroll,
    );
    if (!tpl.isRetail && !tpl.isMarketing)
      assert.ok(b.stats.lastOutput > 0, type + " must produce");
    if (b.equipment.condition < 100) {
      g.PRODUCTION.repairEquipment(b.uid);
      books(g, "repair");
    }
  });

test("NIИ equipment, research, training and employer tax conserve the accounting balance", () => {
  const g = game();
  fund(g);
  g.WAREHOUSE.upgrade("odesa");
  g.RND.upgradeFacility();
  g.MARKET.buy("smart_pc", 2, "odesa");
  g.LOGISTICS.processDaily();
  const before = g.FINANCE.calculateNetWorth();
  g.RND.installEquipment(2);
  near(g.FINANCE.calculateNetWorth(), before);
  books(g);
  g.HR.hire("scientist");
  g.HR.hire("scientist");
  g.RND.assignStaff("scientist");
  g.HR.train("scientist");
  g.RND.startProject("bakery_fab");
  for (let day = 0; day < 12; day++) {
    g.GAME.nextDay();
    books(g, "research " + day);
  }
  g.RND.repairEquipment();
  books(g, "research repair");
});

test("stock valuation and takeover premiums stay outside retained earnings until realized", () => {
  const g = game();
  fund(g, 10000000);
  const id = Object.keys(g.STATE.stockMarket.companies)[0];
  g.STOCK_MARKET.buyShares(id, 10);
  books(g, "purchase");
  g.STATE.stockMarket.companies[id].sharePrice += 2;
  const r = g.FINANCE.getReports();
  near(r.revaluation, 20);
  near(r.retainedEarnings, g.LEDGER.result(g.STATE.ledger.total).net);
  books(g, "quote");
  g.STOCK_MARKET.sellShares(id, 4);
  books(g, "partial sale");
  g.STOCK_MARKET.acquire(id);
  books(g, "takeover");
  assert.ok(g.FINANCE.getReports().revaluation < 0);
  g.STOCK_MARKET.sellShares(id, g.STATE.stockMarket.portfolio[id]);
  books(g, "exit");
  near(g.FINANCE.getReports().revaluation, 0);
});

test("loan projections match actual payments and settle the entire final principal", () => {
  for (const days of [1, 3, 30, 365]) {
    const g = game();
    g.FINANCE.takeLoan(1000.01, days);
    const loan = g.STATE.finances.loans[0],
      schedule = g.FINANCE.generatePaymentSchedule(loan);
    near(
      schedule.reduce((sum, p) => sum + p.principal, 0),
      loan.remainingPrincipal,
    );
    for (const payment of schedule) {
      const cash = g.STATE.finances.balance;
      g.FINANCE.processDailyClearing();
      near(cash - g.STATE.finances.balance, payment.total);
      books(g, "loan");
    }
    assert.equal(g.STATE.finances.loans.length, 0);
  }
});

test("deposit forecasts include daily payouts and match maturity cash exactly", () => {
  for (const payoutType of ["daily", "end"]) {
    const g = game();
    g.FINANCE.openDeposit(1000, 3, payoutType);
    g.FINANCE.processDailyClearing();
    const dep = g.STATE.finances.deposits[0],
      schedule = g.FINANCE.generateDepositSchedule(dep);
    assert.ok(schedule[1].total > schedule[0].total);
    const cash = g.STATE.finances.balance;
    for (const row of schedule) {
      const balance = g.STATE.finances.balance;
      g.FINANCE.processDailyClearing();
      near(g.STATE.finances.balance - balance, row.payout);
      books(g);
    }
    near(
      g.STATE.finances.balance - cash,
      schedule.reduce((sum, row) => sum + row.payout, 0),
    );
    assert.equal(g.STATE.finances.deposits.length, 0);
  }
});

test("receivable-only actions select current P&L and current cash period without fictitious cash", () => {
  const g = game();
  fund(g);
  g.WAREHOUSE.upgrade("odesa");
  g.MARKET.buy("bakery", 10, "odesa");
  g.GAME.nextDay();
  g.MARKET.sell("bakery", 2, "odesa");
  const r = g.FINANCE.getReports();
  assert.equal(r.currentActivity, true);
  assert.ok(r.periodProfit.revenue > 0);
  near(r.cashReport.closing - r.cashReport.opening, 0);
  books(g);
});

test("store history records actual depreciation and repairs once", () => {
  const g = game();
  fund(g);
  const s = business(g);
  g.MARKET.buy("retail_display", 1, "odesa");
  g.LOGISTICS.processDaily();
  g.PRODUCTION.installEquipment(s.uid, 1);
  g.GAME.nextDay();
  near(
    s.stats.history[0].depreciation,
    g.STATE.ledger.yesterday.exp_depreciation,
  );
  assert.ok(s.stats.history[0].depreciation > 0);
  g.PRODUCTION.repairEquipment(s.uid);
  const repair = g.STATE.ledger.today.exp_repair;
  g.GAME.nextDay();
  near(s.stats.history[1].repair, repair);
  g.GAME.nextDay();
  near(s.stats.history[2].repair, 0);
  books(g);
});

test("tax assessment uses operating and realized financial profit, excludes unrealized quotes", () => {
  const g = game();
  g.TAXES.init();
  g.LEDGER.cash(1000);
  g.LEDGER.record("rev_b2c", 1000);
  g.LEDGER.cash(-100);
  g.LEDGER.record("exp_salary", 100);
  g.LEDGER.record("exp_depreciation", 20);
  g.LEDGER.cash(-30);
  g.LEDGER.record("exp_logistics", 30);
  g.LEDGER.cash(10, "investing");
  g.LEDGER.record("fin_income", 10);
  g.STATE.taxes.daysToReport = 1;
  g.TAXES.processDaily();
  near(g.STATE.ledger.today.exp_taxes_payroll, 22);
  near(
    g.STATE.ledger.today.exp_taxes_corp,
    (1000 - 100 - 22 - 20 - 30 + 10) * 0.18,
  );
  near(g.STATE.taxes.taxableBase, 0);
});

test("legacy opening differences are preserved once rather than silently masking new errors", () => {
  const g = game();
  delete g.STATE.finances.openingAdjustment;
  g.LEDGER.cash(500);
  g.GAME.prepare();
  near(g.STATE.finances.openingAdjustment, 500);
  books(g, "legacy");
  g.LEDGER.cash(5);
  g.GAME.prepare();
  near(g.STATE.finances.openingAdjustment, 500);
  near(g.FINANCE.getReports().reconciliation, 5);
});

test("cash-flow chart history uses actual recorded closing days", () => {
  const g = game();
  g.GAME.nextDay();
  g.GAME.nextDay();
  assert.equal(
    JSON.stringify(g.LEDGER.cashHistory().map((day) => day.day)),
    "[2,3]",
  );
});

test("negative equity with debt cannot appear as a zero debt/equity ratio", () => {
  const g = game();
  g.FINANCE.takeLoan(1000, 30);
  g.LEDGER.cash(-26000);
  g.LEDGER.record("exp_fines", 26000);
  assert.equal(g.FINANCE.getReports().debtEquity, Infinity);
  books(g);
});

for (const seed of [1, 42, 730])
  test(`mixed retail, manufacturing, research, marketing, banking and stock operations reconcile for 120 days (seed ${seed})`, () => {
    const g = game(seed);
    fund(g, 2000000);
    const store = business(g),
      factory = business(g, "bakery_fab"),
      agency = business(g, "marketing_agency");
    for (const [b, grades] of [
      [store, ["store_manager", "salesman"]],
      [factory, ["senior", "senior"]],
      [agency, ["marketer"]],
    ]) {
      for (const grade of grades) {
        g.HR.hire(grade);
        g.HR.assignToBusiness(b.uid, grade);
      }
      g.MARKET.buy(g.RECIPES.BUSINESSES[b.type].equipmentType, 1, b.city);
    }
    g.LOGISTICS.processDaily();
    for (const b of [store, factory, agency])
      g.PRODUCTION.installEquipment(b.uid, 1);
    agency.campaign = 1;
    store.autoSupplyRules = { bakery: 150 };
    factory.routing = { [store.uid]: 30 };
    g.RND.upgradeFacility();
    g.HR.hire("scientist");
    g.RND.assignStaff("scientist");
    g.MARKET.buy("smart_pc", 1, "odesa");
    g.LOGISTICS.processDaily();
    g.RND.installEquipment(1);
    g.RND.startProject("bakery_fab");
    g.FINANCE.takeLoan(10000, 45);
    g.FINANCE.openDeposit(15000, 90, "end");
    const id = Object.keys(g.STATE.stockMarket.companies)[1];
    g.STOCK_MARKET.buyShares(id, 10);
    for (let day = 0; day < 120; day++) {
      for (const item of ["grain", "bakery"]) {
        const qty = Math.min(100, g.MARKET.getAvailablePool(item));
        if (
          qty > 0 &&
          g.WAREHOUSE.freeSpace("odesa") >= qty * g.OPERATIONS.volume(item)
        )
          g.MARKET.buy(item, qty, "odesa");
      }
      if (day % 20 === 10) {
        const qty = Math.min(
          5,
          g.STATE.company.warehouses.odesa.inventory.bakery?.qty ?? 0,
          g.STATE.market.sellDemand.bakery,
        );
        if (qty > 0) g.MARKET.sell("bakery", qty, "odesa");
      }
      if (day % 25 === 10) {
        g.STOCK_MARKET.buyShares(id, 2);
        g.STOCK_MARKET.sellShares(id, 1);
      }
      if (day % 10 === 0) {
        for (const b of [store, factory, agency])
          g.PRODUCTION.repairEquipment(b.uid);
        g.RND.repairEquipment();
      }
      books(g, "before day " + day);
      const oldDay = g.STATE.time.day;
      g.GAME.nextDay();
      assert.equal(g.STATE.time.day, oldDay + 1);
      books(g, "after day " + day);
      for (const category of Object.keys(g.LEDGER.categories)) {
        const sum = g.STATE.ledger.history.reduce(
          (n, row) => n + row[category],
          g.STATE.ledger.today[category],
        );
        near(g.STATE.ledger.total[category], sum, category + " history");
      }
    }
    assert.ok(g.STATE.ledger.total.rev_b2c > 0);
    assert.ok(g.STATE.ledger.total.rev_b2b > 0);
    assert.ok(g.STATE.ledger.total.fin_income > 0);
    assert.ok(g.STATE.ledger.total.exp_taxes_corp > 0);
    assert.equal(g.STATE.finances.loans.length, 0);
    assert.equal(g.STATE.finances.deposits.length, 0);
  });

test("credit headroom excludes outstanding principal and a secured loan can cover an overdraft", () => {
  const g = game();
  business(g);
  g.LEDGER.cash(-20000);
  g.LEDGER.record("exp_fines", 20000);
  assert.ok(g.STATE.finances.balance < 0);
  g.FINANCE.takeLoan(2000, 30);
  assert.equal(g.STATE.finances.loans.length, 1);
  assert.ok(g.STATE.finances.balance > 0);
  near(g.FINANCE.getRemainingCredit(), g.FINANCE.getAvailableLimit() - 2000);
  books(g);
});

test("legacy receivables are recognized once before establishing opening equity", () => {
  const g = game();
  delete g.STATE.finances.openingAdjustment;
  g.STATE.logistics = {
    deliveries: [],
    receivables: [{ amount: 100, cogs: 50, daysLeft: 1 }],
  };
  g.GAME.prepare();
  near(g.STATE.ledger.total.rev_b2b, 100);
  books(g);
  g.LOGISTICS.processDaily();
  near(g.STATE.ledger.total.rev_b2b, 100);
  books(g);
  g.GAME.prepare();
  near(g.STATE.ledger.total.rev_b2b, 100);
  books(g);
});

test("legacy current cash movements select the current period even without operation counters", () => {
  const g = game();
  g.LEDGER.cash(-10);
  g.LEDGER.record("exp_fines", 10);
  const day = g.STATE.ledger.cashFlow.today;
  delete day.operations;
  delete day.inflow;
  delete day.outflow;
  g.STATE.ledger.today = { ...g.LEDGER.categories };
  assert.equal(g.FINANCE.getReports().currentActivity, true);
  g.LEDGER.endOfDay();
  assert.equal(g.LEDGER.cashHistory()[0].inflow, null);
});
