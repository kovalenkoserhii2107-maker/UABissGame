// Модуль Налоговой системы и сборов (GEO Интеграция)
const TAXES = {
    init() {
        if (!STATE.taxes) {
            STATE.taxes = { daysToReport: 30, taxableBase: 0, totalPaid: 0 };
        }
    },

    processDaily() {
        this.init();
        // Берем налоги напрямую из макроэкономики страны
        let rates = typeof GEO !== 'undefined' ? GEO.COUNTRIES['ua'].taxes : { payroll: 0.22, corporate: 0.18 };

        if (typeof STATE.ledger !== 'undefined' && STATE.ledger.today) {
            if (STATE.ledger.today.exp_taxes_payroll === undefined) STATE.ledger.today.exp_taxes_payroll = 0;
            if (STATE.ledger.today.exp_taxes_corp === undefined) STATE.ledger.today.exp_taxes_corp = 0;
        }

        let dailySalary = typeof HR !== 'undefined' ? HR.getDailySalaryFund() : 0;
        if (dailySalary > 0) {
            let payrollTax = dailySalary * rates.payroll;
            STATE.finances.balance -= payrollTax;
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_taxes_payroll', payrollTax);
        }

        if (typeof LEDGER !== 'undefined' && STATE.ledger && STATE.ledger.today) {
            let t = STATE.ledger.today;
            let todayRev = (t.rev_b2b||0) + (t.rev_b2g||0) + (t.rev_other||0) + (t.fin_income||0) + (t.rev_b2c||0);
            let todayExp = (t.exp_materials||0) + (t.exp_salary||0) + (t.exp_admin||0) + 
                           (t.exp_hr||0) + (t.exp_fines||0) + (t.exp_repair||0) + 
                           (t.exp_taxes_payroll||0) + (t.fin_expense||0) + (t.fin_fees||0) + (t.exp_logistics||0);
            
            STATE.taxes.taxableBase += (todayRev - todayExp);
        }

        STATE.taxes.daysToReport--;
        if (STATE.taxes.daysToReport <= 0) {
            this.payCorporateTax(rates.corporate);
            STATE.taxes.daysToReport = 30; 
        }
    },

    payCorporateTax(corpRate) {
        if (STATE.taxes.taxableBase > 0) {
            let taxAmount = STATE.taxes.taxableBase * corpRate;
            STATE.finances.balance -= taxAmount;
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_taxes_corp', taxAmount);
            STATE.taxes.totalPaid += taxAmount;
            NOTIFY.warning('Налоговая служба', `Период закрыт с прибылью. Удержан налог (${(corpRate*100).toFixed(0)}%): $${formatMoney(taxAmount)}.`);
            STATE.taxes.taxableBase = 0; 
        } else {
            let loss = Math.abs(STATE.taxes.taxableBase);
            NOTIFY.warning('Налоговая служба', `Период закрыт с убытком $${formatMoney(loss)}. Налог не начислен.`);
        }
    }
};
