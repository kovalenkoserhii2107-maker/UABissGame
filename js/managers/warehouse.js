// Модуль складской логистики
const WAREHOUSE = {
    // Стоимость уровней склада: [Вместимость, Ежедневная аренда, Цена апгрейда]
    LEVELS: [
        { maxVol: 1000, rent: 50, upgradeCost: 0 },         // Базовый (Ур 1)
        { maxVol: 2500, rent: 150, upgradeCost: 5000 },     // Ангар (Ур 2)
        { maxVol: 10000, rent: 500, upgradeCost: 15000 },   // Логистический хаб (Ур 3)
        { maxVol: 50000, rent: 2000, upgradeCost: 50000 }   // Региональный РЦ (Ур 4)
    ],

    init() {
        if (!STATE.company.warehouse) {
            STATE.company.warehouse = { level: 1 };
        }
    },

    getCurrentVolume() {
        let totalVol = 0;
        if (STATE.company.inventory) {
            Object.keys(STATE.company.inventory).forEach(key => {
                let qty = STATE.company.inventory[key].qty;
                let vol = RECIPES.RESOURCES[key].volume || 0;
                totalVol += qty * vol;
            });
        }
        return totalVol;
    },

    getMaxVolume() {
        this.init();
        let lvlIndex = STATE.company.warehouse.level - 1;
        return this.LEVELS[lvlIndex].maxVol;
    },

    getDailyRent() {
        this.init();
        let lvlIndex = STATE.company.warehouse.level - 1;
        return this.LEVELS[lvlIndex].rent;
    },

    upgrade() {
        this.init();
        let currentLvlIndex = STATE.company.warehouse.level - 1;
        
        if (currentLvlIndex >= this.LEVELS.length - 1) {
            NOTIFY.error('Ошибка', 'У вас уже максимальный уровень склада!');
            return;
        }

        let nextLvl = this.LEVELS[currentLvlIndex + 1];
        if (STATE.finances.balance >= nextLvl.upgradeCost) {
            STATE.finances.balance -= nextLvl.upgradeCost;
            STATE.company.warehouse.level++;
            NOTIFY.success('Успех', `Склад успешно расширен до ${nextLvl.maxVol} м³!`);
            UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', `Недостаточно средств для расширения (нужно $${formatMoney(nextLvl.upgradeCost)}).`);
        }
    }
};
