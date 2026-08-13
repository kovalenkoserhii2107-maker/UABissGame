// Модуль внешнего рынка B2B с ограничением пулов и дефицитом
const MARKET = {
    trends: {},

    // Инициализация рыночных пулов и трендов
    init() {
        if (!STATE.market) STATE.market = { pools: {} };
        
        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            if (this.trends[key] === undefined) this.trends[key] = 1.0; 
            if (STATE.market.pools[key] === undefined) {
                STATE.market.pools[key] = res.dailyMarketPool || 1000;
            }
        });
    },

    // Получить текущую цену с учетом рыночного тренда
    getCurrentPrice(itemKey) {
        this.init();
        let res = RECIPES.RESOURCES[itemKey];
        if (!res) return 0;
        let basePrice = res.basePrice || 10;
        let trend = this.trends[itemKey] || 1.0;
        return basePrice * trend;
    },
    
    // Получить доступное количество товара на бирже сегодня
    getAvailablePool(itemKey) {
        this.init();
        return STATE.market.pools[itemKey] !== undefined ? STATE.market.pools[itemKey] : 0;
    },

    // Покупка ресурсов с проверкой лимитов
    buy(itemKey, qty) {
        this.init();
        let res = RECIPES.RESOURCES[itemKey];
        if (!res) return;

        let availableQty = this.getAvailablePool(itemKey);

        if (qty > availableQty) {
            NOTIFY.error('Дефицит на бирже', `Невозможно купить ${qty} шт. Доступно на рынке: ${availableQty} шт.`);
            return;
        }

        let price = this.getCurrentPrice(itemKey);
        let cost = price * qty;
        
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost; 
            STATE.market.pools[itemKey] -= qty; // Списываем с биржи
            
            if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
            STATE.logistics.deliveries.push({ item: itemKey, qty: qty, cost: cost, daysLeft: 1 });
            
            NOTIFY.success('Успех', `Закупка оформлена. ${qty} шт. прибудут на склад завтра.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', `Недостаточно средств. Нужно $${formatMoney(cost)}`);
        }
    },

    sell(itemKey, qty) {
        let inv = STATE.company.inventory[itemKey];
        if (inv && inv.qty >= qty) {
            let price = this.getCurrentPrice(itemKey) * (inv.quality || 1);
            let revenue = price * qty;
            let cogs = qty * inv.avgCost;
            
            inv.qty -= qty;
            if (inv.qty === 0) inv.avgCost = 0;
            
            if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
            STATE.logistics.receivables.push({ amount: revenue, cogs: cogs, source: 'B2B', daysLeft: 1 });
            
            NOTIFY.success('Успех', `Партия отгружена. Выручка $${formatMoney(revenue)} поступит завтра.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        }
    },

    // Симуляция живого рынка (вызывается каждый день в gameLoop)
    simulate() {
        this.init();
        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            let maxPool = res.dailyMarketPool || 1000;
            let currentPool = STATE.market.pools[key] || 0;

            // Если выкупили более 70% пула, возникает давление дефицита (цена растет)
            let remainingRatio = currentPool / maxPool;
            let deficitPressure = 0;
            if (remainingRatio < 0.3) {
                deficitPressure = 0.05 + (0.3 - remainingRatio) * 0.2; 
            }

            let change = (Math.random() * 0.1) - 0.04 + deficitPressure; 
            this.trends[key] += change;
            
            if (this.trends[key] < 0.5) this.trends[key] = 0.5;
            if (this.trends[key] > 3.0) this.trends[key] = 3.0;

            // Восполнение рынка на следующий день
            STATE.market.pools[key] = maxPool;
        });
    }
};
