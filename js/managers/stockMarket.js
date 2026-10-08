// Модуль Фондового Рынка (Stock Market) и Слияний/Поглощений
const STOCK_MARKET = {
    TOTAL_SHARES: 100000,
    FREE_FLOAT_PERCENT: 0.30, // 30% акций доступны для торговли
    BROKER_FEE: 0.015, // 1.5% комиссия брокера
    IPO_THRESHOLD: 500000,

    init() {
        if (!STATE.stockMarket) {
            STATE.stockMarket = {
                companies: {}, // Котировки и данные по компаниям
                portfolio: {},
                costBasis: {}, // Портфель игрока: { npcId: sharesCount }
                macroTrend: 1.0, // Глобальный тренд рынка (Bull/Bear)
                lastDividendsDay: 0
            };
        }

        STATE.stockMarket.costBasis ??= {};
        for (const [id, amount] of Object.entries(STATE.stockMarket.portfolio)) STATE.stockMarket.costBasis[id] ??= amount * STATE.stockMarket.companies[id].sharePrice;
        // Existing listings are retained; new companies list only by explicit choice.

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
                        founderShares: this.TOTAL_SHARES * (1 - this.FREE_FLOAT_PERCENT),
                        isPlayer: false,
                        capital: baseNetWorth // Виртуальный капитал компании
                    };
                }
            });
        }
    },

    launchIPO() {
        this.init();
        const playerNetWorth = FINANCE.calculateNetWorth();
        if (STATE.stockMarket.companies.player) return false;
        if (playerNetWorth < this.IPO_THRESHOLD) {
            NOTIFY.error('IPO недоступно', 'Нужна капитализация от $' + formatMoney(this.IPO_THRESHOLD) + '.');
            return false;
        }
        STATE.stockMarket.companies.player = {
            id: 'player',
            name: STATE.company.name || 'Моя Корпорация',
            netWorthHistory: [],
            sharePrice: playerNetWorth / this.TOTAL_SHARES,
            sharesAvailable: this.TOTAL_SHARES * this.FREE_FLOAT_PERCENT,
            isPlayer: true
        };
        STATE.stockMarket.ipoDay = STATE.time.day;
        NOTIFY.success('Выход на IPO 📈', 'Ваша компания размещена на бирже. Листинг не меняет баланс денег.');
        UI_DASHBOARD.update();
        return true;
    },

    processDaily() {
        this.init();
        // Экономические циклы и шум влияют на котировки, не на свободный кэш.
        let cycle = Math.sin((STATE.time.day / 360) * Math.PI * 2) * 0.25;
        let noise = (Math.random() - 0.5) * 0.1;
        STATE.stockMarket.macroTrend = 1.0 + cycle + noise;

        // 2. Обновление котировок для всех компаний
        Object.keys(STATE.stockMarket.companies).forEach(id => {
            let compData = STATE.stockMarket.companies[id];

            let netWorth = 0;
            let brandPower = 1.0;

            if (compData.isPlayer) {
                netWorth = typeof FINANCE !== 'undefined' ? FINANCE.calculateNetWorth() : 10000;
                brandPower = 1 + STATE.retail.brand / 100;
            } else {
                let npcInfo = B2B_AI.competitors.find(c => c.id === id);
                if (npcInfo) {
                    // Рост или падение капитала ИИ зависит от макро-тренда и случайности
                    // В среднем компании стремятся оставаться на своем уровне (стагнация/конкуренция), но растут в бычьем рынке
                    let npcTrend = STATE.stockMarket.macroTrend > 1.0 ? 0.001 : -0.001; // +/- 0.1% от тренда
                    let npcNoise = (Math.random() - 0.5) * 0.006; // от -0.3% до +0.3% случайной волатильности каждый день
                    compData.capital = (compData.capital || 50000) * (1.0 + npcTrend + npcNoise);

                    // Не даем капиталу упасть ниже базового минимума (чтобы компании не исчезали в 0)
                    let minCapital = npcInfo.tier * 250000;
                    if (compData.capital < minCapital) compData.capital = minCapital;

                    netWorth = compData.capital;
                    brandPower = npcInfo.brandMod;
                }
            }

            // Шум акций конкретной компании (отклонение рыночной цены от фундаментальной на -2% to +2%)
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
            LEDGER.cash(totalDividends, 'investing', 'Дивиденды');
            if (typeof LEDGER !== 'undefined') LEDGER.record('fin_income', totalDividends); // Проведем как b2b доход
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Дивиденды выплачены', `Ваш портфель акций принес пассивный доход: $${formatMoney(totalDividends)}`);
        }
    },

    buyShares(companyId, amount) {
        amount = Number(amount);
        if (!OPERATIONS.quantity(amount)) return false;

        let comp = STATE.stockMarket.companies[companyId];
        if (!comp || comp.isPlayer) return false;

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

        LEDGER.cash(-totalCost, 'investing', 'Покупка акций');
        STATE.stockMarket.costBasis[companyId] = (STATE.stockMarket.costBasis[companyId] ?? 0) + cost;
        if (typeof LEDGER !== 'undefined') LEDGER.record('fin_fees', fee); // Комиссия идет в убыток

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

    acquire(companyId) {
        const comp = STATE.stockMarket.companies[companyId];
        if (!comp || comp.isPlayer || comp.isAcquired) return false;
        const owned = STATE.stockMarket.portfolio[companyId] ?? 0;
        const amount = Math.max(0, Math.ceil(this.TOTAL_SHARES * 0.51) - owned);
        const float = Math.min(amount, comp.sharesAvailable);
        const founders = amount - float;
        const founderAvailable = comp.founderShares ?? this.TOTAL_SHARES - comp.sharesAvailable - owned;
        const cost = (float + founders * 1.2) * comp.sharePrice;
        const fee = cost * this.BROKER_FEE;
        if (founders > founderAvailable || STATE.finances.balance < cost + fee) { NOTIFY.error('Поглощение недоступно', 'Не хватает средств для выкупа 51% акций с премией основателям 20%.'); return false; }
        LEDGER.cash(-cost - fee, 'investing', 'Поглощение'); LEDGER.record('fin_fees', fee);
        STATE.stockMarket.costBasis[companyId] = (STATE.stockMarket.costBasis[companyId] ?? 0) + cost;
        comp.sharesAvailable -= float; comp.founderShares = founderAvailable - founders;
        STATE.stockMarket.portfolio[companyId] = owned + amount; comp.isAcquired = true;
        NOTIFY.success('Поглощение завершено', 'Вы владеете 51% акций ' + comp.name + '.');
        UI_DASHBOARD.update(); return true;
    },

    sellShares(companyId, amount) {
        amount = Number(amount);
        if (!OPERATIONS.quantity(amount)) return false;

        let owned = STATE.stockMarket.portfolio[companyId] || 0;
        if (amount > owned) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка', 'У вас нет столько акций этой компании.');
            return false;
        }

        let comp = STATE.stockMarket.companies[companyId];
        if (!comp || comp.isPlayer) return false;
        let revenue = amount * comp.sharePrice;
        let fee = revenue * this.BROKER_FEE;
        let totalRevenue = revenue - fee;

        const basis = (STATE.stockMarket.costBasis[companyId] ?? 0) * amount / owned;
        STATE.stockMarket.costBasis[companyId] = Math.max(0, (STATE.stockMarket.costBasis[companyId] ?? 0) - basis);
        LEDGER.cash(totalRevenue, 'investing', 'Продажа акций');
        LEDGER.record(revenue >= basis ? 'fin_income' : 'fin_expense', Math.abs(revenue - basis));
        if (typeof LEDGER !== 'undefined') LEDGER.record('fin_fees', fee); // Комиссия брокера

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
