// Модуль складской логистики (Бесконечная математическая прогрессия)
const WAREHOUSE = {
    init() {
        if (!STATE.company.warehouse) {
            STATE.company.warehouse = { level: 1 };
        }
    },

    // Магический прокси-мост для обратной совместимости с интерфейсом (dashboardUI.js).
    // Он притворяется бесконечным массивом, вычисляя параметры любого уровня на лету!
    get LEVELS() {
        return new Proxy([], {
            get: (target, prop) => {
                if (prop === 'length') return Infinity; // Кнопка расширения больше никогда не скроется
                let index = parseInt(prop);
                if (!isNaN(index)) {
                    let targetLevel = index + 1;
                    return {
                        maxVol: Math.floor(500 * Math.pow(1.5, targetLevel - 1)),
                        upgradeCost: Math.floor(5000 * Math.pow(1.8, targetLevel - 2))
                    };
                }
                return target[prop];
            }
        });
    },

    // Максимальный объем: База 500 м³, каждый уровень +50%
    getMaxVolume() {
        this.init();
        let lvl = STATE.company.warehouse.level;
        return Math.floor(500 * Math.pow(1.5, lvl - 1));
    },

    // Стоимость улучшения до СЛЕДУЮЩЕГО уровня: База $5,000, каждый уровень +80%
    getUpgradeCost() {
        this.init();
        let lvl = STATE.company.warehouse.level;
        return Math.floor(5000 * Math.pow(1.8, lvl - 1));
    },

    // Ежедневная аренда: База $50, каждый уровень +50% (растет синхронно с объемом)
    getDailyRent() {
        this.init();
        let lvl = STATE.company.warehouse.level;
        return Math.floor(50 * Math.pow(1.5, lvl - 1));
    },

    // Динамический подсчет занятого места (сверяется с рецептами)
    getCurrentVolume() {
        let vol = 0;
        if (STATE.company.inventory) {
            Object.keys(STATE.company.inventory).forEach(key => {
                let item = STATE.company.inventory[key];
                if (item.qty > 0 && RECIPES.RESOURCES[key]) {
                    let itemVol = RECIPES.RESOURCES[key].volume || 1.0; // По умолчанию 1 куб на штуку
                    vol += item.qty * itemVol;
                }
            });
        }
        return vol;
    },

    // Функция покупки расширения
    upgrade() {
        this.init();
        let cost = this.getUpgradeCost();
        let currentVol = this.getMaxVolume();
        
        if (STATE.finances.balance >= cost) {
            // Списываем деньги и повышаем уровень
            STATE.finances.balance -= cost;
            STATE.company.warehouse.level++;
            let newVol = this.getMaxVolume();
            
            if (typeof NOTIFY !== 'undefined') {
                NOTIFY.success('Склад расширен!', `Площадь логистического хаба увеличена с ${currentVol} до ${newVol} м³.`);
            }
            
            // Мгновенная перерисовка интерфейса
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            if (typeof NOTIFY !== 'undefined') {
                NOTIFY.error('Отказ в стройке', `Для расширения склада не хватает средств. Нужно $${formatMoney(cost)}`);
            }
        }
    }
};