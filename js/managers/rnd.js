// Модуль Лаборатории НИОКР (R&D)
const RND = {
    init() {
        if (!STATE.rnd) {
            STATE.rnd = {
                unlocked: ['microchips', 'parts3d'],
                activeProject: null,
                points: 0,
                staff: { scientist: 0, lead_scientist: 0 }
            };
        }
        
        if (!STATE.rnd.staff) STATE.rnd.staff = { scientist: 0, lead_scientist: 0 };
        if (typeof STATE.rnd.staff.scientist !== 'number' || isNaN(STATE.rnd.staff.scientist)) STATE.rnd.staff.scientist = 0;
        if (typeof STATE.rnd.staff.lead_scientist !== 'number' || isNaN(STATE.rnd.staff.lead_scientist)) STATE.rnd.staff.lead_scientist = 0;

        if (!STATE.rnd.facility) {
            STATE.rnd.facility = { level: 0, equipment: { count: 0, condition: 100 } };
        }

        if (!STATE.rnd.techLevels) STATE.rnd.techLevels = {};
        STATE.rnd.unlocked.forEach(k => {
            if (!STATE.rnd.techLevels[k]) STATE.rnd.techLevels[k] = 1.0;
        });
    },

    getUpgradeCost() { return ((STATE.rnd.facility.level || 0) + 1) * 10000; },
    getMaxStaff() { return (STATE.rnd.facility.level || 0) * 5; },

    upgradeFacility() {
        this.init();
        let cost = this.getUpgradeCost();
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost;
            STATE.rnd.facility.level++;
            NOTIFY.success('Успех', 'Корпус НИИ расширен!');
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', `Недостаточно средств. Нужно $${formatMoney(cost)}`);
        }
    },

    installEquipment(qty) {
        if (isNaN(qty) || qty <= 0) return;
        this.init();
        let maxSlots = this.getMaxStaff();
        let freeSlots = maxSlots - (STATE.rnd.facility.equipment.count || 0);
        if (qty > freeSlots) { NOTIFY.error('Ошибка', 'Не хватает мест!'); return; }

        let inv = STATE.company.inventory['pc_workstation'];
        if (!inv || inv.qty < qty) { NOTIFY.error('Ошибка', 'Нет ПК на складе.'); return; }

        inv.qty -= qty;
        if (inv.qty === 0) inv.avgCost = 0;

        let currentTotalHealth = STATE.rnd.facility.equipment.count * STATE.rnd.facility.equipment.condition;
        STATE.rnd.facility.equipment.count += qty;
        STATE.rnd.facility.equipment.condition = (currentTotalHealth + (qty * 100)) / STATE.rnd.facility.equipment.count;
        if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
    },

    repairEquipment() {
        this.init();
        if (STATE.rnd.facility.equipment.count === 0) { 
            NOTIFY.error('Ошибка', 'Нет оборудования для ремонта.'); 
            return; 
        }
        
        // Строгая проверка, чтобы 0% не воспринимался как пустота
        let cond = STATE.rnd.facility.equipment.condition !== undefined ? STATE.rnd.facility.equipment.condition : 100;
        let damage = 100 - cond;
        
        if (damage <= 0) { 
            NOTIFY.success('Успех', 'Оборудование в идеальном состоянии.'); 
            return; 
        }
        
        let eqCost = RECIPES.RESOURCES['pc_workstation'].basePrice || 800;
        // Стоимость полного ТО = 10% от цены новых ПК
        let repairCost = (STATE.rnd.facility.equipment.count * eqCost) * 0.10 * (damage / 100); 
        
        if (STATE.finances.balance >= repairCost) {
            STATE.finances.balance -= repairCost;
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_repair', repairCost); 
            STATE.rnd.facility.equipment.condition = 100;
            NOTIFY.success('Успех', `ТО лаборатории завершено! Списано: $${formatMoney(repairCost)}`);
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', `Не хватает средств на ТО. Нужно $${formatMoney(repairCost)}`);
        }
    },

    getDailyRP() {
        this.init();
        if (STATE.rnd.facility.level === 0) return 0;
        let scientists = STATE.rnd.staff.scientist || 0;
        let leads = STATE.rnd.staff.lead_scientist || 0;
        let pcs = STATE.rnd.facility.equipment.count || 0;
        if ((scientists + leads) === 0 || pcs === 0) return 0;

        let workingLeads = Math.min(leads, pcs);
        let remainingPCs = pcs - workingLeads;
        let workingScientists = Math.min(scientists, remainingPCs);
        let rawRP = (workingScientists * HR.GRADES.scientist.rp) + (workingLeads * HR.GRADES.lead_scientist.rp);
        
        // ИСПРАВЛЕНО: Теперь при 0% оборудование выдает 0.0 (полная остановка)
        let conditionMult = STATE.rnd.facility.equipment.condition < 70 ? Math.max(0.0, STATE.rnd.facility.equipment.condition / 70) : 1.0;
        return Math.floor(rawRP * conditionMult);
    },

    assignStaff(grade) {
        this.init();
        if (((STATE.rnd.staff.scientist || 0) + (STATE.rnd.staff.lead_scientist || 0)) >= this.getMaxStaff()) {
            NOTIFY.error('Ошибка', 'Нет мест в НИИ!'); return;
        }
        if (HR.getUnassigned(grade) > 0) {
            STATE.rnd.staff[grade]++;
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        }
    },

    removeStaff(grade) {
        this.init();
        if (STATE.rnd.staff[grade] > 0) {
            STATE.rnd.staff[grade]--;
            if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
        }
    },

    startProject(bizId) {
        this.init();
        if (STATE.rnd.facility.level === 0) { NOTIFY.error('Ошибка', 'Нет НИИ!'); return; }
        
        if (STATE.rnd.activeProject && STATE.rnd.activeProject !== bizId) {
            this.pauseProject();
        }

        let isUnlocked = STATE.rnd.unlocked.includes(bizId);
        let currentLevel = STATE.rnd.techLevels[bizId] || 1.0;
        let tpl = RECIPES.BUSINESSES[bizId];
        
        // ИСПРАВЛЕНО: Синхронизировано на 1000 RP для базовых
        let targetRP = isUnlocked ? (tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000) : tpl.researchCost;
        
        if (!isUnlocked && tpl.researchCost === 0) { 
            NOTIFY.error('Ошибка', 'Эта технология не требует исследований.'); 
            return; 
        }
        
        if (isUnlocked && currentLevel >= 2.0) { 
            NOTIFY.error('Ошибка', 'Технология уже прокачана до максимума (2.0)!'); 
            return; 
        }

        STATE.rnd.activeProject = bizId;
        
        if (!STATE.rnd.savedProgress) STATE.rnd.savedProgress = {};
        if (STATE.rnd.savedProgress[bizId] !== undefined) {
            STATE.rnd.points = STATE.rnd.savedProgress[bizId];
            delete STATE.rnd.savedProgress[bizId];
        } else {
            STATE.rnd.points = isUnlocked ? (currentLevel - 1.0) * targetRP : 0;
        }

        if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
    },

    pauseProject() {
        this.init();
        if (!STATE.rnd.activeProject) return;
        
        let currentBiz = STATE.rnd.activeProject;
        if (!STATE.rnd.savedProgress) STATE.rnd.savedProgress = {};
        
        // Сохраняем накопленный прогресс в объект приостановленных
        if (STATE.rnd.points > 0) {
            STATE.rnd.savedProgress[currentBiz] = STATE.rnd.points;
        }
        
        STATE.rnd.activeProject = null;
        STATE.rnd.points = 0;
        
        if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
    },

    processDaily() {
        this.init();
        let lvl = STATE.rnd.facility.level || 0;
        if (lvl > 0) {
            let adminCost = lvl * 250; 
            STATE.finances.balance -= adminCost;
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_admin', adminCost);
            
            let rp = this.getDailyRP();
            let pcs = STATE.rnd.facility.equipment.count || 0;
            if (rp > 0 && pcs > 0) {
                STATE.rnd.facility.equipment.condition -= 2.0;
                if (STATE.rnd.facility.equipment.condition < 0) STATE.rnd.facility.equipment.condition = 0;
            }

            if (STATE.rnd.activeProject) {
                STATE.rnd.points += rp;
                let activeKey = STATE.rnd.activeProject; 
                let tpl = RECIPES.BUSINESSES[activeKey];
                let isUnlocked = STATE.rnd.unlocked.includes(activeKey);
                
                // ИСПРАВЛЕНО: Синхронизировано на 1000 RP для базовых
                let targetRP = isUnlocked ? (tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000) : tpl.researchCost;

                if (!isUnlocked) {
                    if (STATE.rnd.points >= targetRP) {
                        STATE.rnd.unlocked.push(activeKey);
                        STATE.rnd.techLevels[activeKey] = 1.0;
                        NOTIFY.success('Успех', `Открыта новая технология: "${tpl.name}"!`);
                        STATE.rnd.activeProject = null;
                        STATE.rnd.points = 0;
                    }
                } else {
                    let newLevel = 1.0 + (STATE.rnd.points / targetRP);
                    if (newLevel >= 2.0) {
                        STATE.rnd.techLevels[activeKey] = 2.0;
                        NOTIFY.success('Успех', `Технология "${tpl.name}" достигла уровня 2.0!`);
                        
                        STATE.rnd.activeProject = null;
                        STATE.rnd.points = 0;
                        
                        if (STATE.rnd.savedProgress && STATE.rnd.savedProgress[activeKey]) {
                            delete STATE.rnd.savedProgress[activeKey];
                        }
                    } else {
                        STATE.rnd.techLevels[activeKey] = newLevel;
                    }
                }
            }
        }
    }
};
