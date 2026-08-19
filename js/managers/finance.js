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

    getAssetsBreakdown() {
        let cash = Math.max(0, STATE.finances.balance);
        let realEstateValue = 0;
        let equipmentValue = 0;

        if (STATE.company && STATE.company.businesses) {
            STATE.company.businesses.forEach(b => {
                let tpl = typeof RECIPES !== 'undefined' ? RECIPES.BUSINESSES[b.type] : null;
                if (!tpl) return;
                let locMult = b.locMult || 1.0; 
                realEstateValue += tpl.area * 50 * locMult;
                for (let i = 1; i < (b.level || 1); i++) realEstateValue += (tpl.area * 50 * i * locMult); 
                if (b.equipment && b.equipment.count > 0) {
                    let eqPrice = RECIPES.RESOURCES[tpl.equipmentType] ? RECIPES.RESOURCES[tpl.equipmentType].basePrice : 0;
                    equipmentValue += (b.equipment.count * eqPrice) * ((b.equipment.condition || 0) / 100);
                }
            });
        }
        
        if (typeof WAREHOUSE !== 'undefined' && STATE.company.warehouses) {
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.level > 0) {
                    for (let i = 1; i < wh.level; i++) {
                        realEstateValue += WAREHOUSE.LEVELS[i].upgradeCost;
                    }
                }
            });
        }
        
        if (STATE.rnd && STATE.rnd.facility && STATE.rnd.facility.level) {
            let rndLvl = STATE.rnd.facility.level || 0;
            for (let i = 1; i <= rndLvl; i++) realEstateValue += i * 10000;
            if (STATE.rnd.facility.equipment && STATE.rnd.facility.equipment.count > 0) {
                let pcPrice = typeof RECIPES !== 'undefined' && RECIPES.RESOURCES['smart_pc'] ? RECIPES.RESOURCES['smart_pc'].basePrice : 800;
                equipmentValue += (STATE.rnd.facility.equipment.count * pcPrice) * ((STATE.rnd.facility.equipment.condition || 0) / 100);
            }
        }
        let fixedAssets = realEstateValue + equipmentValue;

        let inventoryValue = 0;
        if (STATE.company && STATE.company.warehouses) {
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.inventory) {
                    Object.keys(wh.inventory).forEach(k => {
                        let val = (wh.inventory[k].qty || 0) * (wh.inventory[k].avgCost || 0);
                        if (!isNaN(val)) inventoryValue += val;
                    });
                }
            });
        }
        if (STATE.company && STATE.company.businesses) {
            STATE.company.businesses.forEach(b => {
                if (b.localInventory) {
                    Object.keys(b.localInventory).forEach(k => {
                        let val = (b.localInventory[k].qty || 0) * (b.localInventory[k].avgCost || 0);
                        if (!isNaN(val)) inventoryValue += val;
                    });
                }
            });
        }

        let logisticsValue = 0;
        if (STATE.logistics && STATE.logistics.deliveries) {
            STATE.logistics.deliveries.forEach(d => { logisticsValue += (d.cost || 0); });
        }

        let totalLiabilities = 0;
        if (STATE.finances.loans) STATE.finances.loans.forEach(l => totalLiabilities += l.remainingPrincipal);
        if (STATE.finances.balance < 0) totalLiabilities += Math.abs(STATE.finances.balance);

        let depositValue = 0;
        if (STATE.finances.deposits) {
            STATE.finances.deposits.forEach(d => depositValue += (d.amount + (d.accrued || 0)));
        }

        let portfolioValue = 0;
        if (typeof STOCK_MARKET !== 'undefined' && STATE.stockMarket && STATE.stockMarket.portfolio) {
            Object.keys(STATE.stockMarket.portfolio).forEach(id => {
                let shares = STATE.stockMarket.portfolio[id];
                let comp = STATE.stockMarket.companies[id];
                if (comp && shares > 0) {
                    portfolioValue += shares * comp.sharePrice;
                }
            });
        }

        let netWorth = cash + inventoryValue + logisticsValue + fixedAssets + depositValue + portfolioValue - totalLiabilities;
        return { cash, fixedAssets, inventoryValue, logisticsValue, depositValue, portfolioValue, totalLiabilities, netWorth };
    },

    calculateNetWorth() {
        return this.getAssetsBreakdown().netWorth;
    },

    getAvailableLimit() {
        // Банк 2.0: Залоговый лимит (70% недвижка/оборудование + 50% товары + 90% депозиты + 50% кэш)
        let assets = this.getAssetsBreakdown();
        return (assets.fixedAssets * 0.70) + (assets.inventoryValue * 0.50) + (assets.depositValue * 0.90) + (assets.cash * 0.50);
    },

    // (Остальная логика уже перенесена в getAssetsBreakdown)

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
            schedule.push({
                day: i + 1,
                principal: dailyPrincipal,
                interest: dailyInterest,
                total: dailyPrincipal + dailyInterest,
                remaining: Math.max(0, remainingPrincipal - dailyPrincipal)
            });
            remainingPrincipal -= dailyPrincipal;
        }
        return schedule;
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
                STATE.finances.creditScore = Math.min(1000, STATE.finances.creditScore + 15); 
            }
        }
        STATE.finances.balance -= totalDailyPayment;
        // Банк 2.0: Бизнес-Овердрафт (штраф 0.2% в день от суммы долга)
        if (STATE.finances.balance < 0) {
            let overdraftPenalty = Math.abs(STATE.finances.balance) * 0.002;
            STATE.finances.balance -= overdraftPenalty;
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
        
        // НОВОЕ: Динамический пересчет кредитного рейтинга (Банк 2.0)
        let assets = this.getAssetsBreakdown();
        let nw = assets.netWorth;
        let totalDebt = assets.totalLiabilities;
        // Debt/Equity = Долговая нагрузка
        let debtRatio = nw > 0 ? (totalDebt / nw) : (totalDebt > 0 ? 1 : 0);
        
        let targetScore = 400; // Базовый скоринг
        if (nw > 50000) targetScore += 50;
        if (nw > 250000) targetScore += 100;
        if (nw > 1000000) targetScore += 150;
        if (STATE.finances.balance > 100000) targetScore += 100;
        
        if (debtRatio < 0.1) targetScore += 150;
        else if (debtRatio < 0.3) targetScore += 50;
        else if (debtRatio > 0.7) targetScore -= 100;
        else if (debtRatio > 1.0) {
            targetScore -= 300; // Жесткий штраф за высокую долговую нагрузку
        }
        
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
