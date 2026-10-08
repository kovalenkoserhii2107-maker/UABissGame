// Goods arriving at the beginning of a day can be used that same day.
const LOGISTICS = {
    processDaily() {
        WAREHOUSE.init();
        if (!STATE.logistics) return;
        for (let i = STATE.logistics.deliveries.length - 1; i >= 0; i--) {
            const d = STATE.logistics.deliveries[i];
            d.daysLeft = Math.max(0, d.daysLeft - 1);
            const wh = STATE.company.warehouses[d.targetCity];
            if (d.daysLeft || !wh?.level) continue;
            if (OPERATIONS.fit(wh.inventory, WAREHOUSE.getMaxVolume(d.targetCity), d.item) < d.qty) continue;
            if (!OPERATIONS.add(wh.inventory, d.item, d.qty, d.cost + (d.logCost ?? 0), d.quality ?? 1, d.brand ?? 0)) continue;
            STATE.logistics.deliveries.splice(i, 1);
        }
        for (let i = STATE.logistics.receivables.length - 1; i >= 0; i--) {
            const r = STATE.logistics.receivables[i];
            r.daysLeft = Math.max(0, r.daysLeft - 1);
            if (r.daysLeft) continue;
            LEDGER.cash(r.amount, 'operating', 'Оплата B2B');
            // Compatibility for earlier unrecognised receivables.
            if (!r.recognized) { LEDGER.record('rev_b2b', r.amount); LEDGER.record('exp_materials', r.cogs ?? 0); }
            STATE.logistics.receivables.splice(i, 1);
        }
    }
};
