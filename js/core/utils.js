// Глобальные утилиты форматирования
function formatMoney(amount) {
    return Number(amount).toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatFinancialResult(amount) {
    if (amount > 0) return '+$' + formatMoney(amount);
    if (amount < 0) return '-$' + formatMoney(Math.abs(amount));
    return '$' + formatMoney(0);
}