// Модуль Главной бухгалтерской книги (General Ledger)
const LEDGER = {
    // План счетов (Категории доходов и расходов)
    categories: {
        rev_b2b: 0,       // Выручка: Продажа на бирже
        rev_b2g: 0,       // Выручка: Тендеры и контракты
        rev_b2c: 0,       // Выручка: Розничная сеть
        rev_other: 0,     // Выручка: Случайные события (Гранты)
        exp_salary: 0,    // OPEX: Зарплаты персонала (ФОТ)
        exp_hr: 0,        // OPEX: Обучение, найм, увольнения
        exp_admin: 0,     // OPEX: Аренда и обслуживание зданий
        exp_materials: 0, // OPEX: Закупка сырья
        exp_logistics: 0, // OPEX: Межгородская логистика
        exp_fines: 0,     // OPEX: Случайные события (Штрафы)
        exp_marketing: 0, // OPEX: Рекламные кампании
        exp_repair: 0,    // OPEX: Ремонт оборудования
        exp_taxes_payroll: 0, // НАЛОГ: На ФОТ
        exp_taxes_corp: 0,    // НАЛОГ: Корпоративный
        fin_income: 0,    // Финансы: Доход по депозитам
        fin_expense: 0,   // Финансы: Проценты по кредитам
        fin_fees: 0       // Финансы: Разовые банковские комиссии
    },

init() {
        if (!STATE.ledger || !STATE.ledger.total.hasOwnProperty('exp_logistics')) {
            STATE.ledger = {
                today: JSON.parse(JSON.stringify(this.categories)),
                yesterday: JSON.parse(JSON.stringify(this.categories)),
                total: JSON.parse(JSON.stringify(this.categories)),
                history: (STATE.ledger && STATE.ledger.history) ? STATE.ledger.history : []
            };
        }
    },

    record(category, amount) {
        this.init();
        if (STATE.ledger.today[category] !== undefined && amount > 0) {
            STATE.ledger.today[category] += amount;
            STATE.ledger.total[category] += amount;
        }
    },

    endOfDay() {
        this.init();
        STATE.ledger.yesterday = JSON.parse(JSON.stringify(STATE.ledger.today));
        STATE.ledger.history.unshift(JSON.parse(JSON.stringify(STATE.ledger.yesterday)));
        if (STATE.ledger.history.length > 7) STATE.ledger.history.pop();
        STATE.ledger.today = JSON.parse(JSON.stringify(this.categories));
    }
};
