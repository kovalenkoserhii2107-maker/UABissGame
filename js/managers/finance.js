// Модуль управления финансами (Кредиты и Депозиты)
const FINANCE = {
    
    getCurrentRate() {
        let rate = 0.15 - (STATE.finances.creditScore / 10000); 
        if (STATE.finances.balance >= 50000) rate -= 0.02; 
        return Math.max(0.03, rate); 
    },

    getAvailableLimit() {
        return (Math.max(0, STATE.finances.balance) * 0.5) + (STATE.finances.creditScore * 50);
    },

    takeLoan(amount, termDays) {
        let currentDebt = STATE.finances.loans.reduce((sum, l) => sum + l.remainingPrincipal, 0);
        
        if (currentDebt + amount > this.getAvailableLimit()) {
            NOTIFY.error('Ошибка', 'Кредитный комитет отклонил заявку: превышен лимит риска.');
            return;
        }

        let originationFee = amount * 0.03;
        if (STATE.finances.balance < originationFee) {
            NOTIFY.error('Ошибка', 'Недостаточно средств для оплаты комиссии за выдачу (3%).');
            return;
        }

        let rate = this.getCurrentRate();
        // Фиксируем только платеж по телу кредита
        let dailyPrincipal = amount / termDays;

        STATE.finances.balance += amount;
        STATE.finances.balance -= originationFee;
        
        if (typeof LEDGER !== 'undefined') LEDGER.record('fin_fees', originationFee);

        STATE.finances.loans.push({
            id: Date.now(),
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
                STATE.finances.balance -= totalToPay;
                if (typeof LEDGER !== 'undefined') LEDGER.record('fin_expense', dailyInterest);
                
                STATE.finances.loans.splice(idx, 1);
                STATE.finances.creditScore += 20; // Позитивный эффект на скоринг
                
                NOTIFY.success('Успех', `Кредит досрочно погашен! Списано $${formatMoney(totalToPay)} (в т.ч. проценты за 1 день: $${formatMoney(dailyInterest)}).`);
                UI_DASHBOARD.update();
            } else {
                NOTIFY.error('Ошибка', `Недостаточно средств для полного погашения (Нужно $${formatMoney(totalToPay)}).`);
            }
        }
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
        if (!STATE.finances.deposits) STATE.finances.deposits = []; 
        
        if (STATE.finances.balance >= amount) {
            STATE.finances.balance -= amount;
            let rate = this.getDepositRate(termDays, payoutType);
            
            STATE.finances.deposits.push({
                id: Date.now(), amount: amount, termDays: termDays,
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
            let paymentToday = loan.dailyPrincipal + dailyInterest;
            
            if (typeof LEDGER !== 'undefined') LEDGER.record('fin_expense', dailyInterest);
            
            totalDailyPayment += paymentToday;
            loan.remainingPrincipal -= loan.dailyPrincipal;
            loan.remainingDays--;

            if (loan.remainingDays <= 0) {
                STATE.finances.loans.splice(i, 1);
                STATE.finances.creditScore += 15; 
            }
        }
        STATE.finances.balance -= totalDailyPayment;
        if (STATE.finances.balance < 0) STATE.finances.creditScore -= 10;

        if (!STATE.finances.deposits) STATE.finances.deposits = [];
        for (let i = STATE.finances.deposits.length - 1; i >= 0; i--) {
            let dep = STATE.finances.deposits[i];
            let dailyInt = (dep.amount * dep.rate) / 365;
            
            if (typeof LEDGER !== 'undefined') LEDGER.record('fin_income', dailyInt);
            
            if (dep.payoutType === 'daily') {
                STATE.finances.balance += dailyInt; 
            } else {
                dep.accrued += dailyInt; 
            }
            
            dep.daysLeft--;
            if (dep.daysLeft <= 0) {
                STATE.finances.balance += dep.amount + dep.accrued;
                STATE.finances.deposits.splice(i, 1);
            }
        }
    }
};
