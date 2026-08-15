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
        this._initialized = true;
    },

    init() {
        if (this._initialized && STATE.market) return;
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

    buy(itemKey, qty, cityId) {
        this.init();
        let res = RECIPES.RESOURCES[itemKey];
        if (!res) return;

        qty = Math.floor(qty);
        let availableQty = this.getAvailablePool(itemKey);

        if (qty > availableQty) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Дефицит на бирже', `Невозможно купить ${qty} шт. Доступно: ${availableQty} шт.`);
            return;
        }

        let cityName = typeof GEO !== 'undefined' ? GEO.getCity(cityId).name : cityId;
        let itemVol = res.volume || 1.0; 
        let totalVol = itemVol * qty;

        // 1. Учитываем объем товаров, которые УЖЕ заказаны и находятся в пути в этот город
        let pendingVol = 0;
        if (STATE.logistics && STATE.logistics.deliveries) {
            STATE.logistics.deliveries.forEach(d => {
                if (d.targetCity === cityId && RECIPES.RESOURCES[d.item]) {
                    pendingVol += d.qty * (RECIPES.RESOURCES[d.item].volume || 1.0);
                }
            });
        }

        // ПРОВЕРКА ЛИМИТА СКЛАДА С УЧЕТОМ ТОВАРОВ В ПУТИ
        if (typeof WAREHOUSE !== 'undefined' && WAREHOUSE.getCurrentVolume) {
            let freeSpace = WAREHOUSE.getMaxVolume(cityId) - WAREHOUSE.getCurrentVolume(cityId) - pendingVol;
            if (totalVol > freeSpace) {
                if (typeof NOTIFY !== 'undefined') NOTIFY.error('Склад переполнен!', `В г. ${cityName} нет места (с учетом товаров в пути). Свободно: ${Math.max(0, freeSpace).toFixed(1)} м³.`);
                return;
            }
        }

        // 2. Транспортные расходы от главного оптового хаба (Киева) до целевого склада
        let dist = typeof GEO !== 'undefined' ? Math.max(10, GEO.getDistance('kyiv', cityId)) : 10;
        let logBase = typeof GEO !== 'undefined' ? GEO.COUNTRIES['ua'].macro.logisticsBaseRate : 0.015;
        let logCost = dist * logBase * totalVol;

        let price = this.getCurrentPrice(itemKey);
        let itemCost = price * qty;
        let totalCost = itemCost + logCost; // Конечная стоимость партии с учетом доставки
        
        if (STATE.finances.balance >= totalCost) {
            STATE.finances.balance -= totalCost; 
            STATE.market.pools[itemKey] = Math.floor(STATE.market.pools[itemKey] - qty);
            
            // Списываем логистику в P&L
            if (typeof LEDGER !== 'undefined' && logCost > 0) {
                LEDGER.record('exp_logistics', logCost);
            }
            
            if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
            
            STATE.logistics.deliveries.push({ 
                id: Date.now() + Math.random().toString(36).substr(2, 5), // Уникальный ID ордера
                item: itemKey, 
                qty: qty, 
                cost: itemCost,       // Стоимость самого товара (пойдет в себестоимость на складе)
                logCost: logCost,     // Транспортные расходы (для отображения)
                totalCost: totalCost, // Сколько всего списано
                daysLeft: 1, 
                targetCity: cityId,
                isMarketOrder: true,  // Флаг того, что это прямой заказ с биржи
                quality: 1.0,
                brand: 0
            });
            
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Ордер размещен', `Закупка оформлена. ${qty} шт. прибудут в г. ${cityName} завтра.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка', `Недостаточно средств. С учетом доставки требуется $${formatMoney(totalCost)}`);
        }
    },

    // НОВЫЙ МЕТОД: Отмена оформленного ордера
    cancelOrder(orderId) {
        if (!STATE.logistics || !STATE.logistics.deliveries) return;
        
        let idx = STATE.logistics.deliveries.findIndex(d => d.id === orderId && d.isMarketOrder);
        if (idx !== -1) {
            let d = STATE.logistics.deliveries[idx];
            
            // Возвращаем общую стоимость ордера на счет
            STATE.finances.balance += d.totalCost;
            
            // Возвращаем товар на биржу
            if (STATE.market && STATE.market.pools[d.item] !== undefined) {
                STATE.market.pools[d.item] += d.qty;
            }

            // Откатываем логистические расходы в бухгалтерии, чтобы они не дублировались в P&L
            if (typeof LEDGER !== 'undefined' && STATE.ledger && STATE.ledger.today && d.logCost > 0) {
                STATE.ledger.today.exp_logistics = Math.max(0, STATE.ledger.today.exp_logistics - d.logCost);
                STATE.ledger.total.exp_logistics = Math.max(0, STATE.ledger.total.exp_logistics - d.logCost);
            }

            STATE.logistics.deliveries.splice(idx, 1);
            
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Отмена сделки', `Ордер аннулирован. Товар возвращен на биржу, средства компенсированы.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        }
    },

    sell(itemKey, qty, cityId = 'odesa') {
        let wh = STATE.company.warehouses[cityId];
        let inv = wh ? wh.inventory[itemKey] : null;
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
            
            let cityName = typeof GEO !== 'undefined' ? GEO.getCity(cityId).name : cityId;
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Успех', `Партия отгружена со склада ${cityName}. Выручка $${formatMoney(revenue)} поступит завтра.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
             if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка', 'Недостаточно товара на складе для продажи.');
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
