// Модуль Налоговой системы и сборов
const TAXES = {
    RATES: {
        payroll: 0.20,     // 20% социальные взносы с ФОТ (Фонда оплаты труда)
        corporate: 0.18    // 18% налог на прибыль корпораций
    },
    
    init() {
        if (!STATE.taxes) {
            STATE.taxes = {
                daysToReport: 30,       // Дней до сдачи налоговой отчетности (отчетный период)
                taxableBase: 0,         // Накопленная база (прибыль или убыток за период)
                totalPaid: 0            // Всего уплачено налогов за всё время
            };
        }
    },

    // Вызывается 1 раз в день при закрытии смены (ДО закрытия бухгалтерской книги)
    processDaily() {
        this.init();
        
        // --- ЗАЩИТА LEDGER: Принудительно создаем ключи в бухгалтерии, если их нет ---
        if (typeof STATE.ledger !== 'undefined' && STATE.ledger.today) {
            if (STATE.ledger.today.exp_taxes_payroll === undefined) STATE.ledger.today.exp_taxes_payroll = 0;
            if (STATE.ledger.today.exp_taxes_corp === undefined) STATE.ledger.today.exp_taxes_corp = 0;
            if (STATE.ledger.total && STATE.ledger.total.exp_taxes_payroll === undefined) STATE.ledger.total.exp_taxes_payroll = 0;
            if (STATE.ledger.total && STATE.ledger.total.exp_taxes_corp === undefined) STATE.ledger.total.exp_taxes_corp = 0;
        }

        // 1. ЗАРПЛАТНЫЕ НАЛОГИ (Удерживаются каждый день)
        let dailySalary = typeof HR !== 'undefined' ? HR.getDailySalaryFund() : 0;
        if (dailySalary > 0) {
            let payrollTax = dailySalary * this.RATES.payroll;
            STATE.finances.balance -= payrollTax;
            if (typeof LEDGER !== 'undefined') {
                LEDGER.record('exp_taxes_payroll', payrollTax);
            }
        }

        // 2. ФОРМИРОВАНИЕ НАЛОГОВОЙ БАЗЫ ЗА ДЕНЬ
        // Считаем EBT (Прибыль до налогов) за сегодня на основе текущих записей LEDGER.today
        if (typeof LEDGER !== 'undefined' && STATE.ledger && STATE.ledger.today) {
            let t = STATE.ledger.today;
            
            let todayRev = (t.rev_b2b || 0) + (t.rev_b2g || 0) + (t.rev_other || 0) + (t.fin_income || 0);
            let todayExp = (t.exp_materials || 0) + (t.exp_salary || 0) + (t.exp_admin || 0) + 
                           (t.exp_hr || 0) + (t.exp_fines || 0) + (t.exp_repair || 0) + 
                           (t.exp_taxes_payroll || 0) + (t.fin_expense || 0) + (t.fin_fees || 0);
            
            let dailyEbt = todayRev - todayExp;
            
            // Накапливаем финансовый результат (положительный или отрицательный)
            STATE.taxes.taxableBase += dailyEbt;
        }

        // 3. ОТЧЕТНЫЙ ПЕРИОД (Раз в 30 дней)
        STATE.taxes.daysToReport--;
        
        if (STATE.taxes.daysToReport <= 0) {
            this.payCorporateTax();
            STATE.taxes.daysToReport = 30; // Сброс таймера на следующий месяц
        }
    },

    payCorporateTax() {
        if (STATE.taxes.taxableBase > 0) {
            // Компания в плюсе — платим 18% от прибыли
            let taxAmount = STATE.taxes.taxableBase * this.RATES.corporate;
            
            // Защита от кассового разрыва: если денег нет, списываем в минус (штрафы добавим в будущем)
            STATE.finances.balance -= taxAmount;
            
            if (typeof LEDGER !== 'undefined') {
                LEDGER.record('exp_taxes_corp', taxAmount);
            }
            
            STATE.taxes.totalPaid += taxAmount;
            
            NOTIFY.warning('Внимание', `Налоговая служба: период закрыт с прибылью. Удержан налог (18%): $${formatMoney(taxAmount)}.`);
            
            // Обнуляем базу после успешной уплаты
            STATE.taxes.taxableBase = 0; 
        } else {
            // Компания в минусе — налога нет, а убыток ПЕРЕНОСИТСЯ на следующий месяц (налоговая льгота)
            let loss = Math.abs(STATE.taxes.taxableBase);
            NOTIFY.warning('Внимание', `Налоговая служба: период закрыт с убытком $${formatMoney(loss)}. Налог не начислен, убыток перенесён на следующий период для уменьшения будущих налогов.`);
        }
    }
};
