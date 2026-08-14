// Глобальный справочник городов (можно вынести в отдельный файл constants, если нужно)
const CITIES = {
    'odesa': { name: 'Одесса', population: 1000000, logisticsMult: 1.0 },
    'kyiv': { name: 'Киев', population: 3000000, logisticsMult: 1.3 },
    'lviv': { name: 'Львов', population: 700000, logisticsMult: 1.1 }
};

// Модуль складской логистики и распределения
const WAREHOUSE = {
    init() {
        if (!STATE.company.warehouses) {
            // Переход на мульти-склады. Одесса — стартовый хаб по умолчанию.
            STATE.company.warehouses = {
                'odesa': { level: 1, inventory: {} },
                'kyiv': { level: 0, inventory: {} }, // 0 значит склад не куплен
                'lviv': { level: 0, inventory: {} }
            };
            
            // Миграция старого инвентаря (если есть) на склад в Одессу
            if (STATE.company.inventory) {
                STATE.company.warehouses['odesa'].inventory = STATE.company.inventory;
                delete STATE.company.inventory; 
            }
        }
    },

    // Магический мост для уровней (база теперь 5000 м³)
    get LEVELS() {
        return new Proxy([], {
            get: (target, prop) => {
                if (prop === 'length') return Infinity;
                let index = parseInt(prop);
                if (!isNaN(index)) {
                    let targetLevel = index + 1;
                    return {
                        maxVol: Math.floor(5000 * Math.pow(1.5, targetLevel - 1)),
                        upgradeCost: Math.floor(10000 * Math.pow(1.8, targetLevel - 2))
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
        let lvl = wh ? wh.level : 0;
        // Если уровня нет (0), то это покупка ПЕРВОГО склада в новом городе ($25,000)
        if (lvl === 0) return 25000; 
        return Math.floor(10000 * Math.pow(1.8, lvl - 1));
    },

    getDailyRent(cityId) {
        this.init();
        let wh = STATE.company.warehouses[cityId];
        if (!wh || wh.level === 0) return 0;
        let cityMult = CITIES[cityId].logisticsMult;
        return Math.floor(100 * Math.pow(1.5, wh.level - 1) * cityMult);
    },

    getCurrentVolume(cityId) {
        let vol = 0;
        let wh = STATE.company.warehouses[cityId];
        if (wh && wh.inventory) {
            Object.keys(wh.inventory).forEach(key => {
                let item = wh.inventory[key];
                if (item.qty > 0 && RECIPES.RESOURCES[key]) {
                    let itemVol = RECIPES.RESOURCES[key].volume || 1.0; 
                    vol += item.qty * itemVol;
                }
            });
        }
        return vol;
    },

    upgrade(cityId) {
        this.init();
        let cost = this.getUpgradeCost(cityId);
        let wh = STATE.company.warehouses[cityId];
        
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost;
            if (wh.level === 0) {
                wh.level = 1;
                wh.inventory = {};
                if (typeof NOTIFY !== 'undefined') NOTIFY.success('Новый хаб', `Открыт новый складской комплекс в городе: ${CITIES[cityId].name}.`);
            } else {
                wh.level++;
                let newVol = this.getMaxVolume(cityId);
                if (typeof NOTIFY !== 'undefined') NOTIFY.success('Склад расширен', `Хаб в г. ${CITIES[cityId].name} увеличен до ${newVol} м³.`);
            }
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Отказ в стройке', `Не хватает средств. Нужно $${formatMoney(cost)}`);
        }
    },

    // --- СИСТЕМА АВТОМАТИЧЕСКОГО СНАБЖЕНИЯ МАГАЗИНОВ ---
    processDaily() {
        this.init();
        
        // 1. Списываем аренду за все работающие склады
        let totalRent = 0;
        Object.keys(STATE.company.warehouses).forEach(cityId => {
            totalRent += this.getDailyRent(cityId);
        });
        if (totalRent > 0) {
            STATE.finances.balance -= totalRent;
            if (STATE.ledger && STATE.ledger.yesterday) {
                STATE.ledger.yesterday.exp_admin = (STATE.ledger.yesterday.exp_admin || 0) + totalRent;
            }
        }

        // 2. Внутригородская авто-доставка со складов в магазины
        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            // Работаем только с розницей, у которой настроены правила снабжения
            if (!tpl.isRetail || !biz.autoSupplyRules) return;

            let city = biz.city || 'odesa'; // Ищем магазин в городе
            let localWh = STATE.company.warehouses[city];
            
            // Если в этом городе у нас нет склада, снабжать неоткуда
            if (!localWh || localWh.level === 0) return;

            Object.keys(biz.autoSupplyRules).forEach(itemKey => {
                let targetQty = biz.autoSupplyRules[itemKey]; // Сколько хотим видеть на полках
                if (!biz.localInventory) biz.localInventory = {};
                if (!biz.localInventory[itemKey]) biz.localInventory[itemKey] = { qty: 0, avgCost: 0, quality: 1.0 };
                
                let storeItem = biz.localInventory[itemKey];
                let deficit = targetQty - storeItem.qty;

                // Если полка опустела на нужный процент, везем со склада
                if (deficit > 0 && localWh.inventory[itemKey] && localWh.inventory[itemKey].qty > 0) {
                    let whItem = localWh.inventory[itemKey];
                    let transferQty = Math.min(deficit, whItem.qty);
                    
                    // Перемещаем товар, смешивая себестоимость и качество
                    let oldTotalCost = storeItem.qty * storeItem.avgCost;
                    let oldTotalQual = storeItem.qty * storeItem.quality;
                    
                    let transferTotalCost = transferQty * whItem.avgCost;
                    let transferTotalQual = transferQty * (whItem.quality || 1.0);
                    
                    storeItem.qty += transferQty;
                    storeItem.avgCost = (oldTotalCost + transferTotalCost) / storeItem.qty;
                    storeItem.quality = (oldTotalQual + transferTotalQual) / storeItem.qty;
                    
                    whItem.qty -= transferQty;
                    if (whItem.qty === 0) whItem.avgCost = 0;
                    
                    // TODO в будущем: Здесь можно списывать стоимость бензина/логистики за внутригородскую доставку
                }
            });
        });
    }
};
