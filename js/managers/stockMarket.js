// Модуль Фондового Рынка (Stock Market) и Слияний/Поглощений
const STOCK_MARKET = {
    TOTAL_SHARES: 100000,
    FREE_FLOAT_PERCENT: 0.30, // 30% акций доступны для торговли
    BROKER_FEE: 0.015, // 1.5% комиссия брокера

    init() {
        if (!STATE.stockMarket) {
            STATE.stockMarket = {
                companies: {}, // Котировки и данные по компаниям
                portfolio: {}, // Портфель игрока: { npcId: sharesCount }
                macroTrend: 1.0, // Глобальный тренд рынка (Bull/Bear)
                lastDividendsDay: 0
            };
        }
        
        // Инициализация компании игрока
        if (!STATE.stockMarket.companies['player']) {
            STATE.stockMarket.companies['player'] = {
                id: 'player',
                name: 'Моя Корпорация',
                netWorthHistory: [],
                sharePrice: 10,
                sharesAvailable: this.TOTAL_SHARES * this.FREE_FLOAT_PERCENT,
                isPlayer: true
            };
        }

        // Инициализация NPC компаний
        if (typeof B2B_AI !== 'undefined' && B2B_AI.competitors) {
            B2B_AI.competitors.forEach(comp => {
                if (!STATE.stockMarket.companies[comp.id]) {
                    // Стартовый капитал NPC зависит от Tier
                    let baseNetWorth = comp.tier * 500000;
                    let initialPrice = (baseNetWorth * comp.brandMod) / this.TOTAL_SHARES;
                    
                    STATE.stockMarket.companies[comp.id] = {
                        id: comp.id,
                        name: comp.name,
                        netWorthHistory: [],
                        sharePrice: Math.max(1, initialPrice),
                        sharesAvailable: this.TOTAL_SHARES * this.FREE_FLOAT_PERCENT,
                        isPlayer: false,
                        capital: baseNetWorth // Виртуальный капитал компании
                    };
                }
            });
        }
    },

    processDaily() {
        this.init();
        
        // 1. Изменение макро-тренда (Случайные рыночные колебания)
        let trendShift = (Math.random() - 0.5) * 0.02; // -1% to +1%
        STATE.stockMarket.macroTrend += trendShift;
        if (STATE.stockMarket.macroTrend > 1.5) STATE.stockMarket.macroTrend = 1.5;
        if (STATE.stockMarket.macroTrend < 0.5) STATE.stockMarket.macroTrend = 0.5;

        // 2. Обновление котировок для всех компаний
        Object.keys(STATE.stockMarket.companies).forEach(id => {
            let compData = STATE.stockMarket.companies[id];
            
            let netWorth = 0;
            let brandPower = 1.0;
            
            if (compData.isPlayer) {
                netWorth = typeof FINANCE !== 'undefined' ? FINANCE.calculateNetWorth() : 10000;
                brandPower = (STATE.company && STATE.company.brandPower) ? STATE.company.brandPower : 1.0;
            } else {
                let npcInfo = B2B_AI.competitors.find(c => c.id === id);
                if (npcInfo) {
                    // Имитируем рост капитала ИИ на 0.1-0.5% в день
                    compData.capital = (compData.capital || 50000) * (1.001 + Math.random() * 0.004);
                    netWorth = compData.capital;
                    brandPower = npcInfo.brandMod;
                }
            }

            // Шум акций конкретной компании (-2% to +2%)
            let localNoise = 1.0 + (Math.random() - 0.5) * 0.04;
            
            let fundamentalPrice = (netWorth * brandPower * STATE.stockMarket.macroTrend) / this.TOTAL_SHARES;
            compData.sharePrice = Math.max(0.1, fundamentalPrice * localNoise);
            
            // Сохраняем историю для графиков (храним последние 60 дней)
            compData.netWorthHistory.push(compData.sharePrice);
            if (compData.netWorthHistory.length > 60) {
                compData.netWorthHistory.shift();
            }
        });
        
        // 3. Дивиденды (каждые 30 дней)
        if (STATE.time.day > 0 && STATE.time.day % 30 === 0 && STATE.stockMarket.lastDividendsDay !== STATE.time.day) {
            this.payDividends();
            STATE.stockMarket.lastDividendsDay = STATE.time.day;
        }
    },
    
    payDividends() {
        let totalDividends = 0;
        
        // Игрок получает дивиденды от прибыльных NPC, если у него есть их акции
        if (STATE.stockMarket.portfolio) {
            Object.keys(STATE.stockMarket.portfolio).forEach(id => {
                let sharesOwned = STATE.stockMarket.portfolio[id] || 0;
                if (sharesOwned > 0 && STATE.stockMarket.companies[id]) {
                    let compData = STATE.stockMarket.companies[id];
                    // Допустим, компания платит 2% от своей капитализации в год, значит ~0.16% за месяц
                    let dividendPerShare = (compData.sharePrice * 0.0016) + (Math.random() * 0.02);
                    let payout = sharesOwned * dividendPerShare;
                    totalDividends += payout;
                }
            });
        }
        
        if (totalDividends > 0) {
            STATE.finances.balance += totalDividends;
            if (typeof LEDGER !== 'undefined') LEDGER.record('rev_b2b', totalDividends); // Проведем как b2b доход
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Дивиденды выплачены', `Ваш портфель акций принес пассивный доход: $${formatMoney(totalDividends)}`);
        }
    },

    buyShares(companyId, amount) {
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) return false;
        
        let comp = STATE.stockMarket.companies[companyId];
        if (!comp) return false;
        
        if (amount > comp.sharesAvailable) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка', 'Недостаточно акций в свободной продаже (Free Float).');
            return false;
        }
        
        let cost = amount * comp.sharePrice;
        let fee = cost * this.BROKER_FEE;
        let totalCost = cost + fee;
        
        if (STATE.finances.balance < totalCost) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Нет средств', `Не хватает денег. Нужно $${formatMoney(totalCost)} (включая комиссию 1.5%).`);
            return false;
        }
        
        STATE.finances.balance -= totalCost;
        if (typeof LEDGER !== 'undefined') LEDGER.record('exp_fines', fee); // Комиссия идет в убыток
        
        comp.sharesAvailable -= amount;
        STATE.stockMarket.portfolio[companyId] = (STATE.stockMarket.portfolio[companyId] || 0) + amount;
        
        if (typeof NOTIFY !== 'undefined') NOTIFY.success('Брокер', `Успешно куплено ${amount} акций ${comp.name}. Комиссия: $${formatMoney(fee)}`);
        
        // Проверка на поглощение (M&A)
        let totalOwned = STATE.stockMarket.portfolio[companyId];
        if (totalOwned >= this.TOTAL_SHARES * 0.51 && !comp.isAcquired) {
            comp.isAcquired = true;
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Слияние и Поглощение (M&A) 👔', `Поздравляем! Вы выкупили контрольный пакет (>51%) акций ${comp.name}. Корпорация теперь ваша дочерняя компания!`);
        }
        
        if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        return true;
    },
    
    sellShares(companyId, amount) {
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) return false;
        
        let owned = STATE.stockMarket.portfolio[companyId] || 0;
        if (amount > owned) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка', 'У вас нет столько акций этой компании.');
            return false;
        }
        
        let comp = STATE.stockMarket.companies[companyId];
        let revenue = amount * comp.sharePrice;
        let fee = revenue * this.BROKER_FEE;
        let totalRevenue = revenue - fee;
        
        STATE.finances.balance += totalRevenue;
        if (typeof LEDGER !== 'undefined') LEDGER.record('exp_fines', fee); // Комиссия брокера
        
        comp.sharesAvailable += amount;
        STATE.stockMarket.portfolio[companyId] -= amount;
        
        if (typeof NOTIFY !== 'undefined') NOTIFY.success('Брокер', `Успешно продано ${amount} акций ${comp.name}. Зачислено: $${formatMoney(totalRevenue)}`);
        
        // Потеря контроля при падении ниже 51%
        if (STATE.stockMarket.portfolio[companyId] < this.TOTAL_SHARES * 0.51 && comp.isAcquired) {
            comp.isAcquired = false;
            if (typeof NOTIFY !== 'undefined') NOTIFY.info('Потеря контроля', `Вы больше не владеете контрольным пакетом ${comp.name}.`);
        }
        
        if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        return true;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STOCK_MARKET };
}
