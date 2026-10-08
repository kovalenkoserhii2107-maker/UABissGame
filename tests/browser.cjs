// Optional integration checks: npm install --no-save playwright, then run against a local server.
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
  const errors = [],
    missing = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
  });
  page.on("dialog", (d) => d.accept());
  try {
    await page.goto(baseURL);
    await page.waitForFunction(
      () => typeof GAME !== "undefined" && PERSISTENCE.ready,
    );
    await page.evaluate(() => TUTORIAL.skip());
    // Every configured factory appears without maintaining a second catalogue.
    assert.equal(
      await page.evaluate(() => {
        STATE.rnd.unlocked = Object.keys(RECIPES.BUSINESSES);
        UI_DASHBOARD.update();
        const html = document.getElementById("ui-buy-businesses").innerHTML;
        return Object.entries(RECIPES.BUSINESSES)
          .filter(([k, t]) => !t.isRetail && !t.isMarketing)
          .every(([k]) => html.includes(`buyBusiness('${k}')`));
      }),
      true,
    );
    // All views render at desktop and mobile widths without widening the page.
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      for (let i = 0; i < 14; i++) {
        await page
          .locator(".tabs .tab")
          .nth(i)
          .evaluate((el) => el.click());
        await page.waitForTimeout(80);
        const size = await page.evaluate(() => ({
          width: innerWidth,
          body: document.documentElement.scrollWidth,
          tab: document.querySelector(".tab-content.active").id,
          error: document.getElementById("debug-error")?.style.display,
        }));
        assert.ok(
          size.body <= size.width + 2,
          `${size.tab} overflows at ${width}: ${size.body}`,
        );
        assert.ok(size.error === undefined || size.error === "none");
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Real bank action: cash flow is +970, and all asset displays agree.
    const bank = await page.evaluate(() => {
      FINANCE.takeLoan(1000, 30);
      FINANCE.openDeposit(5000, 30, "end");
      return {
        flow: STATE.ledger.cashFlow.today.financing,
        model: formatMoney(FINANCE.calculateNetWorth()),
        header: document.getElementById("ui-header-networth").textContent,
        dash: document.getElementById("dash-kpi-networth").textContent,
        report: document.querySelector('[data-testid="cashflow-net"]')
          .textContent,
      };
    });
    assert.equal(bank.flow, 970);
    assert.equal(bank.header, bank.model);
    assert.equal(bank.dash, bank.model);
    assert.equal(
      bank.report,
      "$" + (await page.evaluate(() => formatMoney(-4030))),
    );
    // Editing another form survives daily repaint.
    await page.locator("#input-loan-amount").evaluate((el) => {
      el.value = "345";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => {
      PRODUCTION.buyBusiness("retail_store", "odesa");
      GAME.nextDay();
    });
    assert.equal(await page.locator("#input-loan-amount").inputValue(), "345");
    const snapshot = await page.evaluate(() => JSON.stringify(STATE));
    await page.reload();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => JSON.stringify(STATE)), snapshot);
    assert.equal(
      await page
        .locator("#tutorial-root")
        .evaluate((el) => el.classList.contains("is-active")),
      false,
    );
    // Keyboard activation, dialog focus trap, Escape and return focus.
    const retail = page.locator("#nav-tab-retail");
    await retail.focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page
        .locator("#tab-retail")
        .evaluate((el) => el.classList.contains("active")),
      true,
    );
    const card = page
      .locator('[onclick*="UI_DASHBOARD.showStoreModal"]')
      .first();
    await card.click();
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(() =>
        document.getElementById("store-modal").contains(document.activeElement),
      ),
      true,
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() =>
        document.getElementById("store-modal").contains(document.activeElement),
      ),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#store-modal").count(), 0);
    // Stable observed prices on repeated chart openings.
    await page.evaluate(() => UI_DASHBOARD.showMarketModal("bakery"));
    const prices = await page.evaluate(() =>
      JSON.stringify(UI_DASHBOARD.marketChartInstance.data.datasets[0].data),
    );
    await page.evaluate(() => UI_DASHBOARD.updateMarketChart("bakery", 7));
    assert.equal(
      await page.evaluate(() =>
        JSON.stringify(UI_DASHBOARD.marketChartInstance.data.datasets[0].data),
      ),
      prices,
    );
    await page.evaluate(() => UI_DASHBOARD.closeMarketModal());
    // Missing saved data cannot overwrite the original save.
    const invalid = await page.evaluate(() => {
      const saved = localStorage.getItem(PERSISTENCE.KEY);
      localStorage.setItem(PERSISTENCE.KEY, "{broken");
      PERSISTENCE.load();
      UI_DASHBOARD.update();
      const intact = localStorage.getItem(PERSISTENCE.KEY) === "{broken";
      localStorage.setItem(PERSISTENCE.KEY, saved);
      PERSISTENCE.blocked = false;
      return intact;
    });
    assert.equal(invalid, true);
    // Tutorial is tested through actual buttons, up to a retail sale.
    await page.evaluate(() => PERSISTENCE.newGame());
    for (let guard = 0; guard < 60; guard++) {
      await page.waitForTimeout(220);
      const step = await page.evaluate(() =>
        STATE.tutorial.isActive
          ? {
              index: STATE.tutorial.step,
              target: TUTORIAL.STEPS[STATE.tutorial.step].target,
              type: TUTORIAL.STEPS[STATE.tutorial.step].trigger.type,
            }
          : null,
      );
      if (!step) break;
      console.log("tutorial", step.index, step.target);
      if (step.type === "manual") {
        await page.locator(".tutorial-next").click();
        continue;
      }
      if (step.type === "click") {
        await page.locator(step.target).first().click();
        continue;
      }
      switch (step.index) {
        case 13:
          await page.locator(step.target).first().click();
          await page.waitForTimeout(220);
          await page
            .locator('#city-modal [onclick*="retail_store"][onclick*="odesa"]')
            .click();
          break;
        case 15:
        case 16:
          await page.locator(step.target).first().click();
          break;
        case 19:
          await page
            .locator(
              '#store-modal [onclick*="HR.assignToBusiness"][onclick*="store_manager"]',
            )
            .click();
          await page.waitForTimeout(220);
          await page
            .locator(
              '#store-modal [onclick*="HR.assignToBusiness"][onclick*="salesman"]',
            )
            .click();
          break;
        case 21:
          await page.locator("#buy-qty-bakery").fill("100");
          await page
            .locator('#tab-market [onclick*="submitBuy"][onclick*="bakery"]')
            .click();
          break;
        case 22:
        case 24:
          await page.locator('[onclick="GAME.nextDay()"]').click();
          break;
        case 23:
          await page
            .locator("#trans-store-odesa-bakery")
            .selectOption(
              await page.evaluate(() =>
                String(STATE.company.businesses[0].uid),
              ),
            );
          await page.locator("#trans-qty-odesa-bakery").fill("100");
          await page
            .locator('[onclick*="transferToStore"][onclick*="bakery"]')
            .click();
          break;
        default:
          throw Error("Unhandled tutorial step " + step.index);
      }
    }
    assert.equal(await page.evaluate(() => STATE.tutorial.isActive), false);
    assert.ok((await page.evaluate(() => STATE.ledger.total.rev_b2c)) > 0);
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal(missing.length, 0, missing.join("\n"));
    console.log(
      "Browser checks passed: 14 tabs, 3 widths, bank, reload, forms, keyboard, charts, saves, complete tutorial.",
    );
  } catch (e) {
    await page.screenshot({ path: "/tmp/uabiss-browser-failure.png" });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
