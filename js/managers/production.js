// Модуль управления производством
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
        });
    },

    buyBusiness(type, locationId = null) {
        let tpl = RECIPES.BUSINESSES[type];
        
        // Если это магазин, а локация еще не выбрана - вызываем красивое окно с кнопками
        if (tpl.isRetail && !locationId) {
            if (typeof UI_DASHBOARD !== 'undefined') {
                UI_DASHBOARD.showLocationModal(type);
            }
            return;
        }

        let locationName = '';
        let costMult = 1.0;
        
        if (tpl.isRetail) {
            if (locationId === 'center') { locationName = ' (Центр)'; costMult = 3.0; }
            else if (locationId === 'suburb') { locationName = ' (Пригород)'; costMult = 0.5; }
            else if (locationId === 'residential') { locationName = ' (Спальный)'; costMult = 1.0; }
        }
        
        let cost = tpl.area * 50 * costMult; 
        
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost;
            
            const UKR_NAMES = ['Мрія', 'Сокіл', 'Скіф', 'Булава', 'Грім', 'Січ', 'Воля'];
            const RETAIL_NAMES = ['Розетка', 'Цитрус', 'АЛЛО', 'Епіцентр', 'Таврія В', 'Сільпо', 'Фокстрот', 'Аврора', 'Comfy', 'MOYO'];
            
            let randomName = tpl.isRetail ? RETAIL_NAMES[Math.floor(Math.random() * RETAIL_NAMES.length)] : UKR_NAMES[Math.floor(Math.random() * UKR_NAMES.length)];
            let countOfThisType = STATE.company.businesses.filter(b => b.type === type).length + 1;
            
            // Магазины теперь имеют названия брендов
            let customName = tpl.isRetail ? `Магазин "${randomName}"${locationName}` : `${tpl.name} "${randomName}-${countOfThisType}"`;
            
            STATE.company.businesses.push({
                uid: Date.now(), 
                type: type, 
                level: 1,
                name: customName,
                location: locationId, 
                locMult: costMult,    
                assigned: { junior: 0, middle: 0, senior: 0 }, 
                equipment: { count: 0, condition: 100, quality: 1.0 },
                stats: { daily: 0, monthly: [], total: 0, lastOutput: 0 },
                lastCogs: 0
            });
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
            let cost = tpl.area * 50 * (biz.level || 1);
            if (STATE.finances.balance >= cost) {
                STATE.finances.balance -= cost;
                biz.level = (biz.level || 1) + 1;
                
                // --- НОВОЕ: Правильные уведомления ---
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

        let inv = STATE.company.inventory[eqType];
        if (!inv || inv.qty < qty) { NOTIFY.error('Ошибка', 'Нет оборудования на складе.'); return; }

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

        STATE.company.businesses.forEach(biz => {
            biz.dailyIncoming = {}; 
        });

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
            if (!biz.routing) biz.routing = {}; // Теперь здесь хранятся штуки, склад по умолчанию

            let tpl = RECIPES.BUSINESSES[biz.type];
            let level = biz.level || 1;
            let locMult = biz.locMult || 1.0; // Вытаскиваем множитель аренды локации
            
            // Аренда списывается с учетом наценки локации
            let dailyAdminCost = tpl.area * 2 * level * locMult; 
            STATE.finances.balance -= dailyAdminCost; 
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_admin', dailyAdminCost);

            // --- НОВОЕ: ЛОГИКА СКЛАДА ДЛЯ МАГАЗИНОВ И ОФИСОВ ---
            if (tpl.isRetail || tpl.isMarketing) {
                if (!biz.localInventory) biz.localInventory = {};
                
                // Переносим товары из буфера поставок на локальный склад магазина
                if (biz.dailyIncoming) {
                    Object.keys(biz.dailyIncoming).forEach(k => {
                        let inc = biz.dailyIncoming[k];
                        if (inc.qty > 0) {
                            // Считаем текущий занятый объем склада магазина
                            let currentVol = 0;
                            Object.keys(biz.localInventory).forEach(ik => {
                                currentVol += biz.localInventory[ik].qty * (RECIPES.RESOURCES[ik].volume || 0);
                            });
                            
                            // Вместимость: 2 м3 на каждый 1 кв.м площади с учетом локации
                            let maxVol = tpl.area * level * locMult * 2; 
                            let itemVol = RECIPES.RESOURCES[k].volume || 0.1;
                            
                            let freeSpace = maxVol - currentVol;
                            let maxCanFit = itemVol > 0 ? Math.floor(freeSpace / itemVol) : inc.qty;
                            
                            let toStore = Math.min(inc.qty, maxCanFit);
                            let toReject = inc.qty - toStore;
                            
                            if (toStore > 0) addToInventory(biz.localInventory, k, toStore, toStore * inc.avgCost, inc.quality);
                            
                            // Если склад магазина забит, излишки возвращаются на Глобальный склад
                            if (toReject > 0) addToInventory(STATE.company.inventory, k, toReject, toReject * inc.avgCost, inc.quality);
                        }
                    });
                    biz.dailyIncoming = {}; 
                }

                if (biz.equipment.count > 0) {
                    biz.equipment.condition -= 0.5;
                    if (biz.equipment.condition < 0) biz.equipment.condition = 0;
                }
                return; 
            }

            let maxStaff = tpl.staffReq * level;
            let assignedTotal = biz.assigned.junior + biz.assigned.middle + biz.assigned.senior;
            let prodPower = (biz.assigned.junior * HR.GRADES.junior.prodMult) + 
                            (biz.assigned.middle * HR.GRADES.middle.prodMult) + 
                            (biz.assigned.senior * HR.GRADES.senior.prodMult);
            let uiEfficiency = maxStaff > 0 ? (prodPower / maxStaff) : 1;
            if (assignedTotal === 0) uiEfficiency = 0;

            let eqCount = biz.equipment.count || 0;
            let maxOutByEquip = eqCount * (tpl.outputPerMachine || 10);
            let conditionMult = biz.equipment.condition < 70 ? Math.max(0.0, biz.equipment.condition / 70) : 1.0;
            let possibleOutput = Math.floor(maxOutByEquip * uiEfficiency * conditionMult);

            let inputsKeys = Object.keys(tpl.inputs);

            let flushLeftovers = () => {
                if (biz.dailyIncoming) {
                    Object.keys(biz.dailyIncoming).forEach(k => {
                        let inc = biz.dailyIncoming[k];
                        if (inc.qty > 0) addToInventory(STATE.company.inventory, k, inc.qty, inc.qty * inc.avgCost, inc.quality);
                    });
                    biz.dailyIncoming = {}; 
                }
            };

            if (possibleOutput <= 0) {
                biz.stats.lastOutput = 0;
                flushLeftovers();
                return; 
            }

            let q_eq = biz.equipment.quality || 1.0; 
            let q_hr = 1.0;
            if (assignedTotal > 0) q_hr = ((biz.assigned.junior * 1.0) + (biz.assigned.middle * 1.2) + (biz.assigned.senior * 1.5)) / assignedTotal;
            let q_tech = (STATE.rnd && STATE.rnd.techLevels && STATE.rnd.techLevels[biz.type]) ? STATE.rnd.techLevels[biz.type] : 1.0;

            let materialsCost = 0;
            let totalInputsCount = 0;
            let sumMatQuality = 0;
            
            inputsKeys.forEach(k => {
                let reqNum = tpl.inputs[k];
                let incomingQty = (biz.dailyIncoming && biz.dailyIncoming[k]) ? biz.dailyIncoming[k].qty : 0;
                let globalQty = STATE.company.inventory[k] ? STATE.company.inventory[k].qty : 0;
                let totalAvail = incomingQty + globalQty;

                if (totalAvail < possibleOutput * reqNum) {
                    possibleOutput = Math.floor(totalAvail / reqNum);
                }
            });

            let outVol = RECIPES.RESOURCES[tpl.output].volume || 0;
            let inVol = 0;
            inputsKeys.forEach(k => inVol += (RECIPES.RESOURCES[k].volume || 0) * tpl.inputs[k]);
            let netVol = outVol - inVol;
            if (netVol > 0 && typeof WAREHOUSE !== 'undefined') {
                let freeSpace = WAREHOUSE.getMaxVolume() - WAREHOUSE.getCurrentVolume();
                let maxBySpace = Math.floor(freeSpace / netVol);
                if (maxBySpace < possibleOutput) possibleOutput = maxBySpace;
            }

            let actualOutput = possibleOutput;

            if (actualOutput > 0) {
                inputsKeys.forEach(k => {
                    let reqTotal = tpl.inputs[k] * actualOutput;
                    let incInv = (biz.dailyIncoming && biz.dailyIncoming[k]) ? biz.dailyIncoming[k] : { qty: 0, avgCost: 0, quality: 1.0 };
                    let globalInv = STATE.company.inventory[k] || { qty: 0, avgCost: 0, quality: 1.0 };
                    
                    let takeIncoming = Math.min(incInv.qty, reqTotal); 
                    let takeGlobal = reqTotal - takeIncoming;          
                    
                    if (takeIncoming > 0) {
                        materialsCost += takeIncoming * incInv.avgCost;
                        sumMatQuality += takeIncoming * (incInv.quality || 1.0);
                        totalInputsCount += takeIncoming;
                        incInv.qty -= takeIncoming; 
                    }
                    if (takeGlobal > 0) {
                        materialsCost += takeGlobal * globalInv.avgCost;
                        sumMatQuality += takeGlobal * (globalInv.quality || 1.0);
                        totalInputsCount += takeGlobal;
                        globalInv.qty -= takeGlobal; 
                        if (globalInv.qty === 0) globalInv.avgCost = 0;
                    }
                });

                let q_mat = totalInputsCount > 0 ? (sumMatQuality / totalInputsCount) : 1.0;
                let q_out = (q_eq * 0.1) + (q_mat * 0.3) + (q_hr * 0.2) + (q_tech * 0.4);

                let bizSalaryCost = (biz.assigned.junior * HR.GRADES.junior.salary) + (biz.assigned.middle * HR.GRADES.middle.salary) + (biz.assigned.senior * HR.GRADES.senior.salary);
                let totalProductionCost = materialsCost + bizSalaryCost + dailyAdminCost; 
                biz.lastCogs = totalProductionCost / actualOutput;

                // --- 4. ОТГРУЗКА ГОТОВОЙ ПРОДУКЦИИ (В ШТУКАХ) ---
                let remainingOutput = actualOutput;
                let remainingCost = totalProductionCost;

                Object.keys(biz.routing).forEach(destId => {
                    let targetQty = biz.routing[destId];
                    if (targetQty <= 0) return;
                    
                    // Берем либо столько, сколько заказано, либо всё что осталось
                    let shareQty = Math.min(targetQty, remainingOutput); 
                    if (shareQty === 0) return;
                    
                    let shareCost = biz.lastCogs * shareQty;
                    remainingOutput -= shareQty;
                    remainingCost -= shareCost;

                    let destBiz = STATE.company.businesses.find(b => b.uid == destId);
                    if (destBiz) {
                        if (!destBiz.dailyIncoming) destBiz.dailyIncoming = {};
                        addToInventory(destBiz.dailyIncoming, tpl.output, shareQty, shareCost, q_out);
                    } else {
                        // Если цех-получатель удален - на склад
                        addToInventory(STATE.company.inventory, tpl.output, shareQty, shareCost, q_out);
                    }
                });

                // Все излишки (или если маршруты не заданы) автоматически летят на склад
                if (remainingOutput > 0) {
                    addToInventory(STATE.company.inventory, tpl.output, remainingOutput, Math.max(0, remainingCost), q_out);
                }

                let wearRate = 1.5 * (actualOutput / maxOutByEquip);
                biz.equipment.condition -= wearRate;
                if (biz.equipment.condition < 0) biz.equipment.condition = 0;
            }

            flushLeftovers();

            biz.stats.lastOutput = actualOutput;
            biz.stats.total += actualOutput;
        });
    }
};
