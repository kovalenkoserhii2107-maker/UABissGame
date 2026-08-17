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
            STATE.finances.balance -= cost;
            
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
                uid: Date.now() + Math.floor(Math.random() * 1000), 
                type: type, 
                level: 1,
                name: customName,
                city: cityId,            // Привязка к городу
                locMult: costMult,       // Фиксация стоимости аренды
                assigned: { junior: 0, middle: 0, senior: 0 }, 
                equipment: { count: 0, condition: 100, quality: 1.0 },
                stats: { daily: 0, monthly: [], total: 0, lastOutput: 0 },
                lastCogs: 0
            });

            // Авто-активация склада уровня 1 в городе при открытии бизнеса
            if (typeof WAREHOUSE !== 'undefined') WAREHOUSE.init();
            if (STATE.company.warehouses && STATE.company.warehouses[cityId] && STATE.company.warehouses[cityId].level === 0) {
                STATE.company.warehouses[cityId].level = 1;
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
                STATE.finances.balance -= cost;
                biz.level = (biz.level || 1) + 1;
                
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
        if (isNaN(qty) || qty <= 0) return;
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
            STATE.finances.balance -= repairCost;
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_repair', repairCost); 
            biz.equipment.condition = 100;
            NOTIFY.success('Успех', `ТО завершено! Списано: $${formatMoney(repairCost)}`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', 'Не хватает средств.');
        }
    },

    processProduction() {
        this.init();
        
        let sortedBusinesses = [...STATE.company.businesses].sort((a, b) => {
            let tplA = RECIPES.BUSINESSES[a.type];
            let tplB = RECIPES.BUSINESSES[b.type];
            if (tplB.inputs && tplB.inputs[tplA.output]) return -1;
            if (tplA.inputs && tplA.inputs[tplB.output]) return 1;
            return Object.keys(tplA.inputs || {}).length - Object.keys(tplB.inputs || {}).length;
        });

        STATE.company.businesses.forEach(biz => { biz.dailyIncoming = {}; });

        let addToInventory = (invContainer, itemKey, qty, cost, quality) => {
            if (!invContainer[itemKey]) invContainer[itemKey] = { qty: 0, avgCost: 0, quality: 1.0 };
            let inv = invContainer[itemKey];
            let oldTotal = inv.qty * inv.avgCost;
            let oldTotalQ = inv.qty * (inv.quality || 1.0);
            
            inv.qty += qty;
            inv.avgCost = (oldTotal + cost) / inv.qty;
            inv.quality = (oldTotalQ + (qty * quality)) / inv.qty;
        };

        sortedBusinesses.forEach(biz => {
            if (!biz.assigned) biz.assigned = { junior: 0, middle: 0, senior: 0 };
            if (!biz.routing) biz.routing = {}; 

            let tpl = RECIPES.BUSINESSES[biz.type];
            let level = biz.level || 1;
            let cityId = biz.city || 'odesa';
            let locMult = biz.locMult || 1.0; 
            
            let dailyAdminCost = tpl.area * 2 * level * locMult; 
            STATE.finances.balance -= dailyAdminCost; 
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_admin', dailyAdminCost);

            let cityData = typeof GEO !== 'undefined' ? GEO.getCity(cityId) : { salaryMult: 1.0 };

            if (tpl.isRetail || tpl.isMarketing) {
                // (Розничная логика остается без изменений)
                if (!biz.localInventory) biz.localInventory = {};
                if (biz.dailyIncoming) {
                    Object.keys(biz.dailyIncoming).forEach(k => {
                        let inc = biz.dailyIncoming[k];
                        if (inc.qty > 0) {
                            let currentVol = 0;
                            Object.keys(biz.localInventory).forEach(ik => { currentVol += biz.localInventory[ik].qty * (RECIPES.RESOURCES[ik].volume || 0); });
                            let maxVol = tpl.area * level * locMult * 2; 
                            let itemVol = RECIPES.RESOURCES[k].volume || 0.1;
                            let maxCanFit = itemVol > 0 ? Math.floor((maxVol - currentVol) / itemVol) : inc.qty;
                            let toStore = Math.min(inc.qty, maxCanFit);
                            let toReject = inc.qty - toStore;
                            
                            if (toStore > 0) addToInventory(biz.localInventory, k, toStore, toStore * inc.avgCost, inc.quality);
                            if (toReject > 0 && STATE.company.warehouses[cityId]) {
                                addToInventory(STATE.company.warehouses[cityId].inventory, k, toReject, toReject * inc.avgCost, inc.quality);
                            }
                        }
                    });
                    biz.dailyIncoming = {}; 
                }
                if (biz.equipment.count > 0) {
                    biz.equipment.condition = Math.max(0, biz.equipment.condition - 0.5);
                }
                return; 
            }

            let maxStaff = tpl.staffReq * level;
            let assignedTotal = biz.assigned.junior + biz.assigned.middle + biz.assigned.senior;
            let prodPower = (biz.assigned.junior * HR.GRADES.junior.prodMult) + (biz.assigned.middle * HR.GRADES.middle.prodMult) + (biz.assigned.senior * HR.GRADES.senior.prodMult);
            let uiEfficiency = maxStaff > 0 ? (prodPower / maxStaff) : 1;
            if (assignedTotal === 0) uiEfficiency = 0;

            let eqCount = biz.equipment.count || 0;
            let maxOutByEquip = eqCount * (tpl.outputPerMachine || 10);
            let conditionMult = biz.equipment.condition < 70 ? Math.max(0.0, biz.equipment.condition / 70) : 1.0;
            let possibleOutput = Math.floor(maxOutByEquip * uiEfficiency * conditionMult);

            let inputsKeys = Object.keys(tpl.inputs);
            
            // --- ЛОГИСТИКА ВЫБОРА СКЛАДА ---
            let sourceCityId = biz.sourceWh || cityId;
            let targetCityId = biz.targetWh || cityId;
            let sourceWh = STATE.company.warehouses[sourceCityId];
            let targetWh = STATE.company.warehouses[targetCityId];

            let flushLeftovers = () => {
                if (biz.dailyIncoming && sourceWh) {
                    Object.keys(biz.dailyIncoming).forEach(k => {
                        let inc = biz.dailyIncoming[k];
                        if (inc.qty > 0) addToInventory(sourceWh.inventory, k, inc.qty, inc.qty * inc.avgCost, inc.quality);
                    });
                    biz.dailyIncoming = {}; 
                }
            };

            if (possibleOutput <= 0) {
                biz.stats.lastOutput = 0;
                flushLeftovers();
                return; 
            }

            let materialsCost = 0;
            let totalInputsCount = 0;
            let sumMatQuality = 0;
            
            inputsKeys.forEach(k => {
                let reqNum = tpl.inputs[k];
                let incomingQty = (biz.dailyIncoming && biz.dailyIncoming[k]) ? biz.dailyIncoming[k].qty : 0;
                let globalQty = (sourceWh && sourceWh.inventory[k]) ? sourceWh.inventory[k].qty : 0;
                let totalAvail = incomingQty + globalQty;

                if (totalAvail < possibleOutput * reqNum) {
                    possibleOutput = Math.floor(totalAvail / reqNum);
                }
            });

            // Проверка вместимости целевого склада
            let outVol = RECIPES.RESOURCES[tpl.output].volume || 0;
            let inVol = 0;
            inputsKeys.forEach(k => inVol += (RECIPES.RESOURCES[k].volume || 0) * tpl.inputs[k]);
            
            // Если склады в одном городе, мы освобождаем место потреблением сырья
            let netVolCheck = (sourceCityId === targetCityId) ? Math.max(0, outVol - inVol) : outVol;
            
            if (netVolCheck > 0 && targetWh) {
                let freeSpace = WAREHOUSE.getMaxVolume(targetCityId) - WAREHOUSE.getCurrentVolume(targetCityId);
                let maxBySpace = Math.floor(freeSpace / netVolCheck);
                if (maxBySpace < possibleOutput) possibleOutput = maxBySpace;
            }

            let actualOutput = possibleOutput;

            if (actualOutput > 0) {
                let inboundLogisticsCost = 0;

                inputsKeys.forEach(k => {
                    let reqTotal = tpl.inputs[k] * actualOutput;
                    let incInv = (biz.dailyIncoming && biz.dailyIncoming[k]) ? biz.dailyIncoming[k] : { qty: 0, avgCost: 0, quality: 1.0 };
                    let globalInv = (sourceWh && sourceWh.inventory[k]) ? sourceWh.inventory[k] : { qty: 0, avgCost: 0, quality: 1.0 };
                    
                    let takeIncoming = Math.min(incInv.qty, reqTotal); 
                    let takeGlobal = reqTotal - takeIncoming;          
                    
                    if (takeIncoming > 0) {
                        materialsCost += takeIncoming * incInv.avgCost;
                        sumMatQuality += takeIncoming * (incInv.quality || 1.0);
                        totalInputsCount += takeIncoming;
                        incInv.qty -= takeIncoming; 
                    }
                    if (takeGlobal > 0 && sourceWh) {
                        materialsCost += takeGlobal * globalInv.avgCost;
                        sumMatQuality += takeGlobal * (globalInv.quality || 1.0);
                        totalInputsCount += takeGlobal;
                        globalInv.qty -= takeGlobal; 
                        if (globalInv.qty === 0) globalInv.avgCost = 0;
                        
                        // Считаем входящую логистику (с учетом внутригородских/межгородских тарифов)
                        if (typeof GEO !== 'undefined') {
                            let vol = takeGlobal * (RECIPES.RESOURCES[k].volume || 0.1);
                            inboundLogisticsCost += GEO.getLogisticsCost(sourceCityId, cityId, vol, 'factory', locMult);
                        }
                    }
                });

                // Списываем входящую логистику
                STATE.finances.balance -= inboundLogisticsCost;

                let q_mat = totalInputsCount > 0 ? (sumMatQuality / totalInputsCount) : 1.0;
                let eqQuality = biz.equipment.quality || 1.0; 
                let q_hr = 1.0;
                if (assignedTotal > 0) q_hr = ((biz.assigned.junior * 1.0) + (biz.assigned.middle * 1.2) + (biz.assigned.senior * 1.5)) / assignedTotal;
                let q_tech = (STATE.rnd && STATE.rnd.techLevels && STATE.rnd.techLevels[biz.type]) ? STATE.rnd.techLevels[biz.type] : 1.0;
                let q_out = (eqQuality * 0.1) + (q_mat * 0.3) + (q_hr * 0.2) + (q_tech * 0.4);

                let bizSalaryCost = ((biz.assigned.junior * HR.GRADES.junior.salary) + (biz.assigned.middle * HR.GRADES.middle.salary) + (biz.assigned.senior * HR.GRADES.senior.salary)) * cityData.salaryMult;
                
                // ИСКЛЮЧАЕМ зарплату из себестоимости (она списывается глобально в HR)
                let totalProductionCost = materialsCost + inboundLogisticsCost; 
                biz.lastCogs = totalProductionCost / actualOutput;

                let remainingOutput = actualOutput;
                let remainingCost = totalProductionCost;

                Object.keys(biz.routing).forEach(destId => {
                    let targetQty = biz.routing[destId];
                    if (targetQty <= 0) return;
                    let shareQty = Math.min(targetQty, remainingOutput); 
                    if (shareQty === 0) return;
                    
                    let shareCost = biz.lastCogs * shareQty;
                    remainingOutput -= shareQty;
                    remainingCost -= shareCost;

                    let destBiz = STATE.company.businesses.find(b => b.uid == destId);
                    if (destBiz) {
                        if (!destBiz.dailyIncoming) destBiz.dailyIncoming = {};
                        addToInventory(destBiz.dailyIncoming, tpl.output, shareQty, shareCost, q_out);
                    } else if (targetWh) {
                        addToInventory(targetWh.inventory, tpl.output, shareQty, shareCost, q_out);
                    }
                });

                // Все излишки идут на ЦЕЛЕВОЙ склад (с расчетом исходящей логистики)
                if (remainingOutput > 0 && targetWh) {
                    let outboundLogisticsCost = 0;
                    if (typeof GEO !== 'undefined') {
                        let vol = remainingOutput * outVol;
                        outboundLogisticsCost = GEO.getLogisticsCost(cityId, targetCityId, vol, 'factory', locMult);
                        
                        if (outboundLogisticsCost > 0) {
                            STATE.finances.balance -= outboundLogisticsCost;
                        }
                    }
                    remainingCost += outboundLogisticsCost;
                    addToInventory(targetWh.inventory, tpl.output, remainingOutput, Math.max(0, remainingCost), q_out);
                }

                let wearRate = 1.5 * (actualOutput / maxOutByEquip);
                biz.equipment.condition = Math.max(0, biz.equipment.condition - wearRate);
            }

            flushLeftovers();
            biz.stats.lastOutput = actualOutput;
            biz.stats.total += actualOutput;
        });
    }
};
