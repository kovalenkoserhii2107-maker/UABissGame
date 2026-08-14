// Модуль обработки доставок и платежей (Товары и деньги в пути)
const LOGISTICS = {
    processDaily() {
        if (!STATE.logistics) return;
        
        // 1. Входящие грузы (покупки на бирже приехали на локальный склад)
        if (STATE.logistics.deliveries) {
            for (let i = STATE.logistics.deliveries.length - 1; i >= 0; i--) {
                let d = STATE.logistics.deliveries[i];
                d.daysLeft--;
                
                if (d.daysLeft <= 0) {
                    let targetWh = STATE.company.warehouses[d.targetCity];
                    if (!targetWh) targetWh = STATE.company.warehouses['odesa']; 

                    if (!targetWh.inventory[d.item]) {
                        targetWh.inventory[d.item] = { qty: 0, avgCost: 0, quality: 1.0 };
                    }
                    
                    let inv = targetWh.inventory[d.item];
                    let oldTotal = inv.qty * inv.avgCost;
                    let oldTotalQ = inv.qty * (inv.quality || 1.0);
                    
                    // ВАЖНО: Добавляем транспортные расходы (d.logCost) в себестоимость товара!
                    let deliveryLogCost = d.logCost || 0;
                    let delQuality = d.quality || 1.0;
                    
                    inv.qty += d.qty;
                    inv.avgCost = (oldTotal + d.cost + deliveryLogCost) / inv.qty;
                    inv.quality = (oldTotalQ + (d.qty * delQuality)) / inv.qty;
                    
                    STATE.logistics.deliveries.splice(i, 1); 
                }
            }
        }
        
        // 2. Исходящие деньги (выручка от B2B-продаж поступила на счет)
        if (STATE.logistics.receivables) {
            for (let i = STATE.logistics.receivables.length - 1; i >= 0; i--) {
                let r = STATE.logistics.receivables[i];
                r.daysLeft--;
                if (r.daysLeft <= 0) {
                    STATE.finances.balance += r.amount;
                    
                    // Записываем в бухгалтерию P&L через Ledger
                    if (typeof LEDGER !== 'undefined') {
                        LEDGER.record('rev_b2b', r.amount);
                        if (r.cogs > 0) LEDGER.record('exp_materials', r.cogs);
                    }
                    STATE.logistics.receivables.splice(i, 1);
                }
            }
        }
    }
};
