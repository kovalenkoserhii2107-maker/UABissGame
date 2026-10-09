// Profit/loss and actual cash movements are separate ledgers.
const LEDGER = {
    categories: {
        rev_b2b: 0, rev_b2g: 0, rev_b2c: 0, rev_other: 0,
        exp_salary: 0, exp_hr: 0, exp_admin: 0, exp_materials: 0,
        exp_logistics: 0, exp_fines: 0, exp_marketing: 0, exp_repair: 0,
        exp_depreciation: 0, exp_taxes_payroll: 0, exp_taxes_corp: 0,
        fin_income: 0, fin_expense: 0, fin_fees: 0
    },
    newCashDay() { return { opening: STATE.finances.balance, closing: STATE.finances.balance, operating: 0, investing: 0, financing: 0, operations: 0, inflow: 0, outflow: 0, movements: [] }; },
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
        // Old saves may have a partial day without descriptions. Retain its totals.
        if (amount !== 0) {
            day.movements ??= [];
            description ||= 'Денежная операция';
            const direction = Math.sign(amount);
            let movement = day.movements.find(m => m.description === description && m.activity === activity && Math.sign(m.amount) === direction);
            if (movement) movement.amount += amount;
            else day.movements.push({ description, activity, amount });
        }
        if (amount !== 0) day.operations = (day.operations ?? 0) + 1;
        day.inflow = (day.inflow ?? 0) + Math.max(0, amount);
        day.outflow = (day.outflow ?? 0) + Math.max(0, -amount);
        day[activity] += amount;
        day.closing = STATE.finances.balance;
    },
    result(data) {
        data = { ...this.categories, ...data };
        const revenue = data.rev_b2b + data.rev_b2g + data.rev_b2c + data.rev_other;
        const opex = data.exp_salary + data.exp_admin + data.exp_hr + data.exp_fines + data.exp_repair + data.exp_taxes_payroll + data.exp_marketing + data.exp_logistics;
        const cogs = data.exp_materials;
        const gross = revenue - cogs;
        const ebitda = gross - opex;
        const depreciation = data.exp_depreciation;
        const ebit = ebitda - depreciation;
        const financial = data.fin_income - data.fin_expense - data.fin_fees;
        const ebt = ebit + financial;
        const corporateTax = data.exp_taxes_corp;
        const expenses = cogs + opex + depreciation + data.fin_expense + data.fin_fees + corporateTax;
        return { revenue, cogs, gross, opex, depreciation, ebitda, ebit, financial, ebt, corporateTax, expenses, net: ebt - corporateTax };
    },
    hasCurrentActivity() {
        const day = STATE.ledger.cashFlow.today;
        return day.operations > 0 || day.inflow > 0 || day.outflow > 0 || day.closing !== day.opening || Object.values(STATE.ledger.today).some(value => value !== 0);
    },
    cashHistory(days = 7) {
        return STATE.ledger.cashFlow.history.slice(0, days).map((entry, index) => ({
            ...entry,
            day: entry.day ?? STATE.time.day - index,
            inflow: entry.inflow ?? null,
            outflow: entry.outflow ?? null
        })).reverse();
    },
    endOfDay() {
        this.init();
        STATE.ledger.yesterday = { ...STATE.ledger.today };
        STATE.ledger.history.unshift({ ...STATE.ledger.today });
        STATE.ledger.history.length = Math.min(STATE.ledger.history.length, 365);
        STATE.ledger.today = { ...this.categories };
        const cf = STATE.ledger.cashFlow;
        cf.today.closing = STATE.finances.balance;
        cf.yesterday = { ...cf.today, day: STATE.time.day };
        cf.history.unshift(cf.yesterday);
        cf.history.length = Math.min(cf.history.length, 365);
        cf.today = this.newCashDay();
    }
};
