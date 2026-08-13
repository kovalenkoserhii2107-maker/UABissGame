// Модуль внешнего рынка B2B: Инерция, Цепочки поставок и Лимиты складов
const MARKET = {
    trends: {},
    recipeMap: null,

    get prices() {
        let dynamicPrices = {};
        if (typeof RECIPES !== 'undefined' && RECIPES.RESOURCES) {
            Object.keys(RECIPES.RESOURCES).forEach(k => {
                dynamicPrices[k] = this.getCurrentPrice(k);
            });
        }
        return dynamicPrices;
    },

    // Карта зависимостей (кто из чего состоит)
    buildRecipeMap() {
        if (this.recipeMap) return;
        this.recipeMap = {};
        if (typeof RECIPES === 'undefined' || !RECIPES.BUSINESSES) return;

        Object.keys(RECIPES.BUSINESSES).forEach(bKey => {
            let biz = RECIPES.BUSINESSES[bKey];
            if (biz.output && biz.inputs && !biz.isRetail && !biz.isMarketing) {
                this.recipeMap[biz.output] = biz.inputs;
            }
        });
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
                STATE.market.pools[key] = Math.floor(STATE.market.pools[key]);
            }
            
            if (STATE.market.productionModifiers[key] === undefined) {
                STATE.market.productionModifiers[key] = 1.0;
            }
        });
        
        this.buildRecipeMap();
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
        return STATE.market.pools[itemKey] !== undefined ? Math.floor(STATE.market.pools[itemKey]) : 0;
    },

    buy(itemKey, qty) {
        this.init();
        let res = RECIPES.RESOURCES[itemKey];
        if (!res) return;

        qty = Math.floor(qty);
        let availableQty = this.getAvailablePool(itemKey);

        if (qty > availableQty) {
            NOTIFY.error('Дефицит на бирже', `Невозможно купить ${qty} шт. Доступно: ${availableQty} шт.`);
            return;
        }

        // ПРОВЕРКА ЛИМИТА СКЛАДА ИГРОКА
        if (typeof WAREHOUSE !== 'undefined' && WAREHOUSE.getCurrentVolume) {
            let itemVol = res.volume || 1.0; 
            let totalVol = itemVol * qty;
            let freeSpace = WAREHOUSE.getMaxVolume() - WAREHOUSE.getCurrentVolume();
            
            if (totalVol > freeSpace) {
                NOTIFY.error('Склад переполнен!', `Не хватает места. Свободно: ${freeSpace.toFixed(1)} м³. Требуется: ${totalVol.toFixed(1)} м³.`);
                return;
            }
        }

        let price = this.getCurrentPrice(itemKey);
        let cost = price * qty;
        
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost; 
            STATE.market.pools[itemKey] = Math.floor(STATE.market.pools[itemKey] - qty);
            
            if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
            STATE.logistics.deliveries.push({ item: itemKey, qty: qty, cost: cost, daysLeft: 1 });
            
            NOTIFY.success('Успех', `Закупка оформлена. ${qty} шт. прибудут завтра.`);
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
            
            NOTIFY.success('Успех', `Отгружено. Выручка $${formatMoney(revenue)} поступит завтра.`);
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
            let currentPool = Math.floor(STATE.market.pools[key] || 0);
            let currentTrend = this.trends[key];
            let prodMod = STATE.market.productionModifiers[key];

            let yesterdayEquilibrium = equilibriumVolume * prodMod;
            let yesterdayRatio = yesterdayEquilibrium > 0 ? (currentPool / yesterdayEquilibrium) : 1;
            let profitability = currentTrend / targetIndex; 

            // 1. ИНЕРЦИЯ ПРОИЗВОДСТВА (Растет и падает плавно)
            let targetChange = 0;
            if (yesterdayRatio < 0.15) {
                targetChange = 0.03 + Math.random() * 0.02; // Рост 3-5% в день
            } else if (profitability > 1.4) {
                targetChange = 0.01 + Math.random() * 0.02; 
            } else if (profitability < 0.8 || yesterdayRatio > 1.3) {
                targetChange = -0.02 - Math.random() * 0.02; // Сворачивание мощностей
            } else {
                if (prodMod > 1.0) targetChange = -0.005;
                if (prodMod < 1.0) targetChange = 0.005;
            }
            prodMod += targetChange;

            if (prodMod < 0.1) prodMod = 0.1;
            if (prodMod > 100.0) prodMod = 100.0;
            STATE.market.productionModifiers[key] = prodMod;

            // 2. ЦЕПОЧКИ ПОСТАВОК И ПРИТОК ТОВАРА
            let dailyInflux = equilibriumVolume * 0.25 * prodMod; 
            let supplyShock = 0.8 + Math.random() * 0.4; 
            if (Math.random() < 0.04) supplyShock = 0.1 + Math.random() * 0.3; 
            else if (Math.random() < 0.04) supplyShock = 1.5 + Math.random() * 1.0; 

            let attemptedArrivals = Math.floor(dailyInflux * supplyShock);
            let bottleneckRatio = 1.0;
            let inputsNeeded = this.recipeMap ? this.recipeMap[key] : null;

            // Если товар требует сырья — пытаемся забрать его с рынка
            if (inputsNeeded) {
                Object.keys(inputsNeeded).forEach(inKey => {
                    let reqPerItem = inputsNeeded[inKey];
                    let totalNeeded = attemptedArrivals * reqPerItem;
                    let availableInMarket = STATE.market.pools[inKey] || 0;
                    
                    if (totalNeeded > 0) {
                        let ratio = availableInMarket / totalNeeded;
                        if (ratio < bottleneckRatio) bottleneckRatio = ratio; // Упираемся в самое дефицитное сырье
                    }
                });
                
                // Срезаем выпуск финального товара
                attemptedArrivals = Math.floor(attemptedArrivals * Math.max(0, bottleneckRatio));
                
                // Сжигаем сырье с биржи на производство
                Object.keys(inputsNeeded).forEach(inKey => {
                    let consumed = attemptedArrivals * inputsNeeded[inKey];
                    STATE.market.pools[inKey] = Math.max(0, Math.floor((STATE.market.pools[inKey] || 0) - consumed));
                });
            }

            currentPool += attemptedArrivals;

            // Склады рынка
            let maxStorage = Math.floor(equilibriumVolume * 2.0 * prodMod);
            if (currentPool > maxStorage) currentPool = maxStorage;
            
            STATE.market.pools[key] = Math.floor(currentPool);

            // 3. ЦЕНООБРАЗОВАНИЕ
            let actualEquilibrium = equilibriumVolume * prodMod; 
            let remainingRatio = actualEquilibrium > 0 ? (currentPool / actualEquilibrium) : 1; 
            let priceChange = 0;

            if (remainingRatio < 0.2) priceChange = 0.04 + Math.random() * 0.08; 
            else if (remainingRatio < 0.6) priceChange = 0.01 + Math.random() * 0.05;
            else if (remainingRatio > 1.3) priceChange = -0.04 - Math.random() * 0.06; 
            else if (remainingRatio > 0.95) priceChange = -0.02 - Math.random() * 0.04;
            else priceChange = (Math.random() * 0.06) - 0.03; 

            // Гравитация
            if (remainingRatio >= 0.6 && remainingRatio <= 0.95) {
                if (this.trends[key] > targetIndex + 0.3) priceChange -= 0.04; 
                if (this.trends[key] < targetIndex - 0.3) priceChange += 0.04; 
            }

            priceChange += 0.0005; 
            this.trends[key] += priceChange;
            
            // Расширенный коридор цен
            if (this.trends[key] < targetIndex * 0.2) this.trends[key] = targetIndex * 0.2;
            if (this.trends[key] > targetIndex * 20.0) this.trends[key] = targetIndex * 20.0;
        });
    }
};
