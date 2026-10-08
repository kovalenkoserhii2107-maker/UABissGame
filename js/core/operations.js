// Shared inventory and equipment operations. Validate before changing state.
const OPERATIONS = {
  quantity(qty) {
    return Number.isSafeInteger(qty) && qty > 0;
  },
  lastId: 0,
  id() {
    this.lastId = Math.max(Date.now() * 1000, this.lastId + 1);
    return this.lastId;
  },
  volume(item) {
    return RECIPES.RESOURCES[item]?.volume ?? 0;
  },
  inventoryVolume(inventory = {}) {
    return Object.entries(inventory).reduce(
      (sum, [key, it]) => sum + it.qty * this.volume(key),
      0,
    );
  },
  inventoryValue(inventory = {}) {
    return Object.values(inventory).reduce(
      (sum, it) => sum + it.qty * it.avgCost,
      0,
    );
  },
  storeCapacity(biz) {
    return RECIPES.BUSINESSES[biz.type].area * biz.level * 2;
  },
  fit(inventory, capacity, item) {
    const volume = this.volume(item);
    return volume === 0
      ? Number.MAX_SAFE_INTEGER - (inventory[item]?.qty ?? 0)
      : Math.max(
          0,
          Math.floor(
            (capacity - this.inventoryVolume(inventory) + 1e-9) / volume,
          ),
        );
  },
  add(inventory, item, qty, totalCost, quality = 1, brand = 0) {
    if (
      !RECIPES.RESOURCES[item] ||
      !this.quantity(qty) ||
      !Number.isFinite(totalCost) ||
      totalCost < 0 ||
      !Number.isFinite(quality) ||
      quality <= 0 ||
      !Number.isFinite(brand) ||
      brand < 0
    )
      return false;
    const old = inventory[item] ?? { qty: 0, avgCost: 0, quality: 1, brand: 0 };
    const count = old.qty + qty;
    if (!Number.isSafeInteger(count)) return false;
    inventory[item] = {
      qty: count,
      avgCost: (old.qty * old.avgCost + totalCost) / count,
      quality: (old.qty * (old.quality ?? 1) + qty * quality) / count,
      brand: (old.qty * (old.brand ?? 0) + qty * brand) / count,
    };
    return true;
  },
  take(inventory, item, qty) {
    const inv = inventory?.[item];
    if (!this.quantity(qty) || !inv || inv.qty < qty) return null;
    const batch = {
      qty,
      cost: qty * inv.avgCost,
      quality: inv.quality ?? 1,
      brand: inv.brand ?? 0,
    };
    inv.qty -= qty;
    if (inv.qty === 0) {
      inv.avgCost = 0;
      inv.quality = 1;
      inv.brand = 0;
    }
    return batch;
  },
  transferToStore(item, cityId, storeUid, qty) {
    const store = STATE.company.businesses.find((b) => b.uid === storeUid);
    const wh = STATE.company.warehouses[cityId];
    const tpl = store && RECIPES.BUSINESSES[store.type];
    if (
      !this.quantity(qty) ||
      !wh?.level ||
      !tpl?.isRetail ||
      !tpl.accepts.includes(item)
    )
      return 0;
    const inv = wh.inventory[item];
    if (!inv || inv.qty < qty) return 0;
    store.localInventory ??= {};
    qty = Math.min(
      qty,
      this.fit(store.localInventory, this.storeCapacity(store), item),
    );
    if (!qty) return 0;
    const unitShipping = GEO.getLogisticsCost(
      cityId,
      store.city,
      this.volume(item),
      "store",
      store.locMult,
    );
    if (unitShipping > 0)
      qty = Math.min(
        qty,
        Math.max(0, Math.floor(STATE.finances.balance / unitShipping)),
      );
    if (!qty) return 0;
    const shipping = GEO.getLogisticsCost(
      cityId,
      store.city,
      qty * this.volume(item),
      "store",
      store.locMult,
    );
    if (STATE.finances.balance < shipping) return 0;
    const batch = this.take(wh.inventory, item, qty);
    LEDGER.cash(-shipping, "operating", "Доставка в магазин");
    this.add(
      store.localInventory,
      item,
      qty,
      batch.cost + shipping,
      batch.quality,
      batch.brand,
    );
    return qty;
  },
  wear(equipment, amount, resource) {
    const before = equipment.condition ?? 100;
    equipment.bookValue ??=
      (equipment.count * RECIPES.RESOURCES[resource].basePrice * before) / 100;
    const after = Math.max(0, before - amount);
    const depreciation =
      before > 0 ? (equipment.bookValue * (before - after)) / before : 0;
    equipment.bookValue = Math.max(0, equipment.bookValue - depreciation);
    equipment.condition = after;
    LEDGER.record("exp_depreciation", depreciation);
  },
};
