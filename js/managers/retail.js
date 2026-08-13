// Модуль розничных продаж и маркетинга (B2C)
const RETAIL = {
    init() {
        if (!STATE.retail) STATE.retail = { prices: {}, brand: 10, history: [] };
    },

    // Главный цикл розницы (вызывается каждый день в gameLoop)
    processDaily() {
        this.init();
        
        let brandPower = 0;
        let storeBoosts = {};    // UID магазина -> сила трафика
        let productBoosts = {};  // Товар -> сила эластичности цены
        let dailyMarketingCost = 0;

        // --- ШАГ 1. СБОР МАРКЕТИНГОВЫХ ЭФФЕКТОВ ---
        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl.isMarketing) return;
            
            // Стоимость и множитель кампаний: 0 - Органика, 1 - Контекст, 2 - Медиа, 3 - ТВ/Национальная
            let campaignCosts = { 0: 0, 1: 100, 2: 500, 3: 2000 };
            let campaignMults = { 0: 1.0, 1: 1.5, 2: 2.5, 3: 5.0 };
            
            let campType = biz.campaign || 0;
            dailyMarketingCost += campaignCosts[campType];
            
            let marketers = biz.assigned.marketer || 0;
            let pr = biz.assigned.pr_manager || 0;
            let totalStaff = marketers + pr;
            
            // Если нет ПК, сотрудники простаивают
            let eqCount = biz.equipment ? (biz.equipment.count || 0) : 0;
            let workingRatio = totalStaff > 0 ? Math.min(1, eqCount / totalStaff) : 0;
            
            // Расчет сырой силы агентства
            let rawPower = ((marketers * 0.2) + (pr * 0.5)) * workingRatio;
            let finalPower = rawPower * campaignMults[campType];
            
            // Распределение силы по таргетам
            let tType = biz.targetType || 'brand';
            let tId = biz.targetId || '';
            
            if (tType === 'brand') brandPower += finalPower;
            else if (tType === 'store') {
                if (!storeBoosts[tId]) storeBoosts[tId] = 0;
                storeBoosts[tId] += finalPower;
            }
            else if (tType === 'product') {
                if (!productBoosts[tId]) productBoosts[tId] = 0;
                productBoosts[tId] += finalPower;
            }
        });

        // Списание бюджета на рекламу и глобальный Бренд
        if (dailyMarketingCost > 0) {
            STATE.finances.balance -= dailyMarketingCost;
            if (STATE.ledger && STATE.ledger.yesterday) {
                STATE.ledger.yesterday.exp_marketing = (STATE.ledger.yesterday.exp_marketing || 0) + dailyMarketingCost;
            }
        }

        // Динамика бренда (растет от PR, но органически забывается на 0.1% в день)
        STATE.retail.brand += brandPower;
        STATE.retail.brand -= 0.1; 
        if (STATE.retail.brand < 1) STATE.retail.brand = 1;
        if (STATE.retail.brand > 100) STATE.retail.brand = 100;

        let brandTrafficMult = 1.0 + (STATE.retail.brand / 100); // 100% Бренд = х2 трафика везде

        // --- ШАГ 2. ОБРАБОТКА ПРОДАЖ В КАЖДОМ МАГАЗИНЕ ---
        let totalB2CRevenue = 0;

        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl.isRetail) return;
            
            if (!biz.stats) biz.stats = { lastSold: {} };
            biz.stats.lastSold = {}; // Обнуляем статистику за вчера

            let sales = biz.assigned.salesman || 0;
            let mgr = biz.assigned.store_manager || 0;
            let totalStaff = sales + mgr;
            let maxStaff = tpl.staffReq * (biz.level || 1);
            
            // Без директора или продавцов магазин закрыт
            if (mgr === 0 || sales === 0) return;
            let staffEfficiency = Math.min(1.0, totalStaff / maxStaff);

            // 1. ЕМКОСТЬ И ТРАФИК (Пригород - 500, Спальный - 2000, Центр - 10000)
            let locMult = biz.locMult || 1.0;
            let maxCapacity = locMult < 1.0 ? 500 : (locMult > 1.0 ? 10000 : 2000);

            // Органика (5%) + Буст от Агентства (каждая 1 ед. силы дает +100 человек)
            let baseTraffic = maxCapacity * 0.05; 
            let storeBonus = (storeBoosts[biz.uid] || 0) * 100; 
            
            let potentialTraffic = (baseTraffic + storeBonus) * brandTrafficMult;
            
            // Жесткий срез по емкости локации
            let actualTraffic = Math.floor(Math.min(potentialTraffic, maxCapacity) * staffEfficiency);

            // Качество витрин
            let eqCount = biz.equipment ? (biz.equipment.count || 0) : 0;
            let eqCondition = biz.equipment ? (biz.equipment.condition || 100) : 100;
            let displayEfficiency = (eqCount > 0) ? (eqCondition / 100) : 0.1; // Без витрин почти не покупают

            // 2. ПРОДАЖА ТОВАРОВ
            if (biz.localInventory) {
                Object.keys(biz.localInventory).forEach(itemKey => {
                    let inv = biz.localInventory[itemKey];
                    if (inv.qty <= 0) return;

                    let b2bPrice = MARKET.getCurrentPrice(itemKey) || 1;
                    let retailPrice = (biz.prices && biz.prices[itemKey]) ? biz.prices[itemKey] : b2bPrice * 1.3;
                    
                    let markup = retailPrice / b2bPrice; // Например, 1.5 = +50% наценка

                    // 3. ЭЛАСТИЧНОСТЬ ЦЕНЫ И КОНВЕРСИЯ
                    // Базово люди терпят +30% к опту. Реклама товара расширяет толерантность!
                    let baseTolerance = 0.3; 
                    let productBonus = (productBoosts[itemKey] || 0) * 0.1; 
                    let tolerance = Math.min(1.5, baseTolerance + productBonus); // Максимум можно "продать" бренд с наценкой +150%

                    // Штраф за жадность:
                    // Если наценка 1.3 и Tolerance 0.3 -> (1.3-1)/0.3 = 1 -> Penalty = 0 (Никто не купит)
                    // Если наценка 1.1 и Tolerance 0.3 -> (1.1-1)/0.3 = 0.33 -> Penalty = 0.67 (Купят 67% от базы)
                    let pricePenalty = 1.0 - ((markup - 1.0) / tolerance);
                    
                    if (pricePenalty < 0) pricePenalty = 0; // Слишком дорого
                    if (pricePenalty > 1.5) pricePenalty = 1.5; // Демпинг (распродажа) повышает конверсию до х1.5

                    // Финальный расчет
                    let baseConversion = 0.15; // 15% зашедших покупают товар (если цена ок)
                    let qualityBonus = inv.quality || 1.0; // Высокое качество (звезды) дает буст
                    
                    let finalConversion = baseConversion * pricePenalty * qualityBonus * displayEfficiency;
                    
                    let itemsSold = Math.floor(actualTraffic * finalConversion);
                    
                    // Легкий RNG (рыночный шум от 80% до 120%)
                    itemsSold = Math.floor(itemsSold * (0.8 + Math.random() * 0.4)); 

                    if (itemsSold > inv.qty) itemsSold = inv.qty; // Не можем продать больше, чем есть

                    if (itemsSold > 0) {
                        let revenue = itemsSold * retailPrice;
                        let cogs = itemsSold * inv.avgCost; // Себестоимость проданного
                        
                        inv.qty -= itemsSold;
                        if (inv.qty === 0) inv.avgCost = 0;

                        totalB2CRevenue += revenue;

                        // Запись в статистику магазина
                        biz.stats.lastSold[itemKey] = {
                            qty: itemsSold,
                            revenue: revenue,
                            cogs: cogs
                        };
                        
                        // Запись в глобальную бухгалтерию
                        if (STATE.ledger && STATE.ledger.yesterday) {
                            STATE.ledger.yesterday.rev_b2c = (STATE.ledger.yesterday.rev_b2c || 0) + revenue;
                            STATE.ledger.yesterday.exp_materials = (STATE.ledger.yesterday.exp_materials || 0) + cogs;
                        }
                    }
                });
            }
        });
        
        return totalB2CRevenue; // Возвращаем для логов, если нужно
    }
};
