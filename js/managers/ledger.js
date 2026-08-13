// Модуль Главной бухгалтерской книги (General Ledger)
const LEDGER = {
    // План счетов (Категории доходов и расходов)
    categories: {
        rev_b2b: 0,       // Выручка: Продажа на бирже
        rev_b2g: 0,       // Выручка: Тендеры и контракты
        rev_other: 0,     // Выручка: Случайные события (Гранты)
        exp_salary: 0,    // OPEX: Зарплаты персонала (ФОТ)
        exp_hr: 0,        // OPEX: Обучение, найм, увольнения
        exp_admin: 0,     // OPEX: Аренда и обслуживание зданий
        exp_materials: 0, // OPEX: Закупка сырья
        exp_fines: 0,     // OPEX: Случайные события (Штрафы)
        fin_income: 0,    // Финансы: Доход по депозитам
        fin_expense: 0,   // Финансы: Проценты по кредитам
        fin_fees: 0       // Финансы: Разовые банковские комиссии
    },

    init() {
        if (!STATE.ledger || !STATE.ledger.total.hasOwnProperty('fin_fees')) {
            STATE.ledger = {
                today: JSON.parse(JSON.stringify(this.categories)),
                yesterday: JSON.parse(JSON.stringify(this.categories)),
                total: JSON.parse(JSON.stringify(this.categories))
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
        STATE.ledger.today = JSON.parse(JSON.stringify(this.categories));
    }
};