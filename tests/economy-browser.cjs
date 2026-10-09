const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const baseURL = process.env.GAME_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => PERSISTENCE.ready);
    await page.evaluate(() => {
      TUTORIAL.skip();
      PRODUCTION.buyBusiness("retail_store", "kyiv");
      UI_DASHBOARD.showStoreAnalyticsModal(STATE.company.businesses[0].uid);
    });
    assert.match(
      await page.locator("#store-analytics-modal").innerText(),
      /Дней в отчете: 0/,
    );
    const firstDayProfit = await page.evaluate(() => {
      const cards = document.querySelectorAll(
        '#store-analytics-modal [style*="border-left:4px"]',
      );
      return cards[2].textContent;
    });
    assert.match(firstDayProfit, /\$0,00|\$0\.00/);
    await page.evaluate(() => {
      document.getElementById("store-analytics-modal").remove();
      const store = STATE.company.businesses[0];
      HR.hire("store_manager");
      HR.hire("salesman");
      HR.assignToBusiness(store.uid, "store_manager");
      HR.assignToBusiness(store.uid, "salesman");
      MARKET.buy("retail_display", 1, "kyiv");
      MARKET.buy("bakery", 100, "kyiv");
      LOGISTICS.processDaily();
      PRODUCTION.installEquipment(store.uid, 1);
      store.autoSupplyRules = { bakery: 30 };
      FINANCE.openDeposit(1000, 3, "daily");
      FINANCE.takeLoan(1000, 30);
      GAME.nextDay();
    });
    const dashboard = await page.evaluate(() => {
      const y = STATE.ledger.yesterday;
      const income = y.rev_b2b + y.rev_b2g + y.rev_b2c + y.rev_other;
      const expense = Object.entries(y)
        .filter(
          ([key]) =>
            key.startsWith("exp_") || ["fin_expense", "fin_fees"].includes(key),
        )
        .reduce((sum, [, value]) => sum + value, 0);
      const net = income + y.fin_income - expense;
      return {
        revenue: document.getElementById("dash-kpi-revenue").textContent,
        expenses: document.getElementById("dash-kpi-burn").textContent,
        expectedRevenue: formatMoney(income),
        expectedExpenses: formatMoney(expense),
        summary: document.querySelector(
          "#dash-fin-summary > div:last-child strong",
        ).textContent,
        expectedSummary: "$" + formatMoney(net),
        cashChartDay: UI_DASHBOARD.charts.cashflow.data.labels.at(-1),
        expectedDay: "Д " + STATE.time.day,
        available: document.getElementById("dash-kpi-credit").textContent,
        expectedAvailable: formatMoney(
          Math.max(
            0,
            FINANCE.getAvailableLimit() -
              STATE.finances.loans.reduce(
                (sum, loan) => sum + loan.remainingPrincipal,
                0,
              ),
          ),
        ),
      };
    });
    assert.equal(dashboard.revenue, dashboard.expectedRevenue);
    assert.equal(dashboard.expenses, dashboard.expectedExpenses);
    assert.equal(dashboard.summary, dashboard.expectedSummary);
    assert.equal(dashboard.cashChartDay, dashboard.expectedDay);
    assert.equal(dashboard.available, dashboard.expectedAvailable);
    await page.evaluate(() => {
      UI_DASHBOARD.showBankModal("deposit", STATE.finances.deposits[0].id);
    });
    const forecast = await page.evaluate(
      () => UI_DASHBOARD.bankChartInstance.data.datasets[0].data,
    );
    assert.ok(forecast[1] > forecast[0]);
    await page.evaluate(() => UI_DASHBOARD.closeBankModal());
    const expected = await page.evaluate(() => {
      const id = Object.keys(STATE.stockMarket.companies)[0];
      STOCK_MARKET.buyShares(id, 10);
      STATE.stockMarket.companies[id].sharePrice += 2;
      MARKET.sell("bakery", 2, "kyiv");
      UI_DASHBOARD.update();
      return {
        retained: "$" + formatMoney(LEDGER.result(STATE.ledger.total).net),
        revaluation: "$" + formatMoney(20),
      };
    });
    await page.locator("#nav-tab-finance").click();
    assert.equal(
      await page.locator('[data-testid="equity-retained"]').textContent(),
      expected.retained,
    );
    assert.equal(
      await page.locator('[data-testid="equity-revaluation"]').textContent(),
      expected.revaluation,
    );
    assert.equal(
      await page
        .locator('[data-testid="balance-reconciliation"]')
        .textContent(),
      "Баланс сходится.",
    );
    assert.match(
      await page.locator("#ui-finance-dashboard").innerText(),
      /Текущие операции/,
    );
    // Negative equity is shown consistently by the bank and reports.
    await page.evaluate(() => {
      LEDGER.cash(-30000);
      LEDGER.record("exp_fines", 30000);
      UI_DASHBOARD.update();
    });
    assert.equal(await page.locator("#ui-debt-ratio").textContent(), "∞");
    assert.equal(
      await page
        .locator('[data-testid="balance-reconciliation"]')
        .textContent(),
      "Баланс сходится.",
    );
    await page.setViewportSize({ width: 390, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      true,
    );
    // Preserve old opening differences across save/reload, without hiding new changes.
    await page.evaluate(() => {
      LEDGER.cash(500);
      delete STATE.finances.openingAdjustment;
      PERSISTENCE.save();
    });
    await page.reload();
    await page.waitForFunction(() => PERSISTENCE.ready);
    assert.equal(
      await page.evaluate(
        () => Math.abs(FINANCE.getReports().reconciliation) < 1e-6,
      ),
      true,
    );
    assert.ok(
      await page.evaluate(
        () => Math.abs(STATE.finances.openingAdjustment - 500) < 1e-6,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Economy browser checks passed: P&L/dashboard parity, cash-flow days, current receivables, equity reconciliation, daily-deposit forecast, zero-day store analytics, debt ratio, credit headroom, mobile, migration.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
