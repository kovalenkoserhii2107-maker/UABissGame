// Модуль внешнего рынка B2B с макроэкономикой, инфляцией и САМОРЕГУЛЯЦИЕЙ ПОСТАВЩИКОВ
const MARKET = {
    trends: {},

    get prices() {
        let dynamicPrices = {};
        if (typeof RECIPES !== 'undefined' && RECIPES.RESOURCES) {
            Object.keys(RECIPES.RESOURCES).forEach(k => {
                dynamicPrices[k] = this.getCurrentPrice(k);
            });
        }
        return dynamicPrices;
    },

    init() {
        if (!STATE.market) STATE.market = { pools: {}, inflationIndex: 1.0, productionModifiers: {} };
        if (STATE.market.inflationIndex === undefined) STATE.market.inflationIndex = 1.0; 
        if (STATE.market.productionModifiers === undefined) STATE.market.productionModifiers = {};

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            if (this.trends[key] === undefined) this.trends[key] = 1.0; 
            
            if (STATE.market.pools[key] === undefined) {
                STATE.market.pools[key] = res.dailyMarketPool || 1000;
            } else {
                // БРОНЕЖИЛЕТ 1: Жестко лечим старые сейвы от дробей прямо при загрузке
                STATE.market.pools[key] = Math.floor(STATE.market.pools[key]);
            }
            
            if (STATE.market.productionModifiers[key] === undefined) {
                STATE.market.productionModifiers[key] = 1.0;
            }
        });
    },

    getCurrentPrice(itemKey) {
        this.init();
        let res = RECIPES.RESOURCES[itemKey];
        if (!res) return 0;
        let basePrice = res.basePrice || 10;
        let trend = this.trends[itemKey] || 1.0;
        return basePrice * trend;
    },
    
    getAvailablePool(itemKey) {
        this.init();
        // БРОНЕЖИЛЕТ 2: Даже если в STATE попадет дробь, интерфейс получит только целое число
        return STATE.market.pools[itemKey] !== undefined ? Math.floor(STATE.market.pools[itemKey]) : 0;
    },

    buy(itemKey, qty) {
        this.init();
        let res = RECIPES.RESOURCES[itemKey];
        if (!res) return;

        qty = Math.floor(qty); // Защита от покупки дробного количества
        let availableQty = this.getAvailablePool(itemKey);

        if (qty > availableQty) {
            NOTIFY.error('Дефицит на бирже', `Невозможно купить ${qty} шт. Доступно на рынке: ${availableQty} шт.`);
            return;
        }

        let price = this.getCurrentPrice(itemKey);
        let cost = price * qty;
        
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost; 
            // БРОНЕЖИЛЕТ 3: Округляем после транзакции
            STATE.market.pools[itemKey] = Math.floor(STATE.market.pools[itemKey] - qty);
            
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
        qty = Math.floor(qty);
        if (inv && Math.floor(inv.qty) >= qty) {
            let price = this.getCurrentPrice(itemKey) * (inv.quality || 1);
            let revenue = price * qty;
            let cogs = qty * inv.avgCost;
            
            inv.qty = Math.floor(inv.qty - qty);
            if (inv.qty <= 0) {
                inv.qty = 0;
                inv.avgCost = 0;
            }
            
            if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
            STATE.logistics.receivables.push({ amount: revenue, cogs: cogs, source: 'B2B', daysLeft: 1 });
            
            NOTIFY.success('Успех', `Партия отгружена. Выручка $${formatMoney(revenue)} поступит завтра.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        }
    },

    simulate() {
        this.init();
        
        STATE.market.inflationIndex += 0.0005; 
        let targetIndex = STATE.market.inflationIndex;

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            let equilibriumVolume = res.dailyMarketPool || 1000; 
            
            // Сразу приводим к целому числу перед любыми математическими операциями
            let currentPool = Math.floor(STATE.market.pools[key] || 0);
            let currentTrend = this.trends[key];
            let prodMod = STATE.market.productionModifiers[key];

            // 1. АДАПТАЦИЯ ПОСТАВЩИКОВ
            let profitability = currentTrend / targetIndex; 

            if (profitability > 1.3) {
                prodMod += (Math.random() * 0.02 + 0.005); 
            } else if (profitability < 0.85) {
                prodMod -= (Math.random() * 0.015 + 0.005); 
            } else {
                if (prodMod > 1.0) prodMod -= 0.002;
                if (prodMod < 1.0) prodMod += 0.002;
            }

            if (prodMod < 0.2) prodMod = 0.2;
            if (prodMod > 5.0) prodMod = 5.0;
            
            STATE.market.productionModifiers[key] = prodMod;

            // 2. ПРИТОК ТОВАРА
            let dailyInflux = equilibriumVolume * 0.2 * prodMod; 
            let supplyShock = 0.8 + Math.random() * 0.4; 

            if (Math.random() < 0.04) {
                supplyShock = 0.1 + Math.random() * 0.3; 
            } else if (Math.random() < 0.04) {
                supplyShock = 2.0 + Math.random() * 1.5; 
            }

            let newArrivals = Math.floor(dailyInflux * supplyShock);
            currentPool += newArrivals;

            let maxStorage = Math.floor(equilibriumVolume * 1.5 * Math.max(1, prodMod));
            if (currentPool > maxStorage) {
                currentPool = maxStorage;
            }
            
            // БРОНЕЖИЛЕТ 4: Жесткая запись исключительно целого числа обратно в состояние
            STATE.market.pools[key] = Math.floor(currentPool);

            // 3. ЦЕНООБРАЗОВАНИЕ
            let actualEquilibrium = equilibriumVolume * Math.max(1, prodMod * 0.5); 
            let remainingRatio = actualEquilibrium > 0 ? (currentPool / actualEquilibrium) : 1; 
            let priceChange = 0;

            if (remainingRatio < 0.3) {
                priceChange = 0.04 + Math.random() * 0.08; 
            } else if (remainingRatio < 0.7) {
                priceChange = 0.01 + Math.random() * 0.04;
            } else if (remainingRatio > 1.2) {
                priceChange = -0.04 - Math.random() * 0.06; 
            } else if (remainingRatio > 0.95) {
                priceChange = -0.02 - Math.random() * 0.04;
            } else {
                priceChange = (Math.random() * 0.06) - 0.03; 
            }

            if (remainingRatio >= 0.7 && remainingRatio <= 0.95) {
                if (this.trends[key] > targetIndex + 0.2) priceChange -= 0.03; 
                if (this.trends[key] < targetIndex - 0.2) priceChange += 0.03; 
            }

            priceChange += 0.0005; 
            this.trends[key] += priceChange;
            
            if (this.trends[key] < targetIndex * 0.3) this.trends[key] = targetIndex * 0.3;
            if (this.trends[key] > targetIndex * 5.0) this.trends[key] = targetIndex * 5.0;
        });
    }
};
