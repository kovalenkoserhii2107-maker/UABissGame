// Versioned saves. Invalid files never replace the current game or stored save.
const PERSISTENCE = {
  KEY: "uabiz_save_v1",
  VERSION: 1,
  defaults: JSON.parse(JSON.stringify(STATE)),
  blocked: false,
  ready: false,
  validate(state) {
    const fail = () => {
      throw new Error("Сохранение содержит некорректные данные.");
    };
    const object = (v) => v && typeof v === "object" && !Array.isArray(v);
    const number = (v, min = 0) => Number.isFinite(v) && v >= min;
    const integer = (v, min = 0) => Number.isSafeInteger(v) && v >= min;
    const walk = (value, depth = 0) => {
      if (depth > 40 || (typeof value === "number" && !Number.isFinite(value)))
        fail();
      if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value)) {
          if (["__proto__", "constructor", "prototype"].includes(key)) fail();
          walk(child, depth + 1);
        }
    };
    walk(state);
    if (
      state?.finances?.openingAdjustment !== undefined &&
      !number(state.finances.openingAdjustment, -Number.MAX_VALUE)
    )
      fail();
    if (
      !object(state) ||
      !integer(state.time?.day, 1) ||
      !object(state.finances) ||
      !number(state.finances.balance, -Number.MAX_VALUE) ||
      !number(state.finances.creditScore) ||
      state.finances.creditScore > 1000 ||
      !object(state.company) ||
      !Array.isArray(state.company.businesses) ||
      !object(state.company.warehouses) ||
      !Array.isArray(state.finances.loans) ||
      !Array.isArray(state.finances.deposits) ||
      !object(state.hr?.staff) ||
      !Array.isArray(state.hr?.trainingQueue) ||
      !Array.isArray(state.rnd?.unlocked) ||
      !Array.isArray(state.contracts?.active) ||
      !Array.isArray(state.contracts?.available) ||
      !Array.isArray(state.quests?.completed) ||
      !Array.isArray(state.quests?.claimed)
    )
      fail();
    const equipment = (e) => {
      if (
        !object(e) ||
        !integer(e.count) ||
        !number(e.condition) ||
        e.condition > 100 ||
        (e.bookValue !== undefined && !number(e.bookValue))
      )
        fail();
    };
    const inventory = (inv) => {
      if (!object(inv)) fail();
      for (const [key, it] of Object.entries(inv))
        if (
          !RECIPES.RESOURCES[key] ||
          !object(it) ||
          !integer(it.qty) ||
          !number(it.avgCost) ||
          !number(it.quality ?? 1, 0.01) ||
          (it.quality ?? 1) > 10 ||
          !number(it.brand ?? 0)
        )
          fail();
    };
    for (const [city, wh] of Object.entries(state.company.warehouses)) {
      if (!GEO.CITIES[city] || !integer(wh.level)) fail();
      inventory(wh.inventory);
      if (wh.capitalCost !== undefined && !number(wh.capitalCost)) fail();
    }
    const ids = new Set();
    for (const b of state.company.businesses) {
      const tpl = RECIPES.BUSINESSES[b.type];
      if (
        !tpl ||
        !integer(b.uid, 1) ||
        ids.has(b.uid) ||
        !integer(b.level, 1) ||
        !GEO.CITIES[b.city] ||
        typeof b.name !== "string" ||
        b.name.length > 200 ||
        !object(b.assigned) ||
        !object(b.stats)
      )
        fail();
      ids.add(b.uid);
      equipment(b.equipment);
      if (b.capitalCost !== undefined && !number(b.capitalCost)) fail();
      for (const inv of [b.localInventory, b.dailyIncoming])
        if (inv !== undefined) inventory(inv);
      for (const city of [b.sourceWh, b.targetWh])
        if (city !== undefined && !GEO.CITIES[city]) fail();
      for (const [g, count] of Object.entries(b.assigned))
        if (
          !HR.GRADES[g] ||
          !integer(count) ||
          (count &&
            HR.GRADES[g].role !==
              (tpl.isRetail
                ? "retail"
                : tpl.isMarketing
                  ? "marketing"
                  : "factory"))
        )
          fail();
      if (
        Object.values(b.assigned).reduce((a, v) => a + v, 0) >
        tpl.staffReq * b.level
      )
        fail();
      for (const [item, val] of Object.entries(b.autoSupplyRules ?? {}))
        if (!tpl.accepts?.includes(item) || !integer(val)) fail();
      for (const [item, val] of Object.entries(b.prices ?? {}))
        if (!RECIPES.RESOURCES[item] || !number(val, 0.01)) fail();
      for (const val of Object.values(b.routing ?? {}))
        if (!integer(val)) fail();
    }
    for (const [g, count] of Object.entries(state.hr.staff))
      if (!HR.GRADES[g] || !integer(count)) fail();
    for (const t of state.hr.trainingQueue)
      if (
        !HR.GRADES[t.fromGrade] ||
        !HR.GRADES[t.toGrade] ||
        !integer(t.daysLeft, 1) ||
        !number(t.salary)
      )
        fail();
    if (
      !number(state.retail?.brand, 1) ||
      state.retail.brand > 100 ||
      !number(state.rnd.points) ||
      !integer(state.quests.currentChapter, 1) ||
      state.quests.currentChapter > 5
    )
      fail();
    for (const key of state.rnd.unlocked) if (!RECIPES.BUSINESSES[key]) fail();
    if (state.rnd.activeProject && !RECIPES.BUSINESSES[state.rnd.activeProject])
      fail();
    for (const [key, level] of Object.entries(state.rnd.techLevels ?? {}))
      if (!RECIPES.BUSINESSES[key] || !number(level, 1) || level > 2) fail();
    if (state.rnd.facility) {
      if (!integer(state.rnd.facility.level)) fail();
      equipment(state.rnd.facility.equipment);
    }
    for (const [g, count] of Object.entries(state.rnd.staff ?? {}))
      if (!["scientist", "lead_scientist"].includes(g) || !integer(count))
        fail();
    for (const g of Object.keys(HR.GRADES)) {
      const assigned =
        state.company.businesses.reduce((n, b) => n + (b.assigned[g] ?? 0), 0) +
        (state.rnd.staff?.[g] ?? 0);
      if (assigned > (state.hr.staff[g] ?? 0)) fail();
    }
    for (const loan of state.finances.loans)
      if (
        !integer(loan.id, 1) ||
        !number(loan.amount, 0.01) ||
        !number(loan.remainingPrincipal) ||
        !integer(loan.remainingDays, 1) ||
        !number(loan.dailyPrincipal, 0.01) ||
        !number(loan.rate)
      )
        fail();
    for (const dep of state.finances.deposits)
      if (
        !integer(dep.id, 1) ||
        !number(dep.amount, 0.01) ||
        !integer(dep.termDays, 1) ||
        !integer(dep.daysLeft, 1) ||
        !number(dep.rate) ||
        !number(dep.accrued) ||
        !["daily", "end"].includes(dep.payoutType)
      )
        fail();
    for (const contract of [
      ...state.contracts.active,
      ...state.contracts.available,
    ])
      if (
        !integer(contract.id, 1) ||
        !RECIPES.RESOURCES[contract.item] ||
        !integer(contract.qty, 1) ||
        !integer(contract.deadline) ||
        !number(contract.price, 0.01) ||
        !number(contract.minQuality ?? 1, 0.01) ||
        !number(contract.totalReward) ||
        !number(contract.penalty)
      )
        fail();
    for (const d of state.logistics?.deliveries ?? [])
      if (
        typeof d.id !== "string" ||
        !/^[a-zA-Z0-9_]+$/.test(d.id) ||
        !RECIPES.RESOURCES[d.item] ||
        !GEO.CITIES[d.targetCity] ||
        !integer(d.qty, 1) ||
        !number(d.cost) ||
        !integer(d.daysLeft) ||
        !number(d.quality ?? 1, 0.01) ||
        !number(d.logCost ?? 0) ||
        !number(d.totalCost ?? d.cost) ||
        !number(d.brand ?? 0)
      )
        fail();
    for (const r of state.logistics?.receivables ?? [])
      if (!number(r.amount) || !integer(r.daysLeft) || !number(r.cogs ?? 0))
        fail();
    if (
      !number(state.finances.startCapital, 0.01) ||
      !object(state.history) ||
      !Array.isArray(state.history.rp) ||
      state.history.rp.some((v) => !number(v)) ||
      !object(state.tutorial) ||
      typeof state.tutorial.isActive !== "boolean" ||
      !integer(state.tutorial.step) ||
      state.tutorial.step > 1000 ||
      !Array.isArray(state.b2bOffers)
    )
      fail();
    if (state.ledger !== null) {
      if (!object(state.ledger) || !Array.isArray(state.ledger.history)) fail();
      for (const record of [
        state.ledger.today,
        state.ledger.yesterday,
        state.ledger.total,
        ...state.ledger.history,
      ]) {
        if (!object(record)) fail();
        for (const [key, value] of Object.entries(record))
          if (!Object.hasOwn(LEDGER.categories, key) || !number(value)) fail();
      }
      if (state.ledger.cashFlow !== undefined) {
        const cf = state.ledger.cashFlow;
        if (!object(cf) || !Array.isArray(cf.history)) fail();
        for (const day of [cf.today, cf.yesterday, ...cf.history]) {
          if (!object(day)) fail();
          for (const key of [
            "opening",
            "closing",
            "operating",
            "investing",
            "financing",
          ])
            if (!number(day[key], -Number.MAX_VALUE)) fail();
          for (const key of ["operations", "inflow", "outflow"])
            if (day[key] !== undefined && !number(day[key])) fail();
          for (const key of ["netWorthBefore", "netWorthAfter"])
            if (day[key] !== undefined && !number(day[key], -Number.MAX_VALUE))
              fail();
          if (day.movements !== undefined) {
            if (!Array.isArray(day.movements)) fail();
            for (const movement of day.movements)
              if (
                !object(movement) ||
                typeof movement.description !== "string" ||
                movement.description.length > 200 ||
                !["operating", "investing", "financing"].includes(
                  movement.activity,
                ) ||
                !number(movement.amount, -Number.MAX_VALUE)
              )
                fail();
          }
          if (
            Math.abs(
              day.closing -
                day.opening -
                day.operating -
                day.investing -
                day.financing,
            ) > Math.max(1e-6, Math.abs(day.closing) * 1e-12)
          )
            fail();
        }
      }
    }
    if (
      state.logistics &&
      (!object(state.logistics) ||
        !Array.isArray(state.logistics.deliveries) ||
        !Array.isArray(state.logistics.receivables))
    )
      fail();
    if (
      state.taxes &&
      (!integer(state.taxes.daysToReport, 1) ||
        state.taxes.daysToReport > 30 ||
        !number(state.taxes.taxableBase, -Number.MAX_VALUE) ||
        !number(state.taxes.totalPaid))
    )
      fail();
    if (
      state.eventLog &&
      (!Array.isArray(state.eventLog) ||
        state.eventLog.some(
          (e) =>
            !integer(e.day, 1) ||
            typeof e.msg !== "string" ||
            !["good", "bad", "info"].includes(e.type),
        ))
    )
      fail();
    for (const q of [...state.quests.completed, ...state.quests.claimed])
      if (!QUESTS.LIST.some((item) => item.id === q)) fail();
    if (
      new Set(state.quests.completed).size !== state.quests.completed.length ||
      new Set(state.quests.claimed).size !== state.quests.claimed.length ||
      state.quests.claimed.some((q) => !state.quests.completed.includes(q))
    )
      fail();
    for (const offer of state.b2bOffers)
      if (
        typeof offer.id !== "string" ||
        !/^[a-zA-Z0-9_]+$/.test(offer.id) ||
        !RECIPES.RESOURCES[offer.itemId] ||
        !integer(offer.qty, 1) ||
        !number(offer.price, 0.01) ||
        !number(offer.totalPrice, 0.01) ||
        !number(offer.quality, 0.01) ||
        offer.quality > 10 ||
        !number(offer.brandPower) ||
        typeof offer.company !== "string" ||
        !integer(offer.expiresDay, 1)
      )
        fail();
    if (state.market) {
      if (
        !object(state.market) ||
        !object(state.market.pools) ||
        !number(state.market.inflationIndex, 0.01)
      )
        fail();
      for (const name of [
        "pools",
        "trends",
        "productionModifiers",
        "sellDemand",
      ]) {
        const values = state.market[name];
        if (values !== undefined && !object(values)) fail();
        for (const [item, value] of Object.entries(values ?? {}))
          if (
            !RECIPES.RESOURCES[item] ||
            !number(value) ||
            (["pools", "sellDemand"].includes(name) && !integer(value))
          )
            fail();
      }
      if (
        state.market.priceHistory !== undefined &&
        !object(state.market.priceHistory)
      )
        fail();
      for (const [item, hist] of Object.entries(
        state.market.priceHistory ?? {},
      ))
        if (
          !RECIPES.RESOURCES[item] ||
          !Array.isArray(hist) ||
          hist.some((h) => !integer(h.day, 1) || !number(h.price, 0.01))
        )
          fail();
    }
    if (state.stockMarket) {
      const sm = state.stockMarket;
      if (
        sm.ipoDay !== undefined &&
        (!integer(sm.ipoDay, 1) || sm.ipoDay > state.time.day)
      )
        fail();
      if (
        !object(sm) ||
        !object(sm.companies) ||
        !object(sm.portfolio) ||
        !number(sm.macroTrend, 0.01) ||
        !integer(sm.lastDividendsDay)
      )
        fail();
      const validIds = new Set([
        "player",
        ...B2B_AI.competitors.map((c) => c.id),
      ]);
      for (const [id, comp] of Object.entries(sm.companies))
        if (
          !validIds.has(id) ||
          comp.id !== id ||
          typeof comp.name !== "string" ||
          !number(comp.sharePrice, 0.01) ||
          !integer(comp.sharesAvailable) ||
          !Array.isArray(comp.netWorthHistory) ||
          comp.netWorthHistory.some((v) => !number(v, 0.01)) ||
          (comp.founderShares !== undefined && !integer(comp.founderShares))
        )
          fail();
      for (const [id, amount] of Object.entries(sm.portfolio))
        if (
          !sm.companies[id] ||
          id === "player" ||
          !integer(amount) ||
          amount +
            sm.companies[id].sharesAvailable +
            (sm.companies[id].founderShares ?? 0) >
            STOCK_MARKET.TOTAL_SHARES
        )
          fail();
      if (sm.costBasis !== undefined && !object(sm.costBasis)) fail();
      for (const [id, cost] of Object.entries(sm.costBasis ?? {}))
        if (!sm.companies[id] || !number(cost)) fail();
      if (sm.selectedStock !== undefined && !sm.companies[sm.selectedStock])
        fail();
    }
    for (const b of state.company.businesses) {
      const tpl = RECIPES.BUSINESSES[b.type];
      if (
        !number(b.locMult, 0.01) ||
        b.equipment.count > b.level * (tpl.slotsPerLevel ?? 10) ||
        !number(b.equipment.quality ?? 1, 0.01)
      )
        fail();
      if (b.campaign !== undefined && ![0, 1, 2, 3].includes(b.campaign))
        fail();
      for (const dest of Object.keys(b.routing ?? {}))
        if (!ids.has(Number(dest))) fail();
      for (const key of ["lastOutput", "total"])
        if (b.stats[key] !== undefined && !integer(b.stats[key])) fail();
      if (b.stats.history !== undefined && !Array.isArray(b.stats.history))
        fail();
      for (const h of b.stats.history ?? []) {
        if (
          !integer(h.day, 1) ||
          !number(h.revenue) ||
          !number(h.cogs) ||
          !number(h.missed) ||
          !object(h.items)
        )
          fail();
        if (h.opex !== undefined && !number(h.opex)) fail();
        for (const key of ["depreciation", "repair"])
          if (h[key] !== undefined && !number(h[key])) fail();
        for (const [key, sold] of Object.entries(h.items))
          if (
            !RECIPES.RESOURCES[key] ||
            !integer(sold.qty) ||
            !number(sold.revenue) ||
            !number(sold.cogs) ||
            !integer(sold.missedQty) ||
            !number(sold.missedRevenue)
          )
            fail();
      }
    }
    for (const [key, points] of Object.entries(state.rnd.savedProgress ?? {}))
      if (!RECIPES.BUSINESSES[key] || !number(points)) fail();
    if (
      state.rnd.facility &&
      (state.rnd.facility.equipment.count > state.rnd.facility.level * 5 ||
        Object.values(state.rnd.staff).reduce((n, v) => n + v, 0) >
          state.rnd.facility.level * 5)
    )
      fail();
    return state;
  },
  parse(text) {
    if (text.length > 10 * 1024 * 1024)
      throw new Error("Файл сохранения слишком большой.");
    const payload = JSON.parse(text);
    if (payload.version !== this.VERSION)
      throw new Error("Неподдерживаемая версия сохранения.");
    return this.validate(payload.state);
  },
  replace(state) {
    for (const key of Object.keys(STATE)) delete STATE[key];
    Object.assign(STATE, state);
    MARKET._initialized = false;
    MARKET.recipeMap = null;
  },
  load() {
    this.ready = true;
    try {
      const text = localStorage.getItem(this.KEY);
      if (text) {
        this.replace(this.parse(text));
        return true;
      }
      STATE.tutorial.isActive =
        localStorage.getItem("uabiz_tutorial_done") !== "1";
    } catch (error) {
      this.blocked = true;
      NOTIFY.error(
        "Сохранение не загружено",
        error.message +
          " Исходное сохранение сохранено. Импортируйте исправный файл или начните новую игру.",
      );
    }
    return false;
  },
  serialize() {
    this.validate(STATE);
    return JSON.stringify({ version: this.VERSION, state: STATE });
  },
  save() {
    if (!this.ready || this.blocked || GAME.processing) return false;
    try {
      localStorage.setItem(this.KEY, this.serialize());
      return true;
    } catch (error) {
      if (!this.lastError)
        NOTIFY.error(
          "Не удалось сохранить игру",
          error.message + " Экспортируйте сохранение в файл.",
        );
      this.lastError = error.message;
      return false;
    }
  },
  export() {
    try {
      const url = URL.createObjectURL(
        new Blob([this.serialize()], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "uabiz-day-" + STATE.time.day + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      NOTIFY.error("Экспорт не выполнен", e.message);
    }
  },
  async importFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = this.parse(text);
      if (!confirm("Заменить текущую игру импортированным сохранением?"))
        return;
      // Backup is written first; on quota failure the current game stays intact.
      localStorage.setItem(
        this.KEY + "_backup",
        localStorage.getItem(this.KEY) ?? this.serialize(),
      );
      localStorage.setItem(this.KEY, text);
      this.replace(data);
      this.blocked = false;
      this.lastError = null;
      GAME.prepare();
      UI_DASHBOARD.closeStoreModal();
      UI_DASHBOARD.update();
      TUTORIAL.init();
    } catch (e) {
      NOTIFY.error("Импорт не выполнен", e.message);
    }
  },
  newGame() {
    if (
      !confirm(
        "Перезапустить компанию? День, деньги, объекты и весь прогресс будут сброшены. Текущее сохранение останется в резервной копии.",
      )
    )
      return;
    try {
      localStorage.setItem(
        this.KEY + "_backup",
        localStorage.getItem(this.KEY) ?? this.serialize(),
      );
      localStorage.removeItem("uabiz_tutorial_done");
      this.replace(JSON.parse(JSON.stringify(this.defaults)));
      this.blocked = false;
      this.lastError = null;
      GAME.prepare();
      UI_DASHBOARD.closeStoreModal();
      UI_DASHBOARD.resetNavigation?.();
      UI_DASHBOARD.update();
      TUTORIAL.init();
    } catch (e) {
      NOTIFY.error("Новая игра не создана", e.message);
    }
  },
};
