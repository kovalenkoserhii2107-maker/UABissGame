// Модуль управления производством (Интеграция с Региональной Экономикой)
const PRODUCTION = {
    init() {
        if (!STATE.company.businesses) STATE.company.businesses = [];
        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!biz.equipment) {
                biz.equipment = {
                    count: (biz.level || 1) * (tpl.slotsPerLevel || 10),
                    condition: 100,
                    quality: 1.0
                };
            }
            // Заглушка для совместимости старых сохранений
            if (!biz.city) biz.city = 'odesa';
        });
    },

    buyBusiness(type, cityId = null) {
        let tpl = RECIPES.BUSINESSES[type];
        if (!tpl || (tpl.researchCost > 0 && !STATE.rnd.unlocked.includes(type))) return false;
        if (cityId && !GEO.CITIES[cityId]) return false;

        // Вызов универсального окна выбора города из dashboardUI
        if (!cityId) {
            if (typeof UI_DASHBOARD !== 'undefined') {
                UI_DASHBOARD.showCityModal('business', type);
            }
            return;
        }

        // Подтягиваем данные региона из GEO
        let cityData = typeof GEO !== 'undefined' ? GEO.getCity(cityId) : { name: 'Одесса', rentMult: 1.0 };
        let costMult = cityData.rentMult || 1.0;

        let cost = tpl.area * 50 * costMult;

        if (STATE.finances.balance >= cost) {
            LEDGER.cash(-cost, 'investing', 'Предприятие');

            const UKR_NAMES = ['Мрія', 'Сокіл', 'Скіф', 'Булава', 'Грім', 'Січ', 'Воля'];
            const RETAIL_NAMES = ['Сільпо', 'АТБ', 'Аврора', 'Епіцентр', 'ФОРА', 'VARUS', 'КОСМО', 'Fozzy', 'EVA'];
            const MARKETING_NAMES = [
                'Banda Agency',
                'Fedoriv Group',
                'Gres Todorchuk',
                'Republik',
                'Katsman Communications',
                'IAMIDEA',
                'Sushka',
                'Postmen',
                'Arriba!'
            ];

            let randomName = '';
            if (tpl.isRetail) {
                randomName = RETAIL_NAMES[Math.floor(Math.random() * RETAIL_NAMES.length)];
            } else if (tpl.isMarketing) {
                randomName = MARKETING_NAMES[Math.floor(Math.random() * MARKETING_NAMES.length)];
            } else {
                randomName = UKR_NAMES[Math.floor(Math.random() * UKR_NAMES.length)];
            }

            let countOfThisType = STATE.company.businesses.filter(b => b.type === type).length + 1;

            let customName = '';
            if (tpl.isRetail) {
                customName = `Магазин "${randomName}" (${cityData.name})`;
            } else if (tpl.isMarketing) {
                customName = `Агентство "${randomName}" (${cityData.name})`;
            } else {
                customName = `${tpl.name} "${randomName}-${countOfThisType}" (${cityData.name})`;
            }

            STATE.company.businesses.push({
                uid: OPERATIONS.id(),
                type: type,
                level: 1,
                name: customName,
                city: cityId,            // Привязка к городу
                capitalCost: cost,
                locMult: costMult,       // Фиксация стоимости аренды
                assigned: { junior: 0, middle: 0, senior: 0 },
                equipment: { count: 0, condition: 100, quality: 1.0 },
                stats: { daily: 0, monthly: [], total: 0, lastOutput: 0 },
                localInventory: {}, dailyIncoming: {}, prices: {}, autoSupplyRules: {}, routing: {},
                lastCogs: 0
            });

            // Авто-активация склада уровня 1 в городе при открытии бизнеса
            if (typeof WAREHOUSE !== 'undefined') WAREHOUSE.init();
            if (STATE.company.warehouses && STATE.company.warehouses[cityId] && STATE.company.warehouses[cityId].level === 0) {
                STATE.company.warehouses[cityId].level = 1;
                STATE.company.warehouses[cityId].capitalCost = 0; // Хаб включён в стоимость предприятия.
            }

            NOTIFY.success('Успех', `Вы открыли: ${customName}!`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', `Недостаточно средств (Нужно $${formatMoney(cost)})`);
        }
    },

    upgradeBusiness(uid) {
        let biz = STATE.company.businesses.find(b => b.uid === uid);
        if (biz) {
            let tpl = RECIPES.BUSINESSES[biz.type];
            // Стоимость расширения зависит от изначального коэффициента города
            let cost = tpl.area * 50 * (biz.level || 1) * (biz.locMult || 1.0);

            if (STATE.finances.balance >= cost) {
                LEDGER.cash(-cost, 'investing', 'Предприятие');
                const lvl = biz.level || 1;
                biz.capitalCost = (biz.capitalCost ?? tpl.area * 50 * (biz.locMult ?? 1) * (1 + lvl * (lvl - 1) / 2)) + cost;
                biz.level = lvl + 1;

                let msg = "Завод расширен!";
                if (tpl.isRetail) msg = "Площадь магазина успешно увеличена!";
                else if (tpl.isMarketing) msg = "Офис маркетинга расширен!";

                NOTIFY.success('Успех', msg);
                if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
            } else {
                NOTIFY.error('Ошибка', `Недостаточно средств (Нужно $${formatMoney(cost)})`);
            }
        }
    },

    installEquipment(uid, qty) {
        if (!OPERATIONS.quantity(qty)) return;
        let biz = STATE.company.businesses.find(b => b.uid === uid);
        if (!biz) return;

        let tpl = RECIPES.BUSINESSES[biz.type];
        let eqType = tpl.equipmentType;
        let maxSlots = (biz.level || 1) * (tpl.slotsPerLevel || 10);
        let freeSlots = maxSlots - biz.equipment.count;

        if (qty > freeSlots) { NOTIFY.error('Ошибка', 'Не хватает места в цеху!'); return; }

        let cityId = biz.city || 'odesa';
        let localWh = STATE.company.warehouses[cityId];

        // Оборудование списывается со склада того города, где расположен цех
        if (!localWh || !localWh.inventory[eqType] || localWh.inventory[eqType].qty < qty) {
            let cName = typeof GEO !== 'undefined' ? GEO.getCity(cityId).name : 'Одесса';
            NOTIFY.error('Ошибка', `Нет оборудования на складе г. ${cName}.`);
            return;
        }

        let inv = localWh.inventory[eqType];
        if (!biz.equipment.quality) biz.equipment.quality = 1.0;
        let eqQuality = inv.quality || 1.0;

        let currentTotalHealth = biz.equipment.count * biz.equipment.condition;
        let currentTotalQuality = biz.equipment.count * biz.equipment.quality;

        biz.equipment.bookValue = (biz.equipment.bookValue ?? biz.equipment.count * RECIPES.RESOURCES[eqType].basePrice * biz.equipment.condition / 100) + qty * inv.avgCost;
        inv.qty -= qty;
        if (inv.qty === 0) inv.avgCost = 0;

        biz.equipment.count += qty;
        biz.equipment.condition = (currentTotalHealth + (qty * 100)) / biz.equipment.count;
        biz.equipment.quality = (currentTotalQuality + (qty * eqQuality)) / biz.equipment.count;

        if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
    },

    repairEquipment(uid) {
        let biz = STATE.company.businesses.find(b => b.uid === uid);
        if (!biz || biz.equipment.count === 0) return;

        let eqCost = RECIPES.RESOURCES[RECIPES.BUSINESSES[biz.type].equipmentType].basePrice;
        let damage = 100 - biz.equipment.condition;
        if (damage <= 0) { NOTIFY.success('Успех', 'Ремонт не требуется.'); return; }

        let repairCost = (biz.equipment.count * eqCost) * 0.10 * (damage / 100);
        if (STATE.finances.balance >= repairCost) {
            LEDGER.cash(-repairCost, 'operating', 'Ремонт');
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_repair', repairCost);
            biz.equipment.condition = 100;
            NOTIFY.success('Успех', `ТО завершено! Списано: $${formatMoney(repairCost)}`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', 'Не хватает средств.');
        }
    },

    orderedFactories() {
        const factories = STATE.company.businesses.filter(b => !RECIPES.BUSINESSES[b.type].isRetail && !RECIPES.BUSINESSES[b.type].isMarketing);
        const ordered = [], visiting = new Set(), visited = new Set();
        const visit = biz => {
            if (visited.has(biz.uid)) return;
            if (visiting.has(biz.uid)) throw new Error('Циклический производственный рецепт');
            visiting.add(biz.uid);
            const inputs = RECIPES.BUSINESSES[biz.type].inputs;
            for (const parent of factories) if (parent.uid !== biz.uid && inputs[RECIPES.BUSINESSES[parent.type].output]) visit(parent);
            visiting.delete(biz.uid); visited.add(biz.uid); ordered.push(biz);
        };
        factories.forEach(visit);
        return ordered;
    },

    processProduction() {
        this.init();
        WAREHOUSE.init();
        // Recover legacy in-flight routes once. Never clear stock without transferring it.
        for (const biz of STATE.company.businesses) {
            biz.localInventory ??= {};
            for (const [key, inv] of Object.entries(biz.dailyIncoming ?? {})) {
                if (inv.qty > 0) OPERATIONS.add(biz.localInventory, key, inv.qty, inv.qty * inv.avgCost, inv.quality, inv.brand ?? 0);
            }
            biz.dailyIncoming = {};
            const tpl = RECIPES.BUSINESSES[biz.type];
            const rent = tpl.area * 2 * biz.level * biz.locMult;
            LEDGER.cash(-rent, 'operating', 'Аренда предприятия'); LEDGER.record('exp_admin', rent);
        }
        for (const biz of this.orderedFactories()) {
            const tpl = RECIPES.BUSINESSES[biz.type];
            const sourceCity = biz.sourceWh ?? biz.city, targetCity = biz.targetWh ?? biz.city;
            const source = STATE.company.warehouses[sourceCity], target = STATE.company.warehouses[targetCity];
            const staff = biz.assigned;
            const power = ['junior', 'middle', 'senior'].reduce((n, g) => n + (staff[g] ?? 0) * HR.GRADES[g].prodMult, 0);
            const maximum = biz.equipment.count * tpl.outputPerMachine;
            const condition = Math.min(1, biz.equipment.condition / 70);
            let output = Math.floor(maximum * power / (tpl.staffReq * biz.level) * condition);
            biz.stats.lastOutput = 0;
            if (!source?.level || !target?.level) continue;
            for (const [item, count] of Object.entries(tpl.inputs)) {
                output = Math.min(output, Math.floor(((biz.localInventory[item]?.qty ?? 0) + (source.inventory[item]?.qty ?? 0)) / count));
            }
            const consumption = qty => Object.entries(tpl.inputs).map(([item, count]) => {
                const local = Math.min(qty * count, biz.localInventory[item]?.qty ?? 0);
                return { item, local, global: qty * count - local };
            });
            // Reserve destinations before consuming material. Routes can use a free store
            // even when the fallback warehouse is full. Pending orders reserve warehouse space.
            const plan = qty => {
                let left = qty, shipping = 0;
                const allocations = [];
                for (const [id, quota] of Object.entries(biz.routing ?? {})) {
                    const dest = STATE.company.businesses.find(b => b.uid === Number(id));
                    const dt = dest && RECIPES.BUSINESSES[dest.type];
                    if (!dest || dest.uid === biz.uid || !OPERATIONS.quantity(quota) || !(dt.inputs[tpl.output] || dt.accepts?.includes(tpl.output))) continue;
                    const fit = OPERATIONS.fit(dest.localInventory, OPERATIONS.storeCapacity(dest), tpl.output);
                    const count = Math.min(quota, left, fit);
                    if (count) {
                        const cost = GEO.getLogisticsCost(biz.city, dest.city, count * OPERATIONS.volume(tpl.output), dt.isRetail ? 'store' : 'factory', dest.locMult);
                        allocations.push({ dest, count, shipping: cost }); shipping += cost; left -= count;
                    }
                }
                const used = consumption(qty);
                const released = sourceCity === targetCity ? used.reduce((v, c) => v + c.global * OPERATIONS.volume(c.item), 0) : 0;
                const vol = OPERATIONS.volume(tpl.output);
                const free = WAREHOUSE.freeSpace(targetCity) + released;
                const fit = vol === 0 ? left : Math.max(0, Math.floor((free + 1e-9) / vol));
                const count = Math.min(left, fit);
                if (count) { const cost = GEO.getLogisticsCost(biz.city, targetCity, count * vol, 'factory'); allocations.push({ dest: null, count, shipping: cost }); shipping += cost; left -= count; }
                shipping += used.reduce((v, c) => v + GEO.getLogisticsCost(sourceCity, biz.city, c.global * OPERATIONS.volume(c.item), 'factory'), 0);
                return { allocations, shipping, valid: left === 0 && shipping <= Math.max(0, STATE.finances.balance) + 1e-9 };
            };
            let low = 0, high = Math.max(0, output);
            while (low < high) { const mid = Math.ceil((low + high) / 2); if (plan(mid).valid) low = mid; else high = mid - 1; }
            output = low;
            if (!output) continue;
            const shipment = plan(output);
            let materialsCost = 0, qualitySum = 0, inputCount = 0;
            const used = consumption(output);
            let inboundCost = 0;
            for (const c of used) {
                for (const [inventory, count] of [[biz.localInventory, c.local], [source.inventory, c.global]]) {
                    if (!count) continue;
                    const batch = OPERATIONS.take(inventory, c.item, count);
                    materialsCost += batch.cost; qualitySum += count * batch.quality; inputCount += count;
                }
                inboundCost += GEO.getLogisticsCost(sourceCity, biz.city, c.global * OPERATIONS.volume(c.item), 'factory');
            }
            const people = ['junior', 'middle', 'senior'].reduce((n, g) => n + (staff[g] ?? 0), 0);
            const hrQuality = people ? ((staff.junior ?? 0) + (staff.middle ?? 0) * 1.2 + (staff.senior ?? 0) * 1.5) / people : 1;
            const quality = (biz.equipment.quality ?? 1) * 0.1 + (inputCount ? qualitySum / inputCount : 1) * 0.3 + hrQuality * 0.2 + (STATE.rnd.techLevels?.[biz.type] ?? 1) * 0.4;
            biz.lastCogs = (materialsCost + inboundCost) / output;
            LEDGER.cash(-shipment.shipping, 'operating', 'Производственная доставка');
            for (const a of shipment.allocations) {
                const inventory = a.dest ? a.dest.localInventory : target.inventory;
                OPERATIONS.add(inventory, tpl.output, a.count, a.count * biz.lastCogs + a.shipping, quality);
            }
            OPERATIONS.wear(biz.equipment, 1.5 * output / maximum, tpl.equipmentType);
            biz.stats.lastOutput = output; biz.stats.total += output;
        }
        for (const biz of STATE.company.businesses) {
            const tpl = RECIPES.BUSINESSES[biz.type];
            if ((tpl.isRetail || tpl.isMarketing) && biz.equipment.count) OPERATIONS.wear(biz.equipment, 0.5, tpl.equipmentType);
        }
    }

};
