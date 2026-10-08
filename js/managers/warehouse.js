// Модуль складской логистики и распределения (на базе GEO)
const WAREHOUSE = {
    init() {
        if (!STATE.company.warehouses) {
            STATE.company.warehouses = {};
            // Инициализируем все города из GEO с базовым складом в Одессе
            Object.keys(GEO.CITIES).forEach(cId => {
                STATE.company.warehouses[cId] = { level: (cId === 'odesa' ? 1 : 0), inventory: {} };
            });
            delete STATE.company.inventory;
        }

        // БРОНЯ: Восстанавливаем целостность данных для ВСЕХ городов
        Object.keys(GEO.CITIES).forEach(cId => {
            if (!STATE.company.warehouses[cId]) {
                STATE.company.warehouses[cId] = { level: 0, inventory: {} };
            }
            if (!STATE.company.warehouses[cId].inventory) {
                STATE.company.warehouses[cId].inventory = {};
            }
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
        let city = (typeof GEO !== 'undefined' && GEO.getCity) ? GEO.getCity(cityId) : { rentMult: 1.0 };
        let mult = city.rentMult || 1.0;

        // Постройка первого хаба в городе стоит базово $5,000 * rentMult региона
        if (!wh || wh.level === 0) return Math.floor(5000 * mult);
        return Math.floor(10000 * Math.pow(1.8, wh.level - 1) * mult);
    },

    getDailyRent(cityId) {
        this.init();
        let wh = STATE.company.warehouses[cityId];
        if (!wh || wh.level === 0) return 0;
        let city = GEO.getCity(cityId);
        return Math.floor(100 * Math.pow(1.5, wh.level - 1) * city.rentMult);
    },

    freeSpace(cityId) {
        const pending = (STATE.logistics?.deliveries ?? []).filter(d => d.targetCity === cityId).reduce((v, d) => v + d.qty * OPERATIONS.volume(d.item), 0);
        return Math.max(0, this.getMaxVolume(cityId) - this.getCurrentVolume(cityId) - pending);
    },

    getCurrentVolume(cityId) {
        let vol = 0;
        let wh = STATE.company.warehouses[cityId];
        if (wh && wh.inventory) {
            Object.keys(wh.inventory).forEach(key => {
                let item = wh.inventory[key];
                if (item.qty > 0 && RECIPES.RESOURCES[key]) {
                    vol += item.qty * OPERATIONS.volume(key);
                }
            });
        }
        return vol;
    },

    upgrade(cityId) {
        if (!GEO.CITIES[cityId]) return;

        this.init();
        let cost = this.getUpgradeCost(cityId);
        let wh = STATE.company.warehouses[cityId];
        let city = GEO.getCity(cityId);

        if (STATE.finances.balance >= cost) {
            LEDGER.cash(-cost, 'investing', 'Склад');
            wh.capitalCost = (wh.capitalCost ?? FINANCE.warehouseCost(cityId, wh.level)) + cost;
            if (wh.level === 0) {
                wh.level = 1;
                wh.inventory ??= {};
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
            LEDGER.cash(-totalRent, 'operating', 'Аренда склада');
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_admin', totalRent);
        }

        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl.isRetail || !biz.autoSupplyRules) return;
            let city = biz.city || 'odesa';
            let localWh = STATE.company.warehouses[city];
            if (!localWh || localWh.level === 0) return;

            Object.keys(biz.autoSupplyRules).forEach(itemKey => {
                const target = biz.autoSupplyRules[itemKey];
                const current = biz.localInventory?.[itemKey]?.qty ?? 0;
                const available = localWh.inventory[itemKey]?.qty ?? 0;
                const qty = Math.min(Math.max(0, target - current), available);
                if (qty > 0) OPERATIONS.transferToStore(itemKey, city, biz.uid, qty);
            });
        });
    }
};
