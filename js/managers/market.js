// Модуль внешнего рынка B2B
const MARKET = {
    // Базовые цены на старые ресурсы
    BASE_PRICES: {
        silicon: 5,       // Кремний
        plastic: 2,       // Пластик
        chips: 25,        // Микросхемы
        parts3d: 8,       // Детали 3D
        software: 200,    // Софт
        drops: 15,        // Системы сброса
        drones: 800       // Готовый FPV-дрон
    },

    // Мультипликаторы трендов рынка (изменяются каждый день)
    trends: {
        silicon: 1.0, plastic: 1.0, chips: 1.0, 
        parts3d: 1.0, software: 1.0, drops: 1.0, drones: 1.0
    },

    // Получить актуальную цену на сегодня
    getCurrentPrice(itemKey) {
        // 1. Ищем базовую цену: сначала в старом словаре, затем в новых рецептах
        let basePrice = this.BASE_PRICES[itemKey];
        if (basePrice === undefined && RECIPES.RESOURCES[itemKey]) {
            basePrice = RECIPES.RESOURCES[itemKey].basePrice || 0;
        }
        
        // 2. Ищем тренд (если это новый товар, ставим коэффициент 1.0)
        let trend = this.trends[itemKey] || 1.0;
        
        return basePrice * trend;
    },
    
    // Покупка ресурсов
    buy(itemKey, qty) {
        let price = this.getCurrentPrice(itemKey);
        let cost = price * qty;
        
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost; // Деньги списываются сразу
            
            // Записываем товар в очередь доставки
            if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
            STATE.logistics.deliveries.push({ item: itemKey, qty: qty, cost: cost, daysLeft: 1 });
            
            NOTIFY.success('Успех', `Закупка оформлена. ${qty} шт. прибудут на склад завтра.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', `Недостаточно средств. Нужно $${formatMoney(cost)}`);
        }
    },

    // Продажа готовой продукции или излишков
    sell(itemKey, qty) {
        let inv = STATE.company.inventory[itemKey];
        if (inv && inv.qty >= qty) {
            let price = this.getCurrentPrice(itemKey) * (inv.quality || 1);
            let revenue = price * qty;
            
            let cogs = qty * inv.avgCost; // <--- НОВОЕ: Считаем себестоимость оптовой партии
            
            // Списываем товар со склада сразу
            inv.qty -= qty;
            if (inv.qty === 0) inv.avgCost = 0;
            
            // Записываем деньги и себестоимость в дебиторскую задолженность
            if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
            STATE.logistics.receivables.push({ amount: revenue, cogs: cogs, source: 'B2B', daysLeft: 1 }); // <--- НОВОЕ: Передаем cogs в логистику
            
            NOTIFY.success('Успех', `Партия отгружена. Выручка $${formatMoney(revenue)} поступит завтра.`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        }
    },

    // Симуляция живого рынка (вызывается каждый день)
    simulate() {
        // Теперь мы обновляем тренды для ВСЕХ товаров из базы данных
        Object.keys(RECIPES.RESOURCES).forEach(key => {
            // Инициализируем тренд для новых товаров (станков)
            if (this.trends[key] === undefined) {
                this.trends[key] = 1.0; 
            }
            
            // Цена может измениться на +/- 5% за день
            let change = (Math.random() * 0.1) - 0.05; 
            this.trends[key] += change;
            
            // Защита от экстремальных обвалов
            if (this.trends[key] < 0.5) this.trends[key] = 0.5;
            if (this.trends[key] > 2.0) this.trends[key] = 2.0;
        });
    }
}; // <--- ВОТ ЭТА СКОБКА ЗАКРЫВАЕТ ОБЪЕКТ MARKET. ОНА ОБЯЗАТЕЛЬНА!

// А вот теперь объявляем новый модуль логистики
const LOGISTICS = {
    processDaily() {
        if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };
        
        // 1. Приход товаров
        let newDeliveries = [];
        STATE.logistics.deliveries.forEach(d => {
            d.daysLeft--;
            if (d.daysLeft <= 0) {
                let inv = STATE.company.inventory[d.item];
                if (!inv) inv = { qty: 0, avgCost: 0, quality: 1.0 };
                
                let oldTotal = inv.qty * inv.avgCost;
                let newTotal = d.cost; // Затраченная сумма
                inv.avgCost = (oldTotal + newTotal) / (inv.qty + d.qty);
                inv.qty += d.qty;
                STATE.company.inventory[d.item] = inv;
            } else {
                newDeliveries.push(d);
            }
        });
        STATE.logistics.deliveries = newDeliveries;

        // 2. Приход денег
        let newReceivables = [];
        STATE.logistics.receivables.forEach(r => {
            r.daysLeft--;
            if (r.daysLeft <= 0) {
                STATE.finances.balance += r.amount;
                if (typeof LEDGER !== 'undefined' && r.source === 'B2B') {
                    LEDGER.record('rev_b2b', r.amount); // Записываем оптовый доход
                    if (r.cogs) LEDGER.record('exp_materials', r.cogs); // <--- НОВОЕ: Списываем себестоимость партии в P&L
                }
            } else {
                newReceivables.push(r);
            }
        });
        STATE.logistics.receivables = newReceivables;
    }
};

// Модуль Розничных продаж (B2C) и Маркетинга
const RETAIL = {
    // Базовый трафик локаций (покупателей в день на 1 магазин)
    TRAFFIC: { center: 150, residential: 60, suburb: 20 },
    
    processDaily() {
        if (!STATE.retail) STATE.retail = { brand: 10, history: [] };
        let dailyReport = { revenue: 0, sold: {}, traffic: 0 };
        let totalRevenue = 0;
        
        // 1. Офисы маркетинга повышают Глобальный Бренд
        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (tpl.isMarketing) {
                let marketers = biz.assigned ? (biz.assigned.marketer || 0) : 0;
                let pr = biz.assigned ? (biz.assigned.pr_manager || 0) : 0;
                let eqCount = biz.equipment.count || 0;
                let totalAssigned = marketers + pr;
                
                let workingRatio = totalAssigned > 0 ? Math.min(1, eqCount / totalAssigned) : 0;
                let effMarketers = marketers * workingRatio;
                let effPR = pr * workingRatio;
                
                let campaignLevel = biz.campaign || 0;
                let campaignCost = 0;
                let campaignMult = 1.0;

                if (campaignLevel == 1) { campaignCost = 100; campaignMult = 1.5; }
                else if (campaignLevel == 2) { campaignCost = 500; campaignMult = 2.5; }
                else if (campaignLevel == 3) { campaignCost = 2000; campaignMult = 5.0; }

                if (totalAssigned > 0) {
                    if (STATE.finances.balance >= campaignCost) {
                        STATE.finances.balance -= campaignCost;
                        if (typeof LEDGER !== 'undefined') LEDGER.record('exp_marketing', campaignCost); // <--- ВЫВЕЛИ В ОТДЕЛЬНУЮ СТАТЬЮ 
                    } else {
                        campaignMult = 1.0;
                        biz.campaign = 0; 
                    }
                }
                
                let brandGain = ((effMarketers * 0.2) + (effPR * 0.5)) * campaignMult;
                STATE.retail.brand += brandGain;
            }
        });
        
        // Естественное падение узнаваемости бренда
        STATE.retail.brand -= 0.5;
        if (STATE.retail.brand > 100) STATE.retail.brand = 100;
        if (STATE.retail.brand < 1) STATE.retail.brand = 1; 

        // Влияние бренда на трафик (1% = базовый, 100% = x3 трафика)
        let brandMult = 1 + (STATE.retail.brand / 50); 
        
        // 2. Продажи в каждом МАГАЗИНЕ со своих локальных складов
        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (tpl.isRetail) {
                let baseT = this.TRAFFIC[biz.location] || 50;
                let sellers = biz.assigned ? (biz.assigned.salesman || 0) : 0;
                let managers = biz.assigned ? (biz.assigned.store_manager || 0) : 0;
                
                let staffMult = (sellers * 1.0) + (managers * 1.5);
                if (staffMult > 1) staffMult = 1.0; 
                if (staffMult === 0) staffMult = 0.1; 
                
                // Финальный трафик магазина
                let storeTraffic = Math.floor(baseT * staffMult * brandMult);
                dailyReport.traffic += storeTraffic;
                
                // Подготовка статистики продаж за день
                if (!biz.stats) biz.stats = {};
                biz.stats.lastSold = {}; // Очищаем вчерашние продажи этого магазина
                
                if (biz.localInventory) {
                    Object.keys(biz.localInventory).forEach(key => {
                        let inv = biz.localInventory[key];
                        if (inv.qty > 0) {
                            let b2bPrice = MARKET.getCurrentPrice(key);
                            
                            if (!biz.prices) biz.prices = {};
                            let retailPrice = biz.prices[key] || (b2bPrice * 2.5);
                            let priceRatio = retailPrice / b2bPrice;
                            
                            // ЭЛАСТИЧНОСТЬ СПРОСА (Защита от сверхприбылей)
                            // Если цена в 5 раз больше оптовой (и выше) -> спрос падает до 0
                            let priceMult = Math.max(0, 1 - ((priceRatio - 1) / 4)); 
                            
                            let qualityMult = inv.quality || 1.0; 
                            
                            // Конверсия (процент людей, купивших товар)
                            let conversion = 0.15 * priceMult * qualityMult;
                            
                            let demand = Math.floor(storeTraffic * conversion);
                            let soldQty = Math.min(demand, inv.qty); 
                            
                            if (soldQty > 0) {
                                let revenue = soldQty * retailPrice;
                                let cogs = soldQty * inv.avgCost; // <--- НОВОЕ: Считаем закупочную себестоимость проданного
                                
                                STATE.finances.balance += revenue;
                                
                                if (typeof LEDGER !== 'undefined') {
                                    LEDGER.record('rev_b2c', revenue); // <--- Теперь это отдельная статья B2C
                                    LEDGER.record('exp_materials', cogs); // <--- НОВОЕ: Списываем себестоимость в P&L
                                }
                                
                                inv.qty -= soldQty;
                                if (inv.qty === 0) inv.avgCost = 0;
                                
                                // Записываем в магазин и в общий отчет
                                biz.stats.lastSold[key] = { qty: soldQty, revenue: revenue };
                                totalRevenue += revenue;
                                
                                if (!dailyReport.sold[key]) dailyReport.sold[key] = { qty: 0, revenue: 0 };
                                dailyReport.sold[key].qty += soldQty;
                                dailyReport.sold[key].revenue += revenue;
                            }
                        }
                    });
                }
            }
        });
        
        dailyReport.revenue = totalRevenue;
        STATE.retail.history.push(dailyReport);
        if (STATE.retail.history.length > 7) STATE.retail.history.shift(); 
    }
};
