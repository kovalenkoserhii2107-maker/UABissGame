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
                    // Ищем склад назначения (если город удалили из игры, везем в Одессу)
                    let targetWh = STATE.company.warehouses[d.targetCity];
                    if (!targetWh) targetWh = STATE.company.warehouses['odesa']; 

                    if (!targetWh.inventory[d.item]) {
                        targetWh.inventory[d.item] = { qty: 0, avgCost: 0, quality: 1.0 };
                    }
                    
                    let inv = targetWh.inventory[d.item];
                    let oldTotal = inv.qty * inv.avgCost;
                    
                    inv.qty += d.qty;
                    inv.avgCost = (oldTotal + d.cost) / inv.qty;
                    
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
                    
                    // Записываем в бухгалтерию P&L
                    if (STATE.ledger && STATE.ledger.yesterday) {
                        STATE.ledger.yesterday.rev_b2b = (STATE.ledger.yesterday.rev_b2b || 0) + r.amount;
                        STATE.ledger.yesterday.exp_materials = (STATE.ledger.yesterday.exp_materials || 0) + r.cogs;
                    }
                    STATE.logistics.receivables.splice(i, 1);
                }
            }
        }
    }
};
