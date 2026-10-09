// Модуль управления финансами (Кредиты и Депозиты)
const FINANCE = {

    getCurrentRate() {
        // Базовая ставка 12% + премия за риск
        // Рейтинг 800+ = 13% (премия 1%)
        // Рейтинг 300 и ниже = 35% (премия 23%)
        let score = Math.max(300, Math.min(800, STATE.finances.creditScore));
        let premium = 0.23 - ((score - 300) / 500) * 0.22;
        let rate = 0.12 + premium;
        return rate;
    },

    warehouseCost(cityId, level) {
        if (!level) return 0;
        const mult = GEO.getCity(cityId).rentMult;
        let cost = Math.floor(5000 * mult);
        for (let i = 1; i < level; i++) cost += Math.floor(10000 * Math.pow(1.8, i - 1) * mult);
        return cost;
    },

    getAssetsBreakdown() {
        let realEstateValue = 0, equipmentValue = 0, inventoryValue = 0, logisticsValue = 0;
        let receivablesValue = 0, depositValue = 0, portfolioValue = 0;
        for (const b of STATE.company.businesses) {
            const tpl = RECIPES.BUSINESSES[b.type];
            const level = b.level ?? 1;
            const legacyCost = tpl.area * 50 * (b.locMult ?? 1) * (1 + level * (level - 1) / 2);
            realEstateValue += b.capitalCost ?? legacyCost;
            equipmentValue += b.equipment.bookValue ?? b.equipment.count * RECIPES.RESOURCES[tpl.equipmentType].basePrice * b.equipment.condition / 100;
            inventoryValue += OPERATIONS.inventoryValue(b.localInventory);
            inventoryValue += OPERATIONS.inventoryValue(b.dailyIncoming);
        }
        for (const [city, wh] of Object.entries(STATE.company.warehouses)) {
            realEstateValue += wh.capitalCost ?? this.warehouseCost(city, wh.level);
            inventoryValue += OPERATIONS.inventoryValue(wh.inventory);
        }
        const facility = STATE.rnd.facility;
        if (facility) {
            realEstateValue += facility.capitalCost ?? 10000 * facility.level * (facility.level + 1) / 2;
            equipmentValue += facility.equipment.bookValue ?? facility.equipment.count * RECIPES.RESOURCES.smart_pc.basePrice * facility.equipment.condition / 100;
        }
        for (const d of STATE.logistics?.deliveries ?? []) logisticsValue += d.cost + (d.logCost ?? 0);
        for (const r of STATE.logistics?.receivables ?? []) receivablesValue += r.amount;
        for (const d of STATE.finances.deposits) depositValue += d.amount + d.accrued;
        for (const [id, shares] of Object.entries(STATE.stockMarket?.portfolio ?? {})) portfolioValue += shares * (STATE.stockMarket.companies[id]?.sharePrice ?? 0);
        const cash = Math.max(0, STATE.finances.balance);
        const totalLiabilities = STATE.finances.loans.reduce((n, l) => n + l.remainingPrincipal, 0) + Math.max(0, -STATE.finances.balance);
        const fixedAssets = realEstateValue + equipmentValue;
        const totalAssets = cash + fixedAssets + inventoryValue + logisticsValue + receivablesValue + depositValue + portfolioValue;
        return { cash, realEstateValue, equipmentValue, fixedAssets, inventoryValue, logisticsValue, receivablesValue, depositValue, portfolioValue, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
    },

    calculateNetWorth() {
        return this.getAssetsBreakdown().netWorth;
    },

    getReports() {
        LEDGER.init();
        const assets = this.getAssetsBreakdown();
        const totalProfit = LEDGER.result(STATE.ledger.total);
        const currentActivity = LEDGER.hasCurrentActivity();
        const periodLedger = currentActivity ? STATE.ledger.today : STATE.ledger.yesterday;
        const cashReport = currentActivity ? STATE.ledger.cashFlow.today : STATE.ledger.cashFlow.yesterday;
        const basis = Object.entries(STATE.stockMarket?.portfolio ?? {}).reduce((sum, [id, shares]) => sum + (STATE.stockMarket.costBasis?.[id] ?? shares * STATE.stockMarket.companies[id].sharePrice), 0);
        const startCapital = STATE.finances.startCapital ?? 25000;
        const retainedEarnings = totalProfit.net;
        const revaluation = assets.portfolioValue - basis;
        const openingAdjustment = STATE.finances.openingAdjustment ?? 0;
        const totalEquity = startCapital + retainedEarnings + revaluation + openingAdjustment;
        const currentAssets = assets.cash + assets.inventoryValue + assets.logisticsValue + assets.receivablesValue + assets.depositValue + assets.portfolioValue;
        const reconciliation = assets.netWorth - totalEquity;
        const debtEquity = assets.netWorth > 0 ? assets.totalLiabilities / assets.netWorth : assets.totalLiabilities > 0 ? Infinity : null;
        const currentRatio = assets.totalLiabilities > 0 ? currentAssets / assets.totalLiabilities : currentAssets > 0 ? Infinity : null;
        return { assets, totalProfit, dailyProfit: LEDGER.result(STATE.ledger.yesterday), periodProfit: LEDGER.result(periodLedger), periodLedger, cashReport, currentActivity, currentAssets, startCapital, retainedEarnings, revaluation, openingAdjustment, totalEquity, reconciliation, debtEquity, currentRatio };
    },

    initAccounting() {
        // Old saves may predate the current bookkeeping rules. Preserve their opening
        // difference once, rather than presenting it as new profit on every render.
        if (STATE.finances.openingAdjustment === undefined) {
            STATE.finances.openingAdjustment = this.getReports().reconciliation;
        }
    },

    getAvailableLimit() {
        // Банк 2.0: Залоговый лимит (70% недвижка/оборудование + 50% товары + 90% депозиты + 50% кэш)
        let assets = this.getAssetsBreakdown();
        return (assets.fixedAssets * 0.70) + (assets.inventoryValue * 0.50) + (assets.depositValue * 0.90) + (assets.cash * 0.50);
    },

    getRemainingCredit() {
        const debt = STATE.finances.loans.reduce((sum, loan) => sum + loan.remainingPrincipal, 0);
        return Math.max(0, this.getAvailableLimit() - debt);
    },

    // (Остальная логика уже перенесена в getAssetsBreakdown)

    takeLoan(amount, termDays) {
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(termDays) || termDays < 1 || termDays > 3650) return false;
        let currentDebt = STATE.finances.loans.reduce((sum, l) => sum + l.remainingPrincipal, 0);

        if (currentDebt + amount > this.getAvailableLimit()) {
            NOTIFY.error('Ошибка', 'Кредитный комитет отклонил заявку: превышен лимит риска.');
            return;
        }

        let originationFee = amount * 0.03;
        if (STATE.finances.balance + amount < originationFee) {
            NOTIFY.error('Ошибка', 'Суммы кредита недостаточно для покрытия дефицита денег и комиссии выдачи (3%).');
            return;
        }

        let rate = this.getCurrentRate();
        // Фиксируем только платеж по телу кредита
        let dailyPrincipal = amount / termDays;

        LEDGER.cash(amount, 'financing', 'Получение кредита');
        LEDGER.cash(-originationFee, 'financing', 'Комиссия кредита');

        if (typeof LEDGER !== 'undefined') LEDGER.record('fin_fees', originationFee);

        STATE.finances.loans.push({
            id: OPERATIONS.id(),
            amount: amount,
            remainingPrincipal: amount,
            remainingDays: termDays,
            dailyPrincipal: dailyPrincipal,
            rate: rate
        });

        NOTIFY.success('Успех', `Транш на $${formatMoney(amount)} зачислен. Списана комиссия банка: $${formatMoney(originationFee)}.`);
        UI_DASHBOARD.update();
    },

    // НОВОЕ: Досрочное погашение кредита
    payOffLoan(id) {
        let idx = STATE.finances.loans.findIndex(l => l.id === id);
        if (idx !== -1) {
            let loan = STATE.finances.loans[idx];
            // Считаем проценты за текущий недозакрытый день
            let dailyInterest = (loan.remainingPrincipal * loan.rate) / 365;
            let totalToPay = loan.remainingPrincipal + dailyInterest;

            if (STATE.finances.balance >= totalToPay) {
                LEDGER.cash(-totalToPay, 'financing', 'Досрочное погашение');
                if (typeof LEDGER !== 'undefined') LEDGER.record('fin_expense', dailyInterest);

                STATE.finances.loans.splice(idx, 1);
                STATE.finances.creditScore = Math.min(1000, STATE.finances.creditScore + 20); // Позитивный эффект на скоринг

                NOTIFY.success('Успех', `Кредит досрочно погашен! Списано $${formatMoney(totalToPay)} (в т.ч. проценты за 1 день: $${formatMoney(dailyInterest)}).`);
                UI_DASHBOARD.update();
            } else {
                NOTIFY.error('Ошибка', `Недостаточно средств для полного погашения (Нужно $${formatMoney(totalToPay)}).`);
            }
        }
    },

    calculateTotalInterest(amount, rate, termDays) {
        let totalInterest = 0;
        let remainingPrincipal = amount;
        let dailyPrincipal = amount / termDays;

        for (let i = 0; i < termDays; i++) {
            let dailyInterest = (remainingPrincipal * rate) / 365;
            totalInterest += dailyInterest;
            remainingPrincipal -= dailyPrincipal;
        }
        return totalInterest;
    },

    generatePaymentSchedule(loan) {
        let schedule = [];
        let remainingPrincipal = loan.remainingPrincipal;
        let termDays = loan.remainingDays;
        let rate = loan.rate;
        let dailyPrincipal = loan.dailyPrincipal;

        for (let i = 0; i < termDays; i++) {
            let dailyInterest = (remainingPrincipal * rate) / 365;
            const principal = i === termDays - 1 ? remainingPrincipal : Math.min(dailyPrincipal, remainingPrincipal);
            schedule.push({
                day: i + 1,
                principal,
                interest: dailyInterest,
                total: principal + dailyInterest,
                remaining: Math.max(0, remainingPrincipal - principal)
            });
            remainingPrincipal = Math.max(0, remainingPrincipal - principal);
        }
        return schedule;
    },

    generateDepositSchedule(deposit) {
        const interest = deposit.amount * deposit.rate / 365;
        let earned = deposit.accrued;
        return Array.from({ length: deposit.daysLeft }, (_, index) => {
            earned += interest;
            const last = index === deposit.daysLeft - 1;
            const payout = deposit.payoutType === 'daily' ? interest + (last ? deposit.amount : 0) : last ? deposit.amount + earned : 0;
            return { day: index + 1, interest, accrued: earned, total: deposit.amount + earned, payout };
        });
    },

    getDepositRate(termDays, payoutType) {
        let base = 0.04;
        if (termDays >= 30) base = 0.06;
        if (termDays >= 90) base = 0.09;
        if (termDays >= 180) base = 0.12;
        if (termDays >= 270) base = 0.14;
        if (termDays >= 360) base = 0.16;
        if (payoutType === 'end') base += 0.01;
        return base;
    },

    openDeposit(amount, termDays, payoutType) {
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(termDays) || termDays < 1 || termDays > 3650 || !['daily', 'end'].includes(payoutType)) return false;
        if (!STATE.finances.deposits) STATE.finances.deposits = [];

        if (STATE.finances.balance >= amount) {
            LEDGER.cash(-amount, 'investing', 'Открытие вклада');
            let rate = this.getDepositRate(termDays, payoutType);

            STATE.finances.deposits.push({
                id: OPERATIONS.id(), amount: amount, termDays: termDays,
                daysLeft: termDays, rate: rate, payoutType: payoutType, accrued: 0
            });

            NOTIFY.success('Успех', `Депозит на $${formatMoney(amount)} открыт под ${(rate*100).toFixed(1)}% годовых.`);
            UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', 'Недостаточно свободных средств на балансе.');
        }
    },

    processDailyClearing() {
        let totalDailyPayment = 0;
        for (let i = STATE.finances.loans.length - 1; i >= 0; i--) {
            let loan = STATE.finances.loans[i];

            // НОВОЕ: Проценты динамически считаются на остаток тела
            let dailyInterest = (loan.remainingPrincipal * loan.rate) / 365;
            let principal = loan.remainingDays === 1 ? loan.remainingPrincipal : Math.min(loan.dailyPrincipal, loan.remainingPrincipal);
            let paymentToday = principal + dailyInterest;

            if (typeof LEDGER !== 'undefined') LEDGER.record('fin_expense', dailyInterest);

            totalDailyPayment += paymentToday;
            loan.remainingPrincipal = Math.max(0, loan.remainingPrincipal - principal);
            loan.remainingDays--;

            if (loan.remainingDays <= 0) {
                STATE.finances.loans.splice(i, 1);
                STATE.finances.creditScore = Math.min(1000, STATE.finances.creditScore + 15);
            }
        }
        LEDGER.cash(-totalDailyPayment, 'financing', 'Платежи по кредитам');
        // Банк 2.0: Бизнес-Овердрафт (штраф 0.2% в день от суммы долга)
        if (STATE.finances.balance < 0) {
            let overdraftPenalty = Math.abs(STATE.finances.balance) * 0.002;
            LEDGER.cash(-overdraftPenalty, 'financing', 'Овердрафт');
            if (typeof LEDGER !== 'undefined') LEDGER.record('fin_expense', overdraftPenalty);
            // Жесткое падение рейтинга при овердрафте
            STATE.finances.creditScore = Math.max(0, STATE.finances.creditScore - 15);
        } else {
            // Если баланс положительный и есть кредиты, рейтинг понемногу растет
            if (STATE.finances.loans.length > 0) {
                STATE.finances.creditScore = Math.min(1000, STATE.finances.creditScore + 1);
            }
        }

        if (!STATE.finances.deposits) STATE.finances.deposits = [];
        for (let i = STATE.finances.deposits.length - 1; i >= 0; i--) {
            let dep = STATE.finances.deposits[i];
            let dailyInt = (dep.amount * dep.rate) / 365;

            if (typeof LEDGER !== 'undefined') LEDGER.record('fin_income', dailyInt);

            if (dep.payoutType === 'daily') {
                LEDGER.cash(dailyInt, 'investing', 'Проценты по вкладу');
            } else {
                dep.accrued += dailyInt;
            }

            dep.daysLeft--;
            if (dep.daysLeft <= 0) {
                LEDGER.cash(dep.amount + dep.accrued, 'investing', 'Возврат вклада');
                STATE.finances.deposits.splice(i, 1);
            }
        }

        // НОВОЕ: Динамический пересчет кредитного рейтинга (Банк 2.0)
        let assets = this.getAssetsBreakdown();
        let nw = assets.netWorth;
        let totalDebt = assets.totalLiabilities;
        // Debt/Equity = Долговая нагрузка
        let debtRatio = nw > 0 ? (totalDebt / nw) : (totalDebt > 0 ? Infinity : 0);

        let targetScore = 400; // Базовый скоринг
        if (nw > 50000) targetScore += 50;
        if (nw > 250000) targetScore += 100;
        if (nw > 1000000) targetScore += 150;
        if (STATE.finances.balance > 100000) targetScore += 100;

        if (debtRatio < 0.1) targetScore += 150;
        else if (debtRatio < 0.3) targetScore += 50;
        else if (debtRatio > 1.0) {
            targetScore -= 300; // Жесткий штраф за высокую долговую нагрузку
        } else if (debtRatio > 0.7) targetScore -= 100;

        if (STATE.finances.balance < 0) targetScore -= 300;

        targetScore = Math.max(0, Math.min(1000, targetScore));

        // Плавное движение текущего рейтинга к целевому
        // Ускоренное падение (по 10 пунктов), медленный рост (по 2 пункта)
        if (STATE.finances.creditScore < targetScore) {
            STATE.finances.creditScore = Math.min(targetScore, STATE.finances.creditScore + 2);
        } else if (STATE.finances.creditScore > targetScore) {
            STATE.finances.creditScore = Math.max(targetScore, STATE.finances.creditScore - 10);
        }
    }
};
