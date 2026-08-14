// Модуль складской логистики и распределения (на базе GEO)
const WAREHOUSE = {
    init() {
        if (!STATE.company.warehouses) {
            STATE.company.warehouses = {};
            // Инициализируем все города из GEO с нулевым уровнем
            Object.keys(GEO.CITIES).forEach(cId => {
                STATE.company.warehouses[cId] = { level: 0, inventory: {} };
            });
            // Спасение старого инвентаря в Одессу
            if (STATE.company.inventory && Object.keys(STATE.company.inventory).length > 0) {
                STATE.company.warehouses['odesa'] = { level: 1, inventory: STATE.company.inventory };
            }
            delete STATE.company.inventory; 
        }
        // Защита от добавления новых городов
        Object.keys(GEO.CITIES).forEach(cId => {
            if (!STATE.company.warehouses[cId]) STATE.company.warehouses[cId] = { level: 0, inventory: {} };
        });
    },

    get LEVELS() {
        return new Proxy([], {
            get: (target, prop) => {
                if (prop === 'length') return Infinity;
                let index = parseInt(prop);
                if (!isNaN(index)) {
                    return {
                        maxVol: Math.floor(5000 * Math.pow(1.5, index)),
                        upgradeCost: Math.floor(10000 * Math.pow(1.8, index - 1))
                    };
                }
                return target[prop];
            }
        });
    },

    getMaxVolume(cityId) {
        this.init();
        let wh = STATE.company.warehouses[cityId];
        if (!wh || wh.level === 0) return 0;
        return Math.floor(5000 * Math.pow(1.5, wh.level - 1));
    },

    getUpgradeCost(cityId) {
        this.init();
        let wh = STATE.company.warehouses[cityId];
        // Если склада в городе еще нет (0 уровень), постройка обойдется в $5,000
        if (!wh || wh.level === 0) return 5000; 
        return Math.floor(10000 * Math.pow(1.8, wh.level - 1));
    },

    getDailyRent(cityId) {
        this.init();
        let wh = STATE.company.warehouses[cityId];
        if (!wh || wh.level === 0) return 0;
        let city = GEO.getCity(cityId);
        return Math.floor(100 * Math.pow(1.5, wh.level - 1) * city.rentMult);
    },

    getCurrentVolume(cityId) {
        let vol = 0;
        let wh = STATE.company.warehouses[cityId];
        if (wh && wh.inventory) {
            Object.keys(wh.inventory).forEach(key => {
                let item = wh.inventory[key];
                if (item.qty > 0 && RECIPES.RESOURCES[key]) {
                    vol += item.qty * (RECIPES.RESOURCES[key].volume || 1.0);
                }
            });
        }
        return vol;
    },

    upgrade(cityId) {
        this.init();
        let cost = this.getUpgradeCost(cityId);
        let wh = STATE.company.warehouses[cityId];
        let city = GEO.getCity(cityId);
        
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost;
            if (wh.level === 0) {
                wh.level = 1;
                wh.inventory = {};
                if (typeof NOTIFY !== 'undefined') NOTIFY.success('Новый хаб', `Открыт складской комплекс в г. ${city.name}.`);
            } else {
                wh.level++;
                if (typeof NOTIFY !== 'undefined') NOTIFY.success('Склад расширен', `Хаб в г. ${city.name} увеличен до ${this.getMaxVolume(cityId)} м³.`);
            }
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Отказ в стройке', `Не хватает средств. Нужно $${formatMoney(cost)}`);
        }
    },

    processDaily() {
        this.init();
        let totalRent = 0;
        Object.keys(STATE.company.warehouses).forEach(cId => totalRent += this.getDailyRent(cId));
        
        if (totalRent > 0) {
            STATE.finances.balance -= totalRent;
            if (STATE.ledger && STATE.ledger.yesterday) STATE.ledger.yesterday.exp_admin = (STATE.ledger.yesterday.exp_admin || 0) + totalRent;
        }

        // Авто-снабжение (базовое, без логистики, т.к. логистика теперь ручная платная)
        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl.isRetail || !biz.autoSupplyRules) return;
            let city = biz.city || 'odesa'; 
            let localWh = STATE.company.warehouses[city];
            if (!localWh || localWh.level === 0) return;

            Object.keys(biz.autoSupplyRules).forEach(itemKey => {
                let targetQty = biz.autoSupplyRules[itemKey]; 
                if (!biz.localInventory) biz.localInventory = {};
                if (!biz.localInventory[itemKey]) biz.localInventory[itemKey] = { qty: 0, avgCost: 0, quality: 1.0 };
                
                let storeItem = biz.localInventory[itemKey];
                let deficit = targetQty - storeItem.qty;

                if (deficit > 0 && localWh.inventory[itemKey] && localWh.inventory[itemKey].qty > 0) {
                    let whItem = localWh.inventory[itemKey];
                    let transferQty = Math.min(deficit, whItem.qty);
                    
                    let oldTotalCost = storeItem.qty * storeItem.avgCost;
                    let transferTotalCost = transferQty * whItem.avgCost;
                    
                    storeItem.qty += transferQty;
                    storeItem.avgCost = (oldTotalCost + transferTotalCost) / storeItem.qty;
                    
                    whItem.qty -= transferQty;
                    if (whItem.qty === 0) whItem.avgCost = 0;
                }
            });
        });
    }
};
