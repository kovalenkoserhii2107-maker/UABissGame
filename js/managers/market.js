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
            }
            // Инициализация мощностей поставщиков (1.0 = норма)
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
        return STATE.market.pools[itemKey] !== undefined ? STATE.market.pools[itemKey] : 0;
    },

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
            STATE.market.pools[itemKey] -= qty;
            
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

    simulate() {
        this.init();
        
        STATE.market.inflationIndex += 0.0005; 
        let targetIndex = STATE.market.inflationIndex;

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            let equilibriumVolume = res.dailyMarketPool || 1000; 
            let currentPool = STATE.market.pools[key] || 0;
            let currentTrend = this.trends[key];
            let prodMod = STATE.market.productionModifiers[key];

            // 1. АДАПТАЦИЯ ПОСТАВЩИКОВ (Невидимая рука рынка)
            // Оцениваем рентабельность товара относительно уровня инфляции
            let profitability = currentTrend / targetIndex; 

            if (profitability > 1.3) {
                // Сверхприбыль! Поставщики переоборудуют мощности под этот товар (рост от 0.5% до 2.5% в день)
                prodMod += (Math.random() * 0.02 + 0.005); 
            } else if (profitability < 0.85) {
                // Убытки. Поставщики сворачивают производство и уходят с рынка
                prodMod -= (Math.random() * 0.015 + 0.005); 
            } else {
                // Рынок спокоен. Мощности плавно (0.2% в день) стремятся к норме 1.0
                if (prodMod > 1.0) prodMod -= 0.002;
                if (prodMod < 1.0) prodMod += 0.002;
            }

            // Ограничения на мощности поставщиков (не менее 20% и не более 500% от нормы)
            if (prodMod < 0.2) prodMod = 0.2;
            if (prodMod > 5.0) prodMod = 5.0;
            
            STATE.market.productionModifiers[key] = prodMod;

            // 2. ПРИТОК ТОВАРА (С учетом новых мощностей поставщиков)
            // Базовый приток 20% умножается на множитель мощностей (prodMod)
            let dailyInflux = equilibriumVolume * 0.2 * prodMod; 
            let supplyShock = 0.8 + Math.random() * 0.4; 

            if (Math.random() < 0.04) {
                supplyShock = 0.1 + Math.random() * 0.3; // Жесткий кризис 
            } else if (Math.random() < 0.04) {
                supplyShock = 2.0 + Math.random() * 1.5; // Локальное разовое перепроизводство
            }

            let newArrivals = Math.floor(dailyInflux * supplyShock);
            currentPool += newArrivals;

            // Емкость складов биржи тоже резиновая, но имеет предел, чтобы товар не копился до миллиардов
            let maxStorage = equilibriumVolume * 1.5 * Math.max(1, prodMod);
            if (currentPool > maxStorage) {
                currentPool = maxStorage;
            }
            STATE.market.pools[key] = currentPool;

            // 3. ЦЕНООБРАЗОВАНИЕ
            // Чем больше производят (prodMod), тем больше нормальный объем рынка
            let actualEquilibrium = equilibriumVolume * Math.max(1, prodMod * 0.5); 
            let remainingRatio = actualEquilibrium > 0 ? (currentPool / actualEquilibrium) : 1; 
            let priceChange = 0;

            if (remainingRatio < 0.3) {
                priceChange = 0.04 + Math.random() * 0.08; 
            } else if (remainingRatio < 0.7) {
                priceChange = 0.01 + Math.random() * 0.04;
            } else if (remainingRatio > 1.2) {
                // Перепроизводство обваливает цены
                priceChange = -0.04 - Math.random() * 0.06; 
            } else if (remainingRatio > 0.95) {
                priceChange = -0.02 - Math.random() * 0.04;
            } else {
                priceChange = (Math.random() * 0.06) - 0.03; 
            }

            // РЫНОЧНАЯ ГРАВИТАЦИЯ
            if (remainingRatio >= 0.7 && remainingRatio <= 0.95) {
                if (this.trends[key] > targetIndex + 0.2) priceChange -= 0.03; 
                if (this.trends[key] < targetIndex - 0.2) priceChange += 0.03; 
            }

            priceChange += 0.0005; // Инфляция
            this.trends[key] += priceChange;
            
            // Жесткие ограничители цены от макроэкономической нормы
            if (this.trends[key] < targetIndex * 0.3) this.trends[key] = targetIndex * 0.3;
            if (this.trends[key] > targetIndex * 5.0) this.trends[key] = targetIndex * 5.0;
        });
    }
};
