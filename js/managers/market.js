// Модуль внешнего рынка B2B с макроэкономикой, волатильностью и ИНФЛЯЦИЕЙ
const MARKET = {
    trends: {},

    // Мост совместимости для контрактов
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
        if (!STATE.market) STATE.market = { pools: {}, inflationIndex: 1.0 };
        // Инициализируем индекс инфляции, если это старое сохранение
        if (STATE.market.inflationIndex === undefined) STATE.market.inflationIndex = 1.0; 

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            if (this.trends[key] === undefined) this.trends[key] = 1.0; 
            if (STATE.market.pools[key] === undefined) {
                STATE.market.pools[key] = res.dailyMarketPool || 1000;
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

    // Симуляция живого рынка (вызывается каждый день в gameLoop)
    simulate() {
        this.init();
        
        // Макроэкономическая инфляция: +0.05% в день (около +20% в год)
        STATE.market.inflationIndex += 0.0005; 
        let targetIndex = STATE.market.inflationIndex;

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            let maxPool = res.dailyMarketPool || 1000; 
            let currentPool = STATE.market.pools[key] || 0;

            let remainingRatio = maxPool > 0 ? (currentPool / maxPool) : 1; 
            let priceChange = 0;

            if (remainingRatio < 0.25) {
                priceChange = 0.04 + Math.random() * 0.08; 
            } else if (remainingRatio < 0.6) {
                priceChange = 0.01 + Math.random() * 0.04;
            } else if (remainingRatio > 0.9) {
                priceChange = -0.03 - Math.random() * 0.05; 
            } else {
                priceChange = (Math.random() * 0.06) - 0.03; 
            }

            // РЫНОЧНАЯ ГРАВИТАЦИЯ (теперь тянет к уровню ИНФЛЯЦИИ, а не к 1.0)
            if (remainingRatio >= 0.6 && remainingRatio <= 0.9) {
                if (this.trends[key] > targetIndex + 0.2) priceChange -= 0.02; // Пузырь сдувается
                if (this.trends[key] < targetIndex - 0.2) priceChange += 0.02; // Недооцененный актив дорожает
            }

            // Добавляем базовое инфляционное давление к каждому ресурсу
            priceChange += 0.0005;

            this.trends[key] += priceChange;
            
            // Динамические ограничители относительно инфляции
            if (this.trends[key] < targetIndex * 0.5) this.trends[key] = targetIndex * 0.5;
            if (this.trends[key] > targetIndex * 3.0) this.trends[key] = targetIndex * 3.0;

            let supplyShock = 0.75 + Math.random() * 0.50; 

            if (Math.random() < 0.04) {
                supplyShock = 0.15 + Math.random() * 0.25; 
                if (res.isRaw && typeof NOTIFY !== 'undefined') {
                    if (Math.random() < 0.3) NOTIFY.error('Сбой поставок', `Резкое сокращение квот на ${res.name}. Ожидается дефицит.`);
                }
            }
            else if (Math.random() < 0.04) {
                supplyShock = 1.5 + Math.random() * 0.8; 
            }

            STATE.market.pools[key] = Math.floor(maxPool * supplyShock);
        });
    }
};
