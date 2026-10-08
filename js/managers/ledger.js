// Profit/loss and actual cash movements are separate ledgers.
const LEDGER = {
    categories: {
        rev_b2b: 0, rev_b2g: 0, rev_b2c: 0, rev_other: 0,
        exp_salary: 0, exp_hr: 0, exp_admin: 0, exp_materials: 0,
        exp_logistics: 0, exp_fines: 0, exp_marketing: 0, exp_repair: 0,
        exp_depreciation: 0, exp_taxes_payroll: 0, exp_taxes_corp: 0,
        fin_income: 0, fin_expense: 0, fin_fees: 0
    },
    newCashDay() { return { opening: STATE.finances.balance, closing: STATE.finances.balance, operating: 0, investing: 0, financing: 0, operations: 0, inflow: 0, outflow: 0 }; },
    init() {
        STATE.ledger ??= { history: [] };
        for (const name of ['today', 'yesterday', 'total']) STATE.ledger[name] = { ...this.categories, ...STATE.ledger[name] };
        STATE.ledger.history ??= [];
        STATE.ledger.cashFlow ??= { today: this.newCashDay(), yesterday: this.newCashDay(), history: [] };
    },
    record(category, amount) {
        this.init();
        if (Object.hasOwn(this.categories, category) && Number.isFinite(amount) && amount > 0) {
            STATE.ledger.today[category] += amount;
            STATE.ledger.total[category] += amount;
        }
    },
    cash(amount, activity = 'operating', description = '') {
        if (!Number.isFinite(amount) || !['operating', 'investing', 'financing'].includes(activity)) throw new Error('Некорректная денежная операция: ' + description);
        this.init();
        STATE.finances.balance += amount;
        const day = STATE.ledger.cashFlow.today;
        if (amount !== 0) day.operations = (day.operations ?? 0) + 1;
        day.inflow = (day.inflow ?? 0) + Math.max(0, amount);
        day.outflow = (day.outflow ?? 0) + Math.max(0, -amount);
        day[activity] += amount;
        day.closing = STATE.finances.balance;
    },
    result(data) {
        const revenue = data.rev_b2b + data.rev_b2g + data.rev_b2c + data.rev_other;
        const opex = data.exp_salary + data.exp_admin + data.exp_hr + data.exp_fines + data.exp_repair + data.exp_taxes_payroll + data.exp_marketing + data.exp_logistics;
        const ebitda = revenue - data.exp_materials - opex;
        const financial = data.fin_income - data.fin_expense - data.fin_fees;
        return { revenue, opex, ebitda, financial, net: ebitda - data.exp_depreciation + financial - data.exp_taxes_corp };
    },
    endOfDay() {
        this.init();
        STATE.ledger.yesterday = { ...STATE.ledger.today };
        STATE.ledger.history.unshift({ ...STATE.ledger.today });
        STATE.ledger.history.length = Math.min(STATE.ledger.history.length, 365);
        STATE.ledger.today = { ...this.categories };
        const cf = STATE.ledger.cashFlow;
        cf.today.closing = STATE.finances.balance;
        cf.yesterday = { ...cf.today };
        cf.history.unshift({ ...cf.today, day: STATE.time.day });
        cf.history.length = Math.min(cf.history.length, 365);
        cf.today = this.newCashDay();
    }
};
