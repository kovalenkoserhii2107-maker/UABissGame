// Главный модуль интерфейса (Отрефакторенная версия)
const UI_DASHBOARD = {
    // Состояния фильтров биржи
    marketFilter: 'all', 
    marketOptions: { hideEmpty: false, onlyMyStock: false },
    isMarketOptOpen: false,

    setMarketFilter(f) { this.marketFilter = f; this.update(); },
    toggleMarketOptMenu() { this.isMarketOptOpen = !this.isMarketOptOpen; this.update(); },
    toggleMarketOpt(opt) { this.marketOptions[opt] = !this.marketOptions[opt]; this.update(); },
    
    // Мастер-метод: обновляет всё (вызывается при закрытии дня)
    update() {
        try {
            this.clearError();
            
            this.updateTopPanel();
            this.updateDashboardTab();
            this.updateContractsTab();
            this.updateRnDTab();
            this.updateWarehouseUI();
            this.updateProductionTab();
            this.updateRetailTab();
            this.updateMarketingTab();
            this.updateMarketTab();
            this.updateHRTab();
            this.updateBankTab();
            this.updateFinanceTab();
            if (typeof this.updateB2BTab === 'function') this.updateB2BTab();
            if (typeof WIKI !== 'undefined') WIKI.render();
            
        } catch (err) {
            this.showError(err);
        }
    },

    // --- 1. ТОП-ПАНЕЛЬ ---
    updateTopPanel() {
        if (document.getElementById('ui-day')) document.getElementById('ui-day').innerText = STATE.time.day;
        if (document.getElementById('ui-balance')) document.getElementById('ui-balance').innerText = formatMoney(STATE.finances.balance);
        if (document.getElementById('ui-header-networth')) document.getElementById('ui-header-networth').innerText = formatMoney(FINANCE.calculateNetWorth());
        if (document.getElementById('ui-credit')) document.getElementById('ui-credit').innerText = STATE.finances.creditScore;
    },

    // --- ИНИЦИАЛИЗАЦИЯ ГРАФИКОВ ---
    initCharts() {
        if (!this.charts) this.charts = { cashflow: null, assets: null, rndRP: null };
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
            Chart.defaults.color = '#86868B';
        }
    },

    // --- 2. ГЛАВНЫЙ ДАШБОРД CEO (КОМПАНИЯ) ---
    updateDashboardTab() {
        if (!document.getElementById('dash-kpi-cash')) return;
        this.initCharts();
        this.renderQuestWidget();

        // 1. РАСЧЕТ КАПИТАЛИЗАЦИИ И АКТИВОВ
        let cash = Math.max(0, STATE.finances.balance);
        let inventoryValue = 0;
        
        // --- ИЗМЕНЕНИЕ 1: Подсчет инвентаря по всем складам (городам) ---
        if (STATE.company.warehouses) {
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.inventory) {
                    Object.keys(wh.inventory).forEach(k => {
                        inventoryValue += wh.inventory[k].qty * wh.inventory[k].avgCost;
                    });
                }
            });
        }
        
        STATE.company.businesses.forEach(b => {
            if (b.localInventory) Object.keys(b.localInventory).forEach(k => inventoryValue += b.localInventory[k].qty * b.localInventory[k].avgCost);
        });
        
        let logisticsValue = 0;
        if (STATE.logistics) {
            if (STATE.logistics.deliveries) STATE.logistics.deliveries.forEach(d => logisticsValue += d.cost);
            if (STATE.logistics.receivables) STATE.logistics.receivables.forEach(r => logisticsValue += r.amount);
        }

        let realEstateValue = 0;
        let equipmentValue = 0;
        STATE.company.businesses.forEach(b => {
            let tpl = RECIPES.BUSINESSES[b.type];
            let locMult = b.locMult || 1.0; 
            realEstateValue += tpl.area * 50 * locMult;
            for (let i = 1; i < (b.level || 1); i++) realEstateValue += (tpl.area * 50 * i * locMult); 
            if (b.equipment && b.equipment.count > 0) {
                let eqPrice = RECIPES.RESOURCES[tpl.equipmentType].basePrice;
                equipmentValue += (b.equipment.count * eqPrice) * ((b.equipment.condition || 0) / 100);
            }
        });
        
        // --- ИЗМЕНЕНИЕ 2: Подсчет стоимости складов по всем городам ---
        if (typeof WAREHOUSE !== 'undefined' && STATE.company.warehouses) {
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.level > 0) {
                    for (let i = 1; i < wh.level; i++) {
                        realEstateValue += WAREHOUSE.LEVELS[i].upgradeCost;
                    }
                }
            });
        }
        
        // ЗАЩИТА: Проверяем существование лаборатории
        if (STATE.rnd && STATE.rnd.facility && STATE.rnd.facility.level) {
            let rndLvl = STATE.rnd.facility.level || 0;
            for (let i = 1; i <= rndLvl; i++) realEstateValue += i * 10000;
            if (STATE.rnd.facility.equipment && STATE.rnd.facility.equipment.count > 0) {
                let pcPrice = RECIPES.RESOURCES['smart_pc'].basePrice || 800;
                equipmentValue += (STATE.rnd.facility.equipment.count * pcPrice) * ((STATE.rnd.facility.equipment.condition || 0) / 100);
            }
        }
        let fixedAssets = realEstateValue + equipmentValue;

        let totalLiabilities = 0;
        if (STATE.finances.loans) STATE.finances.loans.forEach(l => totalLiabilities += l.remainingPrincipal);
        if (STATE.finances.balance < 0) totalLiabilities += Math.abs(STATE.finances.balance);

        let netWorth = cash + inventoryValue + logisticsValue + fixedAssets - totalLiabilities;

        document.getElementById('dash-kpi-cash').innerText = formatMoney(STATE.finances.balance);
        document.getElementById('dash-kpi-networth').innerText = formatMoney(netWorth);
        
        let yesterday = (STATE.ledger && STATE.ledger.history && STATE.ledger.history.length > 0) ? STATE.ledger.history[STATE.ledger.history.length - 1] : null;
        let rev = 0; let burn = 0;
        if (yesterday) {
            rev = (yesterday.rev_b2b||0) + (yesterday.rev_b2g||0) + (yesterday.rev_b2c||0) + (yesterday.rev_other||0) + (yesterday.fin_income||0);
            burn = (yesterday.exp_materials||0) + (yesterday.exp_salary||0) + (yesterday.exp_admin||0) + (yesterday.exp_hr||0) + (yesterday.exp_fines||0) + (yesterday.exp_repair||0) + (yesterday.exp_taxes_payroll||0) + (yesterday.exp_taxes_corp||0) + (yesterday.exp_marketing||0) + (yesterday.fin_expense||0) + (yesterday.fin_fees||0);
        }
        
        if (document.getElementById('dash-kpi-revenue')) document.getElementById('dash-kpi-revenue').innerText = formatMoney(rev);
        if (document.getElementById('dash-kpi-burn')) document.getElementById('dash-kpi-burn').innerText = formatMoney(burn);
        
        if (document.getElementById('dash-kpi-brand')) document.getElementById('dash-kpi-brand').innerText = (STATE.retail && STATE.retail.brand) ? STATE.retail.brand.toFixed(1) : '10.0';
        if (document.getElementById('dash-kpi-credit')) document.getElementById('dash-kpi-credit').innerText = typeof FINANCE !== 'undefined' ? formatMoney(FINANCE.getAvailableLimit()) : '0.00';
        
        let staffCount = typeof HR !== 'undefined' ? HR.getTotalStaff() : 0;
        if (document.getElementById('dash-kpi-staff')) document.getElementById('dash-kpi-staff').innerText = staffCount;
        
        let objCount = STATE.company.businesses.length;
        if (STATE.company.warehouses) objCount += Object.keys(STATE.company.warehouses).length;
        if (document.getElementById('dash-kpi-objects')) document.getElementById('dash-kpi-objects').innerText = objCount;

        // 2. ОТРИСОВКА ГРАФИКОВ
        if (typeof Chart !== 'undefined') {
            let ctxAssets = document.getElementById('chart-assets').getContext('2d');
            let assetsData = [cash, inventoryValue, fixedAssets, logisticsValue];
            if (!this.charts.assets) {
                this.charts.assets = new Chart(ctxAssets, {
                    type: 'doughnut',
                    data: {
                        labels: ['Cash', 'Склады', 'Инфраструктура', 'Логистика'],
                        datasets: [{ data: assetsData, backgroundColor: ['#34C759', '#007AFF', '#FF9500', '#AF52DE'], borderWidth: 0, hoverOffset: 4 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }
                });
            } else {
                this.charts.assets.data.datasets[0].data = assetsData;
                this.charts.assets.update();
            }

            let ctxFlow = document.getElementById('chart-cashflow').getContext('2d');
            let labels = [];
            let incomeData = [];
            let expenseData = [];
            
            let hist = (STATE.ledger && STATE.ledger.history) ? [...STATE.ledger.history].reverse() : [];
            while (hist.length < 7) hist.unshift(null); 

            hist.forEach((dayData, i) => {
                let dayNum = STATE.time.day - (hist.length - i - 1) - 1; 
                labels.push(`Д ${dayNum > 0 ? dayNum : '-'}`);
                if (dayData) {
                    let inc = (dayData.rev_b2b||0) + (dayData.rev_b2g||0) + (dayData.rev_b2c||0) + (dayData.rev_other||0) + (dayData.fin_income||0);
                    let exp = (dayData.exp_materials||0) + (dayData.exp_salary||0) + (dayData.exp_admin||0) + (dayData.exp_hr||0) + (dayData.exp_fines||0) + (dayData.exp_repair||0) + (dayData.exp_taxes_payroll||0) + (dayData.exp_taxes_corp||0) + (dayData.exp_marketing||0) + (dayData.fin_expense||0) + (dayData.fin_fees||0);
                    incomeData.push(inc);
                    expenseData.push(exp);
                } else {
                    incomeData.push(0); expenseData.push(0);
                }
            });

            if (!this.charts.cashflow) {
                this.charts.cashflow = new Chart(ctxFlow, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            { label: 'Доходы', data: incomeData, backgroundColor: '#34C759', borderRadius: 4 },
                            { label: 'Расходы', data: expenseData, backgroundColor: '#FF3B30', borderRadius: 4 }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, ticks: { callback: function(val) { return '$' + (val>=1000 ? (val/1000).toFixed(1)+'k' : val); } }, grid: { color: 'rgba(0,0,0,0.05)' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            } else {
                this.charts.cashflow.data.labels = labels;
                this.charts.cashflow.data.datasets[0].data = incomeData;
                this.charts.cashflow.data.datasets[1].data = expenseData;
                this.charts.cashflow.update();
            }
        }

        // 2.5. СТРАТЕГИЧЕСКИЕ СВОДКИ (R&D, HR, Финансы)
        
        // Сводка R&D
        let rndDiv = document.getElementById('dash-rnd-summary');
        if (rndDiv && STATE.rnd) {
            // ЗАЩИТА: Проверяем, существует ли facility вообще, перед тем как читать level
            if (!STATE.rnd.facility || !STATE.rnd.facility.level) {
                rndDiv.innerHTML = '<span style="color:var(--text-dim); font-size:0.9em;">Лаборатория еще не построена.</span>';
            } else if (!STATE.rnd.activeProject) {
                rndDiv.innerHTML = '<div style="display:flex; align-items:center; gap:8px; color:var(--orange); font-weight:500; font-size:0.95em;">⏸️ Лаборатория простаивает!</div><div style="font-size:0.8em; color:var(--text-dim); margin-top:4px;">Назначьте проект, чтобы не терять время.</div>';
            } else {
                let activeKey = STATE.rnd.activeProject;
                let tpl = RECIPES.BUSINESSES[activeKey];
                let isUnlocked = STATE.rnd.unlocked.includes(activeKey);
                let targetRP = isUnlocked ? (tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000) : tpl.researchCost;
                let percent = targetRP > 0 ? Math.min(100, (STATE.rnd.points / targetRP) * 100) : 100;
                let titleName = isUnlocked ? `Улучшение: ${tpl.name}` : `Изучение: ${tpl.name}`;
                
                rndDiv.innerHTML = `
                    <div style="font-weight:600; margin-bottom:5px; font-size:0.95em; color:var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${titleName}</div>
                    <div style="display:flex; justify-content:space-between; font-size:0.85em; color:var(--text-dim); margin-bottom:6px;">
                        <span>Прогресс</span><span style="font-weight:600; color:var(--blue);">${percent.toFixed(1)}%</span>
                    </div>
                    <div style="width:100%; background:var(--surface-3); height:8px; border-radius:4px; overflow:hidden;">
                        <div style="width:${percent}%; background:var(--blue); height:100%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="font-size:0.8em; color:var(--text-dim); margin-top:6px; text-align:right;">Собрано: ${Math.floor(STATE.rnd.points)} / ${targetRP} RP</div>
                `;
            }
        }

        // Сводка HR
        let hrDiv = document.getElementById('dash-hr-summary');
        if (hrDiv && typeof HR !== 'undefined') {
            let total = HR.getTotalStaff();
            let training = STATE.hr.trainingQueue.length;
            
            let counts = { factory: 0, rnd: 0, retail: 0, marketing: 0 };
            Object.keys(HR.GRADES).forEach(g => {
                let amt = STATE.hr.staff[g] || 0;
                let role = HR.GRADES[g].role;
                if (counts[role] !== undefined) counts[role] += amt;
            });
            
            hrDiv.innerHTML = `
                <div style="font-size:1.4em; font-weight:700; color:var(--text); margin-bottom:10px;">${total} <span style="font-size:0.6em; color:var(--text-dim); font-weight:500;">сотрудников в штате</span></div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:0.85em; margin-bottom:12px;">
                    <div>🏭 Заводы: <strong style="color:var(--text);">${counts.factory}</strong></div>
                    <div>🏪 Розница: <strong style="color:var(--text);">${counts.retail}</strong></div>
                    <div>📢 Маркетинг: <strong style="color:var(--text);">${counts.marketing}</strong></div>
                    <div>🔬 R&D: <strong style="color:var(--text);">${counts.rnd}</strong></div>
                </div>
                ${training > 0 
                    ? `<div style="font-size:0.8em; padding:4px 8px; background:var(--orange-dim); color:var(--orange); border-radius:6px; display:inline-block; font-weight:500;">🎓 В Академии (обучение): ${training} чел.</div>` 
                    : `<div style="font-size:0.8em; color:var(--text-dim);">Никто не проходит обучение</div>`}
            `;
        }

        // Сводка Финансов (Вчерашний P&L)
        let finDiv = document.getElementById('dash-fin-summary');
        if (finDiv && STATE.ledger && STATE.ledger.yesterday) {
            let y = STATE.ledger.yesterday;
            
            let yRevB2C = y.rev_b2c || 0;
            let yRevOther = y.rev_other || 0;
            let yRev = (y.rev_b2b||0) + (y.rev_b2g||0) + yRevB2C + yRevOther;
            
            let yOpex = (y.exp_salary||0) + (y.exp_admin||0) + (y.exp_hr||0) + (y.exp_fines||0) + (y.exp_repair||0) + (y.exp_taxes_payroll||0) + (y.exp_marketing||0);
            let yMaterials = y.exp_materials || 0;
            
            let yEbitda = yRev - yMaterials - yOpex;
            let yFin = (y.fin_income||0) - (y.fin_expense||0) - (y.fin_fees||0);
            let yEbt = yEbitda + yFin;
            let yNet = yEbt - (y.exp_taxes_corp||0);
            
            let ebitdaColor = yEbitda > 0 ? 'var(--green)' : (yEbitda < 0 ? 'var(--red)' : 'var(--text-dim)');
            let netColor = yNet > 0 ? 'var(--green)' : (yNet < 0 ? 'var(--red)' : 'var(--text-dim)');
            
            finDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85em;">
                    <span style="color:var(--text-dim);">Выручка (Доходы)</span>
                    <strong style="color:var(--text);">$${formatMoney(yRev)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85em;">
                    <span style="color:var(--text-dim);">Себестоимость + OPEX</span>
                    <strong style="color:var(--text);">$${formatMoney(yMaterials + yOpex)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-top:1px dashed var(--border); padding-top:6px; font-size:0.95em;">
                    <span style="font-weight:600; color:var(--text);">EBITDA</span>
                    <strong style="color:${ebitdaColor};">$${formatMoney(yEbitda)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:0; font-size:1.05em; border-top:1px solid var(--border); padding-top:8px;">
                    <span style="font-weight:600; color:var(--text);">Чистая прибыль</span>
                    <strong style="color:${netColor};">$${formatMoney(yNet)}</strong>
                </div>
            `;
        }

        // 3. ОПЕРАЦИОННЫЙ РАДАР (СВЕТОФОР)
        let radarList = document.getElementById('dash-radar-list');
        if (radarList) {
            radarList.innerHTML = '';
            if (STATE.company.businesses.length === 0) {
                radarList.innerHTML = '<li style="color:var(--text-dim); padding:10px;">Нет работающих активов.</li>';
            } else {
                STATE.company.businesses.forEach(biz => {
                    let tpl = RECIPES.BUSINESSES[biz.type];
                    let level = biz.level || 1;
                    let statusColor = '#34C759'; 
                    let statusText = 'В норме';
                    let icon = '🏭';
                    
                    if (tpl.isRetail) {
                        icon = '🏪';
                        let hasStock = biz.localInventory && Object.values(biz.localInventory).some(inv => inv.qty > 0);
                        if (!hasStock) { statusColor = '#FF3B30'; statusText = 'Пустые полки!'; }
                    } else if (tpl.isMarketing) {
                        icon = '📢';
                        if (!biz.campaign || biz.campaign === 0) { statusColor = '#FF9500'; statusText = 'Только органика'; }
                    } else {
                        let maxStaff = tpl.staffReq * level;
                        let assignedTotal = (biz.assigned.junior||0) + (biz.assigned.middle||0) + (biz.assigned.senior||0);
                        let prodPower = ((biz.assigned.junior||0) * HR.GRADES.junior.prodMult) + ((biz.assigned.middle||0) * HR.GRADES.middle.prodMult) + ((biz.assigned.senior||0) * HR.GRADES.senior.prodMult);
                        let uiEfficiency = maxStaff > 0 ? (prodPower / maxStaff) : 1;
                        if (assignedTotal === 0) uiEfficiency = 0;
                        
                        let eqCount = biz.equipment.count || 0;
                        let cond = biz.equipment.condition !== undefined ? biz.equipment.condition : 100;
                        let conditionMult = cond < 70 ? Math.max(0.0, cond/70) : 1.0;
                        let maxOutByEquip = eqCount * (tpl.outputPerMachine || 10);
                        let estDailyOutput = Math.floor(maxOutByEquip * uiEfficiency * conditionMult);

                        let minDaysMats = Infinity;
                        if (estDailyOutput > 0) {
                            Object.keys(tpl.inputs).forEach(k => {
                                // --- ИЗМЕНЕНИЕ 3: Ищем сырье в том городе, где находится завод ---
                                let city = biz.city || 'odesa';
                                let inQty = (STATE.company.warehouses && STATE.company.warehouses[city] && STATE.company.warehouses[city].inventory[k]) 
                                    ? STATE.company.warehouses[city].inventory[k].qty 
                                    : 0;
                                let req = tpl.inputs[k] * estDailyOutput;
                                let days = Math.floor(inQty / req);
                                if (days < minDaysMats) minDaysMats = days;
                            });
                        }

                        if (assignedTotal === 0 || eqCount === 0) {
                            statusColor = '#FF3B30'; statusText = 'Простаивает (Нет кадров/ПК)';
                        } else if (estDailyOutput === 0 || minDaysMats === 0) {
                            statusColor = '#FF3B30'; statusText = 'Остановка (Нет сырья)';
                        } else if (minDaysMats <= 2 || uiEfficiency < 0.8) {
                            statusColor = '#FF9500'; statusText = 'Требует внимания';
                        } else {
                            statusText = `В норме (Сырья на ${minDaysMats} дн.)`;
                        }
                    }

                    radarList.innerHTML += `
                        <li style="background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 14px; display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
                            <div>
                                <strong>${icon} ${biz.name || tpl.name}</strong><br>
                                <small style="color:var(--text-dim);">${tpl.name}</small>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:0.85em; color:var(--text-dim);">${statusText}</span>
                                <div style="width:12px; height:12px; border-radius:50%; background:${statusColor}; box-shadow:0 0 8px ${statusColor}80;"></div>
                            </div>
                        </li>
                    `;
                });
            }
        }

        let dashContracts = document.getElementById('dash-active-contracts');
        if (dashContracts && typeof CONTRACTS !== 'undefined') {
            dashContracts.innerHTML = '';
            if (!STATE.contracts || STATE.contracts.active.length === 0) {
                dashContracts.innerHTML = '<li><small style="color:var(--text-dim);">Нет активных тендеров в работе.</small></li>';
            } else {
                STATE.contracts.active.forEach(c => {
                    // --- ИЗМЕНЕНИЕ 4: Сбор товара для контрактов со всех складов ---
                    let inv = 0;
                    if (STATE.company.warehouses) {
                        Object.keys(STATE.company.warehouses).forEach(cId => {
                            let wh = STATE.company.warehouses[cId];
                            if (wh.inventory && wh.inventory[c.item]) {
                                inv += wh.inventory[c.item].qty;
                            }
                        });
                    }
                    dashContracts.innerHTML += `<li style="padding: 8px 0; border-bottom: 1px solid var(--border);"><strong>${RECIPES.RESOURCES[c.item].name}</strong>: Собрано ${inv} / ${c.qty} шт. <span style="float:right; color:var(--red);">${c.deadline} дн.</span></li>`;
                });
            }
        }
    },

    // --- 3. ТЕНДЕРЫ И КОНТРАКТЫ ---
    updateContractsTab() {
        if (typeof CONTRACTS === 'undefined') return;
        CONTRACTS.init();
        
        let availList = document.getElementById('ui-contracts-available');
        if (availList) {
            availList.innerHTML = '';
            if (STATE.contracts.available.length === 0) {
                availList.innerHTML = '<div style="color:var(--text-faint); font-size:0.9rem; text-align:center; padding:20px; background:var(--surface-2); border-radius:12px; border:1px dashed var(--border);">Пока нет новых тендеров. Вернитесь через пару дней.</div>';
            } else {
                STATE.contracts.available.forEach(c => {
                    let itemName = RECIPES.RESOURCES[c.item].name;
                    availList.innerHTML += `
                    <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                            <div>
                                <div style="font-weight:700; font-size:1.1rem; color:var(--text); margin-bottom:4px;">${itemName}</div>
                                <div style="font-size:0.85rem; color:var(--text-dim); font-weight:600;">Объем: <span style="color:var(--text);">${c.qty} шт.</span></div>
                            </div>
                            <div style="background:var(--red-dim); color:var(--red); padding:4px 8px; border-radius:8px; font-size:0.85rem; font-weight:700;">Срок: ${c.deadline} дн.</div>
                        </div>
                        
                        <div style="display:flex; gap:16px; margin-bottom:16px; padding-top:12px; border-top:1px dashed var(--border);">
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Цена за шт.</div>
                                <div style="color:var(--text); font-weight:700; font-size:1rem;">$${formatMoney(c.price)}</div>
                            </div>
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Сумма (Оплата)</div>
                                <div style="color:var(--green); font-weight:700; font-size:1rem;">$${formatMoney(c.totalReward)}</div>
                            </div>
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Штраф за срыв</div>
                                <div style="color:var(--red); font-weight:700; font-size:0.9rem;">$${formatMoney(c.penalty)}</div>
                            </div>
                        </div>

                        <button onclick="CONTRACTS.accept(${c.id})" style="width:100%; background:var(--blue); border:none; color:white; font-size:0.95rem; padding:10px; border-radius:10px; font-weight:700; cursor:pointer; transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">Подписать контракт</button>
                    </div>`;
                });
            }
        }

        let activeList = document.getElementById('ui-contracts-active');
        if (activeList) {
            activeList.innerHTML = '';
            if (STATE.contracts.active.length === 0) {
                activeList.innerHTML = '<div style="color:var(--text-faint); font-size:0.9rem; text-align:center; padding:20px; background:var(--surface-2); border-radius:12px; border:1px dashed var(--border);">Нет активных обязательств.</div>';
            } else {
                STATE.contracts.active.forEach(c => {
                    let itemName = RECIPES.RESOURCES[c.item].name;
                    let inv = 0;
                    if (STATE.company.warehouses) {
                        Object.keys(STATE.company.warehouses).forEach(cId => {
                            let wh = STATE.company.warehouses[cId];
                            if (wh.inventory && wh.inventory[c.item]) inv += wh.inventory[c.item].qty;
                        });
                    }
                    let canFulfill = inv >= c.qty;
                    let progress = Math.min(100, (inv / c.qty) * 100);
                    
                    activeList.innerHTML += `
                    <div style="background: ${canFulfill ? 'rgba(52, 199, 89, 0.05)' : 'var(--surface-2)'}; border:1px solid ${canFulfill ? 'rgba(52, 199, 89, 0.3)' : 'var(--border)'}; border-radius:12px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                            <div>
                                <div style="font-weight:700; font-size:1.1rem; color:var(--text); margin-bottom:4px;">${itemName}</div>
                                <div style="font-size:0.85rem; color:var(--text-dim); font-weight:600;">Собрано: <span style="color:${canFulfill ? 'var(--green)' : 'var(--text)'};">${inv} / ${c.qty}</span> шт.</div>
                            </div>
                            <div style="background:${c.deadline <= 3 ? 'var(--red-dim)' : 'var(--orange-dim)'}; color:${c.deadline <= 3 ? 'var(--red)' : 'var(--orange)'}; padding:4px 8px; border-radius:8px; font-size:0.85rem; font-weight:700;">Осталось: ${c.deadline} дн.</div>
                        </div>
                        
                        <!-- Прогресс бар сборки -->
                        <div style="height:8px; background:rgba(0,0,0,0.05); border-radius:4px; margin-bottom:16px; overflow:hidden;">
                            <div style="height:100%; background:${canFulfill ? 'var(--green)' : 'var(--blue)'}; width:${progress}%;"></div>
                        </div>

                        <div style="display:flex; gap:16px; margin-bottom:16px; padding-top:12px; border-top:1px dashed var(--border);">
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Сумма (Оплата)</div>
                                <div style="color:var(--green); font-weight:700; font-size:1rem;">$${formatMoney(c.totalReward)}</div>
                            </div>
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Неустойка</div>
                                <div style="color:var(--red); font-weight:700; font-size:0.9rem;">$${formatMoney(c.penalty)}</div>
                            </div>
                        </div>

                        <button onclick="CONTRACTS.fulfill(${c.id})" ${!canFulfill ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="cursor:pointer; transition:transform 0.1s;"'} class="btn-primary-lg" style="width:100%; background:${canFulfill ? 'var(--green)' : 'var(--text-dim)'}; border:none; color:white; font-size:0.95rem; padding:10px; border-radius:10px; font-weight:700;">${canFulfill ? 'Отгрузить партию (Готово!)' : 'Недостаточно товара на складах'}</button>
                    </div>`;
                });
            }
        }
    },

    // --- 4. ЛАБОРАТОРИЯ R&D ---
    // Словарь иконок для технологий
    _rndTechIcons: {
        bakery_fab: '🥖', canned_food_fab: '🥫', clothes_fab: '👗',
        chem_fab: '🧴', furniture_fab: '🪑', optics_fab: '🔭',
        drone_fab: '🚁', battery_fab: '🔋', solar_fab: '☀️',
        toy_fab: '🧸', electronics_fab: '📱', auto_fab: '🚗',
        microchips: '💾', parts3d: '🖨️', smart_pc: '💻',
        medtech_fab: '💊', agro_fab: '🌾', steel_fab: '⚙️',
        lab_equip: '🔬', crypto_farm: '₿', textile_fab: '🧵',
    },

    updateRnDTab() {
        if (typeof RND === 'undefined') return;
        RND.init();

        let lvl = STATE.rnd.facility ? (STATE.rnd.facility.level || 0) : 0;
        let rpSpeed = RND.getDailyRP();
        let eqCount = STATE.rnd.facility ? (STATE.rnd.facility.equipment.count || 0) : 0;
        let cond = STATE.rnd.facility ? (STATE.rnd.facility.equipment.condition !== undefined ? STATE.rnd.facility.equipment.condition : 100) : 100;
        let maxStaff = RND.getMaxStaff();
        let curStaff = (STATE.rnd.staff.scientist || 0) + (STATE.rnd.staff.lead_scientist || 0);

        // --- Хедер: общие данные ---
        let pointsEl = document.getElementById('rnd-points-display');
        let dailyEl = document.getElementById('rnd-daily-rp-display');
        if (pointsEl) pointsEl.innerText = STATE.rnd.points || 0;
        if (dailyEl) dailyEl.innerText = '+' + rpSpeed;

        // ─── КАРТОЧКА 1: Корпус НИИ ─────────────────────────────────
        let facilCard = document.getElementById('ui-rnd-facility-card');
        if (facilCard) {
            if (lvl === 0) {
                facilCard.innerHTML = `
                <div style="text-align:center; padding: 8px 0;">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🏗️</div>
                    <h3 style="margin: 0 0 8px 0; color: var(--red);">НИИ не построен</h3>
                    <p style="color: var(--text-dim); margin: 0 0 16px 0; font-size:0.9rem;">Для разработки технологий постройте первый корпус лаборатории</p>
                    <button onclick="RND.upgradeFacility()" style="background: linear-gradient(135deg, #8e44ad, #9b59b6); color:white; border:none; padding:12px 28px; border-radius:var(--radius-sm); cursor:pointer; font-weight:700; font-size:1rem; box-shadow: 0 4px 15px rgba(142,68,173,0.4);">
                        🏛️ Построить НИИ ($${formatMoney(RND.getUpgradeCost())})
                    </button>
                </div>`;
            } else {
                let capPct = maxStaff > 0 ? Math.round((curStaff/maxStaff)*100) : 0;
                facilCard.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                    <div>
                        <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:4px;">Корпус НИИ</div>
                        <div style="font-size:1.4rem; font-weight:800; color:var(--text);">Уровень ${lvl}</div>
                    </div>
                    <div style="background: rgba(142,68,173,0.1); color:#8e44ad; font-weight:700; padding:6px 12px; border-radius:8px; font-size:0.9rem;">
                        🏢 ${curStaff}/${maxStaff} мест
                    </div>
                </div>
                <div style="background:var(--surface-2); border-radius:8px; height:8px; overflow:hidden; margin-bottom:6px;">
                    <div style="height:100%; width:${capPct}%; background:linear-gradient(90deg,#8e44ad,#3498db); border-radius:8px; transition:width 0.4s;"></div>
                </div>
                <div style="font-size:0.9rem; color:var(--text-dim); margin-bottom:16px;">Заполненность: ${capPct}%</div>
                <button onclick="RND.upgradeFacility()" style="width:100%; background: rgba(142,68,173,0.1); color:#8e44ad; border:1px solid rgba(142,68,173,0.3); padding:10px; border-radius:var(--radius-sm); cursor:pointer; font-weight:600; font-size:0.9rem;">
                    ⬆️ Расширить НИИ ($${formatMoney(RND.getUpgradeCost())})
                </button>`;
            }
        }

        // ─── КАРТОЧКА 2: Персонал ───────────────────────────────────
        let staffCard = document.getElementById('ui-rnd-staff-card');
        if (staffCard) {
            let sci = STATE.rnd.staff.scientist || 0;
            let lead = STATE.rnd.staff.lead_scientist || 0;
            staffCard.innerHTML = `
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:14px;">👨‍🔬 Персонал лаборатории</div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-2); padding:12px 16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <div>
                        <div style="font-weight:600; color:var(--text);">Лаборант</div>
                        <div style="font-size:0.78rem; color:var(--text-dim);">+1 RP/день • ЗП $${formatMoney(150)}/дн</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button onclick="RND.removeStaff('scientist')" style="background:var(--red-dim); color:var(--red); border:none; width:32px; height:32px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700;">−</button>
                        <span style="font-weight:700; min-width:20px; text-align:center;">${sci}</span>
                        <button onclick="RND.assignStaff('scientist')" style="background:rgba(142,68,173,0.1); color:#8e44ad; border:none; width:32px; height:32px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700;">+</button>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-2); padding:12px 16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <div>
                        <div style="font-weight:600; color:var(--text);">Ст. Учёный</div>
                        <div style="font-size:0.78rem; color:var(--text-dim);">+3 RP/день • ЗП $${formatMoney(400)}/дн</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button onclick="RND.removeStaff('lead_scientist')" style="background:var(--red-dim); color:var(--red); border:none; width:32px; height:32px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700;">−</button>
                        <span style="font-weight:700; min-width:20px; text-align:center;">${lead}</span>
                        <button onclick="RND.assignStaff('lead_scientist')" style="background:rgba(52,152,219,0.1); color:#3498db; border:none; width:32px; height:32px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700;">+</button>
                    </div>
                </div>
            </div>`;
        }

        // ─── КАРТОЧКА 3: Оборудование ───────────────────────────────
        let equipCard = document.getElementById('ui-rnd-equip-card');
        if (equipCard && lvl > 0) {
            let condColor = cond >= 70 ? 'var(--green)' : (cond >= 30 ? 'var(--orange)' : 'var(--red)');
            let condPct = Math.max(0, Math.min(100, cond));
            let freeSlots = maxStaff - eqCount;
            let warning = curStaff > eqCount ? `<div style="color:var(--orange); font-size:0.82rem; margin-top:8px;">⚠️ Учёных больше, чем рабочих мест (ПК)!</div>` : '';
            equipCard.innerHTML = `
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:14px;">💻 Оборудование (Смарт-ПК)</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="color:var(--text-dim); font-size:0.9rem;">Установлено</span>
                <span style="font-weight:700; color:var(--text);">${eqCount} / ${maxStaff}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="color:var(--text-dim); font-size:0.9rem;">Состояние</span>
                <span style="font-weight:700; color:${condColor};">${condPct.toFixed(0)}%</span>
            </div>
            <div style="background:var(--surface-2); border-radius:6px; height:6px; margin-bottom:4px;">
                <div style="height:100%; width:${condPct}%; background:${condColor}; border-radius:6px; transition:width 0.4s;"></div>
            </div>
            ${warning}
            <div style="display:flex; gap:8px; margin-top:14px;">
                <input type="number" id="install-pc-qty" value="1" min="1" max="${Math.max(1,freeSlots)}" style="width:60px; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); text-align:center; font-weight:600;">
                <button onclick="RND.installEquipment(parseInt(document.getElementById('install-pc-qty').value))" style="flex:1; background:rgba(52,152,219,0.1); color:#3498db; border:1px solid rgba(52,152,219,0.3); padding:8px; border-radius:8px; cursor:pointer; font-weight:600;">
                    ⬇️ Установить ПК
                </button>
                <button onclick="RND.repairEquipment()" style="background:rgba(142,68,173,0.1); color:#8e44ad; border:1px solid rgba(142,68,173,0.3); padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:600;">🔧 ТО</button>
            </div>`;
        } else if (equipCard && lvl === 0) {
            equipCard.innerHTML = `<div style="color:var(--text-faint); font-size:0.9rem; text-align:center; padding:8px;">Постройте НИИ для установки оборудования</div>`;
        }

        // ─── ГРАФИК: История RP ─────────────────────────────────────
        let rpHistory = (STATE.history && STATE.history.rp) ? STATE.history.rp : [];
        let labels = rpHistory.map((_, i) => {
            let dayNum = STATE.time.day - rpHistory.length + i + 1;
            return `Д${dayNum}`;
        });
        if (labels.length === 0) { labels = ['Нет данных']; rpHistory = [0]; }

        let rndCanvas = document.getElementById('rndRPChart');
        if (rndCanvas) {
            if (this.charts.rndRP) {
                this.charts.rndRP.data.labels = labels;
                this.charts.rndRP.data.datasets[0].data = rpHistory;
                this.charts.rndRP.update('none');
            } else {
                let ctx = rndCanvas.getContext('2d');
                let grad = ctx.createLinearGradient(0, 0, 0, 180);
                grad.addColorStop(0, 'rgba(142,68,173,0.4)');
                grad.addColorStop(1, 'rgba(142,68,173,0.0)');
                this.charts.rndRP = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'RP/день',
                            data: rpHistory,
                            borderColor: '#8e44ad',
                            backgroundColor: grad,
                            borderWidth: 2.5,
                            pointRadius: rpHistory.length > 10 ? 0 : 4,
                            pointHoverRadius: 5,
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 } } },
                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 } } }
                        }
                    }
                });
            }
        }

        // ─── АКТИВНЫЙ ПРОЕКТ ────────────────────────────────────────
        let rndActive = document.getElementById('ui-rnd-active');
        if (rndActive) {
            let icons = this._rndTechIcons;
            if (STATE.rnd.activeProject) {
                let tpl = RECIPES.BUSINESSES[STATE.rnd.activeProject];
                let isUnlocked = STATE.rnd.unlocked && STATE.rnd.unlocked.includes(STATE.rnd.activeProject);
                let targetCost = isUnlocked ? (tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000) : tpl.researchCost;
                let titleName = isUnlocked ? `Совершенствование` : `Изучение`;
                let percent = targetCost > 0 ? Math.min(100, (STATE.rnd.points / targetCost) * 100) : 100;
                let techIcon = icons[STATE.rnd.activeProject] || '🔬';
                rndActive.innerHTML = `
                <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:14px;">⚡ Активное Исследование</div>
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
                    <div style="font-size:2.5rem;">${techIcon}</div>
                    <div>
                        <div style="font-size:0.85rem; color:var(--orange); text-transform:uppercase; font-weight:700;">${titleName}</div>
                        <div style="font-weight:700; color:var(--text); font-size:1.05rem;">${tpl.name}</div>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:var(--text-dim); margin-bottom:6px;">
                    <span>${STATE.rnd.points} RP</span><span>${targetCost} RP</span>
                </div>
                <div style="background:var(--surface-2); border-radius:8px; height:10px; overflow:hidden; margin-bottom:8px;">
                    <div style="height:100%; width:${percent.toFixed(1)}%; background:linear-gradient(90deg,#8e44ad,#e74c3c); border-radius:8px; transition:width 0.4s;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.85rem; color:#8e44ad; font-weight:700;">${percent.toFixed(1)}% завершено</span>
                    <button onclick="RND.pauseProject()" style="background:rgba(230,126,34,0.1); color:var(--orange); border:1px solid rgba(230,126,34,0.3); padding:6px 14px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem;">⏸ Пауза</button>
                </div>`;

                // Приостановленные
                if (STATE.rnd.savedProgress && Object.keys(STATE.rnd.savedProgress).length > 0) {
                    let pausedHtml = '';
                    Object.keys(STATE.rnd.savedProgress).forEach(bizId => {
                        let pts = STATE.rnd.savedProgress[bizId];
                        if (pts > 0) {
                            let t = RECIPES.BUSINESSES[bizId];
                            let tc = STATE.rnd.unlocked.includes(bizId) ? (t.researchCost > 0 ? t.researchCost * 2 : 1000) : t.researchCost;
                            let p = tc > 0 ? Math.min(100, (pts/tc)*100).toFixed(0) : 100;
                            let ico = icons[bizId] || '🔬';
                            pausedHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(243,156,18,0.08); border:1px solid rgba(243,156,18,0.2); padding:10px 14px; border-radius:8px; margin-top:8px;">
                                <span>${ico} <strong>${t.name}</strong> <span style="color:var(--text-dim); font-size:0.9rem;">${p}%</span></span>
                                <button onclick="RND.startProject('${bizId}')" style="background:rgba(39,174,96,0.1); color:var(--green); border:1px solid rgba(39,174,96,0.3); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.82rem; font-weight:600;">▶ Продолжить</button>
                            </div>`;
                        }
                    });
                    if (pausedHtml) rndActive.innerHTML += `<div style="margin-top:14px;"><div style="font-size:0.85rem; text-transform:uppercase; color:var(--text-dim); font-weight:700; margin-bottom:6px;">⏸ На паузе</div>${pausedHtml}</div>`;
                }
            } else {
                rndActive.innerHTML = `
                <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:12px;">⚡ Активное Исследование</div>
                <div style="text-align:center; padding: 20px 0; color:var(--text-faint);">
                    <div style="font-size:2.5rem; margin-bottom:8px;">🧪</div>
                    <div style="font-size:0.9rem;">Нет активных исследований.</div>
                    <div style="font-size:0.82rem; margin-top:4px;">Выберите технологию ниже</div>
                </div>`;

                if (STATE.rnd.savedProgress && Object.keys(STATE.rnd.savedProgress).some(k => STATE.rnd.savedProgress[k] > 0)) {
                    let pausedHtml = '';
                    Object.keys(STATE.rnd.savedProgress).forEach(bizId => {
                        let pts = STATE.rnd.savedProgress[bizId];
                        if (pts > 0) {
                            let t = RECIPES.BUSINESSES[bizId];
                            let tc = STATE.rnd.unlocked.includes(bizId) ? (t.researchCost > 0 ? t.researchCost * 2 : 1000) : t.researchCost;
                            let p = tc > 0 ? Math.min(100, (pts/tc)*100).toFixed(0) : 100;
                            let ico = icons[bizId] || '🔬';
                            pausedHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(243,156,18,0.08); border:1px solid rgba(243,156,18,0.2); padding:10px 14px; border-radius:8px; margin-top:8px;">
                                <span>${ico} <strong>${t.name}</strong> <span style="color:var(--text-dim); font-size:0.9rem;">${p}%</span></span>
                                <button onclick="RND.startProject('${bizId}')" style="background:rgba(39,174,96,0.1); color:var(--green); border:1px solid rgba(39,174,96,0.3); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.82rem; font-weight:600;">▶ Продолжить</button>
                            </div>`;
                        }
                    });
                    if (pausedHtml) rndActive.innerHTML += `<div style="margin-top:4px;"><div style="font-size:0.85rem; text-transform:uppercase; color:var(--text-dim); font-weight:700; margin-bottom:6px;">⏸ На паузе</div>${pausedHtml}</div>`;
                }
            }
        }

        // ─── ДОСТУПНЫЕ ТЕХНОЛОГИИ ────────────────────────────────────
        let rndAvail = document.getElementById('ui-rnd-available');
        if (!rndAvail) return;

        let icons = this._rndTechIcons;
        if (!STATE.rnd.unlocked) STATE.rnd.unlocked = ['microchips', 'parts3d'];

        let newTechs = [], upgradeTechs = [], maxedTechs = [];

        Object.keys(RECIPES.BUSINESSES).forEach(key => {
            let tpl = RECIPES.BUSINESSES[key];
            let isPaused = STATE.rnd.savedProgress && STATE.rnd.savedProgress[key] > 0;
            let isResearching = STATE.rnd.activeProject === key;
            if (isPaused || isResearching) return;
            if (tpl.researchCost >= 0) {
                let isUnlocked = STATE.rnd.unlocked.includes(key);
                let currentLevel = (STATE.rnd.techLevels && STATE.rnd.techLevels[key]) ? STATE.rnd.techLevels[key] : 1.0;
                let ico = icons[key] || '🏭';
                if (isUnlocked) {
                    if (currentLevel >= 2.0) {
                        maxedTechs.push({ key, tpl, ico, currentLevel });
                    } else {
                        upgradeTechs.push({ key, tpl, ico, currentLevel });
                    }
                } else if (tpl.researchCost > 0) {
                    newTechs.push({ key, tpl, ico });
                }
            }
        });

        const renderTechCard = (item, mode) => {
            let { key, tpl, ico } = item;
            if (mode === 'new') {
                return `
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; display:flex; flex-direction:column; gap:10px; box-shadow:var(--shadow-card); transition:transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                    <div style="font-size:2.2rem; text-align:center;">${ico}</div>
                    <div style="text-align:center;">
                        <div style="font-weight:700; font-size:0.95rem; color:var(--text);">${tpl.name}</div>
                        <div style="font-size:0.78rem; color:var(--text-dim); margin-top:2px;">Требует изучения</div>
                    </div>
                    <div style="background:rgba(142,68,173,0.08); border-radius:8px; padding:6px 10px; text-align:center; font-size:0.82rem; font-weight:700; color:#8e44ad;">${tpl.researchCost} RP</div>
                    <button onclick="RND.startProject('${key}')" style="width:100%; background:linear-gradient(135deg,#8e44ad,#9b59b6); color:white; border:none; padding:9px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                        🔬 Изучить
                    </button>
                </div>`;
            } else if (mode === 'upgrade') {
                let upgCost = tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000;
                let lvlPct = ((item.currentLevel - 1.0) * 100).toFixed(0);
                return `
                <div style="background:var(--surface); border:1px solid rgba(52,152,219,0.25); border-radius:var(--radius); padding:16px; display:flex; flex-direction:column; gap:10px; box-shadow:var(--shadow-card); transition:transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                    <div style="font-size:2.2rem; text-align:center;">${ico}</div>
                    <div style="text-align:center;">
                        <div style="font-weight:700; font-size:0.95rem; color:var(--text);">${tpl.name}</div>
                        <div style="font-size:0.78rem; color:var(--blue);">v${item.currentLevel.toFixed(2)} / 2.0</div>
                    </div>
                    <div style="background:var(--surface-2); border-radius:6px; height:6px; overflow:hidden;">
                        <div style="height:100%; width:${lvlPct}%; background:linear-gradient(90deg,#3498db,#2ecc71); border-radius:6px;"></div>
                    </div>
                    <div style="background:rgba(52,152,219,0.08); border-radius:8px; padding:6px 10px; text-align:center; font-size:0.82rem; font-weight:700; color:#3498db;">${upgCost} RP</div>
                    <button onclick="RND.startProject('${key}')" style="width:100%; background:linear-gradient(135deg,#3498db,#2980b9); color:white; border:none; padding:9px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                        ⚙️ Улучшить
                    </button>
                </div>`;
            } else {
                return `
                <div style="background:var(--surface); border:1px solid rgba(39,174,96,0.25); border-radius:var(--radius); padding:16px; display:flex; flex-direction:column; gap:8px; opacity:0.75;">
                    <div style="font-size:2.2rem; text-align:center; filter:grayscale(30%);">${ico}</div>
                    <div style="text-align:center;">
                        <div style="font-weight:700; font-size:0.95rem; color:var(--text);">${tpl.name}</div>
                        <div style="font-size:0.78rem; color:var(--green);">🏆 Макс. уровень v2.0</div>
                    </div>
                    <div style="text-align:center; font-size:0.9rem; color:var(--green); font-weight:700;">✅ Завершено</div>
                </div>`;
            }
        };

        let html = '';

        if (newTechs.length > 0) {
            html += `
            <div style="margin-bottom:24px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid rgba(142,68,173,0.2);">
                    <span style="font-size:1.2rem;">📜</span>
                    <h3 style="margin:0; color:#8e44ad;">Новые технологии (Открытие чертежей)</h3>
                    <span style="background:rgba(142,68,173,0.1); color:#8e44ad; font-size:0.78rem; padding:2px 8px; border-radius:10px; font-weight:700;">${newTechs.length} доступно</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px;">
                    ${newTechs.map(t => renderTechCard(t, 'new')).join('')}
                </div>
            </div>`;
        }

        if (upgradeTechs.length > 0) {
            html += `
            <div style="margin-bottom:24px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid rgba(52,152,219,0.2);">
                    <span style="font-size:1.2rem;">⚙️</span>
                    <h3 style="margin:0; color:#3498db;">Совершенствование производства</h3>
                    <span style="background:rgba(52,152,219,0.1); color:#3498db; font-size:0.78rem; padding:2px 8px; border-radius:10px; font-weight:700;">${upgradeTechs.length} технол.</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px;">
                    ${upgradeTechs.map(t => renderTechCard(t, 'upgrade')).join('')}
                </div>
            </div>`;
        }

        if (maxedTechs.length > 0) {
            html += `
            <div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid rgba(39,174,96,0.2);">
                    <span style="font-size:1.2rem;">🏆</span>
                    <h3 style="margin:0; color:var(--green);">Полностью усовершенствованные</h3>
                    <span style="background:rgba(39,174,96,0.1); color:var(--green); font-size:0.78rem; padding:2px 8px; border-radius:10px; font-weight:700;">${maxedTechs.length} завершено</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px;">
                    ${maxedTechs.map(t => renderTechCard(t, 'maxed')).join('')}
                </div>
            </div>`;
        }

        if (!html) {
            html = `<div style="text-align:center; padding:40px; color:var(--text-dim);">
                <div style="font-size:3rem; margin-bottom:12px;">🏆</div>
                <div style="font-weight:700;">Все технологии исследованы на максимум!</div>
            </div>`;
        }

        rndAvail.innerHTML = html;
    },


    // --- 5. СКЛАДСКИЕ КАРТОЧКИ ---
    updateWarehouseUI() {
        if (typeof WAREHOUSE === 'undefined') return;
        WAREHOUSE.init(); 
        
        let warehouseList = document.getElementById('ui-warehouse-list');
        if (!warehouseList) return;
        
        warehouseList.innerHTML = '';
        let hasWarehouses = false;
        
        Object.keys(STATE.company.warehouses).forEach(cId => {
            let wh = STATE.company.warehouses[cId];
            if (wh.level > 0) {
                hasWarehouses = true;
                let city = typeof GEO !== 'undefined' ? GEO.getCity(cId) : { name: cId, rentMult: 1.0 };
                let curVol = WAREHOUSE.getCurrentVolume(cId);
                let maxVol = WAREHOUSE.getMaxVolume(cId);
                let percent = maxVol > 0 ? Math.min(100, (curVol / maxVol) * 100).toFixed(1) : 0;
                let dailyRent = WAREHOUSE.getDailyRent(cId);
                
                let nextMaxVol = Math.floor(5000 * Math.pow(1.5, wh.level));
                let upgradeCost = WAREHOUSE.getUpgradeCost(cId);
                let addedVol = nextMaxVol - maxVol;
                let nextRent = Math.floor(100 * Math.pow(1.5, wh.level) * city.rentMult);
                let addedRent = nextRent - dailyRent;

                let chartBg = percent > 90 ? 'var(--red)' : (percent > 70 ? 'var(--orange)' : 'var(--blue)');

                let invHtml = '';
                if (!wh.inventory) wh.inventory = {};
                
                Object.keys(RECIPES.RESOURCES).forEach(key => {
                    let inv = wh.inventory[key];
                    if (inv && inv.qty > 0) {
                        let res = RECIPES.RESOURCES[key];
                        let totalVal = inv.qty * inv.avgCost;
                        let volStr = res.volume > 0 ? res.volume + ' м³/шт' : 'Цифровой товар';
                        let icon = this._resIcons && this._resIcons[key] ? this._resIcons[key] : '📦';
                        
                        let storeOptions = '';
                        STATE.company.businesses.forEach(b => {
                            let bTpl = RECIPES.BUSINESSES[b.type];
                            if (bTpl.isRetail && bTpl.accepts && bTpl.accepts.includes(key)) {
                                let storeCityName = typeof GEO !== 'undefined' ? GEO.getCity(b.city || 'odesa').name : '';
                                let extraCost = (b.city || 'odesa') !== cId ? ' (Платная дост.)' : '';
                                storeOptions += `<option value="${b.uid}">${b.name} - ${storeCityName}${extraCost}</option>`;
                            }
                        });
                        
                        let transferHtml = '';
                        if (storeOptions !== '') {
                            transferHtml = `
                            <div style="margin-top:12px; display:flex; gap:6px; flex-wrap:wrap; border-top:1px dashed var(--border); padding-top:10px;">
                                <select id="trans-store-${cId}-${key}" style="flex:1; font-size:0.9rem; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text);">
                                    <option value="">В магазин...</option>${storeOptions}
                                </select>
                                <input type="number" id="trans-qty-${cId}-${key}" value="${inv.qty}" max="${inv.qty}" style="width:80px; font-size:0.85rem; font-weight:700; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); text-align:center;">
                                <button onclick="UI_DASHBOARD.transferToStore('${key}', '${cId}')" style="background:var(--orange); color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.85rem;">Отгрузить</button>
                            </div>`;
                        } else {
                            transferHtml = `<div style="margin-top:12px; border-top:1px dashed var(--border); padding-top:10px; font-size:0.85rem; color:var(--text-dim);">У вас нет магазинов для этого товара</div>`;
                        }

                        let stars = '';
                        let q = Math.round(inv.quality || 1);
                        for(let i=0; i<q; i++) stars += '⭐';

                        invHtml += `
                        <div style="background:var(--surface-2); border-radius:10px; padding:16px; border:1px solid var(--border); display:flex; flex-direction:column; justify-content:space-between;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="font-size:2.5rem; background:white; padding:8px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05); line-height:1;">${icon}</div>
                                    <div>
                                        <div style="font-weight:800; font-size:1.05rem; color:var(--text);">${res.name}</div>
                                        <div style="font-size:0.85rem; color:var(--text-dim); margin-top:2px;">${volStr}</div>
                                        <div style="font-size:0.85rem; color:var(--orange); margin-top:2px; font-weight:600;">Качество: ${stars} ${(inv.quality || 1.0).toFixed(2)}</div>
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-weight:800; font-size:1.3rem; color:var(--blue);">${inv.qty} шт</div>
                                    <div style="font-size:0.85rem; color:var(--text-dim); margin-top:2px;">$${formatMoney(inv.avgCost)}/шт</div>
                                </div>
                            </div>
                            <div style="margin-top:12px; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.9rem; color:var(--text-dim);">Общая стоимость:</span>
                                <span style="font-weight:800; color:var(--green);">$${formatMoney(totalVal)}</span>
                            </div>
                            ${transferHtml}
                        </div>`;
                    }
                });
                
                if (invHtml === '') {
                    invHtml = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-dim); background:var(--surface-2); border-radius:12px; border:1px dashed var(--border);">Склад пуст. Закупите продукцию на B2B-рынке или отправьте сюда произведенные товары.</div>';
                }

                warehouseList.innerHTML += `
                <li style="background:var(--surface); border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-card); overflow:hidden;">
                    <div style="background:linear-gradient(135deg, rgba(41,128,185,0.1), rgba(46,204,113,0.05)); border-bottom:1px solid var(--border); padding:20px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px;">
                        <div style="display:flex; align-items:center; gap:16px;">
                            <div style="font-size:2.5rem; background:white; width:60px; height:60px; display:flex; align-items:center; justify-content:center; border-radius:14px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">🗺️</div>
                            <div>
                                <h3 style="margin:0 0 6px 0; color:var(--text); font-size:1.4rem;">Логистический хаб: ${city.name} <span style="background:var(--blue); color:white; padding:2px 8px; border-radius:6px; font-size:0.9rem; vertical-align:middle; margin-left:6px;">Ур. ${wh.level}</span></h3>
                                <p style="margin:0; color:var(--text-dim); font-size:0.95rem;">Аренда: <strong style="color:var(--red);">$${formatMoney(dailyRent)}</strong> / день</p>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:20px; background:white; padding:14px 20px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); border:1px solid var(--border);">
                            <div>
                                <div style="font-size:0.85rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); margin-bottom:4px;">Заполненность</div>
                                <div style="font-size:1.1rem; font-weight:800; color:var(--text);">${curVol.toFixed(1)} <span style="font-size:0.85rem; color:var(--text-dim); font-weight:500;">/ ${maxVol} м³</span></div>
                            </div>
                            
                            <div style="position:relative; width:54px; height:54px;">
                                <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--surface-3)" stroke-width="4"/>
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${chartBg}" stroke-width="4" stroke-dasharray="${percent}, 100" />
                                </svg>
                                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
                                    <span style="font-size:0.9rem; font-weight:800; color:${chartBg};">${percent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="padding:24px;">
                        <div style="font-size:0.85rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); margin-bottom:16px;">📦 Инвентарь на складе</div>
                        
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
                            ${invHtml}
                        </div>

                        <div style="margin-top:24px; padding-top:24px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                            <div style="color:var(--text-dim); font-size:0.9rem;">
                                При расширении: <strong style="color:var(--text);">+${addedVol} м³</strong> вместимости, аренда вырастет на <strong style="color:var(--red);">+$${addedRent}</strong>/дн.
                            </div>
                            <button onclick="WAREHOUSE.upgrade('${cId}')" style="background:linear-gradient(135deg, var(--orange), #d35400); color:white; border:none; cursor:pointer; padding:12px 24px; border-radius:10px; font-weight:800; font-size:1rem; box-shadow:0 4px 12px rgba(243,156,18,0.3); transition:0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                                🏗️ Расширить склад ($${formatMoney(upgradeCost)})
                            </button>
                        </div>
                    </div>
                </li>`;
            }
        });

        if (!hasWarehouses) {
            warehouseList.innerHTML = '<div style="text-align:center; padding:60px 20px; color:var(--text-dim); font-size:1.2rem; background:var(--surface); border-radius:16px; border:1px dashed var(--border);">У вас нет открытых логистических хабов. Постройте первый склад, чтобы закупать сырье и продавать продукцию.</div>';
        }
    },

    // --- 6. ПРОИЗВОДСТВО ---
    // Словарь иконок для производств
    _bizIcons: {
        bakery_fab: '🥖', canned_food_fab: '🥫', clothes_fab: '👗',
        chem_fab: '🧴', furniture_fab: '🪑', optics_fab: '🔭',
        fab_3d: '🖨️', microchips: '💾', servo_fab: '⚙️',
        battery_fab: '🔋', camera_fab: '📷', drop_fab: '🪂',
        software_co: '💻', ai_lab: '🤖', pc_fab: '🖥️',
        radio_fab: '📡', drones: '🚁', drones_ai_fab: '🛡️',
        retail_eq_fab: '🏪', server_fab: '🗄️', marketing_agency: '📢',
    },

    // Тематические цвета по категориям
    _bizColors: {
        bakery_fab: '#e67e22', canned_food_fab: '#e74c3c', clothes_fab: '#e91e63',
        chem_fab: '#9c27b0', furniture_fab: '#795548', optics_fab: '#2196f3',
        fab_3d: '#00bcd4', microchips: '#3f51b5', servo_fab: '#607d8b',
        battery_fab: '#ff9800', camera_fab: '#4caf50', drop_fab: '#009688',
        software_co: '#673ab7', ai_lab: '#f44336', pc_fab: '#2196f3',
        radio_fab: '#00838f', drones: '#1565c0', drones_ai_fab: '#b71c1c',
        retail_eq_fab: '#388e3c', server_fab: '#455a64',
    },

    toggleBuyPanel() {
        let panel = document.getElementById('ui-buy-panel');
        if (!panel) return;
        let isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        let btn = document.getElementById('btn-toggle-buy');
        if (btn) btn.textContent = isHidden ? '✕ Закрыть каталог' : '+ Построить предприятие';
    },

    updateProductionTab() {
        // ─── ДАШБОРД ──────────────────────────────────────────────────
        let prodDash = document.getElementById('ui-prod-dashboard');
        if (prodDash) {
            let factories = STATE.company.businesses.filter(b => {
                let t = RECIPES.BUSINESSES[b.type];
                return t && !t.isRetail && !t.isMarketing;
            });
            let totalStaff = 0, totalEq = 0, totalOutput = 0, totalCost = 0;
            factories.forEach(b => {
                let t = RECIPES.BUSINESSES[b.type];
                let assigned = (b.assigned.junior||0)+(b.assigned.middle||0)+(b.assigned.senior||0);
                totalStaff += assigned;
                totalEq += (b.equipment.count||0);
                let lvl = b.level||1;
                let maxOut = (b.equipment.count||0) * (t.outputPerMachine||10);
                totalOutput += maxOut;
                totalCost += (t.area*2*lvl) + assigned*200;
            });
            let dashMetrics = [
                { icon:'🏭', label:'Заводов',    value: factories.length,           color:'var(--blue)' },
                { icon:'👥', label:'Рабочих',    value: totalStaff,                 color:'var(--text)' },
                { icon:'⚙️', label:'Станков',    value: totalEq,                    color:'var(--green)' },
                { icon:'📦', label:'Мощность/дн', value: totalOutput + ' шт',       color:'#8e44ad' },
                { icon:'💸', label:'Затраты/дн', value: '$'+formatMoney(totalCost), color:'var(--red)' },
            ];
            prodDash.innerHTML = dashMetrics.map(m => `
                <div style="background:var(--surface); padding:14px 16px; border-radius:var(--radius); border:1px solid var(--border); box-shadow:var(--shadow-card);">
                    <div style="font-size:1.4rem; margin-bottom:4px;">${m.icon}</div>
                    <div style="font-size:0.62rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700;">${m.label}</div>
                    <div style="font-size:1.15rem; font-weight:800; color:${m.color}; margin-top:2px;">${m.value}</div>
                </div>`).join('');
        }

        // ─── КАТАЛОГ ПОКУПКИ ───────────────────────────────────────────
        let buyContainer = document.getElementById('ui-buy-businesses');
        if (buyContainer) {
            buyContainer.innerHTML = '';
            const TIERS = {
                food: { label: '🥗 Пищевая промышленность', color: '#e67e22', keys: ['bakery_fab','canned_food_fab'] },
                light: { label: '👕 Лёгкая промышленность', color: '#e91e63', keys: ['clothes_fab','chem_fab','furniture_fab'] },
                optics: { label: '🔬 Точная механика', color: '#2196f3', keys: ['fab_3d','optics_fab','camera_fab','drop_fab'] },
                electronics: { label: '💡 Электроника и IT', color: '#3f51b5', keys: ['microchips','pc_fab','software_co','ai_lab'] },
                defense: { label: '🛡️ Оборонная промышленность', color: '#b71c1c', keys: ['servo_fab','battery_fab','radio_fab','drones','drones_ai_fab'] },
                equip: { label: '🏗️ Производство оборудования', color: '#607d8b', keys: ['retail_eq_fab','server_fab'] },
            };

            let html = '';
            Object.values(TIERS).forEach(tier => {
                let tierCards = '';
                tier.keys.forEach(key => {
                    let tpl = RECIPES.BUSINESSES[key];
                    if (!tpl) return;
                    let isUnlocked = (tpl.researchCost === 0) || (STATE.rnd && STATE.rnd.unlocked && STATE.rnd.unlocked.includes(key));
                    let icon = this._bizIcons[key] || '🏭';
                    let color = this._bizColors[key] || 'var(--blue)';
                    let cost = tpl.area * 50;
                    let inputsStr = Object.entries(tpl.inputs||{}).map(([k,v]) => {
                        let r = RECIPES.RESOURCES[k];
                        return `${r ? r.name : k} ×${v}`;
                    }).join(', ') || 'Без сырья';
                    let outRes = RECIPES.RESOURCES[tpl.output];

                    if (!isUnlocked) {
                        tierCards += `
                        <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:16px; opacity:0.6; position:relative; overflow:hidden;">
                            <div style="position:absolute; top:8px; right:8px; background:rgba(142,68,173,0.15); color:#8e44ad; font-size:0.65rem; font-weight:700; padding:2px 7px; border-radius:6px; text-transform:uppercase;">🔒 Заблокировано</div>
                            <div style="font-size:2rem; margin-bottom:8px; filter:grayscale(80%);">${icon}</div>
                            <div style="font-weight:700; color:var(--text-dim); font-size:0.9rem; margin-bottom:4px;">${tpl.name}</div>
                            <div style="font-size:0.72rem; color:var(--text-faint);">Требует исследования (${tpl.researchCost} RP)</div>
                        </div>`;
                        return;
                    }

                    tierCards += `
                    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:var(--shadow-card); transition:transform 0.15s,box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                        <div style="background:${color}18; border-bottom:2px solid ${color}40; padding:14px 16px; display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.8rem;">${icon}</span>
                            <div>
                                <div style="font-weight:700; font-size:0.88rem; color:var(--text);">${tpl.name}</div>
                                <div style="font-size:0.9rem; color:${color}; font-weight:600;">→ ${outRes ? outRes.name : tpl.output}</div>
                            </div>
                        </div>
                        <div style="padding:12px 16px;">
                            <div style="font-size:0.72rem; color:var(--text-dim); margin-bottom:6px;">📦 Сырьё: <span style="color:var(--text);">${inputsStr}</span></div>
                            <div style="font-size:0.72rem; color:var(--text-dim); margin-bottom:10px;">⚙️ ${tpl.outputPerMachine} шт/станок · 👥 ${tpl.staffReq} чел./уровень</div>
                            <div style="font-size:1rem; font-weight:800; color:${color}; margin-bottom:10px;">$${formatMoney(cost)}</div>
                            <button onclick="PRODUCTION.buyBusiness('${key}')" style="width:100%; background:${color}; color:white; border:none; padding:9px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem; transition:opacity 0.15s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                                🏗️ Построить
                            </button>
                        </div>
                    </div>`;
                });

                if (tierCards) {
                    html += `<div style="grid-column:1/-1; display:flex; align-items:center; gap:8px; margin-top:8px; margin-bottom:4px; padding-bottom:8px; border-bottom:1px solid var(--border);">
                        <span style="font-size:1rem;">${tier.label.split(' ')[0]}</span>
                        <span style="font-weight:700; color:${tier.color}; font-size:0.9rem;">${tier.label.slice(3)}</span>
                    </div>${tierCards}`;
                }
            });
            buyContainer.innerHTML = html || '<div style="color:var(--text-dim)">Нет доступных предприятий.</div>';
        }

        // ─── АКТИВНЫЕ ПРЕДПРИЯТИЯ ──────────────────────────────────────
        let bizList = document.getElementById('ui-active-businesses');
        if (!bizList) return;
        bizList.innerHTML = '';

        let hasFactories = false;
        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl || tpl.isRetail || tpl.isMarketing) return;
            hasFactories = true;

            if (!biz.assigned) biz.assigned = { junior: 0, middle: 0, senior: 0 };
            if (!biz.stats) biz.stats = { daily: 0, monthly: [], total: 0, lastOutput: 0 };

            let level = biz.level || 1;
            let eqCount = biz.equipment.count || 0;
            let maxSlots = level * (tpl.slotsPerLevel || 10);
            let cond = biz.equipment.condition !== undefined ? biz.equipment.condition : 100;
            let maxStaff = tpl.staffReq * level;
            let maxOutByEquip = eqCount * (tpl.outputPerMachine || 10);
            let assignedTotal = (biz.assigned.junior||0) + (biz.assigned.middle||0) + (biz.assigned.senior||0);
            let isFull = assignedTotal >= maxStaff;

            let prodPower = ((biz.assigned.junior||0) * HR.GRADES.junior.prodMult) + ((biz.assigned.middle||0) * HR.GRADES.middle.prodMult) + ((biz.assigned.senior||0) * HR.GRADES.senior.prodMult);
            let uiEfficiency = maxStaff > 0 ? (prodPower / maxStaff) : 0;
            if (assignedTotal === 0) uiEfficiency = 0;

            let condMult = cond < 70 ? Math.max(0, cond/70) : 1.0;
            let effPercent = Math.round(uiEfficiency * condMult * 100);
            let effColor = effPercent >= 80 ? 'var(--green)' : (effPercent >= 40 ? 'var(--orange)' : 'var(--red)');
            let condColor = cond >= 70 ? 'var(--green)' : (cond >= 30 ? 'var(--orange)' : 'var(--red)');

            let cityId = biz.city || 'odesa';
            let cityData = typeof GEO !== 'undefined' ? GEO.getCity(cityId) : { name: 'Одесса', rentMult: 1.0, salaryMult: 1.0 };

            let salaryCost = (((biz.assigned.junior||0) * HR.GRADES.junior.salary) + ((biz.assigned.middle||0) * HR.GRADES.middle.salary) + ((biz.assigned.senior||0) * HR.GRADES.senior.salary)) * cityData.salaryMult;
            let adminCost = tpl.area * 2 * level * cityData.rentMult;
            let upgradeCost = tpl.area * 50 * level * cityData.rentMult;

            let localWh = STATE.company.warehouses[cityId];
            if (localWh && !localWh.inventory) localWh.inventory = {};
            let localInv = localWh ? localWh.inventory : {};

            let outRes = RECIPES.RESOURCES[tpl.output] || { name: 'Продукция' };
            let outInvData = localInv[tpl.output] || { qty: 0 };
            let outInv = outInvData.qty;

            let capacityOutput = Math.floor(maxOutByEquip * uiEfficiency * condMult);

            let q_tech = (STATE.rnd && STATE.rnd.techLevels && STATE.rnd.techLevels[biz.type]) ? STATE.rnd.techLevels[biz.type] : 1.0;
            let q_hr = 1.0;
            if (assignedTotal > 0) q_hr = (((biz.assigned.junior||0)*1.0) + ((biz.assigned.middle||0)*1.2) + ((biz.assigned.senior||0)*1.5)) / assignedTotal;

            let sumMatQ = 0, totalMatCount = 0;
            let inputsKeys = Object.keys(tpl.inputs || {});
            let inputsHtml = '';
            if (inputsKeys.length === 0) {
                inputsHtml = '<span style="color:var(--text-dim); font-size:0.82rem;">Не требует сырья</span>';
            } else {
                inputsKeys.forEach(k => {
                    let reqNum = tpl.inputs[k];
                    let inName = RECIPES.RESOURCES[k] ? RECIPES.RESOURCES[k].name : k;
                    let invMat = localInv[k];
                    let inQty = invMat ? invMat.qty : 0;
                    let matQ = (invMat && invMat.qty > 0) ? (invMat.quality || 1.0) : 1.0;
                    sumMatQ += matQ * reqNum;
                    totalMatCount += reqNum;
                    let totalReqPerDay = reqNum * capacityOutput;
                    let hasEnough = inQty >= totalReqPerDay;
                    inputsHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--surface); border-radius:6px; border:1px solid var(--border); margin-bottom:4px;">
                        <span style="font-size:0.9rem; color:var(--text);">${inName}</span>
                        <div style="text-align:right;">
                            <span style="font-weight:700; font-size:0.82rem; color:${hasEnough ? 'var(--green)' : 'var(--red)'};">${inQty} шт</span>
                            <span style="font-size:0.72rem; color:var(--text-dim); margin-left:4px;">(−${totalReqPerDay}/дн)</span>
                        </div>
                    </div>`;
                });
            }

            let q_mat = totalMatCount > 0 ? (sumMatQ / totalMatCount) : 1.0;
            let expectedQuality = ((biz.equipment.quality || 1.0) * 0.1 + q_mat * 0.3 + q_hr * 0.2 + q_tech * 0.4).toFixed(2);

            let freeJun = typeof HR !== 'undefined' ? HR.getUnassigned('junior') : 0;
            let freeMid = typeof HR !== 'undefined' ? HR.getUnassigned('middle') : 0;
            let freeSen = typeof HR !== 'undefined' ? HR.getUnassigned('senior') : 0;

            // Склады для логистики
            let whOptions = '';
            Object.keys(STATE.company.warehouses).forEach(cId => {
                if (STATE.company.warehouses[cId].level > 0) {
                    let cName = typeof GEO !== 'undefined' ? GEO.getCity(cId).name : cId;
                    whOptions += `<option value="${cId}">${cName}</option>`;
                }
            });
            let sourceWh = biz.sourceWh || cityId;
            let targetWh = biz.targetWh || cityId;

            // Авто-маршруты
            let viableRoutes = [];
            STATE.company.businesses.forEach(other => {
                if (other.uid === biz.uid) return;
                let ot = RECIPES.BUSINESSES[other.type];
                if (ot.inputs && ot.inputs[tpl.output] !== undefined) {
                    viableRoutes.push({ id: other.uid, name: `🏭 ${other.name || ot.name}` });
                } else if (ot.isRetail && ot.accepts && ot.accepts.includes(tpl.output)) {
                    viableRoutes.push({ id: other.uid, name: `🏪 ${other.name}` });
                }
            });
            if (!biz.routing) biz.routing = {};
            let routingHtml = '';
            if (viableRoutes.length > 0) {
                routingHtml = viableRoutes.map(r => {
                    let val = biz.routing[r.id] || 0;
                    return `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:0.9rem; color:var(--text); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</span>
                        <div style="display:flex; align-items:center; gap:4px; margin-left:8px;">
                            <input type="number" id="route-${biz.uid}-${r.id}" value="${val}" min="0" style="width:56px; padding:4px 6px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:0.9rem; text-align:right;">
                            <span style="font-size:0.85rem; color:var(--text-dim);">шт</span>
                        </div>
                    </div>`;
                }).join('');
                let destsStr = viableRoutes.map(r => r.id).join(',');
                routingHtml += `<button onclick="UI_DASHBOARD.saveRoutes(${biz.uid},'${destsStr}')" style="width:100%; background:rgba(243,156,18,0.1); color:var(--orange); border:1px solid rgba(243,156,18,0.3); padding:7px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem; margin-top:4px;">💾 Сохранить маршруты</button>`;
            }

            let eqPct = maxSlots > 0 ? Math.round((eqCount/maxSlots)*100) : 0;
            let staffPct = maxStaff > 0 ? Math.round((assignedTotal/maxStaff)*100) : 0;
            let freeSlots = maxSlots - eqCount;
            let bizIcon = this._bizIcons[biz.type] || '🏭';
            let bizColor = this._bizColors[biz.type] || 'var(--blue)';

            bizList.innerHTML += `
            <div style="background:var(--surface); border-radius:var(--radius); border:1px solid var(--border); box-shadow:var(--shadow-card); overflow:hidden; margin-bottom:20px;">

                <!-- ЗАГОЛОВОК -->
                <div style="background:linear-gradient(135deg,${bizColor}18,${bizColor}06); border-bottom:2px solid ${bizColor}40; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="font-size:2.2rem;">${bizIcon}</div>
                        <div>
                            <div style="font-weight:700; font-size:1.05rem; color:var(--text);">${biz.name || tpl.name}</div>
                            <div style="font-size:0.78rem; color:var(--text-dim);">
                                Ур.${level} • 📍 ${cityData.name} • 🔬 Тех. v${q_tech.toFixed(2)} • 💸 $${formatMoney(adminCost+salaryCost)}/дн
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div style="background:${effColor}; color:white; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.95rem;">КПД ${effPercent}%</div>
                        <div style="background:rgba(142,68,173,0.1); color:#8e44ad; padding:6px 12px; border-radius:8px; font-weight:700; font-size:0.88rem;">★ ${expectedQuality}</div>
                        <button onclick="PRODUCTION.upgradeBusiness(${biz.uid})" style="background:rgba(243,156,18,0.1); color:var(--orange); border:1px solid rgba(243,156,18,0.3); padding:7px 16px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem;">⬆️ $${formatMoney(upgradeCost)}</button>
                    </div>
                </div>

                <!-- ТЕЛО: 3 колонки -->
                <div style="padding:18px 20px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:18px;">

                    <!-- КОЛОНКА 1: Производство и сырьё -->
                    <div style="display:flex; flex-direction:column; gap:14px;">
                        <div style="background:var(--surface-2); border-radius:10px; padding:14px; border:1px solid var(--border);">
                            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:10px;">📦 Производство</div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem;">
                                <span style="color:var(--text-dim);">Продукт</span>
                                <span style="font-weight:700; color:${bizColor};">${outRes.name}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem;">
                                <span style="color:var(--text-dim);">Мощность</span>
                                <span style="font-weight:700; color:var(--green);">${capacityOutput} шт/дн</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.85rem;">
                                <span style="color:var(--text-dim);">На складе</span>
                                <span style="font-weight:700;">${outInv} шт</span>
                            </div>
                            <div style="height:1px; background:var(--border); margin-bottom:10px;"></div>
                            <div style="font-size:0.68rem; text-transform:uppercase; color:var(--text-dim); font-weight:700; margin-bottom:8px;">🧪 Сырьё на складе (${cityData.name})</div>
                            ${inputsHtml || '<span style="color:var(--text-dim); font-size:0.82rem;">Не требует сырья</span>'}
                        </div>

                        <!-- Логистика -->
                        <div style="background:var(--surface-2); border-radius:10px; padding:14px; border:1px solid var(--border);">
                            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:10px;">🚛 Логистика</div>
                            <div style="font-size:0.78rem; color:var(--text-dim); margin-bottom:6px;">Брать сырьё:</div>
                            <select id="source-wh-${biz.uid}" onchange="UI_DASHBOARD.setFactoryWarehouses(${biz.uid})" style="width:100%; padding:7px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:0.82rem; margin-bottom:8px;">
                                ${whOptions.replace(`value="${sourceWh}"`, `value="${sourceWh}" selected`)}
                            </select>
                            <div style="font-size:0.78rem; color:var(--text-dim); margin-bottom:6px;">Отгружать на:</div>
                            <select id="target-wh-${biz.uid}" onchange="UI_DASHBOARD.setFactoryWarehouses(${biz.uid})" style="width:100%; padding:7px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:0.82rem;">
                                ${whOptions.replace(`value="${targetWh}"`, `value="${targetWh}" selected`)}
                            </select>
                            <div style="font-size:0.72rem; color:var(--text-faint); margin-top:6px;">* Межгородские поставки платные</div>
                        </div>
                    </div>

                    <!-- КОЛОНКА 2: Персонал -->
                    <div style="display:flex; flex-direction:column; gap:14px;">
                        <div style="background:var(--surface-2); border-radius:10px; padding:14px; border:1px solid var(--border);">
                            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:10px;">👥 Смена (${assignedTotal}/${maxStaff})</div>
                            <div style="background:var(--surface); border-radius:6px; height:6px; overflow:hidden; margin-bottom:12px;">
                                <div style="height:100%; width:${staffPct}%; background:${bizColor}; border-radius:6px; transition:width 0.4s;"></div>
                            </div>
                            ${[
                                {key:'junior',  label:'🔧 Junior', free: freeJun, color:'rgba(52,152,219,0.1)', textColor:'var(--blue)'},
                                {key:'middle',  label:'⚙️ Middle', free: freeMid, color:'rgba(39,174,96,0.1)', textColor:'var(--green)'},
                                {key:'senior',  label:'🔬 Senior', free: freeSen, color:'rgba(142,68,173,0.1)', textColor:'#8e44ad'},
                            ].map(g => `
                            <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin-bottom:8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:600; font-size:0.85rem; color:var(--text);">${g.label}</div>
                                        <div style="font-size:0.72rem; color:var(--text-dim);">Резерв: ${g.free}</div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <button onclick="HR.removeFromBusiness(${biz.uid},'${g.key}')" ${biz.assigned[g.key]===0?'disabled':''} style="background:var(--red-dim); color:var(--red); border:none; width:28px; height:28px; border-radius:6px; font-size:1rem; cursor:pointer; ${biz.assigned[g.key]===0?'opacity:0.4;cursor:not-allowed;':''}">−</button>
                                        <span style="font-weight:700; min-width:18px; text-align:center;">${biz.assigned[g.key]||0}</span>
                                        <button onclick="HR.assignToBusiness(${biz.uid},'${g.key}')" ${(isFull||g.free===0)?'disabled':''} style="background:${g.color}; color:${g.textColor}; border:none; width:28px; height:28px; border-radius:6px; font-size:1rem; cursor:pointer; ${(isFull||g.free===0)?'opacity:0.4;cursor:not-allowed;':''}">+</button>
                                    </div>
                                </div>
                            </div>`).join('')}
                            <div style="margin-top:6px; background:var(--surface-2); border-radius:8px; padding:8px 10px; font-size:0.78rem; display:flex; justify-content:space-between;">
                                <span style="color:var(--text-dim);">💰 ФОТ</span>
                                <span style="font-weight:700; color:var(--red);">$${formatMoney(salaryCost)}/дн</span>
                            </div>
                        </div>

                        <!-- Авто-маршруты -->
                        ${viableRoutes.length > 0 ? `
                        <div style="background:rgba(243,156,18,0.06); border-radius:10px; padding:14px; border:1px solid rgba(243,156,18,0.2);">
                            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--orange); font-weight:700; margin-bottom:10px;">📬 Авто-поставки (шт/день)</div>
                            ${routingHtml}
                        </div>` : ''}
                    </div>

                    <!-- КОЛОНКА 3: Оборудование и КПД -->
                    <div style="display:flex; flex-direction:column; gap:14px;">

                        <!-- Оборудование -->
                        <div style="background:var(--surface-2); border-radius:10px; padding:14px; border:1px solid var(--border);">
                            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:10px;">⚙️ Оборудование</div>
                            <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:4px;">
                                <span style="color:var(--text-dim);">Установлено</span>
                                <span style="font-weight:700;">${eqCount} / ${maxSlots}</span>
                            </div>
                            <div style="background:var(--surface); border-radius:6px; height:6px; overflow:hidden; margin-bottom:4px;">
                                <div style="height:100%; width:${eqPct}%; background:var(--blue); border-radius:6px; transition:width 0.4s;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:10px;">
                                <span style="color:var(--text-dim);">Состояние</span>
                                <span style="font-weight:700; color:${condColor};">${cond.toFixed(0)}%</span>
                            </div>
                            <div style="background:var(--surface); border-radius:6px; height:4px; overflow:hidden; margin-bottom:12px;">
                                <div style="height:100%; width:${Math.max(0,Math.min(100,cond))}%; background:${condColor}; border-radius:6px;"></div>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <input type="number" id="install-qty-${biz.uid}" value="1" min="1" max="${Math.max(1,freeSlots)}" style="width:55px; padding:7px 6px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); text-align:center; font-weight:600; font-size:0.85rem;">
                                <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" style="flex:1; background:rgba(52,152,219,0.1); color:var(--blue); border:1px solid rgba(52,152,219,0.3); padding:7px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">⬇️ Установить</button>
                                <button onclick="PRODUCTION.repairEquipment(${biz.uid})" style="background:rgba(142,68,173,0.1); color:#8e44ad; border:1px solid rgba(142,68,173,0.3); padding:7px 10px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">🔧 ТО</button>
                            </div>
                        </div>

                        <!-- Общая эффективность (Диаграмма) -->
                        <div style="background:var(--surface); border-radius:12px; padding:16px; border:1px solid var(--border); box-shadow:0 4px 15px rgba(0,0,0,0.02);">
                            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:800; margin-bottom:12px; display:flex; align-items:center; gap:6px;">📊 Эффективность (КПД)</div>
                            
                            <div style="position:relative; width:140px; height:140px; margin:0 auto 16px auto;">
                                <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--surface-3)" stroke-width="3.5" stroke-linecap="round"/>
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${effColor}" stroke-width="3.5" stroke-dasharray="${effPercent}, 100" stroke-linecap="round" style="transition: stroke-dasharray 1s ease-out;"/>
                                </svg>
                                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; padding-top:4px;">
                                    <span style="font-size:2.2rem; font-weight:900; color:${effColor}; line-height:1;">${effPercent}%</span>
                                    <span style="font-size:0.9rem; color:var(--text-dim); margin-top:2px;">мощности</span>
                                </div>
                            </div>
                            
                            <div style="text-align:center; font-size:0.85rem; color:var(--text-dim); margin-bottom:16px; background:${effColor}10; padding:6px; border-radius:6px; font-weight:600; color:${effColor}; border:1px dashed ${effColor}40;">
                                ${effPercent >= 80 ? '🔥 Идеальная работа' : effPercent >= 40 ? '⚙️ Требуется настройка' : assignedTotal === 0 ? '😴 Назначьте персонал' : '⚠️ Простой производства'}
                            </div>

                            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.78rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:var(--text-dim); display:flex; align-items:center; gap:4px;">⚙️ Кач. оборуд.</span><span style="font-weight:700; background:var(--surface-2); padding:2px 6px; border-radius:4px;">${(biz.equipment.quality||1.0).toFixed(2)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:var(--text-dim); display:flex; align-items:center; gap:4px;">👥 Кач. персонала</span><span style="font-weight:700; background:var(--surface-2); padding:2px 6px; border-radius:4px;">${q_hr.toFixed(2)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:var(--text-dim); display:flex; align-items:center; gap:4px;">🔬 Технология</span><span style="font-weight:800; color:#8e44ad; background:rgba(142,68,173,0.1); padding:2px 6px; border-radius:4px;">v${q_tech.toFixed(2)}</span>
                                </div>
                                <div style="height:1px; background:var(--border); margin:4px 0;"></div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:var(--text-dim); display:flex; align-items:center; gap:4px;">★ Рейтинг продукта</span><span style="font-weight:800; color:#8e44ad;">${expectedQuality}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:var(--text-dim); display:flex; align-items:center; gap:4px;">💰 Себестоимость</span><span style="font-weight:800; color:var(--red);">$${formatMoney(biz.lastCogs)}/шт</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
        });

        if (!hasFactories) {
            bizList.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-dim); font-size:1.2rem; background:var(--surface); border-radius:16px; border:1px dashed var(--border); margin-bottom: 24px;">
                У вас нет активных предприятий. Откройте каталог ниже, чтобы построить свой первый завод.
            </div>`;
        }
    },


    // --- БИРЖА С РАБОЧИМИ ФИЛЬТРАМИ И АКТИВНЫМИ ОРДЕРАМИ ---
    updateB2BTab() {
        let container = document.getElementById('ui-b2b-offers-list');
        if (!container) return;

        let offers = STATE.b2bOffers || [];
        let activeOffers = offers.filter(o => !o.accepted && o.expiresDay >= STATE.time.day);

        let html = `
        <div style="background:linear-gradient(135deg, rgba(52,152,219,0.1), rgba(155,89,182,0.1)); border:1px solid rgba(52,152,219,0.2); border-radius:16px; padding:20px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="margin:0 0 8px 0; color:var(--text); display:flex; align-items:center; gap:8px;"><span style="font-size:1.5rem;">🤖</span> AI-Конкуренты (B2B Рынок)</h3>
                <p style="margin:0; color:var(--text-dim); font-size:0.9rem;">В игре действуют 10 конкурирующих корпораций. Вы можете синхронизировать их поведение с LLM (ИИ-Ассистентом).</p>
            </div>
            <button onclick="document.getElementById('b2b-sync-modal').style.display='flex'" style="background:linear-gradient(135deg, var(--blue), #9b59b6); color:white; border:none; padding:12px 24px; border-radius:12px; font-weight:800; font-size:1rem; cursor:pointer; box-shadow:0 4px 12px rgba(52,152,219,0.3); transition:0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">Синхронизация с ИИ</button>
        </div>
        `;

        html += `<h3 style="margin:0 0 16px 0; color:var(--text);">📋 Активные предложения (Контракты)</h3>`;

        if (activeOffers.length === 0) {
            html += '<div style="padding:40px 20px; background:var(--surface); border-radius:12px; border:1px dashed var(--border); color:var(--text-dim); text-align:center; margin-bottom:24px;">Нет активных предложений от конкурентов. Контракты появляются каждые 7 дней или после синхронизации с ИИ.</div>';
        } else {
            html += `<div style="display:grid; grid-template-columns:1fr; gap:16px; margin-bottom:32px;">`;
            activeOffers.forEach(offer => {
                let itemDef = RECIPES.RESOURCES[offer.itemId];
                if (!itemDef) return;

                let icon = this._resIcons && this._resIcons[offer.itemId] ? this._resIcons[offer.itemId] : '📦';
                let name = itemDef.name || offer.itemId;
                let daysLeft = offer.expiresDay - STATE.time.day;
                
                let stars = '';
                let q = Math.round(offer.quality);
                for(let i=0; i<q; i++) stars += '⭐';

                html += `
                <div style="background:var(--surface); border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-card); border-left: 4px solid var(--blue);">
                    <div style="display:flex; align-items:center; gap:20px;">
                        <div style="font-size:32px; background:var(--surface-2); padding:12px; border-radius:12px;">${icon}</div>
                        <div>
                            <h3 style="margin:0 0 6px 0; font-size:1.1rem;">Контракт от «${offer.company}»</h3>
                            <div style="color:var(--text); font-weight:700; margin-bottom: 6px;">
                                Поставка: <span style="color:var(--blue);">${offer.qty} шт.</span> ${name}
                            </div>
                            <div style="display:flex; gap:10px; font-size:0.85rem;">
                                <span style="background:rgba(255,149,0,0.1); color:var(--orange); padding:4px 8px; border-radius:6px; font-weight:600;">Качество: ${stars} (${Number(offer.quality).toFixed(1)})</span>
                                <span style="background:rgba(0,122,255,0.1); color:var(--blue); padding:4px 8px; border-radius:6px; font-weight:600;">Бренд: +${offer.brandPower}</span>
                                <span style="background:rgba(255,59,48,0.1); color:var(--red); padding:4px 8px; border-radius:6px; font-weight:600;">Истекает: через ${daysLeft} дн.</span>
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.4rem; font-weight:800; color:var(--text); margin-bottom:4px;">$${formatMoney(offer.totalPrice)}</div>
                        <div style="font-size:0.85rem; color:var(--text-dim); margin-bottom:12px;">Цена за шт: $${formatMoney(offer.price)}</div>
                        <button class="btn-primary-lg" onclick="B2B_AI.acceptOffer('${offer.id}')" style="background:var(--green); width:100%; border:none; padding:10px; border-radius:8px; color:white; font-weight:800; cursor:pointer;">Выкупить партию</button>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        html += `
        <h3 style="margin:0 0 16px 0; color:var(--text);">🏢 Корпорации (NPC Игроки)</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px;">
        `;
        
        if (typeof B2B_AI !== 'undefined' && B2B_AI.competitors) {
            B2B_AI.competitors.forEach(comp => {
                html += `
                <div style="background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-card);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0; font-size:1.1rem; color:var(--text);">${comp.name}</h4>
                        <span style="background:var(--surface-3); padding:4px 8px; border-radius:6px; font-size:0.9rem; font-weight:700;">Тир ${comp.tier}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                        <span style="color:var(--text-dim);">Сила бренда:</span>
                        <span style="color:var(--blue); font-weight:700;">${comp.brandMod.toFixed(1)}</span>
                    </div>
                </div>`;
            });
        }
        
        html += `</div>`;
        container.innerHTML = html;
    },

    // Словарь иконок для ресурсов
    _resIcons: {
        grain: '🌾', vegetables: '🍅', meat_raw: '🥩', milk_raw: '🥛', bakery: '🍞', canned_food: '🥫',
        cotton: '🧶', wood: '🪵', chemicals: '🧪', detergent: '🧼', clothing: '👕', toys: '🧸', furniture: '🪑',
        plastic: '🧊', glass: '🪟', silicon: '🪨', copper: '🧱', aluminum: '🪙', lithium: '🔋',
        parts3d: '⚙️', optics: '🔭', chips: '💾', motors: '🦾', batteries: '🔋', camera_mod: '📷', drops: '🪂',
        software: '💿', ai_core: '🧠', smart_pc: '🖥️', mil_radio: '📻', drones: '🚁', drones_ai: '🛸',
        retail_display: '🏪', server_rack: '🗄️', machine_tool: '🏗️'
    },

    updateMarketTab() {
        let marketContainer = document.getElementById('ui-market-businesses');
        if (!marketContainer || typeof MARKET === 'undefined') return;

        let cityOptions = '';
        if (STATE.company.warehouses) {
            Object.keys(GEO.CITIES).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh && wh.level > 0) {
                    let maxVol = WAREHOUSE.getMaxVolume(cId);
                    let curVol = WAREHOUSE.getCurrentVolume(cId);
                    let pendingVol = 0;
                    if (STATE.logistics && STATE.logistics.deliveries) {
                        STATE.logistics.deliveries.forEach(d => {
                            if (d.targetCity === cId && RECIPES.RESOURCES[d.item]) {
                                pendingVol += d.qty * (RECIPES.RESOURCES[d.item].volume || 1.0);
                            }
                        });
                    }
                    let freeSpace = Math.max(0, maxVol - curVol - pendingVol).toFixed(1);
                    cityOptions += `<option value="${cId}">${GEO.CITIES[cId].name} (Свободно: ${freeSpace} м³)</option>`;
                }
            });
        }

        if (cityOptions === '') {
            marketContainer.innerHTML = '<div style="padding: 40px; text-align:center; color:var(--text-dim);">У вас нет ни одного активного склада! Сначала постройте склад (вкладка Производство или Склады).</div>';
            return;
        }

        let filterHtml = `
        <div style="margin-bottom: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="UI_DASHBOARD.setMarketFilter('all')" class="btn-filter ${this.marketFilter==='all' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${this.marketFilter==='all' ? 'var(--blue)' : 'var(--surface-2)'}; color: ${this.marketFilter==='all' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Все товары</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('raw')" class="btn-filter ${this.marketFilter==='raw' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${this.marketFilter==='raw' ? 'var(--blue)' : 'var(--surface-2)'}; color: ${this.marketFilter==='raw' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Только сырье</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('finished')" class="btn-filter ${this.marketFilter==='finished' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${this.marketFilter==='finished' ? 'var(--blue)' : 'var(--surface-2)'}; color: ${this.marketFilter==='finished' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Готовая продукция</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('equipment')" class="btn-filter ${this.marketFilter==='equipment' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${this.marketFilter==='equipment' ? 'var(--blue)' : 'var(--surface-2)'}; color: ${this.marketFilter==='equipment' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Оборудование</button>
        </div>`;

        // Активные ордера (Товары в пути)
        let pendingOrdersHtml = '';
        if (STATE.logistics && STATE.logistics.deliveries) {
            let marketOrders = STATE.logistics.deliveries.filter(d => d.isMarketOrder);
            if (marketOrders.length > 0) {
                pendingOrdersHtml += `
                <div style="margin-bottom: 24px; background: rgba(243,156,18,0.05); border: 1px solid rgba(243,156,18,0.2); border-radius: 12px; padding: 20px;">
                    <h4 style="margin: 0 0 16px 0; color: var(--orange); display:flex; align-items:center; gap:8px;"><span style="font-size:1.4rem;">📦</span> В пути (Закупки с рынка)</h4>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">`;
                
                marketOrders.forEach(d => {
                    let resName = RECIPES.RESOURCES[d.item] ? RECIPES.RESOURCES[d.item].name : d.item;
                    let icon = this._resIcons && this._resIcons[d.item] ? this._resIcons[d.item] : '📦';
                    let cName = typeof GEO !== 'undefined' ? GEO.getCity(d.targetCity).name : d.targetCity;
                    pendingOrdersHtml += `
                        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="font-size:2rem;">${icon}</div>
                                <div>
                                    <div style="font-weight:700; color:var(--text); font-size:0.95rem;">${resName} <span style="color:var(--text-dim); font-weight:400;">x${d.qty}</span></div>
                                    <div style="font-size:0.85rem; color:var(--text-dim);">📍 в ${cName} • ★${(d.quality||1.0).toFixed(2)}</div>
                                </div>
                            </div>
                            <div style="text-align:right; min-width:140px;">
                                <div style="color:var(--green); font-weight:800; font-size:1.1rem; line-height:1;">$${formatMoney(d.totalCost)}</div>
                                <div style="font-size:0.85rem; color:var(--text-dim); margin-top:6px;">Товар: <span style="font-weight:600;">$${formatMoney(d.cost||0)}</span></div>
                                <div style="font-size:0.85rem; color:var(--orange); margin-top:2px;">Доставка: <span style="font-weight:600;">$${formatMoney(d.logCost||0)}</span></div>
                                <button onclick="MARKET.cancelOrder('${d.id}')" style="background:var(--red-dim); color:var(--red); border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:700; margin-top:8px; width:100%; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Отменить</button>
                            </div>
                        </div>`;
                });
                pendingOrdersHtml += `</div></div>`;
            }
        }

        let html = `
        <div style="background: linear-gradient(135deg, rgba(52,152,219,0.1), rgba(41,128,185,0.05)); border: 1px solid rgba(52,152,219,0.2); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
                <h2 style="margin: 0 0 6px 0; color: var(--blue);">🛒 Глобальный Рынок</h2>
                <p style="margin: 0; color: var(--text-dim); font-size: 0.9rem;">Закупайте сырье и продавайте излишки. Цены формируются динамически.</p>
            </div>
            <div style="display:flex; align-items:center; gap:12px; background:var(--surface); padding:8px 14px; border-radius:12px; border:1px solid var(--border);">
                <span style="font-size:1.2rem;">📍</span>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:0.9rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">Склад для доставки</span>
                    <select id="market-target-city" style="border:none; background:transparent; font-size:0.95rem; font-weight:700; color:var(--text); cursor:pointer; outline:none; padding:0;">
                        ${cityOptions}
                    </select>
                </div>
            </div>
        </div>
        ${filterHtml}
        ${pendingOrdersHtml}
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
        `;

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            if (this.marketFilter === 'raw' && !res.isRaw) return;
            if (this.marketFilter === 'finished' && (res.isRaw || res.isEquipment)) return;
            if (this.marketFilter === 'equipment' && !res.isEquipment) return;

            let basePrice = MARKET.getCurrentPrice(key);
            let availQty = MARKET.getAvailablePool(key);
            let icon = this._resIcons && this._resIcons[key] ? this._resIcons[key] : '📦';
            
            // Инвентарь для продажи
            let inventoryHtml = '';
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.inventory && wh.inventory[key] && wh.inventory[key].qty > 0) {
                    let inv = wh.inventory[key];
                    let finalPrice = basePrice * (inv.quality || 1.0);
                    let cityName = typeof GEO !== 'undefined' ? GEO.getCity(cId).name : cId;
                    inventoryHtml += `
                    <div style="background:rgba(39,174,96,0.08); border:1px solid rgba(39,174,96,0.2); border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div style="font-size:0.9rem; color:var(--text-dim);">На складе <span style="font-weight:700; color:var(--text);">${cityName}</span></div>
                            <div style="font-weight:800; color:var(--green); font-size:0.9rem;">${inv.qty} шт</div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="font-size:0.9rem;">★ ${(inv.quality || 1.0).toFixed(2)} <span style="color:var(--text-faint);">($${formatMoney(finalPrice)}/шт)</span></div>
                            <button onclick="MARKET.sell('${key}', ${inv.qty}, '${cId}')" style="background:var(--green); color:white; border:none; padding:6px 12px; border-radius:6px; font-weight:700; font-size:0.9rem; cursor:pointer;">Продать</button>
                        </div>
                    </div>`;
                }
            });

            html += `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; box-shadow:var(--shadow-card); overflow:hidden; display:flex; flex-direction:column; transition:transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <div style="padding:16px; cursor:pointer;" onclick="UI_DASHBOARD.showMarketModal('${key}')">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="font-size:2.4rem;">${icon}</div>
                            <div>
                                <h3 style="margin:0; font-size:1.1rem; color:var(--text);">${res.name}</h3>
                                <div style="color:var(--text-dim); font-size:0.85rem;">Объем: ${res.volume || 1} м³</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.3rem; font-weight:800; color:var(--text);">$${formatMoney(basePrice)}</div>
                            <div style="font-size:0.85rem; color:var(--text-faint);">за ед.</div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-2); padding:8px 12px; border-radius:8px;">
                        <span style="font-size:0.9rem; color:var(--text-dim);">Доступно на рынке</span>
                        <span style="font-weight:700; color:var(--blue); font-size:0.95rem;">${availQty} шт</span>
                    </div>
                </div>
                
                <div style="padding:0 16px;">${inventoryHtml}</div>

                <div style="padding:16px; border-top:1px solid var(--border); background:var(--surface-2); margin-top:auto;">
                    <div style="display:flex; gap:8px;">
                        <input type="number" id="buy-qty-${key}" value="10" min="1" style="flex:1; width:50px; padding:10px; border:1px solid var(--border); border-radius:8px; font-weight:700; font-size:1rem; text-align:center; background:var(--surface); color:var(--text);">
                        <button onclick="UI_DASHBOARD.submitBuy('${key}')" style="background:var(--blue); color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:700; font-size:0.95rem; cursor:pointer;">Купить</button>
                    </div>
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <button onclick="document.getElementById('buy-qty-${key}').value = 100" style="flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:6px; border-radius:6px; cursor:pointer; font-size:0.9rem; font-weight:600;">100</button>
                        <button onclick="document.getElementById('buy-qty-${key}').value = 1000" style="flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:6px; border-radius:6px; cursor:pointer; font-size:0.9rem; font-weight:600;">1k</button>
                        <button onclick="UI_DASHBOARD.setMaxBuy('${key}')" style="flex:2; background:rgba(243,156,18,0.1); color:var(--orange); border:1px solid rgba(243,156,18,0.3); padding:6px; border-radius:6px; cursor:pointer; font-size:0.9rem; font-weight:700;">MAX</button>
                    </div>
                </div>
            </div>`;
        });

        html += `</div>`;
        marketContainer.innerHTML = html;
    },

    showMarketModal(itemKey) {
        let res = RECIPES.RESOURCES[itemKey];
        if(!res) return;
        let icon = this._resIcons && this._resIcons[itemKey] ? this._resIcons[itemKey] : '📦';
        let basePrice = MARKET.getCurrentPrice(itemKey);
        
        let producers = [];
        let consumers = [];
        if(RECIPES.BUSINESSES) {
            Object.values(RECIPES.BUSINESSES).forEach(biz => {
                if(biz.output === itemKey) producers.push(biz.name);
                if(biz.inputs && biz.inputs[itemKey]) consumers.push(biz.name);
            });
        }
        
        let descHtml = `<div style="font-size:0.9rem; color:var(--text-dim); line-height:1.5; margin-bottom:20px;">
            <p><strong>${res.name}</strong> — ${res.isRaw ? 'Базовое сырье' : res.isEquipment ? 'Оборудование' : 'Готовая продукция'}.
            Широко используется на глобальном рынке B2B. Цены зависят от спроса и глобальной инфляции.</p>
            ${producers.length ? `<p><strong>Производится на:</strong> ${producers.join(', ')}</p>` : ''}
            ${consumers.length ? `<p><strong>Используется на:</strong> ${consumers.join(', ')}</p>` : ''}
        </div>`;

        let content = document.getElementById('market-modal-content');
        content.innerHTML = `
            <div style="padding:24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg, rgba(52,152,219,0.05), rgba(41,128,185,0.02));">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="font-size:3rem;">${icon}</div>
                    <div>
                        <h2 style="margin:0 0 4px 0; font-size:1.6rem;">${res.name}</h2>
                        <div style="font-size:1.2rem; font-weight:800; color:var(--blue);">$${formatMoney(basePrice)}</div>
                    </div>
                </div>
                <button onclick="UI_DASHBOARD.closeMarketModal()" style="background:transparent; border:none; font-size:1.5rem; color:var(--text-dim); cursor:pointer;">&times;</button>
            </div>
            <div style="padding:24px;">
                ${descHtml}
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0;">📈 Динамика цены</h3>
                    <div id="chart-buttons" style="display:flex; gap:8px;">
                        <button onclick="UI_DASHBOARD.updateMarketChart('${itemKey}', 7)" style="padding:4px 10px; border-radius:12px; border:1px solid var(--blue); background:var(--blue); color:white; font-size:0.9rem; cursor:pointer;">Неделя</button>
                        <button onclick="UI_DASHBOARD.updateMarketChart('${itemKey}', 30)" style="padding:4px 10px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:0.9rem; cursor:pointer;">Месяц</button>
                        <button onclick="UI_DASHBOARD.updateMarketChart('${itemKey}', 365)" style="padding:4px 10px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:0.9rem; cursor:pointer;">Год</button>
                    </div>
                </div>
                <div style="height:250px; position:relative;">
                    <canvas id="marketChart"></canvas>
                </div>
            </div>
        `;
        
        document.getElementById('market-item-modal').style.display = 'flex';
        this.updateMarketChart(itemKey, 7);
    },

    closeMarketModal() {
        document.getElementById('market-item-modal').style.display = 'none';
        if(this.marketChartInstance) {
            this.marketChartInstance.destroy();
            this.marketChartInstance = null;
        }
    },

    updateMarketChart(itemKey, days) {
        let ctx = document.getElementById('marketChart');
        if(!ctx) return;
        
        let basePrice = MARKET.getCurrentPrice(itemKey);
        let labels = [];
        let data = [];
        let curPrice = basePrice * (1 - (Math.random()*0.2 - 0.1));
        
        for(let i=days; i>=0; i--) {
            if(days <= 30) {
                let d = STATE.time.day - i;
                labels.push(`День ${d > 0 ? d : 1}`);
            } else if(i%30===0) {
                labels.push(`Мес ${Math.floor(i/30)} назад`);
            }
            
            curPrice = curPrice + (curPrice * (Math.random()*0.06 - 0.03));
            if(i===0) curPrice = basePrice;
            
            if(days <= 30 || i%30===0) data.push(curPrice);
        }

        if(this.marketChartInstance) this.marketChartInstance.destroy();
        
        this.marketChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Цена ($)',
                    data: data,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52,152,219,0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: days <= 30 ? 3 : 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: false, ticks: { callback: v => '$' + v.toFixed(2) } },
                    x: { grid: { display: false } }
                }
            }
        });
        
        let btnContainer = document.getElementById('chart-buttons');
        if (btnContainer) {
            let btns = btnContainer.querySelectorAll('button');
            btns.forEach(b => {
                b.style.background = 'var(--surface-2)'; b.style.color = 'var(--text)'; b.style.borderColor = 'var(--border)';
                if((days===7 && b.innerText==='Неделя') || (days===30 && b.innerText==='Месяц') || (days===365 && b.innerText==='Год')) {
                    b.style.background = 'var(--blue)'; b.style.color = 'white'; b.style.borderColor = 'var(--blue)';
                }
            });
        }
    },

    setMaxBuy(itemKey) {
        let citySelect = document.getElementById('market-target-city');
        if (!citySelect) return;
        
        let cityId = citySelect.value;
        let price = MARKET.getCurrentPrice(itemKey);
        let availMarket = MARKET.getAvailablePool(itemKey);
        
        let itemVol = RECIPES.RESOURCES[itemKey].volume || 1.0;
        let logCostPerItem = typeof GEO !== 'undefined' ? GEO.getLogisticsCost('kyiv', cityId, itemVol, 'market') : 0;

        let maxByMoney = Math.floor(STATE.finances.balance / (price + logCostPerItem));
        
        let pendingVol = 0;
        if (STATE.logistics && STATE.logistics.deliveries) {
            STATE.logistics.deliveries.forEach(d => {
                if (d.targetCity === cityId && RECIPES.RESOURCES[d.item]) {
                    pendingVol += d.qty * (RECIPES.RESOURCES[d.item].volume || 1.0);
                }
            });
        }

        let freeSpace = WAREHOUSE.getMaxVolume(cityId) - WAREHOUSE.getCurrentVolume(cityId) - pendingVol;
        let maxBySpace = Math.floor(freeSpace / itemVol);

        let maxPossible = Math.min(availMarket, maxByMoney, maxBySpace);
        if (maxPossible < 0) maxPossible = 0;

        document.getElementById(`buy-qty-${itemKey}`).value = maxPossible;
    },

    submitBuy(itemKey) {
        let input = document.getElementById(`buy-qty-${itemKey}`);
        let citySelect = document.getElementById('market-target-city');
        
        if (input && citySelect) {
            let qty = parseInt(input.value);
            let cityId = citySelect.value;
            
            if (isNaN(qty) || qty <= 0) {
                NOTIFY.error('Ошибка', 'Введите корректное количество для покупки.');
                return;
            }
            if (typeof MARKET !== 'undefined') {
                MARKET.buy(itemKey, qty, cityId);
            }
        }
    }
,

    // --- 8. БАНК И КРЕДИТЫ ---
    updateBankTab() {
        if (typeof FINANCE === 'undefined') return;
        
        this.initCharts();
        let totalDebt = STATE.finances.loans ? STATE.finances.loans.reduce((sum, l) => sum + l.remainingPrincipal, 0) : 0;
        let availableLimit = FINANCE.getAvailableLimit() - totalDebt;

        if (typeof Chart !== 'undefined' && document.getElementById('chart-bank-credit')) {
            let ctx = document.getElementById('chart-bank-credit').getContext('2d');
            if (!this.charts.bankCredit) {
                this.charts.bankCredit = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Использовано (Долг)', 'Свободно'],
                        datasets: [{
                            data: [totalDebt, Math.max(0, availableLimit)],
                            backgroundColor: ['#ff3b30', '#34c759'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '75%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) { return '$' + formatMoney(context.parsed); }
                                }
                            }
                        }
                    }
                });
            } else {
                this.charts.bankCredit.data.datasets[0].data = [totalDebt, Math.max(0, availableLimit)];
                this.charts.bankCredit.update();
            }
        }
        
        if (document.getElementById('ui-rate')) document.getElementById('ui-rate').innerText = (FINANCE.getCurrentRate() * 100).toFixed(1);
        if (document.getElementById('ui-credit-limit')) document.getElementById('ui-credit-limit').innerText = formatMoney(FINANCE.getAvailableLimit());
        
        let assets = FINANCE.getAssetsBreakdown();
        if (document.getElementById('ui-col-fixed')) document.getElementById('ui-col-fixed').innerText = '$' + formatMoney(assets.fixedAssets * 0.70);
        if (document.getElementById('ui-col-inv')) document.getElementById('ui-col-inv').innerText = '$' + formatMoney(assets.inventoryValue * 0.50);
        
        let currentDebt = assets.totalLiabilities;
        let debtRatio = assets.netWorth > 0 ? (currentDebt / assets.netWorth) : (currentDebt > 0 ? 1 : 0);
        
        if (document.getElementById('ui-debt-ratio')) {
            let drEl = document.getElementById('ui-debt-ratio');
            drEl.innerText = debtRatio.toFixed(2);
            drEl.style.color = debtRatio > 1.0 ? 'var(--red)' : (debtRatio > 0.5 ? 'var(--orange)' : 'var(--text)');
        }
        
        let overdraftWarn = document.getElementById('ui-bank-overdraft-warning');
        if (overdraftWarn) {
            if (STATE.finances.balance < 0) {
                overdraftWarn.style.display = 'flex';
                let penalty = Math.abs(STATE.finances.balance) * 0.002;
                if (document.getElementById('ui-bank-overdraft-penalty')) {
                    document.getElementById('ui-bank-overdraft-penalty').innerText = '$' + formatMoney(penalty);
                }
            } else {
                overdraftWarn.style.display = 'none';
            }
        }
        
        let loansList = document.getElementById('ui-active-loans');
        if (loansList) {
            let totalDebt = STATE.finances.loans.reduce((sum, l) => sum + l.remainingPrincipal, 0);
            if(document.getElementById('ui-debt')) document.getElementById('ui-debt').innerText = formatMoney(totalDebt);
            
            loansList.innerHTML = '';
            if (STATE.finances.loans.length === 0) {
                loansList.innerHTML = '<div style="color:var(--text-faint); font-size:0.9rem; text-align:center; padding:20px; background:var(--surface-2); border-radius:12px; border:1px dashed var(--border);">Нет активных кредитов</div>';
            } else {
                STATE.finances.loans.forEach(l => {
                    let currentDailyInterest = (l.remainingPrincipal * l.rate) / 365;
                    let currentDailyPayment = l.dailyPrincipal + currentDailyInterest;
                    let totalInterestLeft = FINANCE.calculateTotalInterest(l.remainingPrincipal, l.rate, l.remainingDays);
                    
                    loansList.innerHTML += `
                    <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:700; font-size:1.05rem; color:var(--text);">Заём $${formatMoney(l.amount)}</div>
                            <div style="background:var(--orange-dim); color:var(--orange); padding:4px 8px; border-radius:8px; font-size:0.85rem; font-weight:700;">Осталось: ${l.remainingDays} дн.</div>
                        </div>
                        
                        <div style="display:flex; gap:16px; margin-bottom:12px;">
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Остаток Долга</div>
                                <div style="color:var(--red); font-weight:700; font-size:1rem;">$${formatMoney(l.remainingPrincipal)}</div>
                            </div>
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Ставка</div>
                                <div style="color:var(--text); font-weight:700; font-size:1rem;">${(l.rate*100).toFixed(1)}%</div>
                            </div>
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Переплата (Проценты)</div>
                                <div style="color:var(--red); font-weight:700; font-size:1rem;">$${formatMoney(totalInterestLeft)}</div>
                            </div>
                        </div>

                        <!-- Прогресс бар -->
                        <div style="height:6px; background:rgba(0,0,0,0.05); border-radius:3px; margin-bottom:16px; overflow:hidden;">
                            <div style="height:100%; background:var(--orange); width:${Math.max(0, 100 - (l.remainingPrincipal / l.amount) * 100)}%;"></div>
                        </div>

                        <div style="display:flex; gap:8px;">
                            <button onclick="UI_DASHBOARD.showBankModal('loan', ${l.id})" style="flex:1; background:var(--blue-dim); color:var(--blue); border:1px solid var(--blue); font-size:0.85rem; padding:8px; border-radius:8px; font-weight:600; cursor:pointer;">График платежей</button>
                            <button onclick="FINANCE.payOffLoan(${l.id})" style="flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text); font-size:0.85rem; padding:8px; border-radius:8px; font-weight:600; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='var(--surface-3)'" onmouseout="this.style.background='var(--surface)'">Погасить ($${formatMoney(l.remainingPrincipal + currentDailyInterest)})</button>
                        </div>
                    </div>`;
                });
            }
        }

        let depList = document.getElementById('ui-active-deposits');
        if (depList) {
            if (!STATE.finances.deposits) STATE.finances.deposits = [];
            
            let totalDeposits = STATE.finances.deposits.reduce((sum, d) => sum + d.amount, 0);
            if (document.getElementById('ui-total-deposits')) document.getElementById('ui-total-deposits').innerText = formatMoney(totalDeposits);

            depList.innerHTML = '';
            if (STATE.finances.deposits.length === 0) {
                depList.innerHTML = '<div style="color:var(--text-faint); font-size:0.9rem; text-align:center; padding:20px; background:var(--surface-2); border-radius:12px; border:1px dashed var(--border);">Нет открытых вкладов</div>';
            } else {
                STATE.finances.deposits.forEach(d => {
                    let payoutText = d.payoutType === 'daily' ? 'Ежедневно' : 'В конце';
                    let accText = d.payoutType === 'daily' ? 'выплачивается' : `$${formatMoney(d.accrued)}`;
                    let progress = Math.min(100, (1 - (d.daysLeft / d.termDays)) * 100);
                    
                    depList.innerHTML += `
                    <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:700; font-size:1.05rem; color:var(--text);">Вклад $${formatMoney(d.amount)}</div>
                            <div style="background:var(--blue-dim); color:var(--blue); padding:4px 8px; border-radius:8px; font-size:0.85rem; font-weight:700;">Осталось: ${d.daysLeft} дн.</div>
                        </div>
                        
                        <div style="display:flex; gap:16px; margin-bottom:12px;">
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Накоплено</div>
                                <div style="color:var(--green); font-weight:700; font-size:1rem;">${accText}</div>
                            </div>
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Ставка</div>
                                <div style="color:var(--text); font-weight:700; font-size:1rem;">${(d.rate*100).toFixed(1)}%</div>
                            </div>
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Тип выплаты</div>
                                <div style="color:var(--text); font-weight:700; font-size:0.85rem;">${payoutText}</div>
                            </div>
                        </div>

                        <!-- Прогресс бар -->
                        <div style="height:6px; background:rgba(0,0,0,0.05); border-radius:3px; margin-bottom:16px; overflow:hidden;">
                            <div style="height:100%; background:var(--blue); width:${progress}%;"></div>
                        </div>
                        
                        <button onclick="UI_DASHBOARD.showBankModal('deposit', ${d.id})" style="width:100%; background:var(--green-dim); color:var(--green); border:1px solid var(--green); font-size:0.85rem; padding:8px; border-radius:8px; font-weight:600; cursor:pointer;">График доходности</button>
                    </div>`;
                });
            }
        }
    },

    switchFinanceTab(tabId) {
        STATE.financeTab = tabId;
        this.updateFinanceTab();
    },

    // --- 9. ФИНАНСОВАЯ ОТЧЕТНОСТЬ (МСФО / IFRS / GAAP) ---
    updateFinanceTab() {
        let container = document.getElementById('ui-finance-dashboard');
        if (!container || typeof LEDGER === 'undefined') return;
        LEDGER.init();
        
        if (!STATE.financeTab) STATE.financeTab = 'all';

        // 1. Расчет активов (Balance Sheet - Assets)
        let cash = Math.max(0, STATE.finances.balance);
        let depositsValue = 0;
        if (STATE.finances.deposits) {
            STATE.finances.deposits.forEach(d => { depositsValue += d.amount + (d.accrued || 0); });
        }

        let inventoryValue = 0;
        if (STATE.company.warehouses) {
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.inventory) {
                    Object.keys(wh.inventory).forEach(k => {
                        inventoryValue += wh.inventory[k].qty * wh.inventory[k].avgCost;
                    });
                }
            });
        }
        STATE.company.businesses.forEach(b => {
            if (b.localInventory) {
                Object.keys(b.localInventory).forEach(k => {
                    inventoryValue += b.localInventory[k].qty * b.localInventory[k].avgCost;
                });
            }
        });

        let logisticsValue = 0;
        let receivablesValue = 0;
        if (STATE.logistics) {
            if (STATE.logistics.deliveries) {
                STATE.logistics.deliveries.forEach(d => { logisticsValue += d.cost; });
            }
            if (STATE.logistics.receivables) {
                STATE.logistics.receivables.forEach(r => { receivablesValue += r.amount; });
            }
        }

        let currentAssets = cash + inventoryValue + depositsValue + logisticsValue + receivablesValue;

        let realEstateValue = 0;
        let equipmentValue = 0;

        STATE.company.businesses.forEach(b => {
            let tpl = RECIPES.BUSINESSES[b.type];
            let locMult = b.locMult || 1.0;
            let baseCost = tpl.area * 50 * locMult;
            realEstateValue += baseCost;
            for (let i = 1; i < (b.level || 1); i++) realEstateValue += (tpl.area * 50 * i * locMult);

            if (b.equipment && b.equipment.count > 0) {
                let eqPrice = RECIPES.RESOURCES[tpl.equipmentType] ? RECIPES.RESOURCES[tpl.equipmentType].basePrice : 500;
                let cond = b.equipment.condition || 0;
                equipmentValue += (b.equipment.count * eqPrice) * (cond / 100);
            }
        });

        if (typeof WAREHOUSE !== 'undefined' && STATE.company.warehouses) {
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.level > 0) {
                    for (let i = 1; i < wh.level; i++) {
                        realEstateValue += WAREHOUSE.LEVELS[i].upgradeCost;
                    }
                }
            });
        }

        let rndIpValue = 0;
        if (STATE.rnd && STATE.rnd.facility) {
            let rndLvl = STATE.rnd.facility.level || 0;
            for (let i = 1; i <= rndLvl; i++) realEstateValue += i * 10000;
            if (STATE.rnd.facility.equipment && STATE.rnd.facility.equipment.count > 0) {
                let pcPrice = RECIPES.RESOURCES['smart_pc'] ? RECIPES.RESOURCES['smart_pc'].basePrice : 800;
                let rndCond = STATE.rnd.facility.equipment.condition || 0;
                equipmentValue += (STATE.rnd.facility.equipment.count * pcPrice) * (rndCond / 100);
            }
            if (STATE.rnd.unlockedTechs) {
                rndIpValue += STATE.rnd.unlockedTechs.length * 5000;
            }
        }

        let nonCurrentAssets = realEstateValue + equipmentValue + rndIpValue;
        let totalAssets = currentAssets + nonCurrentAssets;

        // Пассивы и Капитал
        let totalLiabilities = 0;
        if (STATE.finances.loans) {
            STATE.finances.loans.forEach(l => { totalLiabilities += l.remainingPrincipal; });
        }
        if (STATE.finances.balance < 0) totalLiabilities += Math.abs(STATE.finances.balance);

        let startCapital = STATE.finances.startCapital || 25000;
        let retainedEarnings = totalAssets - totalLiabilities - startCapital;
        let totalEquity = startCapital + retainedEarnings;

        // 2. Расчет P&L (Yesterday & Total)
        let y = STATE.ledger.yesterday || {};
        let t = STATE.ledger.total || {};

        let yRevB2C = y.rev_b2c || 0; let tRevB2C = t.rev_b2c || 0;
        let yRevB2B = y.rev_b2b || 0; let tRevB2B = t.rev_b2b || 0;
        let yRevB2G = y.rev_b2g || 0; let tRevB2G = t.rev_b2g || 0;
        let yRevOther = y.rev_other || 0; let tRevOther = t.rev_other || 0;

        let yRev = yRevB2B + yRevB2G + yRevB2C + yRevOther;
        let tRev = tRevB2B + tRevB2G + tRevB2C + tRevOther;

        let yCogs = y.exp_materials || 0;
        let tCogs = t.exp_materials || 0;

        let yGross = yRev - yCogs;
        let tGross = tRev - tCogs;

        let yTaxPayroll = y.exp_taxes_payroll || 0; let tTaxPayroll = t.exp_taxes_payroll || 0;
        let yTaxCorp = y.exp_taxes_corp || 0; let tTaxCorp = t.exp_taxes_corp || 0;
        let yExpMarketing = y.exp_marketing || 0; let tExpMarketing = t.exp_marketing || 0;
        let yExpLogistics = y.exp_logistics || 0; let tExpLogistics = t.exp_logistics || 0;
        let yExpRepair = y.exp_repair || 0; let tExpRepair = t.exp_repair || 0;
        let yExpFines = y.exp_fines || 0; let tExpFines = t.exp_fines || 0;

        let yOpex = (y.exp_salary || 0) + (y.exp_admin || 0) + (y.exp_hr || 0) + yTaxPayroll + yExpMarketing + yExpRepair + yExpFines;
        let tOpex = (t.exp_salary || 0) + (t.exp_admin || 0) + (t.exp_hr || 0) + tTaxPayroll + tExpMarketing + tExpRepair + tExpFines;

        let yEbitda = yGross - yOpex;
        let tEbitda = tGross - tOpex;

        let yDepr = Math.round(yExpRepair * 0.5);
        let tDepr = Math.round(tExpRepair * 0.5);

        let yEbit = yEbitda - yDepr;
        let tEbit = tEbitda - tDepr;

        let yFin = (y.fin_income || 0) - (y.fin_expense || 0) - (y.fin_fees || 0);
        let tFin = (t.fin_income || 0) - (t.fin_expense || 0) - (t.fin_fees || 0);

        let yEbt = yEbit + yFin;
        let tEbt = tEbit + tFin;

        let yNet = yEbt - yTaxCorp;
        let tNet = tEbt - tTaxCorp;

        // 3. Финансовые показатели
        let netMargin = tRev > 0 ? ((tNet / tRev) * 100).toFixed(1) : '0.0';
        let grossMargin = tRev > 0 ? ((tGross / tRev) * 100).toFixed(1) : '0.0';
        let ebitdaMargin = tRev > 0 ? ((tEbitda / tRev) * 100).toFixed(1) : '0.0';
        let roe = totalEquity > 0 ? ((tNet / totalEquity) * 100).toFixed(1) : '0.0';
        let roa = totalAssets > 0 ? ((tNet / totalAssets) * 100).toFixed(1) : '0.0';

        let currentLiabDiv = totalLiabilities > 0 ? totalLiabilities : 1;
        let currentRatio = (currentAssets / currentLiabDiv).toFixed(2);
        let debtEquityRatio = totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : '0.00';

        // 4. Налоговый календарь
        let taxInfoHTML = '';
        if (STATE.taxes) {
            let tb = STATE.taxes.taxableBase || 0;
            let dtr = STATE.taxes.daysToReport || 30;
            let corpRate = (typeof GEO !== 'undefined' && GEO.COUNTRIES['ua']) ? GEO.COUNTRIES['ua'].taxes.corporate : 0.18;
            let estimatedTax = tb > 0 ? tb * corpRate : 0;
            
            taxInfoHTML = `
                <div style="background: rgba(0,122,255,0.05); border: 1px solid rgba(0,122,255,0.15); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div style="color: var(--blue, #007AFF); font-weight: bold; font-size: 0.95em;">🏛 Налоговый календарь (Отчетный период ДФС)</div>
                        <small style="color: var(--text-dim, #86868B);">Дней до подачи декларации: <strong>${dtr} дн.</strong> | Налоговая база прибыли: <strong style="color:${tb >= 0 ? 'var(--green, #34C759)' : 'var(--red, #FF3B30)'};">$${formatMoney(tb)}</strong></small>
                    </div>
                    <div style="text-align: right; background: var(--surface, #fff); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border, #dcdde1);">
                        <small style="color: var(--text-dim, #86868B); display: block;">Резерв налога на прибыль (18%):</small>
                        <strong style="font-size: 1.15em; color: var(--red, #FF3B30); font-family: var(--font-mono);">$${formatMoney(estimatedTax)}</strong>
                    </div>
                </div>
            `;
        }

        // РАСЧЕТ CASH FLOW (Движение Денежных Средств)
        let cfo = yRev - yCogs - yOpex - yTaxCorp; // Поток от операционной деятельности
        let cfi = -(yExpRepair + (y.exp_materials || 0) * 0.1); // Поток от инвестиций
        let cff = yFin; // Поток от фин. операций
        let netCashFlow = cfo + cfi + cff;

        // Навигация под-вкладок отчетности
        let tabPnlActive = (STATE.financeTab === 'all' || STATE.financeTab === 'pnl') ? 'background: var(--blue, #007AFF); color: #fff;' : 'background: var(--surface-2, #f5f5f7); color: var(--text, #1d1d1f);';
        let tabBalActive = (STATE.financeTab === 'all' || STATE.financeTab === 'balance') ? 'background: var(--blue, #007AFF); color: #fff;' : 'background: var(--surface-2, #f5f5f7); color: var(--text, #1d1d1f);';
        let tabCfActive = (STATE.financeTab === 'all' || STATE.financeTab === 'cashflow') ? 'background: var(--blue, #007AFF); color: #fff;' : 'background: var(--surface-2, #f5f5f7); color: var(--text, #1d1d1f);';
        let tabRatActive = (STATE.financeTab === 'all' || STATE.financeTab === 'ratios') ? 'background: var(--blue, #007AFF); color: #fff;' : 'background: var(--surface-2, #f5f5f7); color: var(--text, #1d1d1f);';

        container.innerHTML = `
            <!-- ВЕРХНЯЯ KPI ПАНЕЛЬ ФИНАНСОВОГО ЗДОРОВЬЯ -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px;">
                <div class="card" style="padding: 14px; margin-bottom: 0; border-left: 4px solid var(--green, #34C759);">
                    <small style="color: var(--text-dim); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em;">Чистая прибыль (Кумулятивно)</small>
                    <div style="font-size: 1.35rem; font-weight: bold; color: ${tNet >= 0 ? 'var(--green, #34C759)' : 'var(--red, #FF3B30)'}; margin-top: 4px; font-family: var(--font-mono);">$${formatMoney(tNet)}</div>
                    <small style="color: var(--text-dim);">Рентабельность (ROS): <strong style="color:var(--text);">${netMargin}%</strong></small>
                </div>

                <div class="card" style="padding: 14px; margin-bottom: 0; border-left: 4px solid var(--blue, #007AFF);">
                    <small style="color: var(--text-dim); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em;">EBITDA (Операционная прибыль)</small>
                    <div style="font-size: 1.35rem; font-weight: bold; color: ${tEbitda >= 0 ? 'var(--blue, #007AFF)' : 'var(--red, #FF3B30)'}; margin-top: 4px; font-family: var(--font-mono);">$${formatMoney(tEbitda)}</div>
                    <small style="color: var(--text-dim);">EBITDA Margin: <strong style="color:var(--text);">${ebitdaMargin}%</strong></small>
                </div>

                <div class="card" style="padding: 14px; margin-bottom: 0; border-left: 4px solid var(--orange, #FF9500);">
                    <small style="color: var(--text-dim); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em;">Ликвидность (Current Ratio)</small>
                    <div style="font-size: 1.35rem; font-weight: bold; color: ${currentRatio >= 1.2 ? 'var(--green, #34C759)' : 'var(--red, #FF3B30)'}; margin-top: 4px; font-family: var(--font-mono);">${currentRatio}x</div>
                    <small style="color: var(--text-dim);">Норма: ≥ 1.50 (Покрытие долга)</small>
                </div>

                <div class="card" style="padding: 14px; margin-bottom: 0; border-left: 4px solid #8e44ad;">
                    <small style="color: var(--text-dim); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em;">Капитализация (Net Worth)</small>
                    <div style="font-size: 1.35rem; font-weight: bold; color: var(--text); margin-top: 4px; font-family: var(--font-mono);">$${formatMoney(totalEquity)}</div>
                    <small style="color: var(--text-dim);">ROE: <strong style="color:var(--text);">${roe}%</strong> | ROA: <strong style="color:var(--text);">${roa}%</strong></small>
                </div>
            </div>

            ${taxInfoHTML}

            <!-- ПЕРЕКЛЮЧАТЕЛЬ ОТЧЕТОВ -->
            <div style="display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap;">
                <button onclick="UI_DASHBOARD.switchFinanceTab('all')" style="padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.85em; font-weight: bold; cursor: pointer; ${STATE.financeTab === 'all' ? 'background: var(--blue); color:#fff;' : 'background:var(--surface); color:var(--text);'}">📋 Все отчеты (Сводный вид)</button>
                <button onclick="UI_DASHBOARD.switchFinanceTab('pnl')" style="padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.85em; font-weight: bold; cursor: pointer; ${STATE.financeTab === 'pnl' ? 'background: var(--blue); color:#fff;' : 'background:var(--surface); color:var(--text);'}">📊 Прибыли и Убытки (P&L)</button>
                <button onclick="UI_DASHBOARD.switchFinanceTab('balance')" style="padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.85em; font-weight: bold; cursor: pointer; ${STATE.financeTab === 'balance' ? 'background: var(--blue); color:#fff;' : 'background:var(--surface); color:var(--text);'}">⚖️ Баланс (Balance Sheet)</button>
                <button onclick="UI_DASHBOARD.switchFinanceTab('cashflow')" style="padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.85em; font-weight: bold; cursor: pointer; ${STATE.financeTab === 'cashflow' ? 'background: var(--blue); color:#fff;' : 'background:var(--surface); color:var(--text);'}">🌊 Движение средств (Cash Flow)</button>
                <button onclick="UI_DASHBOARD.switchFinanceTab('ratios')" style="padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.85em; font-weight: bold; cursor: pointer; ${STATE.financeTab === 'ratios' ? 'background: var(--blue); color:#fff;' : 'background:var(--surface); color:var(--text);'}">📈 Финансовые коэффициенты</button>
            </div>

            <!-- ГРИД ОСНОВНЫХ ОТЧЕТОВ -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 20px;">

                <!-- 1. ОТЧЕТ О ПРИБЫЛЯХ И УБЫТКАХ (P&L) -->
                ${(STATE.financeTab === 'all' || STATE.financeTab === 'pnl') ? `
                <div class="card" style="padding: 20px; margin-bottom: 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 14px;">
                        <div>
                            <h3 style="margin:0; font-size: 1.15rem; color: var(--text);">📊 Отчет о прибылях и убытках (P&L)</h3>
                            <small style="color: var(--text-dim);">Стандарт МСФО (IAS 1) • Метод начисления</small>
                        </div>
                    </div>
                    
                    <table style="width:100%; font-size:0.86rem; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-dim); text-align: right;">
                            <th style="text-align:left; padding: 6px 0;">Статья отчета</th>
                            <th style="padding: 6px;">Вчера</th>
                            <th style="padding: 6px;">Всего</th>
                        </tr>
                        
                        <tr style="font-weight:bold; background: var(--surface-2);"><td style="text-align:left; padding:6px 4px;">1. ВЫРУЧКА (REVENUE)</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yRev)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tRev)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- B2C Розничные продажи</td><td style="text-align:right; color:var(--blue); font-family:var(--font-mono);">$${formatMoney(yRevB2C)}</td><td style="text-align:right; color:var(--blue); font-family:var(--font-mono);">$${formatMoney(tRevB2C)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- B2B Оптовая биржа</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yRevB2B)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tRevB2B)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- B2G Госзакупки и Тендеры</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(yRevB2G)}</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(tRevB2G)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Прочие доходы (Гранты)</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yRevOther)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tRevOther)}</td></tr>
                        
                        <tr style="border-top:1px dashed var(--border);"><td style="text-align:left; padding:4px 0; color:var(--red); font-weight:600;">2. Себестоимость (Сырье + Логистика)</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(yCogs)}</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(tCogs)}</td></tr>
                        
                        <tr style="font-weight:bold; background: rgba(52,199,89,0.06); border-top:1px solid var(--border);"><td style="text-align:left; padding:6px 4px; color:var(--green);">ВАЛОВАЯ ПРИБЫЛЬ (GROSS PROFIT)</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(yGross)}</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(tGross)}</td></tr>
                        
                        <tr style="font-weight:bold; background: var(--surface-2); border-top:1px solid var(--border);"><td style="text-align:left; padding:6px 4px;">3. ОПЕРАЦИОННЫЕ РАСХОДЫ (OPEX)</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(yOpex)}</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(tOpex)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Фонд оплаты труда (ЗП)</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(y.exp_salary || 0)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(t.exp_salary || 0)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Социальный взнос ЕСВ (22%)</td><td style="text-align:right; color:var(--orange); font-family:var(--font-mono);">$${formatMoney(yTaxPayroll)}</td><td style="text-align:right; color:var(--orange); font-family:var(--font-mono);">$${formatMoney(tTaxPayroll)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Аренда недвижимости</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(y.exp_admin || 0)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(t.exp_admin || 0)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Маркетинг и бренд</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yExpMarketing)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tExpMarketing)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- ТО и ремонт оборудования</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yExpRepair)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tExpRepair)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Штрафы и непредвиденные</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yExpFines)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tExpFines)}</td></tr>
                        
                        <tr style="font-weight:bold; border-top:1px solid var(--border); background: var(--surface-3);"><td style="text-align:left; padding:6px 4px;">4. EBITDA</td><td style="text-align:right; font-family:var(--font-mono); color:${yEbitda>=0?'var(--green)':'var(--red)'};">$${formatMoney(yEbitda)}</td><td style="text-align:right; font-family:var(--font-mono); color:${tEbitda>=0?'var(--green)':'var(--red)'};">$${formatMoney(tEbitda)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Амортизация станков (D&A)</td><td style="text-align:right; font-family:var(--font-mono);">-$${formatMoney(yDepr)}</td><td style="text-align:right; font-family:var(--font-mono);">-$${formatMoney(tDepr)}</td></tr>
                        
                        <tr style="font-weight:bold;"><td style="text-align:left; padding:4px 0;">5. ОПЕРАЦИОННАЯ ПРИБЫЛЬ (EBIT)</td><td style="text-align:right; font-family:var(--font-mono); color:${yEbit>=0?'var(--green)':'var(--red)'};">$${formatMoney(yEbit)}</td><td style="text-align:right; font-family:var(--font-mono); color:${tEbit>=0?'var(--green)':'var(--red)'};">$${formatMoney(tEbit)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">+/- Финансовые доходы/расходы</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yFin)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tFin)}</td></tr>
                        
                        <tr style="font-weight:bold; border-top:1px solid var(--border);"><td style="text-align:left; padding:4px 0;">6. ПРИБЫЛЬ ДО НАЛОГОВ (EBT)</td><td style="text-align:right; font-family:var(--font-mono); color:${yEbt>=0?'var(--green)':'var(--red)'};">$${formatMoney(yEbt)}</td><td style="text-align:right; font-family:var(--font-mono); color:${tEbt>=0?'var(--green)':'var(--red)'};">$${formatMoney(tEbt)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--red);">- Налог на прибыль (18%)</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(yTaxCorp)}</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(tTaxCorp)}</td></tr>
                        
                        <tr style="font-weight:bold; font-size:1.05rem; background: rgba(0,122,255,0.08); border-top: 2px solid var(--blue);"><td style="text-align:left; padding:8px 4px; color:var(--blue);">7. ЧИСТАЯ ПРИБЫЛЬ (NET INCOME)</td><td style="text-align:right; font-family:var(--font-mono); color:${yNet>=0?'var(--green)':'var(--red)'};">$${formatMoney(yNet)}</td><td style="text-align:right; font-family:var(--font-mono); color:${tNet>=0?'var(--green)':'var(--red)'};">$${formatMoney(tNet)}</td></tr>
                    </table>
                </div>
                ` : ''}

                <!-- 2. БАЛАНСОВЫЙ ОТЧЕТ (BALANCE SHEET) -->
                ${(STATE.financeTab === 'all' || STATE.financeTab === 'balance') ? `
                <div class="card" style="padding: 20px; margin-bottom: 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 14px;">
                        <div>
                            <h3 style="margin:0; font-size: 1.15rem; color: var(--text);">⚖️ Отчет о финансовом положении (Баланс)</h3>
                            <small style="color: var(--text-dim);">Стандарт МСФО (IAS 1) • Активы = Пассивы + Капитал</small>
                        </div>
                    </div>
                    
                    <table style="width:100%; font-size:0.86rem; border-collapse: collapse;">
                        <tr style="background: var(--surface-2); font-weight:bold;"><th colspan="2" style="padding:6px; text-align:left; color:var(--blue);">I. ОБОРОТНЫЕ АКТИВЫ (CURRENT ASSETS)</th></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Денежные средства на расчетном счете:</td><td style="text-align:right; font-family:var(--font-mono); font-weight:600;">$${formatMoney(cash)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Запасы сырья и товаров (Склады и Магазины):</td><td style="text-align:right; color:var(--blue); font-family:var(--font-mono);">$${formatMoney(inventoryValue)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Товары в пути (Оплаченная логистика):</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(logisticsValue)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Дебиторская задолженность (Выручка в пути):</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(receivablesValue)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Банковские депозиты (Краткосрочные):</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(depositsValue)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px dashed var(--border);"><td style="padding:4px 0;">Итого Оборотные активы:</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(currentAssets)}</td></tr>
                        
                        <tr style="background: var(--surface-2); font-weight:bold;"><th colspan="2" style="padding:6px; text-align:left; color:var(--blue);">II. ВНЕОБОРОТНЫЕ АКТИВЫ (NON-CURRENT ASSETS)</th></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Основные средства: Недвижимость (Цеха, Магазины, Склады):</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(realEstateValue)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Машины и оборудование (Остаточная стоимость):</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(equipmentValue)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Нематериальные активы (Патенты и R&D разработки):</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(rndIpValue)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px dashed var(--border);"><td style="padding:4px 0;">Итого Внеоборотные активы:</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(nonCurrentAssets)}</td></tr>
                        
                        <tr style="font-weight:bold; font-size:1.02rem; background: rgba(52,199,89,0.08); border-top:2px solid var(--green);"><td style="padding:6px 0; color:var(--green);">ИТОГО АКТИВОВ:</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(totalAssets)}</td></tr>
                        
                        <tr><td colspan="2" style="padding:6px 0;">&nbsp;</td></tr>
                        
                        <tr style="background: var(--surface-2); font-weight:bold;"><th colspan="2" style="padding:6px; text-align:left; color:var(--red);">III. ОБЯЗАТЕЛЬСТВА (LIABILITIES)</th></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Краткосрочные кредиты и займы банка:</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">$${formatMoney(totalLiabilities)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px dashed var(--border);"><td style="padding:4px 0;">Итого Обязательства:</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">$${formatMoney(totalLiabilities)}</td></tr>
                        
                        <tr style="background: var(--surface-2); font-weight:bold;"><th colspan="2" style="padding:6px; text-align:left; color:var(--blue);">IV. СОБСТВЕННЫЙ КАПИТАЛ (EQUITY)</th></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Уставный капитал:</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(startCapital)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">Нераспределенная прибыль (Retained Earnings):</td><td style="text-align:right; font-family:var(--font-mono); color:${retainedEarnings>=0?'var(--green)':'var(--red)'};">$${formatMoney(retainedEarnings)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px dashed var(--border);"><td style="padding:4px 0;">Итого Капитал:</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(totalEquity)}</td></tr>
                        
                        <tr style="font-weight:bold; font-size:1.02rem; background: rgba(0,122,255,0.08); border-top:2px solid var(--blue);"><td style="padding:6px 0; color:var(--blue);">ИТОГО ПАССИВОВ И КАПИТАЛА:</td><td style="text-align:right; color:var(--blue); font-family:var(--font-mono);">$${formatMoney(totalLiabilities + totalEquity)}</td></tr>
                    </table>
                </div>
                ` : ''}

                <!-- 3. ДВИЖЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ (CASH FLOW) -->
                ${(STATE.financeTab === 'all' || STATE.financeTab === 'cashflow') ? `
                <div class="card" style="padding: 20px; margin-bottom: 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 14px;">
                        <div>
                            <h3 style="margin:0; font-size: 1.15rem; color: var(--text);">🌊 Отчет о движении денежных средств (Cash Flow)</h3>
                            <small style="color: var(--text-dim);">Стандарт МСФО (IAS 7) • Прямой метод</small>
                        </div>
                    </div>
                    
                    <table style="width:100%; font-size:0.86rem; border-collapse: collapse;">
                        <tr style="font-weight:bold; background: var(--surface-2);"><th colspan="2" style="padding:6px; text-align:left;">1. ОПЕРАЦИОННЫЙ ПОТОК (CFO)</th></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">+ Поступления от продаж (B2C, B2B, B2G):</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(yRev)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">- Оплата сырья и поставщиков:</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(yCogs)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">- Выплата заработной платы и налогов на ФОТ:</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney((y.exp_salary || 0) + yTaxPayroll)}</td></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">- Оплата аренды, логистики и маркетинга:</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney((y.exp_admin || 0) + yExpLogistics + yExpMarketing)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px dashed var(--border);"><td style="padding:4px 0;">Чистый операционный поток (CFO):</td><td style="text-align:right; font-family:var(--font-mono); color:${cfo>=0?'var(--green)':'var(--red)'};">$${formatMoney(cfo)}</td></tr>
                        
                        <tr style="font-weight:bold; background: var(--surface-2);"><th colspan="2" style="padding:6px; text-align:left;">2. ИНВЕСТИЦИОННЫЙ ПОТОК (CFI)</th></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">- Приобретение оборудования и ремонт станков:</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(yExpRepair)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px dashed var(--border);"><td style="padding:4px 0;">Чистый инвестиционный поток (CFI):</td><td style="text-align:right; font-family:var(--font-mono); color:${cfi>=0?'var(--green)':'var(--red)'};">$${formatMoney(cfi)}</td></tr>
                        
                        <tr style="font-weight:bold; background: var(--surface-2);"><th colspan="2" style="padding:6px; text-align:left;">3. ФИНАНСОВЫЙ ПОТОК (CFF)</th></tr>
                        <tr><td style="padding:4px 0 4px 12px; color:var(--text-dim);">+/- Проценты и операции по вкладам/кредитам:</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(cff)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px dashed var(--border);"><td style="padding:4px 0;">Чистый финансовый поток (CFF):</td><td style="text-align:right; font-family:var(--font-mono); color:${cff>=0?'var(--green)':'var(--red)'};">$${formatMoney(cff)}</td></tr>
                        
                        <tr style="font-weight:bold; font-size:1.02rem; background: rgba(0,122,255,0.08); border-top:2px solid var(--blue);"><td style="padding:6px 0; color:var(--blue);">ЧИСТОЕ ИЗМЕНЕНИЕ ДЕНЕГ (NET CASH FLOW):</td><td style="text-align:right; color:${netCashFlow>=0?'var(--green)':'var(--red)'}; font-family:var(--font-mono);">$${formatMoney(netCashFlow)}</td></tr>
                    </table>
                </div>
                ` : ''}

                <!-- 4. ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ И РЕНТАБЕЛЬНОСТЬ -->
                ${(STATE.financeTab === 'all' || STATE.financeTab === 'ratios') ? `
                <div class="card" style="padding: 20px; margin-bottom: 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 14px;">
                        <div>
                            <h3 style="margin:0; font-size: 1.15rem; color: var(--text);">📈 Финансовый анализ и Коэффициенты</h3>
                            <small style="color: var(--text-dim);">Международные бенчмарки корпоративной устойчивости</small>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px;">
                            <small style="color: var(--text-dim);">Рентабельность продаж (ROS)</small>
                            <div style="font-size: 1.25rem; font-weight: bold; color: var(--blue); font-family: var(--font-mono);">${netMargin}%</div>
                            <small style="color: var(--text-dim);">Чистая прибыль / Выручка</small>
                        </div>

                        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px;">
                            <small style="color: var(--text-dim);">Валовая маржинальность (Gross Margin)</small>
                            <div style="font-size: 1.25rem; font-weight: bold; color: var(--green); font-family: var(--font-mono);">${grossMargin}%</div>
                            <small style="color: var(--text-dim);">Валовая прибыль / Выручка</small>
                        </div>

                        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px;">
                            <small style="color: var(--text-dim);">Рентабельность капитала (ROE)</small>
                            <div style="font-size: 1.25rem; font-weight: bold; color: #8e44ad; font-family: var(--font-mono);">${roe}%</div>
                            <small style="color: var(--text-dim);">Прибыль / Собственный капитал</small>
                        </div>

                        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px;">
                            <small style="color: var(--text-dim);">Рентабельность активов (ROA)</small>
                            <div style="font-size: 1.25rem; font-weight: bold; color: var(--orange); font-family: var(--font-mono);">${roa}%</div>
                            <small style="color: var(--text-dim);">Прибыль / Все активы</small>
                        </div>

                        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px;">
                            <small style="color: var(--text-dim);">Коэффициент автономии (Debt/Equity)</small>
                            <div style="font-size: 1.25rem; font-weight: bold; color: var(--text); font-family: var(--font-mono);">${debtEquityRatio}x</div>
                            <small style="color: var(--text-dim);">Обязательства / Капитал (Норма: <1.0)</small>
                        </div>

                        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px;">
                            <small style="color: var(--text-dim);">Коэффициент ликвидности</small>
                            <div style="font-size: 1.25rem; font-weight: bold; color: ${currentRatio>=1.2?'var(--green)':'var(--red)'}; font-family: var(--font-mono);">${currentRatio}x</div>
                            <small style="color: var(--text-dim);">Оборотные активы / Обязательства</small>
                        </div>
                    </div>
                </div>
                ` : ''}

            </div>
        `;
    },

    // --- 7. HR И КАДРЫ ---
    updateHRTab() {
        if (typeof HR === 'undefined' || !document.getElementById('ui-staff-total')) return;
        HR.init();
        
        let totalStaff = HR.getTotalStaff();
        document.getElementById('ui-staff-total').innerText = totalStaff;
        if(document.getElementById('ui-staff-salary')) document.getElementById('ui-staff-salary').innerText = '$' + formatMoney(HR.getDailySalaryFund()) + ' / дн.';
        
        // --- ЧАРТ СТРУКТУРЫ ШТАТА ---
        this.initCharts();
        let roleCounts = { factory: 0, rnd: 0, retail: 0, marketing: 0 };
        Object.keys(HR.GRADES).forEach(grade => {
            let role = HR.GRADES[grade].role;
            let count = STATE.hr && STATE.hr.staff ? (STATE.hr.staff[grade] || 0) : 0;
            if (roleCounts[role] !== undefined) roleCounts[role] += count;
        });

        if (typeof Chart !== 'undefined' && document.getElementById('chart-hr-staff')) {
            let ctx = document.getElementById('chart-hr-staff').getContext('2d');
            let dataArr = [roleCounts.factory, roleCounts.rnd, roleCounts.retail, roleCounts.marketing];
            
            if (!this.charts.hrStaff) {
                this.charts.hrStaff = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Производство', 'R&D', 'Ритейл', 'Маркетинг'],
                        datasets: [{
                            data: dataArr,
                            backgroundColor: ['#3498db', '#9b59b6', '#2ecc71', '#e67e22'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '75%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) { return context.label + ': ' + context.parsed + ' чел.'; }
                                }
                            }
                        }
                    }
                });
            } else {
                this.charts.hrStaff.data.datasets[0].data = dataArr;
                this.charts.hrStaff.update();
            }
        }

        // Брейкдаун легенды
        let breakdownDiv = document.getElementById('ui-hr-breakdown');
        if (breakdownDiv) {
            let parts = [];
            if (roleCounts.factory > 0) parts.push(`<span style="background:rgba(52,152,219,0.1); color:#3498db; padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:700;">Производство: ${roleCounts.factory}</span>`);
            if (roleCounts.rnd > 0) parts.push(`<span style="background:rgba(155,89,182,0.1); color:#9b59b6; padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:700;">R&D: ${roleCounts.rnd}</span>`);
            if (roleCounts.retail > 0) parts.push(`<span style="background:rgba(46,204,113,0.1); color:#2ecc71; padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:700;">Ритейл: ${roleCounts.retail}</span>`);
            if (roleCounts.marketing > 0) parts.push(`<span style="background:rgba(230,126,34,0.1); color:#e67e22; padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:700;">Маркетинг: ${roleCounts.marketing}</span>`);
            if (STATE.hr.trainingQueue.length > 0) parts.push(`<span style="background:var(--orange-dim); color:var(--orange); padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:700;">В Академии: ${STATE.hr.trainingQueue.length}</span>`);
            
            breakdownDiv.innerHTML = parts.length > 0 ? parts.join('') : '<span style="color:var(--text-faint); font-size:0.9rem;">Штат пуст</span>';
        }

        // --- ДЕПАРТАМЕНТЫ (НАЙМ) ---
        let uiRoles = {
            'factory': document.getElementById('ui-hire-factory'),
            'rnd': document.getElementById('ui-hire-rnd'),
            'retail': document.getElementById('ui-hire-retail'),
            'marketing': document.getElementById('ui-hire-marketing')
        };
        
        Object.keys(uiRoles).forEach(k => { if (uiRoles[k]) uiRoles[k].innerHTML = ''; });
        
        Object.keys(HR.GRADES).forEach(grade => {
            let info = HR.GRADES[grade];
            let container = uiRoles[info.role];
            if (!container) return;
            
            let btnHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:12px 16px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-card);">
                <div>
                    <div style="font-weight:700; color:var(--text); font-size:0.95rem;">${info.name}</div>
                    <div style="font-size:0.9rem; color:var(--text-dim);">ЗП: <span style="color:var(--text); font-weight:600;">$${formatMoney(info.salary)}/дн</span></div>
                </div>
                <button onclick="HR.hire('${grade}')" class="btn-primary-lg" style="background:var(--blue); color:white; border:none; padding:8px 16px; border-radius:10px; font-weight:700; font-size:0.85rem; cursor:pointer;">
                    Найм ($${formatMoney(info.hireCost)})
                </button>
            </div>`;
            container.innerHTML += btnHtml;
        });
        
        // --- АКАДЕМИЯ ---
        let trainingDiv = document.getElementById('ui-hr-training-list');
        if (document.getElementById('ui-training-count')) document.getElementById('ui-training-count').innerText = `Обучается: ${STATE.hr.trainingQueue.length}`;
        
        if (trainingDiv) {
            if (STATE.hr.trainingQueue.length === 0) {
                trainingDiv.innerHTML = '<div style="color:var(--text-faint); font-size:0.9rem; text-align:center; padding:20px; background:var(--surface-2); border-radius:12px; border:1px dashed var(--border);">В данный момент никто не проходит обучение.</div>';
            } else {
                let tHtml = '';
                STATE.hr.trainingQueue.forEach(t => {
                    let nextName = HR.GRADES[t.toGrade].name.split(' ')[0];
                    let progress = Math.min(100, Math.max(0, 100 - (t.daysLeft * 10))); // approximate for visual
                    tHtml += `
                    <div style="background:var(--surface-2); padding:12px 16px; border-radius:12px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div>
                                <span style="font-weight:700; color:var(--text); font-size:0.9rem;">Повышение ➔ ${nextName}</span>
                                <div style="font-size:0.85rem; color:var(--text-dim);">Стипендия: $${t.salary}/дн</div>
                            </div>
                            <div style="background:var(--orange-dim); color:var(--orange); font-weight:bold; padding:4px 8px; border-radius:8px; font-size:0.9rem;">
                                ${t.daysLeft} дн.
                            </div>
                        </div>
                        <div style="height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
                            <div style="height:100%; background:var(--orange); width:${progress}%;"></div>
                        </div>
                    </div>`;
                });
                trainingDiv.innerHTML = tHtml;
            }
        }

        // --- КАДРОВЫЙ РЕЗЕРВ ---
        let reserveContainer = document.getElementById('ui-hr-reserve-table');
        if (reserveContainer) {
            let html = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">`;
            Object.keys(HR.GRADES).forEach(grade => {
                let free = HR.getUnassigned(grade);
                let info = HR.GRADES[grade];
                
                // New logic based on hr.js
                let trainCost = grade === 'junior' ? 250 : (grade === 'middle' ? 800 : (grade === 'scientist' ? 1500 : (grade === 'salesman' ? 600 : (grade === 'marketer' ? 1200 : null))));
                let nextGradeName = grade === 'junior' ? 'Middle' : (grade === 'middle' ? 'Senior' : (grade === 'scientist' ? 'Lead' : (grade === 'salesman' ? 'Director' : (grade === 'marketer' ? 'PR' : ''))));
                
                let trainBtn = '';
                if (trainCost) {
                    trainBtn = `<button onclick="HR.train('${grade}')" ${free===0?'disabled style="opacity:0.4; cursor:not-allowed;"':''} style="background:var(--blue); color:white; border:none; padding:8px 12px; border-radius:8px; font-size:0.85rem; font-weight:700; cursor:pointer; width:100%;">Обучить до ${nextGradeName} ($${trainCost})</button>`;
                } else {
                    trainBtn = `<button disabled style="opacity:0.3; cursor:not-allowed; background:var(--text-dim); color:white; border:none; padding:8px 12px; border-radius:8px; font-size:0.85rem; font-weight:700; width:100%;">Максимальная квал.</button>`;
                }

                html += `
                <div style="background:var(--surface-2); padding:16px; border:1px solid var(--border); border-radius:12px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div>
                            <div style="font-weight:800; color:var(--text); font-size:1rem; margin-bottom:4px;">${info.name}</div>
                            <div style="font-size:0.9rem; color:var(--text-dim); background:var(--surface-3); display:inline-block; padding:2px 6px; border-radius:6px;">Отдел: ${info.role}</div>
                        </div>
                        <div style="font-size:1.4rem; font-weight:800; color:${free > 0 ? 'var(--blue)' : 'var(--text-dim)'};">${free}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <div style="flex:1;">${trainBtn}</div>
                        <button onclick="HR.fire('${grade}')" ${free===0?'disabled style="opacity:0.4; cursor:not-allowed;"':''} style="background:var(--red-dim); color:var(--red); border:none; padding:8px 12px; border-radius:8px; font-size:0.85rem; font-weight:700; cursor:pointer;">Уволить</button>
                    </div>
                </div>`;
            });
            html += `</div>`;
            reserveContainer.innerHTML = html;
        }
    },
    
    // --- СЛУЖЕБНЫЕ МЕТОДЫ ОШИБОК И ФОРМ ---
    clearError() {
        let errDiv = document.getElementById('debug-error');
        if (errDiv) errDiv.style.display = 'none';
    },

    showError(err) {
        let errDiv = document.getElementById('debug-error');
        if (!errDiv) {
            errDiv = document.createElement('div');
            errDiv.id = 'debug-error';
            errDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:#c0392b; color:white; padding:20px; z-index:9999; box-shadow: 0 5px 15px rgba(0,0,0,0.5);';
            document.body.prepend(errDiv);
        }
        errDiv.innerHTML = `
            <h3 style="margin-top:0;">⚠️ КРИТИЧЕСКАЯ ОШИБКА ИНТЕРФЕЙСА</h3>
            <p><strong>Суть ошибки:</strong> ${err.message}</p>
            <button onclick="document.getElementById('debug-error').style.display='none'" style="background:#333; padding: 5px 10px; color: white;">Закрыть это окно</button>
        `;
        console.error(err);
    },

    switchTab(event, tabId) {
        try {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            let targetEl = document.getElementById(tabId);
            if (targetEl) targetEl.classList.add('active');
            if (event && event.currentTarget) event.currentTarget.classList.add('active');
            
            if (tabId === 'tab-wiki') {
                if (typeof WIKI !== 'undefined') WIKI.render();
                else alert("WIKI is undefined!");
            }
            if (tabId === 'tab-finance') this.updateFinanceTab();
            if (tabId === 'tab-b2b') this.updateB2BTab();
        } catch (e) {
            alert("Crash in switchTab (" + tabId + "):\n" + e.message);
            console.error(e);
        }
    },

    submitLoan() {
        let amountInput = document.getElementById('input-loan-amount');
        let termInput = document.getElementById('select-loan-term');
        let amount = parseFloat(amountInput.value);
        let term = parseInt(termInput.value);
        if (isNaN(amount) || amount <= 0) {
            NOTIFY.error('Ошибка', 'Пожалуйста, введите корректную сумму кредита.');
            return;
        }
        FINANCE.takeLoan(amount, term);
        amountInput.value = ''; 
    },

    submitDeposit() {
        let amountInput = document.getElementById('input-dep-amount');
        let termInput = document.getElementById('select-dep-term');
        let typeInput = document.getElementById('select-dep-type');
        let amount = parseFloat(amountInput.value);
        let term = parseInt(termInput.value);
        let payoutType = typeInput.value;
        if (isNaN(amount) || amount <= 0) {
            NOTIFY.error('Ошибка', 'Пожалуйста, введите корректную сумму депозита.');
            return;
        }
        FINANCE.openDeposit(amount, term, payoutType);
        amountInput.value = ''; 
    },

    setFactoryWarehouses(uid) {
        let biz = STATE.company.businesses.find(b => b.uid === uid);
        if (biz) {
            let sWh = document.getElementById(`source-wh-${uid}`);
            let tWh = document.getElementById(`target-wh-${uid}`);
            if (sWh) biz.sourceWh = sWh.value;
            if (tWh) biz.targetWh = tWh.value;
            this.update();
        }
    },
    
    // Сохранение процентов логистики
    saveRoutes(bizUid, destsStr) {
        let dests = destsStr ? destsStr.split(',') : [];
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (!biz) return;
        
        let newRoutes = {};
        dests.forEach(d => {
            let val = parseInt(document.getElementById(`route-${bizUid}-${d}`).value) || 0;
            if (val > 0) newRoutes[d] = val; // Сохраняем абсолютные значения в штуках
        });
        
        biz.routing = newRoutes;
        NOTIFY.success('Успех', 'Квоты отгрузки (в шт.) успешно обновлены!');
        this.update();
    },

    // Сохранение цели рекламной кампании (Бренд, Магазин или Товар)
    setMarketingTarget(bizUid) {
        let select = document.getElementById(`marketing-target-${bizUid}`);
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (biz && select) {
            let parts = select.value.split('_'); // 'brand_global', 'store_12345', 'product_drones'
            biz.targetType = parts[0];
            biz.targetId = parts.slice(1).join('_');
            this.update();
        }
    },
    
    // Окно выбора города
    showLocationModal(bizType) {
        this.showCityModal('business', bizType);
    },

    // --- 10. РОЗНИЦА ---
    updateRetailTab() {
        let retailBody = document.getElementById('ui-retail-businesses');
        if (!retailBody) return;
        
        if (!STATE.retail) STATE.retail = { prices: {}, brand: 10, history: [] };
        
        let hasRetail = false;
        let activeStoresHtml = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">';

        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl.isRetail) return;
            hasRetail = true;
            
            let level = biz.level || 1;
            let cityId = biz.city || 'odesa';
            let cityData = typeof GEO !== 'undefined' ? GEO.getCity(cityId) : { name: cityId, rentMult: 1.0, salaryMult: 1.0 };
            
            let totalSold = 0;
            let totalRev = 0;

            if (biz.localInventory) {
                Object.keys(biz.localInventory).forEach(k => {
                    let soldYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].qty : 0;
                    let revYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].revenue : 0;
                    totalSold += soldYesterday;
                    totalRev += revYesterday;
                });
            }

            activeStoresHtml += `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px 20px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer; transition:all 0.2s; box-shadow:var(--shadow-card);" 
                 onclick="UI_DASHBOARD.showStoreModal(${biz.uid})" 
                 onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 15px rgba(0,0,0,0.1)'" 
                 onmouseout="this.style.transform=''; this.style.boxShadow='var(--shadow-card)'">
                
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <div style="font-size:2.2rem; background:linear-gradient(135deg, rgba(46,204,113,0.1), rgba(39,174,96,0.05)); width:56px; height:56px; display:flex; align-items:center; justify-content:center; border-radius:14px; border:1px solid rgba(46,204,113,0.2);">🏪</div>
                    <div>
                        <h3 style="margin:0 0 4px 0; font-size:1.15rem; color:var(--text);">${biz.name}</h3>
                        <div style="font-size:0.85rem; color:var(--text-dim); display:flex; gap:6px; align-items:center;">
                            <span style="background:var(--surface-2); padding:2px 6px; border-radius:4px;">Ур. ${level}</span>
                            <span style="color:var(--green); font-weight:600;">${cityData.name}</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid var(--border); padding-top:12px;">
                    <div>
                        <div style="font-size:0.85rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; margin-bottom:2px;">Выручка (вчера)</div>
                        <div style="font-size:1.2rem; font-weight:800; color:var(--green);">+$${formatMoney(totalRev)}</div>
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-dim); background:var(--surface-2); padding:4px 8px; border-radius:6px; font-weight:600;">
                        ${totalSold} продаж
                    </div>
                </div>
            </div>`;
        });
        
        activeStoresHtml += '</div>';

        let headerHtml = `
        <div style="background: linear-gradient(135deg, rgba(46,204,113,0.1), rgba(39,174,96,0.05)); border: 1px solid rgba(46,204,113,0.2); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 6px 0; color: var(--green);">🏪 Управление Розницей</h2>
            <p style="margin: 0; color: var(--text-dim); font-size: 0.95rem;">Ваши действующие магазины. Кликните на магазин для детальной настройки полок, цен и персонала.</p>
        </div>
        `;

        if (!hasRetail) {
            activeStoresHtml = '<div style="text-align:center; padding: 60px 20px; color:var(--text-dim); font-size:1.2rem; background:var(--surface); border-radius:16px; border:1px dashed var(--border); margin-bottom:24px;">У вас пока нет розничных магазинов. Откройте свой первый бизнес!</div>';
        }

        let newShopHtml = `
        <div style="background:var(--surface); border-radius:16px; border:1px solid var(--border); padding:30px; text-align:center; box-shadow:var(--shadow-card); margin-top:24px;">
            <div style="font-size:3rem; margin-bottom:12px;">🛒</div>
            <h3 style="margin:0 0 8px 0; font-size:1.5rem; color:var(--text);">Открыть новую точку</h3>
            <p style="color:var(--text-dim); max-width:400px; margin:0 auto 20px auto;">Расширяйте свою империю! Постройте новый фирменный магазин, чтобы продавать больше продукции B2C.</p>
            <button onclick="PRODUCTION.buyBusiness('retail_store')" style="background:linear-gradient(135deg, #2ecc71, #27ae60); color:white; font-size:1.1rem; font-weight:800; padding:14px 32px; border:none; border-radius:12px; cursor:pointer; box-shadow:0 6px 20px rgba(46,204,113,0.4); transition:0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">+ Построить Фирменный Магазин</button>
        </div>`;

        retailBody.innerHTML = headerHtml + activeStoresHtml + newShopHtml;
        
        // Синхронное обновление модального окна, если оно открыто
        let modal = document.getElementById('store-modal');
        if (modal && modal.style.display !== 'none' && this.currentStoreModalUid) {
            this.renderStoreModalContent(this.currentStoreModalUid);
        }
    },

    showStoreModal(bizUid) {
        this.currentStoreModalUid = bizUid;
        let oldModal = document.getElementById('store-modal');
        if (oldModal) oldModal.remove();

        let modal = document.createElement('div');
        modal.id = 'store-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:1000000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(4px);';
        
        modal.innerHTML = `
            <div style="background:var(--bg); width:95%; max-width:1200px; max-height:90vh; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid var(--border); overflow:hidden; animation: scaleIn 0.2s ease-out;">
                <div style="padding:16px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--surface);">
                    <h3 id="store-modal-title" style="margin:0; font-size:1.3rem; color:var(--text);">Магазин</h3>
                    <button onclick="UI_DASHBOARD.closeStoreModal()" style="background:var(--surface-2); border:none; border-radius:50%; width:32px; height:32px; font-size:1.2rem; display:flex; align-items:center; justify-content:center; color:var(--text-dim); cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--red-dim)'; this.style.color='var(--red)'" onmouseout="this.style.background='var(--surface-2)'; this.style.color='var(--text-dim)'">✕</button>
                </div>
                <div id="store-modal-body" style="padding:24px; overflow-y:auto; flex:1; background:var(--bg);">
                    <!-- Content rendered dynamically -->
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.renderStoreModalContent(bizUid);
    },
    
    closeStoreModal() {
        let modal = document.getElementById('store-modal');
        if (modal) modal.remove();
        this.currentStoreModalUid = null;
    },

    renderStoreModalContent(bizUid) {
        // 1. ЗАПОМИНАЕМ ПОЗИЦИЮ СКРОЛЛА ПЕРЕД ОБНОВЛЕНИЕМ
        let bodyEl = document.getElementById('store-modal-body');
        let invListEl = document.getElementById('store-inventory-list');
        let savedBodyScroll = bodyEl ? bodyEl.scrollTop : 0;
        let savedInvScroll = invListEl ? invListEl.scrollTop : 0;

        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (!biz) return this.closeStoreModal();
        
        let tpl = RECIPES.BUSINESSES[biz.type];
        let level = biz.level || 1;
        let cityId = biz.city || 'odesa';
        let cityData = typeof GEO !== 'undefined' ? GEO.getCity(cityId) : { name: cityId, rentMult: 1.0, salaryMult: 1.0 };
        
        let locMult = biz.locMult || 1.0;
        let adminCost = tpl.area * 2 * level * locMult;
        
        if (!biz.assigned) biz.assigned = {};
        if (biz.assigned.salesman === undefined) biz.assigned.salesman = 0;
        if (biz.assigned.store_manager === undefined) biz.assigned.store_manager = 0;
        
        let freeSales = typeof HR !== 'undefined' ? HR.getUnassigned('salesman') : 0;
        let freeMgr = typeof HR !== 'undefined' ? HR.getUnassigned('store_manager') : 0;
        
        let mgr = biz.assigned.store_manager || 0;
        let sales = biz.assigned.salesman || 0;
        let assignedTotal = sales + mgr;
        let maxStaff = tpl.staffReq * level;

        let salaryCost = (sales * HR.GRADES.salesman.salary + mgr * HR.GRADES.store_manager.salary) * cityData.salaryMult;
        let staffEff = (mgr > 0 && sales > 0) ? Math.min(1.0, assignedTotal / maxStaff) : 0;
        let staffEffPct = Math.round(staffEff * 100);

        let maxVol = tpl.area * level * locMult * 2;
        let eqCount = biz.equipment.count || 0;
        let maxSlots = level * (tpl.slotsPerLevel || 5);
        let eqName = RECIPES.RESOURCES[tpl.equipmentType] ? RECIPES.RESOURCES[tpl.equipmentType].name : tpl.equipmentType;
        let eqQuality = biz.equipment.quality || 1.0;
        let eqCondition = biz.equipment.condition !== undefined ? biz.equipment.condition : 100;
        let condColor = eqCondition >= 70 ? 'var(--green)' : (eqCondition >= 30 ? 'var(--orange)' : 'var(--red)');
        let displayEff = (eqCount > 0) ? (0.6 + (Math.min(eqCount, 5) * 0.1) * (eqCondition / 100)) : 0.5;
        let displayEffPct = Math.round(displayEff * 100);
        
        let eqCost = RECIPES.RESOURCES[tpl.equipmentType] ? RECIPES.RESOURCES[tpl.equipmentType].basePrice : 800;
        let eqDamage = Math.max(0, 100 - eqCondition);
        let repairCost = (eqCount * eqCost) * 0.10 * (eqDamage / 100);

        let localWh = STATE.company.warehouses[cityId];
        let availableEq = (localWh && localWh.inventory && localWh.inventory[tpl.equipmentType]) ? localWh.inventory[tpl.equipmentType].qty : 0;

        let currentVol = 0;
        let invHtml = '';
        let totalSold = 0;
        let totalRev = 0;
        let totalMissedRev = 0; // НОВАЯ ПЕРЕМЕННАЯ

        if (biz.localInventory) {
            Object.keys(biz.localInventory).forEach(k => {
                let inv = biz.localInventory[k];
                let rTpl = RECIPES.RESOURCES[k];
                if (!rTpl) return;

                let hasAutoSupply = (biz.autoSupplyRules && biz.autoSupplyRules[k]) ? biz.autoSupplyRules[k] : 0;
                let soldYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].qty : 0;

                if (inv.qty > 0 || hasAutoSupply > 0 || soldYesterday > 0) {
                    currentVol += inv.qty * (rTpl.volume || 0);
                    let b2bPrice = typeof MARKET !== 'undefined' ? MARKET.getCurrentPrice(k) : 0;
                    let basePrice = (RECIPES.RESOURCES[k] && RECIPES.RESOURCES[k].basePrice) ? RECIPES.RESOURCES[k].basePrice : 1;
                    let anchorRetailPrice = basePrice * 2.5;

                    if (!biz.prices) biz.prices = {};
                    let retailPrice = biz.prices[k] || anchorRetailPrice;
                    
                    let margin = inv.avgCost > 0 ? (retailPrice / inv.avgCost) : (retailPrice / basePrice);
                    let markupFromAnchor = retailPrice / anchorRetailPrice;
                    let marginColor = markupFromAnchor > 1.2 ? 'var(--red)' : (markupFromAnchor > 1.0 ? 'var(--orange)' : 'var(--green)');
                    
                    let revYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].revenue : 0;
                    let missedRevYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? (biz.stats.lastSold[k].missedRevenue || 0) : 0;
                    let stockCogs = inv.qty * inv.avgCost; 

                    totalSold += soldYesterday;
                    totalRev += revYesterday;
                    totalMissedRev += missedRevYesterday; // Плюсуем потери

                    let icon = UI_DASHBOARD._resIcons && UI_DASHBOARD._resIcons[k] ? UI_DASHBOARD._resIcons[k] : '📦';

                    let opacity = inv.qty === 0 ? '0.6' : '1.0';
                    let filter = inv.qty === 0 ? 'grayscale(80%)' : 'none';
                    let soldOutBadge = inv.qty === 0 
                        ? '<div style="background:var(--red); color:white; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px; display:inline-block; margin-bottom:4px; letter-spacing:0.05em;">SOLD OUT</div>' 
                        : '';

                    invHtml += `
                    <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 5px rgba(0,0,0,0.02); opacity:${opacity}; filter:${filter}; transition:0.3s;">
                        <div style="display:flex; align-items:center; gap:12px; width: 35%;">
                            <div style="font-size:2rem;">${icon}</div>
                            <div>
                                ${soldOutBadge}
                                <div style="font-weight:700; color:var(--text); font-size:0.95rem;">${rTpl.name}</div>
                                <div style="font-size:0.85rem; color:${inv.qty > 0 ? 'var(--blue)' : 'var(--red)'}; font-weight:700;">Сток: ${inv.qty} шт</div>
                                <div style="font-size:0.85rem; color:var(--text-dim);">★ ${(inv.quality||1.0).toFixed(2)} • Опт: $${formatMoney(b2bPrice)}</div>
                                <div style="font-size:0.85rem; color:var(--text-dim); margin-top:2px;">Себест-ть (1 шт): <strong style="color:var(--red);">$${formatMoney(inv.avgCost)}</strong> <span style="opacity:0.6;">(Всего: $${formatMoney(stockCogs)})</span></div>
                            </div>
                        </div>
                        
                        <div style="width: 35%; display:flex; flex-direction:column; gap:8px;">
                            <div>
                                <div style="font-size:0.9rem; color:var(--text-dim); margin-bottom:2px;">Цена полки <span title="Множитель прибыли относительно себестоимости 1 шт" style="color:${marginColor}; font-weight:700;">(ROI: x${margin.toFixed(1)})</span></div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <span style="color:var(--text); font-weight:700;">$</span>
                                    <input type="number" id="price-${biz.uid}-${k}" value="${retailPrice.toFixed(0)}" style="width:80px; padding:4px 6px; border:1px solid var(--border); border-radius:6px; font-weight:700; font-size:0.9rem; background:var(--surface-2); color:var(--text);">
                                    <button onclick="UI_DASHBOARD.saveStorePrice(${biz.uid}, '${k}')" style="background:var(--blue); color:white; border:none; padding:4px 8px; font-size:0.9rem; border-radius:6px; cursor:pointer; font-weight:700;">OK</button>
                                </div>
                            </div>
                            
                            <div style="background:var(--surface-2); padding:6px; border-radius:6px; border:1px dashed var(--border);">
                                <div style="font-size:0.9rem; color:var(--text-dim); margin-bottom:4px; font-weight:700;">🔄 АВТО-ЗАКАЗ (ШТ)</div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <input type="number" id="autosupply-${biz.uid}-${k}" value="${hasAutoSupply}" style="width:80px; padding:4px; border:1px solid var(--border); border-radius:4px; font-size:0.85rem; text-align:center;">
                                    <button onclick="UI_DASHBOARD.saveAutoSupply(${biz.uid}, '${k}')" style="background:var(--green); color:white; border:none; padding:4px 8px; font-size:0.9rem; border-radius:4px; cursor:pointer; font-weight:700;">Set</button>
                                </div>
                            </div>
                        </div>
                        
                            <div style="width: 25%; text-align:right;">
                                <div style="font-size:0.85rem; color:var(--text-dim);">Продано вчера</div>
                                <div style="font-weight:800; color:var(--green); font-size:1.1rem;">${soldYesterday} шт</div>
                                <div style="font-size:0.9rem; color:var(--text); font-weight:700;">+$${formatMoney(revYesterday)}</div>
                                ${missedRevYesterday > 0 ? `<div style="font-size:0.75rem; color:var(--red); font-weight:700; margin-top:6px; padding-top:4px; border-top:1px dashed var(--red);">Упущено: $${formatMoney(missedRevYesterday)}</div>` : ''}
                            </div>
                    </div>`;
                }
            });
        }
        if (invHtml === '') invHtml = '<div style="text-align:center; padding:20px; color:var(--text-dim); background:var(--surface-2); border-radius:8px; border:1px dashed var(--border);">Товара на полках нет</div>';
        
        let volPercent = Math.min(100, (currentVol/maxVol)*100).toFixed(1);
        let chartBg = volPercent > 90 ? 'var(--red)' : (volPercent > 70 ? 'var(--orange)' : 'var(--green)');

        let titleEl = document.getElementById('store-modal-title');
        if (titleEl) titleEl.innerText = biz.name;

        bodyEl = document.getElementById('store-modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = `
            <div style="display:flex; flex-wrap:wrap; gap:32px;">
                <!-- КОЛОНКА 1: ПОЛКИ И ЗАПАСЫ -->
                <div style="flex:1.5; min-width:450px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px;">📦 Заполнение склада</h4>
                        <span style="font-weight:700; color:${chartBg};">${volPercent}%</span>
                    </div>
                    <div style="height:8px; background:var(--surface-3); border-radius:4px; margin-bottom:8px; overflow:hidden;">
                        <div style="height:100%; width:${volPercent}%; background:${chartBg}; transition:0.3s;"></div>
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-dim); margin-bottom:16px;">
                        Занято ${currentVol.toFixed(1)} м³ из ${maxVol.toFixed(1)} м³. Доставляйте товары с производственных складов.
                    </div>
                    
                    <div id="store-inventory-list" style="max-height: 50vh; overflow-y: auto; padding-right:8px;">
                        ${invHtml}
                    </div>
                </div>

                <!-- КОЛОНКА 2: МЕБЕЛЬ И ПЕРСОНАЛ -->
                <div style="flex:1; min-width:350px;">
                    <!-- Выручка сводка -->
                    <div style="background:linear-gradient(135deg, rgba(46,204,113,0.1), rgba(39,174,96,0.05)); border:1px solid rgba(46,204,113,0.3); border-radius:12px; padding:16px; margin-bottom:16px; text-align:center; position:relative;">
                        <div style="font-size:0.85rem; color:var(--text-dim); text-transform:uppercase; font-weight:800;">ВЫРУЧКА ЗА ВЧЕРА</div>
                        <div style="font-size:1.6rem; font-weight:800; color:var(--green);">+$${formatMoney(totalRev)}</div>
                        <div style="font-size:0.85rem; color:var(--text-dim); margin-top:4px;">Аренда: -$${formatMoney(adminCost)}/дн</div>
                        ${totalMissedRev > 0 ? `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--red); color:var(--red); font-size:0.85rem; font-weight:700;">⚠️ Упущено из-за пустых полок: $${formatMoney(totalMissedRev)}</div>` : ''}
                        
                        <button onclick="UI_DASHBOARD.showStoreAnalyticsModal(${biz.uid})" style="margin-top:12px; width:100%; background:var(--surface); border:1px solid var(--green); color:var(--green); padding:8px; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.85rem; transition:all 0.2s;" onmouseover="this.style.background='var(--green)'; this.style.color='white'" onmouseout="this.style.background='var(--surface)'; this.style.color='var(--green)'">📊 Аналитика продаж</button>
                    </div>

                    <h4 style="margin:0 0 16px 0; font-size:1.1rem;">Оборудование & Персонал</h4>
                    
                    <!-- Мебель -->
                    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px;">
                        <div style="font-size:0.85rem; color:var(--text-dim); font-weight:700; text-transform:uppercase; margin-bottom:12px; display:flex; justify-content:space-between;">
                            <span>🛒 Торговое оборудование</span>
                            <span style="color:var(--blue);">КПД: ${displayEffPct}%</span>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div>
                                <strong style="color:var(--text); font-size:1rem;">${eqName}</strong>
                                <div style="font-size:0.85rem; color:var(--text-dim); margin-top:2px;">Качество: ★${eqQuality.toFixed(2)} | На складе хаба: ${availableEq} шт</div>
                            </div>
                            <div style="font-weight:800; color:var(--blue); font-size:1.2rem;">${eqCount} / ${maxSlots}</div>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                            <span style="color:var(--text-dim);">Состояние оборудования</span>
                            <span style="font-weight:700; color:${condColor};">${eqCondition.toFixed(0)}%</span>
                        </div>
                        <div style="height:6px; background:var(--surface-3); border-radius:3px; margin-bottom:12px; overflow:hidden;">
                            <div style="height:100%; width:${eqCondition}%; background:${condColor}; transition:0.3s;"></div>
                        </div>
                        
                        <div style="display:flex; gap:8px;">
                            <input type="number" id="install-qty-${biz.uid}" value="1" min="1" max="${Math.max(1, maxSlots - eqCount)}" style="width:50px; padding:6px; border:1px solid var(--border); border-radius:8px; font-weight:700; text-align:center; background:var(--surface-2);">
                            <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" style="flex:1; background:var(--surface-2); color:var(--text); border:1px solid var(--border); border-radius:8px; font-weight:700; cursor:pointer; font-size:0.85rem;">Докупить</button>
                            <button onclick="PRODUCTION.repairEquipment(${biz.uid})" style="background:rgba(142,68,173,0.1); color:#8e44ad; border:1px solid rgba(142,68,173,0.3); padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">🔧 ТО ($${formatMoney(repairCost)})</button>
                        </div>
                    </div>

                    <!-- Персонал -->
                    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-size:0.85rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">Персонал</div>
                            <div style="display:flex; gap:12px; align-items:center;">
                                <div style="font-size:0.85rem; color:${staffEffPct > 0 ? 'var(--green)' : 'var(--red)'}; font-weight:700;">КПД: ${staffEffPct}%</div>
                                <div style="font-weight:700; color:var(--text); font-size:1rem;">${assignedTotal} / ${maxStaff}</div>
                            </div>
                        </div>
                        
                        <div style="font-size:0.9rem; color:var(--text-dim); margin-bottom:12px; display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
                            <span>Фонд оплаты труда (ФОТ):</span>
                            <strong style="color:var(--red);">$${formatMoney(salaryCost)} / дн</strong>
                        </div>

                        <!-- Директор -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed var(--border);">
                            <div>
                                <div style="font-weight:700; font-size:0.95rem;">Директор</div>
                                <div style="font-size:0.85rem; color:var(--text-dim);">Резерв: <span style="color:var(--blue); font-weight:700;">${freeMgr}</span></div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button onclick="HR.removeFromBusiness(${biz.uid}, 'store_manager')" ${biz.assigned.store_manager === 0 ? 'disabled' : ''} class="btn-hr-minus">-</button> 
                                <span style="font-weight:800; font-size:1.1rem; width:20px; text-align:center;">${biz.assigned.store_manager}</span> 
                                <button onclick="HR.assignToBusiness(${biz.uid}, 'store_manager')" ${biz.assigned.store_manager >= 1 || freeMgr === 0 ? 'disabled' : ''} class="btn-hr-plus">+</button>
                            </div>
                        </div>

                        <!-- Продавец -->
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:700; font-size:0.95rem;">Продавцы</div>
                                <div style="font-size:0.85rem; color:var(--text-dim);">Резерв: <span style="color:var(--blue); font-weight:700;">${freeSales}</span></div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button onclick="HR.removeFromBusiness(${biz.uid}, 'salesman')" ${biz.assigned.salesman === 0 ? 'disabled' : ''} class="btn-hr-minus">-</button> 
                                <span style="font-weight:800; font-size:1.1rem; width:20px; text-align:center;">${biz.assigned.salesman}</span> 
                                <button onclick="HR.assignToBusiness(${biz.uid}, 'salesman')" ${biz.assigned.salesman >= (maxStaff - 1) || freeSales === 0 ? 'disabled' : ''} class="btn-hr-plus">+</button>
                            </div>
                        </div>
                    </div>

                    <button onclick="PRODUCTION.upgradeBusiness(${biz.uid})" style="width:100%; margin-top:16px; padding:12px; background:var(--orange); color:white; border:none; border-radius:10px; font-weight:800; font-size:1rem; cursor:pointer; box-shadow:0 4px 10px rgba(243,156,18,0.3);">🚀 Расширить магазин ($${formatMoney(tpl.area * 50 * level)})</button>
                </div>
            </div>`;

            // 2. ВОССТАНАВЛИВАЕМ СКРОЛЛ ПОСЛЕ ОТРИСОВКИ
            bodyEl.scrollTop = savedBodyScroll;
            let newInvListEl = document.getElementById('store-inventory-list');
            if (newInvListEl) newInvListEl.scrollTop = savedInvScroll;
        }
    },

    // --- 11. НОВАЯ ВКЛАДКА: МАРКЕТИНГ ---
    updateMarketingTab() {
        let marketingBody = document.getElementById('ui-marketing-businesses');
        if (!marketingBody) return;

        if (!STATE.retail) STATE.retail = { prices: {}, brand: 10, history: [] };
        let currentBrand = STATE.retail.brand || 10;

        // ─── ДАШБОРД ЭФФЕКТИВНОСТИ ─────────────────────────────────
        let mktDash = document.getElementById('ui-mkt-dashboard');
        if (mktDash) {
            let agencies = STATE.company.businesses.filter(b => RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isMarketing);
            let totalStaff = 0, totalEq = 0, totalBudget = 0;
            let campaignLabels = { 0:'Органика', 1:'Контекст', 2:'Блогеры', 3:'ТВ' };
            let campaignCosts  = { 0:0, 1:100, 2:500, 3:2000 };
            let campaignEffect = { 0:1.0, 1:1.5, 2:2.5, 3:5.0 };
            let maxEffect = 1.0;
            agencies.forEach(biz => {
                let tpl = RECIPES.BUSINESSES[biz.type];
                totalStaff += (biz.assigned.marketer || 0) + (biz.assigned.pr_manager || 0);
                totalEq += biz.equipment.count || 0;
                totalBudget += campaignCosts[biz.campaign || 0];
                maxEffect = Math.max(maxEffect, campaignEffect[biz.campaign || 0]);
            });
            
            // Индекс маркетинговой силы: бренд * количество агентств * кампания
            let mktIndex = (currentBrand * agencies.length * maxEffect).toFixed(0);
            let brandColor = currentBrand >= 50 ? 'var(--green)' : (currentBrand >= 20 ? 'var(--orange)' : '#8e44ad');
            
            let dashMetrics = [
                { label: 'Сила Бренда', value: currentBrand.toFixed(1) + '%', icon: '🌟', color: brandColor, desc: 'Узнаваемость' },
                { label: 'Агентств', value: agencies.length, icon: '🏢', color: 'var(--blue)', desc: 'Офисов маркетинга' },
                { label: 'Команда', value: totalStaff, icon: '👥', color: 'var(--text)', desc: 'Маркетологов/PR' },
                { label: 'Рекл. бюджет', value: '$' + formatMoney(totalBudget) + '/дн', icon: '💸', color: 'var(--red)', desc: 'В день' },
                { label: 'Макс. эффект', value: 'x' + maxEffect.toFixed(1), icon: '⚡', color: '#e67e22', desc: 'Усилитель кампании' },
                { label: 'Маркетинг-индекс', value: mktIndex, icon: '📈', color: '#8e44ad', desc: 'Общий показатель' },
            ];
            
            mktDash.innerHTML = dashMetrics.map(m => `
                <div style="background:var(--surface); padding:16px; border-radius:var(--radius); border:1px solid var(--border); box-shadow:var(--shadow-card);">
                    <div style="font-size:1.6rem; margin-bottom:6px;">${m.icon}</div>
                    <div style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700;">${m.label}</div>
                    <div style="font-size:1.25rem; font-weight:800; color:${m.color}; margin-top:2px;">${m.value}</div>
                    <div style="font-size:0.72rem; color:var(--text-faint); margin-top:2px;">${m.desc}</div>
                </div>`).join('');
        }

        // ─── КАРТОЧКИ АГЕНТСТВ ─────────────────────────────────────
        marketingBody.innerHTML = '';
        let hasMarketing = false;

        const CAMPAIGNS = [
            { id: 0, name: 'Органический рост',   icon: '🌱', cost:    0, effect: 1.0, color: 'var(--green)',  desc: 'Без затрат. Естественный прирост бренда.' },
            { id: 1, name: 'Контекстная реклама',  icon: '🖥️', cost:  100, effect: 1.5, color: 'var(--blue)',   desc: '$100/дн. Целевые объявления. Эффект ×1.5' },
            { id: 2, name: 'Блогеры и СМИ',        icon: '🎥', cost:  500, effect: 2.5, color: 'var(--orange)', desc: '$500/дн. Охват аудитории. Эффект ×2.5' },
            { id: 3, name: 'Национальное ТВ',      icon: '📺', cost: 2000, effect: 5.0, color: 'var(--red)',    desc: '$2 000/дн. Максимальный охват. Эффект ×5.0' },
        ];

        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl || !tpl.isMarketing) return;
            hasMarketing = true;

            let level = biz.level || 1;
            let adminCost = tpl.area * 2 * level;

            if (!biz.assigned) biz.assigned = {};
            if (biz.assigned.marketer === undefined) biz.assigned.marketer = 0;
            if (biz.assigned.pr_manager === undefined) biz.assigned.pr_manager = 0;

            let freeMarketer = typeof HR !== 'undefined' ? HR.getUnassigned('marketer') : 0;
            let freePR = typeof HR !== 'undefined' ? HR.getUnassigned('pr_manager') : 0;
            let assignedTotal = biz.assigned.marketer + biz.assigned.pr_manager;
            let maxStaff = tpl.staffReq * level;
            let isFull = assignedTotal >= maxStaff;

            let eqCount = biz.equipment.count || 0;
            let maxSlots = level * (tpl.slotsPerLevel || 5);
            let freeSlots = maxSlots - eqCount;
            let staffPct = maxStaff > 0 ? Math.round((assignedTotal / maxStaff) * 100) : 0;
            let eqPct = maxSlots > 0 ? Math.round((eqCount / maxSlots) * 100) : 0;

            let currentCampaign = biz.campaign || 0;
            let targetType = biz.targetType || 'brand';
            let targetId = biz.targetId || '';

            // Эффективность агентства: сколько ПК и персонал задействованы
            let efficiency = Math.min(assignedTotal, eqCount, maxStaff, maxSlots);
            let effMax = Math.min(maxStaff, maxSlots);
            let effPct = effMax > 0 ? Math.round((efficiency / effMax) * 100) : 0;
            let effColor = effPct >= 75 ? 'var(--green)' : (effPct >= 40 ? 'var(--orange)' : 'var(--red)');

            // Таргет опции
            let targetOptions = `<option value="brand_global" ${targetType==='brand' ? 'selected' : ''}>🌍 Глобальный бренд компании</option>`;
            targetOptions += `<optgroup label="🏪 Продвижение магазина">`;
            STATE.company.businesses.forEach(store => {
                if (RECIPES.BUSINESSES[store.type].isRetail) {
                    let sel = (targetType === 'store' && targetId == store.uid) ? 'selected' : '';
                    targetOptions += `<option value="store_${store.uid}" ${sel}>📍 ${store.name}</option>`;
                }
            });
            targetOptions += `</optgroup>`;
            targetOptions += `<optgroup label="📦 Продвижение товара">`;
            Object.keys(RECIPES.RESOURCES).forEach(k => {
                let res = RECIPES.RESOURCES[k];
                if (!res.isRaw && !res.isEquipment) {
                    let sel = (targetType === 'product' && targetId === k) ? 'selected' : '';
                    targetOptions += `<option value="product_${k}" ${sel}>🛍️ ${res.name}</option>`;
                }
            });
            targetOptions += `</optgroup>`;

            // Рендер кнопок кампаний
            let campaignButtons = CAMPAIGNS.map(c => {
                let isActive = currentCampaign === c.id;
                return `
                <div onclick="UI_DASHBOARD.setCampaignById(${biz.uid}, ${c.id})" 
                     title="${c.desc}"
                     style="cursor:pointer; border:2px solid ${isActive ? c.color : 'var(--border)'}; background:${isActive ? 'rgba(0,0,0,0.04)' : 'var(--surface-2)'}; border-radius:10px; padding:10px 12px; text-align:center; transition:all 0.15s; ${isActive ? 'box-shadow: 0 0 0 3px ' + c.color.replace(')', ',0.2)').replace('var(--','rgba(') + ';' : ''}">
                    <div style="font-size:1.5rem; margin-bottom:4px;">${c.icon}</div>
                    <div style="font-size:0.85rem; font-weight:700; color:${isActive ? c.color : 'var(--text-dim)'};">${c.name}</div>
                    <div style="font-size:0.9rem; color:var(--text-faint); margin-top:2px;">${c.cost > 0 ? '$' + c.cost + '/дн' : 'Бесплатно'}</div>
                    ${isActive ? `<div style="margin-top:4px; background:${c.color}; color:white; border-radius:4px; font-size:0.65rem; font-weight:700; padding:2px 6px;">АКТИВНА</div>` : ''}
                </div>`;
            }).join('');

            marketingBody.innerHTML += `
            <div style="background:var(--surface); border-radius:var(--radius); border:1px solid var(--border); box-shadow:var(--shadow-card); overflow:hidden; margin-bottom:20px;">

                <!-- ЗАГОЛОВОК КАРТОЧКИ -->
                <div style="background:linear-gradient(135deg,rgba(142,68,173,0.1),rgba(231,76,60,0.05)); border-bottom:1px solid var(--border); padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="font-size:2rem;">📢</div>
                        <div>
                            <div style="font-weight:700; font-size:1.05rem; color:var(--text);">${biz.name}</div>
                            <div style="font-size:0.9rem; color:var(--text-dim);">Уровень ${level} • Аренда <strong style="color:var(--red);">$${formatMoney(adminCost)}</strong>/дн</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div style="background:${effColor}; color:white; padding:6px 14px; border-radius:8px; font-weight:700; font-size:0.9rem;">
                            КПД: ${effPct}%
                        </div>
                        <button onclick="PRODUCTION.upgradeBusiness(${biz.uid})" style="background:rgba(243,156,18,0.1); color:var(--orange); border:1px solid rgba(243,156,18,0.3); padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem;">
                            ⬆️ Расширить ($${formatMoney(tpl.area * 50 * level)})
                        </button>
                    </div>
                </div>

                <!-- ОСНОВНОЕ ТЕЛО -->
                <div style="padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">

                    <!-- ЛЕВАЯ: Кампании + Таргет -->
                    <div style="display:flex; flex-direction:column; gap:16px;">

                        <!-- Выбор кампании -->
                        <div>
                            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:10px;">🎯 Рекламная кампания</div>
                            <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;">
                                ${campaignButtons}
                            </div>
                        </div>

                        <!-- Таргет -->
                        <div>
                            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:8px;">📍 Цель продвижения</div>
                            <select id="marketing-target-${biz.uid}" onchange="UI_DASHBOARD.setMarketingTarget(${biz.uid})" 
                                    style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); cursor:pointer; font-size:0.9rem;">
                                ${targetOptions}
                            </select>
                        </div>

                        <!-- Оборудование -->
                        <div style="background:var(--surface-2); padding:14px; border-radius:10px; border:1px solid var(--border);">
                            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:10px;">💻 Оборудование (Смарт-ПК)</div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.88rem;">
                                <span style="color:var(--text-dim);">Установлено</span>
                                <span style="font-weight:700; color:var(--text);">${eqCount} / ${maxSlots}</span>
                            </div>
                            <div style="background:var(--surface); border-radius:6px; height:6px; overflow:hidden; margin-bottom:10px;">
                                <div style="height:100%; width:${eqPct}%; background:linear-gradient(90deg,#8e44ad,#e74c3c); border-radius:6px; transition:width 0.4s;"></div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <input type="number" id="install-qty-${biz.uid}" value="1" min="1" max="${Math.max(1,freeSlots)}" 
                                       style="width:60px; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); text-align:center; font-weight:600;">
                                <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" 
                                        style="flex:1; background:rgba(142,68,173,0.1); color:#8e44ad; border:1px solid rgba(142,68,173,0.3); padding:8px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem;">
                                    ⬇️ Купить ПК
                                </button>
                            </div>
                        </div>

                    </div>

                    <!-- ПРАВАЯ: Персонал + Эффективность -->
                    <div style="display:flex; flex-direction:column; gap:16px;">

                        <!-- Прогресс эффективности -->
                        <div style="background:var(--surface-2); padding:16px; border-radius:10px; border:1px solid var(--border);">
                            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:12px;">📊 Эффективность агентства</div>
                            <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:4px;">
                                <span style="color:var(--text-dim);">Персонал</span><span style="font-weight:700;">${assignedTotal} / ${maxStaff}</span>
                            </div>
                            <div style="background:var(--surface); border-radius:6px; height:6px; margin-bottom:10px; overflow:hidden;">
                                <div style="height:100%; width:${staffPct}%; background:var(--blue); border-radius:6px; transition:width 0.4s;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:4px;">
                                <span style="color:var(--text-dim);">Оборудование</span><span style="font-weight:700;">${eqCount} / ${maxSlots}</span>
                            </div>
                            <div style="background:var(--surface); border-radius:6px; height:6px; margin-bottom:12px; overflow:hidden;">
                                <div style="height:100%; width:${eqPct}%; background:#8e44ad; border-radius:6px; transition:width 0.4s;"></div>
                            </div>
                            <div style="background:${effColor}; color:white; border-radius:8px; padding:10px; text-align:center;">
                                <div style="font-size:1.6rem; font-weight:800;">${effPct}%</div>
                                <div style="font-size:0.85rem; opacity:0.9;">${effPct >= 75 ? '🔥 Отличная работа!' : effPct >= 40 ? '⚙️ Есть потенциал' : '⚠️ Требует внимания'}</div>
                            </div>
                            ${assignedTotal > eqCount ? `<div style="margin-top:10px; background:rgba(230,126,34,0.1); color:var(--orange); border:1px solid rgba(230,126,34,0.3); border-radius:8px; padding:8px; font-size:0.9rem; font-weight:600;">⚠️ Сотрудников больше, чем ПК! Часть команды простаивает.</div>` : ''}
                        </div>

                        <!-- Управление кадрами -->
                        <div style="background:var(--surface-2); padding:14px; border-radius:10px; border:1px solid var(--border);">
                            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:12px;">👥 Кадровый состав (${assignedTotal}/${maxStaff})</div>
                            
                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:10px 14px; border-radius:8px; border:1px solid var(--border); margin-bottom:8px;">
                                <div>
                                    <div style="font-weight:600; font-size:0.9rem;">🎨 Маркетолог</div>
                                    <div style="font-size:0.85rem; color:var(--text-dim);">Резерв: ${freeMarketer}</div>
                                </div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <button onclick="HR.removeFromBusiness(${biz.uid}, 'marketer')" ${biz.assigned.marketer===0?'disabled':''} style="background:var(--red-dim); color:var(--red); border:none; width:30px; height:30px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700; ${biz.assigned.marketer===0?'opacity:0.4;cursor:not-allowed;':''}">−</button>
                                    <span style="font-weight:700; min-width:20px; text-align:center; font-size:1.05rem;">${biz.assigned.marketer}</span>
                                    <button onclick="HR.assignToBusiness(${biz.uid}, 'marketer')" ${(isFull||freeMarketer===0)?'disabled':''} style="background:rgba(142,68,173,0.1); color:#8e44ad; border:none; width:30px; height:30px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700; ${(isFull||freeMarketer===0)?'opacity:0.4;cursor:not-allowed;':''}">+</button>
                                </div>
                            </div>

                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:10px 14px; border-radius:8px; border:1px solid var(--border);">
                                <div>
                                    <div style="font-weight:600; font-size:0.9rem;">📣 PR-Менеджер</div>
                                    <div style="font-size:0.85rem; color:var(--text-dim);">Резерв: ${freePR}</div>
                                </div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <button onclick="HR.removeFromBusiness(${biz.uid}, 'pr_manager')" ${biz.assigned.pr_manager===0?'disabled':''} style="background:var(--red-dim); color:var(--red); border:none; width:30px; height:30px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700; ${biz.assigned.pr_manager===0?'opacity:0.4;cursor:not-allowed;':''}">−</button>
                                    <span style="font-weight:700; min-width:20px; text-align:center; font-size:1.05rem;">${biz.assigned.pr_manager}</span>
                                    <button onclick="HR.assignToBusiness(${biz.uid}, 'pr_manager')" ${(isFull||freePR===0)?'disabled':''} style="background:rgba(52,152,219,0.1); color:var(--blue); border:none; width:30px; height:30px; border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:700; ${(isFull||freePR===0)?'opacity:0.4;cursor:not-allowed;':''}">+</button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
        });

        if (!hasMarketing) {
            marketingBody.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <div style="font-size:4rem; margin-bottom:16px;">📢</div>
                <h3 style="color:var(--text); margin:0 0 8px 0;">Нет маркетинговых агентств</h3>
                <p style="color:var(--text-dim); margin:0 0 24px 0; max-width:400px; margin-left:auto; margin-right:auto;">
                    Откройте первое агентство, чтобы начать продвижение бренда, запустить таргетированные рекламные кампании и увеличить поток покупателей.
                </p>
                <button onclick="PRODUCTION.buyBusiness('marketing_agency')" style="background:linear-gradient(135deg,#8e44ad,#9b59b6); color:white; border:none; padding:14px 32px; border-radius:var(--radius); cursor:pointer; font-weight:700; font-size:1rem; box-shadow:0 4px 15px rgba(142,68,173,0.4);">
                    + Открыть первое Агентство
                </button>
            </div>`;
        }
    },

    // Новый хелпер для кнопок выбора кампании
    setCampaignById(bizUid, campaignId) {
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (!biz) return;
        biz.campaign = campaignId;
        this.updateMarketingTab();
    },


    // Отправка товаров с Общего склада в локальный склад Магазина (ПЛАТНАЯ ЛОГИСТИКА)
    transferToStore(itemKey, cityId) {
        let storeSelect = document.getElementById(`trans-store-${cityId}-${itemKey}`);
        let qtyInput = document.getElementById(`trans-qty-${cityId}-${itemKey}`);
        
        if (!storeSelect || !qtyInput || !storeSelect.value) return;
        
        let storeUid = parseInt(storeSelect.value);
        let qty = parseInt(qtyInput.value);
        let store = STATE.company.businesses.find(b => b.uid === storeUid);
        if (!store) return;
        
        let localWh = STATE.company.warehouses[cityId];
        let globalInv = localWh.inventory[itemKey];
        if (!globalInv || globalInv.qty < qty) return NOTIFY.error('Ошибка', 'На складе города нет столько товара.');
        
        let tpl = RECIPES.BUSINESSES[store.type];
        let maxVol = tpl.area * (store.level || 1) * (store.locMult || 1.0) * 2;
        let itemVol = RECIPES.RESOURCES[itemKey].volume || 0.1;
        
        let currentVol = 0;
        if (!store.localInventory) store.localInventory = {};
        Object.keys(store.localInventory).forEach(ik => currentVol += store.localInventory[ik].qty * (RECIPES.RESOURCES[ik].volume || 0));
        
        let maxCanFit = itemVol > 0 ? Math.floor((maxVol - currentVol) / itemVol) : qty;
        if (qty > maxCanFit) {
            qty = maxCanFit;
            if (qty <= 0) return NOTIFY.error('Ошибка', `На складе магазина нет места!`);
        }

        // РАСЧЕТ СТОИМОСТИ ЛОГИСТИКИ (МЕЖДУ ГОРОДАМИ ИЛИ ВНУТРИ ГОРОДА)
        let sourceCity = cityId;
        let targetCity = store.city || 'odesa';
        let totalVolume = qty * itemVol;
        let logCost = typeof GEO !== 'undefined' ? GEO.getLogisticsCost(sourceCity, targetCity, totalVolume, 'store', store.locMult || 1.0) : 0;

        if (STATE.finances.balance < logCost) {
            NOTIFY.error('Ошибка логистики', `Не хватает средств на оплату транспортной компании. Нужно $${formatMoney(logCost)}.`);
            return;
        }

        // Списываем деньги со счета (в P&L не пишем, логистика уходит в наценку товара)
        STATE.finances.balance -= logCost;
        
        if (!store.localInventory[itemKey]) store.localInventory[itemKey] = { qty: 0, avgCost: 0, quality: 1.0 };
        let locInv = store.localInventory[itemKey];
        
        // ВАЖНО: Стоимость доставки ложится в себестоимость товара!
        let totalOldCost = locInv.qty * locInv.avgCost;
        let totalNewCost = qty * globalInv.avgCost;
        locInv.avgCost = (totalOldCost + totalNewCost + logCost) / (locInv.qty + qty);
        locInv.quality = ((locInv.qty * (locInv.quality || 1)) + (qty * (globalInv.quality || 1))) / (locInv.qty + qty);
        locInv.qty += qty;
        
        globalInv.qty -= qty;
        if (globalInv.qty === 0) globalInv.avgCost = 0;
        
        NOTIFY.success('Успех', `Успешно отгружено ${qty} шт. в "${store.name}". Оплата логистики: $${formatMoney(logCost)}.`);
        this.update();
    },
    
    // Сохранение выбранной рекламной кампании
    setCampaign(bizUid) {
        let select = document.getElementById(`campaign-${bizUid}`);
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (biz && select) {
            biz.campaign = parseInt(select.value);
            this.update();
        }
    },
    // Сохранение розничной цены для конкретного магазина
    saveStorePrice(bizUid, itemKey) {
        let input = document.getElementById(`price-${bizUid}-${itemKey}`);
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (input && biz) {
            let val = parseFloat(input.value);
            if (isNaN(val) || val <= 0) {
                NOTIFY.error('Ошибка', 'Введите корректную цену (больше 0).');
                return;
            }
            if (!biz.prices) biz.prices = {};
            biz.prices[itemKey] = val;
            this.update();
        }
    },

    // --- НОВАЯ ФУНКЦИЯ: Сохранение правил Автозаказа ---
    saveAutoSupply(bizUid, itemKey) {
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (!biz) return;
        
        let input = document.getElementById(`autosupply-${bizUid}-${itemKey}`);
        if (!input) return;
        
        let qty = parseInt(input.value) || 0;
        if (!biz.autoSupplyRules) biz.autoSupplyRules = {};
        
        if (qty <= 0) {
            delete biz.autoSupplyRules[itemKey];
            if (typeof NOTIFY !== 'undefined') NOTIFY.info('Логистика', `Автоматическое пополнение отменено.`);
        } else {
            biz.autoSupplyRules[itemKey] = qty;
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Логистика', `Автозаказ настроен. Магазин будет поддерживать запас ${qty} шт.`);
        }
        this.updateRetailTab(); // Перерисовываем интерфейс
    },

    // --- АНАЛИТИКА МАГАЗИНА (ЭТАП 2) ---
    showStoreAnalyticsModal(bizUid, periodDays = 7) {
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (!biz) return;

        let modal = document.getElementById('store-analytics-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'store-analytics-modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:1000001; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(5px);';
            document.body.appendChild(modal);
        }

        // 1. Фильтрация реальной истории
        if (!biz.stats) biz.stats = {};
        let fullHistory = biz.stats.history || [];
        
        // Если история пуста (первый день), берем текущие данные lastSold
        if (fullHistory.length === 0) {
             let dRev = 0, dCogs = 0, dMissed = 0;
             if (biz.stats.lastSold) {
                 Object.values(biz.stats.lastSold).forEach(s => { dRev+=s.revenue||0; dCogs+=s.cogs||0; dMissed+=s.missedRevenue||0; });
             }
             fullHistory = [{ day: STATE.time.day, revenue: dRev, cogs: dCogs, missed: dMissed, items: biz.stats.lastSold || {} }];
        }

        let history = fullHistory;
        if (periodDays !== 'all') {
            history = fullHistory.slice(-periodDays);
        }
        let actualDays = history.length || 1;

        // 2. Агрегация данных по товарам
        let aggRev = 0, aggCogs = 0, aggMissed = 0;
        let itemAgg = {}; 
        
        history.forEach(dayStat => {
            aggRev += dayStat.revenue || 0;
            aggCogs += dayStat.cogs || 0;
            aggMissed += dayStat.missed || 0;
            
            if (dayStat.items) {
                Object.keys(dayStat.items).forEach(k => {
                    if (!itemAgg[k]) itemAgg[k] = { rev: 0, profit: 0, missed: 0, name: RECIPES.RESOURCES[k]?.name || k };
                    let r = dayStat.items[k].revenue || 0;
                    let c = dayStat.items[k].cogs || 0;
                    itemAgg[k].rev += r;
                    itemAgg[k].profit += (r - c);
                    itemAgg[k].missed += dayStat.items[k].missedRevenue || 0;
                });
            }
        });

        // 3. Подсчет Финансовых метрик (Рентабельность, ROA)
        let tpl = RECIPES.BUSINESSES[biz.type];
        let level = biz.level || 1;
        let locMult = biz.locMult || 1.0;
        let cityId = biz.city || 'odesa';
        let cityData = typeof GEO !== 'undefined' ? GEO.getCity(cityId) : { rentMult: 1.0, salaryMult: 1.0 };
        
        let dailyRent = tpl.area * 2 * level * locMult;
        let sales = biz.assigned?.salesman || 0;
        let mgr = biz.assigned?.store_manager || 0;
        let dailySalaries = (sales * HR.GRADES.salesman.salary + mgr * HR.GRADES.store_manager.salary) * cityData.salaryMult;
        
        let totalOpex = (dailyRent + dailySalaries) * actualDays;
        let totalProfit = aggRev - aggCogs - totalOpex;
        let marginPct = aggRev > 0 ? (totalProfit / aggRev) * 100 : 0;

        // Расчет Активов
        let realEstateValue = tpl.area * 50 * level * locMult;
        let eqCost = RECIPES.RESOURCES[tpl.equipmentType] ? RECIPES.RESOURCES[tpl.equipmentType].basePrice : 800;
        let equipmentValue = (biz.equipment?.count || 0) * eqCost * ((biz.equipment?.condition || 0) / 100);
        let inventoryValue = 0;
        if (biz.localInventory) Object.values(biz.localInventory).forEach(inv => inventoryValue += inv.qty * inv.avgCost);
        let totalAssets = realEstateValue + equipmentValue + inventoryValue;
        let roa = totalAssets > 0 ? (totalProfit / totalAssets) * 100 : 0;

        // 4. Формирование таблицы ABC
        let products = Object.values(itemAgg);
        products.sort((a, b) => b.rev - a.rev);
        
        let abcHtml = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left;">
            <thead style="background:var(--surface-2); color:var(--text-dim); border-bottom:1px solid var(--border);">
                <tr>
                    <th style="padding:10px;">Класс и Товар</th>
                    <th style="padding:10px; text-align:right;">Выручка</th>
                    <th style="padding:10px; text-align:right;">Прибыль (Маржа)</th>
                    <th style="padding:10px; text-align:right;">Упущено</th>
                </tr>
            </thead>
            <tbody>`;
        
        if (products.length === 0 || aggRev === 0) {
            abcHtml += `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-dim);">Дождитесь закрытия первого дня для анализа</td></tr>`;
        } else {
            let runningRev = 0;
            products.forEach(p => {
                if (p.rev === 0 && p.missed === 0) return; // Скрываем пустые товары без движения
                runningRev += p.rev;
                let cumPct = aggRev > 0 ? (runningRev / aggRev) * 100 : 0;
                let abcClass = '';
                if (p.rev === 0) abcClass = '<span style="background:rgba(231,76,60,0.1); color:var(--red); padding:2px 6px; border-radius:4px; font-weight:800;">-</span>';
                else if (cumPct <= 80) abcClass = '<span style="background:rgba(46,204,113,0.1); color:var(--green); padding:2px 6px; border-radius:4px; font-weight:800;">A</span>';
                else if (cumPct <= 95) abcClass = '<span style="background:rgba(243,156,18,0.1); color:var(--orange); padding:2px 6px; border-radius:4px; font-weight:800;">B</span>';
                else abcClass = '<span style="background:rgba(231,76,60,0.1); color:var(--red); padding:2px 6px; border-radius:4px; font-weight:800;">C</span>';
                
                let pMargin = p.rev > 0 ? (p.profit / p.rev) * 100 : 0;
                
                abcHtml += `
                <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:10px; font-weight:600; color:var(--text);">${abcClass} ${p.name}</td>
                    <td style="padding:10px; text-align:right; color:var(--text); font-weight:700;">$${formatMoney(p.rev)}</td>
                    <td style="padding:10px; text-align:right; color:var(--green); font-weight:700;">$${formatMoney(p.profit)} <span style="font-size:0.75rem; color:var(--blue);">(${p.profit>0?'+':''}${pMargin.toFixed(1)}%)</span></td>
                    <td style="padding:10px; text-align:right; color:var(--red); font-weight:600;">${p.missed > 0 ? '$'+formatMoney(p.missed) : '-'}</td>
                </tr>`;
            });
        }
        abcHtml += `</tbody></table>`;

        // 5. Рендер HTML Модалки
        let btnStyle = (p) => `padding:6px 12px; border-radius:8px; border:1px solid var(--blue); cursor:pointer; font-weight:700; font-size:0.8rem; transition:0.2s; background:${periodDays===p ? 'var(--blue)' : 'transparent'}; color:${periodDays===p ? 'white' : 'var(--blue)'};`;

        modal.innerHTML = `
            <div style="background:var(--bg); width:95%; max-width:900px; max-height:90vh; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.4); border:1px solid var(--border); overflow:hidden; animation: scaleIn 0.2s ease-out;">
                <div style="padding:16px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--surface);">
                    <h3 style="margin:0; font-size:1.3rem; color:var(--text);">📊 Аналитика: ${biz.name}</h3>
                    <button onclick="document.getElementById('store-analytics-modal').remove()" style="background:var(--surface-2); border:none; border-radius:50%; width:32px; height:32px; font-size:1.2rem; display:flex; align-items:center; justify-content:center; color:var(--text-dim); cursor:pointer;">✕</button>
                </div>
                
                <div style="padding:16px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--surface-2);">
                    <div style="display:flex; gap:8px;">
                        <button onclick="UI_DASHBOARD.showStoreAnalyticsModal(${bizUid}, 7)" style="${btnStyle(7)}">7 дней</button>
                        <button onclick="UI_DASHBOARD.showStoreAnalyticsModal(${bizUid}, 30)" style="${btnStyle(30)}">30 дней</button>
                        <button onclick="UI_DASHBOARD.showStoreAnalyticsModal(${bizUid}, 365)" style="${btnStyle(365)}">Год</button>
                        <button onclick="UI_DASHBOARD.showStoreAnalyticsModal(${bizUid}, 'all')" style="${btnStyle('all')}">За всё время</button>
                    </div>
                    <div style="color:var(--text-dim); font-size:0.85rem; font-weight:600;">Период: ${periodDays === 'all' ? 'Всё время' : periodDays + ' дн.'} (Дней в отчете: ${actualDays})</div>
                </div>

                <div style="padding:24px; overflow-y:auto; flex:1;">
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:24px;">
                        <div style="background:var(--surface-2); padding:16px; border-radius:10px; border-left:4px solid var(--green);">
                            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; margin-bottom:4px;">Реальная Выручка</div>
                            <div style="font-size:1.4rem; font-weight:800; color:var(--text);">$${formatMoney(aggRev)}</div>
                            <div style="font-size:0.75rem; color:var(--red); margin-top:4px;">Потери трафика: $${formatMoney(aggMissed)}</div>
                        </div>
                        <div style="background:var(--surface-2); padding:16px; border-radius:10px; border-left:4px solid var(--orange);">
                            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; margin-bottom:4px;">Расходы (COGS + OPEX)</div>
                            <div style="font-size:1.4rem; font-weight:800; color:var(--text);">-$${formatMoney(aggCogs + totalOpex)}</div>
                            <div style="font-size:0.75rem; color:var(--text-dim); margin-top:4px;">Себест-ть: $${formatMoney(aggCogs)} | OPEX: $${formatMoney(totalOpex)}</div>
                        </div>
                        <div style="background:var(--surface-2); padding:16px; border-radius:10px; border-left:4px solid ${totalProfit >= 0 ? 'var(--green)' : 'var(--red)'};">
                            <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700; margin-bottom:4px;">Фин. Результат (Прибыль)</div>
                            <div style="font-size:1.4rem; font-weight:800; color:${totalProfit >= 0 ? 'var(--green)' : 'var(--red)'};">$${formatMoney(totalProfit)}</div>
                            <div style="font-size:0.75rem; color:var(--text-dim); margin-top:4px;">ROS (Маржа): ${marginPct.toFixed(1)}% | ROA: ${roa.toFixed(1)}%</div>
                        </div>
                    </div>

                    <h4 style="margin:0 0 16px 0; color:var(--text);">📈 Динамика продаж</h4>
                    <div style="height:250px; position:relative; margin-bottom:24px; background:var(--surface-2); border-radius:12px; padding:12px; border:1px solid var(--border);">
                        <canvas id="storeAnalyticsChart"></canvas>
                    </div>
                    
                    <h4 style="margin:0 0 8px 0; color:var(--text);">🏆 ABC-Анализ ассортимента</h4>
                    <div style="border:1px solid var(--border); border-radius:10px; overflow:hidden; background:var(--surface);">
                        ${abcHtml}
                    </div>
                </div>
            </div>
        `;

        // 6. Реальная отрисовка Графика
        let ctx = document.getElementById('storeAnalyticsChart');
        let labels = [];
        let revData = [];
        let missedData = [];
        
        if (history.length <= 30) {
            // Если период небольшой, показываем каждый день
            history.forEach(h => {
                labels.push('Д ' + h.day);
                revData.push(h.revenue);
                missedData.push(h.missed);
            });
        } else {
            // Если дней много, группируем по неделям/месяцам (сжимаем до ~15 колонок на графике)
            let groupSize = Math.ceil(history.length / 15);
            for (let i = 0; i < history.length; i += groupSize) {
                let chunk = history.slice(i, i + groupSize);
                let cRev = chunk.reduce((s, h) => s + h.revenue, 0);
                let cMis = chunk.reduce((s, h) => s + h.missed, 0);
                labels.push(chunk.length > 1 ? `Д ${chunk[0].day}-${chunk[chunk.length-1].day}` : `Д ${chunk[0].day}`);
                revData.push(cRev);
                missedData.push(cMis);
            }
        }

        if (this.storeChartInstance) this.storeChartInstance.destroy();
        this.storeChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Реальная выручка ($)',
                        data: revData,
                        backgroundColor: 'rgba(52, 199, 89, 0.8)',
                        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }
                    },
                    {
                        label: 'Упущенная выгода ($)',
                        data: missedData,
                        backgroundColor: 'rgba(255, 59, 48, 0.8)',
                        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true, ticks: { callback: v => '$' + v }, grid: { color: 'rgba(0,0,0,0.05)' } }
                },
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
                    tooltip: {
                        callbacks: {
                            label: function(context) { return context.dataset.label + ': $' + formatMoney(context.raw); }
                        }
                    }
                }
            }
        });
    },
    
    // Красивое модальное окно Журнала событий
    showEventLog() {
        let oldModal = document.getElementById('event-modal');
        if (oldModal) oldModal.remove();

        let modal = document.createElement('div');
        modal.id = 'event-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(3px);';
        
        let logsHtml = '';
        if (!STATE.eventLog || STATE.eventLog.length === 0) {
            logsHtml = '<p style="color:#7f8c8d; text-align:center; padding: 20px;">Новостей и событий пока нет.</p>';
        } else {
            logsHtml = '<ul style="list-style:none; padding:0; margin:0; max-height: 400px; overflow-y: auto;">';
            STATE.eventLog.forEach(log => {
                let color = log.type === 'good' ? '#27ae60' : (log.type === 'bad' ? '#c0392b' : '#2980b9');
                logsHtml += `
                <li style="border-left: 4px solid ${color}; background: #f9f9f9; padding: 10px; margin-bottom: 8px; border-radius: 0 4px 4px 0;">
                    <small style="color:#7f8c8d; display:block; margin-bottom: 4px;">📅 День ${log.day}</small>
                    <span style="color:#2c3e50;">${log.msg}</span>
                </li>`;
            });
            logsHtml += '</ul>';
        }

        modal.innerHTML = `
            <div style="background:#fff; padding:20px; border-radius:8px; width:500px; max-width:90%; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">
                    <h2 style="margin:0; color:#2c3e50; font-size: 1.5em;">📜 Журнал компании</h2>
                    <button onclick="document.getElementById('event-modal').remove()" style="background:none; border:none; font-size:1.5em; cursor:pointer; color:#7f8c8d;">&times;</button>
                </div>
                ${logsHtml}
                <button onclick="document.getElementById('event-modal').remove()" style="width:100%; padding:10px; margin-top:15px; background:#ecf0f1; border:none; border-radius:4px; color:#34495e; font-weight: bold; cursor:pointer;">Закрыть</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // --- УНИВЕРСАЛЬНОЕ ОКНО ВЫБОРА ЛОКАЦИИ (ГЕО-ЭКОНОМИКА) ---
    showCityModal(actionType, bizType = null) {
        let oldModal = document.getElementById('city-modal');
        if (oldModal) oldModal.remove();

        let modal = document.createElement('div');
        modal.id = 'city-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:1000000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(4px);';
        
        let title = actionType === 'warehouse' ? 'Где открываем или расширяем склад?' : 'Выберите город для инвестиций';
        if (bizType && typeof RECIPES !== 'undefined' && RECIPES.BUSINESSES[bizType]) {
            title = `Открытие: ${RECIPES.BUSINESSES[bizType].name}`;
        }

        let citiesHtml = '';
        Object.keys(GEO.CITIES).forEach(cId => {
            let city = GEO.CITIES[cId];
            
            let rentColor = city.rentMult > 1.1 ? '#c0392b' : (city.rentMult < 1 ? '#27ae60' : '#7f8c8d');
            let salaryColor = city.salaryMult > 1.1 ? '#c0392b' : (city.salaryMult < 1 ? '#27ae60' : '#7f8c8d');
            let demandColor = city.demandMult > 1.1 ? '#27ae60' : (city.demandMult < 1 ? '#c0392b' : '#7f8c8d');

            let actionCode = '';
            if (actionType === 'warehouse') {
                let cost = WAREHOUSE.getUpgradeCost(cId);
                let currentLvl = STATE.company.warehouses[cId] ? STATE.company.warehouses[cId].level : 0;
                let lvlText = currentLvl === 0 ? 'Построить новый хаб' : `Расширить до Ур. ${currentLvl + 1}`;
                
                actionCode = `document.getElementById('city-modal').remove(); WAREHOUSE.upgrade('${cId}');`;
                citiesHtml += `
                <div onclick="${actionCode}" style="background:#fdfefe; border:2px solid #bdc3c7; border-radius:8px; padding:15px; margin-bottom:10px; cursor:pointer; transition:0.2s; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:1.2em; color:#2c3e50;">${city.name}</strong><br>
                        <small style="color:#7f8c8d;">${currentLvl > 0 ? 'Уже построен (Ур. ' + currentLvl + ')' : 'Склада в городе нет'}</small>
                    </div>
                    <div style="text-align:right;">
                        <span style="display:block; font-size:1.1em; color:#27ae60; font-weight:bold;">$${formatMoney(cost)}</span>
                        <small style="color:${rentColor};">${lvlText} (Аренда: x${city.rentMult})</small>
                    </div>
                </div>`;
            } else {
                actionCode = `document.getElementById('city-modal').remove(); PRODUCTION.buyBusiness('${bizType}', '${cId}');`;
                
                let recBadge = '';
                let borderStyle = 'border:1px solid #dcdde1; background:#ffffff;';
                
                if (cId === 'kharkiv') {
                    recBadge = `<div style="margin-top:3px;"><span style="background:#e8f8ee; color:#27ae60; border:1px solid #a3e9b9; padding:2px 6px; border-radius:6px; font-size:0.72em; font-weight:bold;">⭐ Рекомендуется для старта (Низкая аренда)</span></div>`;
                    borderStyle = 'border:2px solid #27ae60; background:#f6fcf8; box-shadow:0 2px 10px rgba(39,174,96,0.15);';
                } else if (cId === 'odesa') {
                    recBadge = `<div style="margin-top:3px;"><span style="background:#e8f4fd; color:#2980b9; border:1px solid #a9d7f9; padding:2px 6px; border-radius:6px; font-size:0.72em; font-weight:bold;">🌊 Высокий спрос (Сбалансировано)</span></div>`;
                    borderStyle = 'border:2px solid #2980b9; background:#f6faff; box-shadow:0 2px 10px rgba(41,128,185,0.15);';
                } else if (cId === 'kyiv') {
                    recBadge = `<div style="margin-top:3px;"><span style="background:#fef5e7; color:#d35400; border:1px solid #f8c471; padding:2px 6px; border-radius:6px; font-size:0.72em; font-weight:bold;">👑 Крупный рынок (Дорогая аренда x1.5)</span></div>`;
                }

                citiesHtml += `
                <div onclick="${actionCode}" style="${borderStyle} border-radius:12px; padding:12px; margin-bottom:10px; cursor:pointer; transition:0.2s; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="min-width:140px;">
                        <strong style="font-size:1.15em; color:#2c3e50;">${city.name}</strong>
                        ${recBadge}
                        <small style="color:#7f8c8d; display:block; margin-top:2px;">Население: ${(city.population/1000000).toFixed(1)} млн</small>
                    </div>
                    <div style="font-size:0.82em; min-width:130px;">
                        <div style="color:${rentColor};">🏢 Аренда: <strong>x${city.rentMult}</strong></div>
                        <div style="color:${salaryColor};">💼 Зарплаты: <strong>x${city.salaryMult}</strong></div>
                    </div>
                    <div style="text-align:right; min-width:100px;">
                        <div style="color:${demandColor}; font-size:1.08em; font-weight:bold;">🛒 Спрос: x${city.demandMult}</div>
                    </div>
                </div>`;
            }
        });

        modal.innerHTML = `
            <div style="background:#fff; padding:20px 16px; border-radius:16px; width:550px; max-width:94%; box-shadow: 0 20px 50px rgba(0,0,0,0.25); max-height:85vh; display:flex; flex-direction:column;">
                <h2 style="margin-top:0; color:#2c3e50; font-size: 1.3em; border-bottom:2px solid #ecf0f1; padding-bottom:10px;">🗺️ ${title}</h2>
                <div style="background: rgba(52, 199, 89, 0.12); border-left: 4px solid #34C759; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 0.84em; color: #1d1d1f;">
                    <strong>💡 Рекомендация для старта:</strong> Выбирайте <strong>Харьков</strong> (минимальная аренда x1.0) или <strong>Одессу</strong> (отличный спрос x1.25), чтобы не уйти в кассовый разрыв.
                </div>
                <div style="overflow-y: auto; flex: 1; padding-right: 4px;">
                    ${citiesHtml}
                </div>
                <button onclick="document.getElementById('city-modal').remove()" style="width:100%; padding:12px; margin-top:12px; background:#ecf0f1; border:none; border-radius:10px; color:#7f8c8d; font-weight: bold; cursor:pointer; min-height:44px;">Отмена</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // --- КВЕСТ-ЦЕНТР И СТРАТЕГИЧЕСКИЕ МИССИИ ---
    renderQuestWidget() {
        let el = document.getElementById('ui-quest-widget');
        if (!el || typeof QUESTS === 'undefined') return;

        let curChId = STATE.quests ? (STATE.quests.currentChapter || 1) : 1;
        let ch = QUESTS.CHAPTERS[curChId] || QUESTS.CHAPTERS[1];
        let quests = QUESTS.LIST.filter(q => q.chapter === curChId);

        let completedCount = quests.filter(q => STATE.quests.completed && STATE.quests.completed.includes(q.id)).length;
        let percent = quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0;

        let questsHTML = quests.map(q => {
            let isDone = STATE.quests.completed && STATE.quests.completed.includes(q.id);
            let isClaimed = STATE.quests.claimed && STATE.quests.claimed.includes(q.id);
            let prog = q.progress ? q.progress(STATE) : { label: isDone ? 'Готово' : 'В процессе' };

            let actionBtn = '';
            if (isDone && !isClaimed) {
                actionBtn = `<button onclick="QUESTS.claimReward('${q.id}')" style="background: var(--green, #34C759); color: white; border: none; padding: 7px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 8px rgba(52,199,89,0.4);">🎁 Забрать награду</button>`;
            } else if (isClaimed) {
                actionBtn = `<span style="color: var(--text-dim, #86868B); font-size: 0.85em; font-weight: 600;">✅ Выполнено</span>`;
            } else {
                actionBtn = `<span style="background: var(--surface-3, #E8E8ED); color: var(--text-dim, #86868B); padding: 4px 10px; border-radius: 6px; font-size: 0.85em;">${prog.label}</span>`;
            }

            return `
                <div style="background: var(--surface-2, #F5F5F7); border: 1px solid var(--border, rgba(0,0,0,0.08)); border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 240px;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                            <span>${isDone ? '✅' : '🎯'}</span>
                            <strong style="color: var(--text, #1D1D1F); font-size: 0.95em; text-decoration: ${isClaimed ? 'line-through' : 'none'};">${q.title}</strong>
                        </div>
                        <div style="color: var(--text-dim, #86868B); font-size: 0.85em; margin-bottom: 3px;">${q.desc}</div>
                        <div style="color: var(--blue, #007AFF); font-size: 0.8em; font-weight: 500;">Награда: ${q.reward.text}</div>
                    </div>
                    <div style="text-align: right; min-width: 140px;">
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('');

        el.innerHTML = `
            <div class="card" style="border-left: 4px solid var(--blue, #007AFF); background: var(--surface, #FFFFFF); margin-bottom: 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.4em;">${ch.icon}</span>
                            <h3 style="margin: 0; font-size: 1.15em; color: var(--text, #1D1D1F);">${ch.title}</h3>
                            <span style="background: var(--blue-dim, rgba(0,122,255,0.1)); color: var(--blue, #007AFF); font-size: 0.75em; padding: 2px 8px; border-radius: 10px; font-weight: bold;">Глава ${curChId}/5</span>
                        </div>
                        <p style="margin: 4px 0 0 0; color: var(--text-dim, #86868B); font-size: 0.88em;">${ch.desc}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: var(--text, #1D1D1F); font-size: 0.88em;">Прогресс: ${completedCount} / ${quests.length} (${percent}%)</div>
                        <div style="width: 140px; height: 6px; background: var(--surface-3, #E8E8ED); border-radius: 3px; overflow: hidden; margin-top: 4px; display: inline-block;">
                            <div style="width: ${percent}%; height: 100%; background: var(--blue, #007AFF); transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    ${questsHTML}
                </div>
            </div>
        `;
    },

    showBankModal(type, id) {
        let content = document.getElementById('bank-modal-content');
        if (!content) return;

        if (type === 'loan') {
            let loan = STATE.finances.loans.find(l => l.id === id);
            if (!loan) return;

            let schedule = FINANCE.generatePaymentSchedule(loan);
            let labels = schedule.map(s => 'День ' + s.day);
            let principalData = schedule.map(s => s.principal);
            let interestData = schedule.map(s => s.interest);

            content.innerHTML = `
                <div style="padding:24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--surface-2);">
                    <h2 style="margin:0; font-size:1.4rem;">График платежей: Заём $${formatMoney(loan.amount)}</h2>
                    <button onclick="UI_DASHBOARD.closeBankModal()" style="background:transparent; border:none; font-size:1.5rem; color:var(--text-dim); cursor:pointer;">&times;</button>
                </div>
                <div style="padding:24px;">
                    <div style="height:300px; position:relative; margin-bottom:24px;">
                        <canvas id="bankScheduleChart"></canvas>
                    </div>
                    <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
                            <thead style="background:var(--surface-2); position:sticky; top:0;">
                                <tr>
                                    <th style="padding:8px; border-bottom:1px solid var(--border); text-align:center;">День</th>
                                    <th style="padding:8px; border-bottom:1px solid var(--border);">Тело кредита</th>
                                    <th style="padding:8px; border-bottom:1px solid var(--border);">Проценты</th>
                                    <th style="padding:8px; border-bottom:1px solid var(--border);">Остаток</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${schedule.map(s => `
                                <tr>
                                    <td style="padding:6px; border-bottom:1px solid var(--border); text-align:center;">${s.day}</td>
                                    <td style="padding:6px; border-bottom:1px solid var(--border); color:var(--text);">$${formatMoney(s.principal)}</td>
                                    <td style="padding:6px; border-bottom:1px solid var(--border); color:var(--red);">$${formatMoney(s.interest)}</td>
                                    <td style="padding:6px; border-bottom:1px solid var(--border); color:var(--orange);">$${formatMoney(s.remaining)}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            document.getElementById('bank-modal').style.display = 'flex';
            
            let ctx = document.getElementById('bankScheduleChart');
            if (this.bankChartInstance) this.bankChartInstance.destroy();
            this.bankChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Проценты (Переплата)',
                            data: interestData,
                            backgroundColor: 'rgba(255, 59, 48, 0.8)',
                            stack: 'Stack 0',
                        },
                        {
                            label: 'Тело кредита',
                            data: principalData,
                            backgroundColor: 'rgba(0, 122, 255, 0.8)',
                            stack: 'Stack 0',
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, ticks: { callback: v => '$' + v } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) { return context.dataset.label + ': $' + formatMoney(context.raw); }
                            }
                        }
                    }
                }
            });
        } else if (type === 'deposit') {
            let deposit = STATE.finances.deposits.find(d => d.id === id);
            if (!deposit) return;

            let schedule = [];
            let currentAccrued = deposit.accrued;
            let dailyInt = (deposit.amount * deposit.rate) / 365;
            
            for (let i = 0; i < deposit.daysLeft; i++) {
                if (deposit.payoutType !== 'daily') currentAccrued += dailyInt;
                schedule.push({
                    day: i + 1,
                    interest: dailyInt,
                    accrued: currentAccrued
                });
            }

            let labels = schedule.map(s => 'День ' + s.day);
            let accruedData = schedule.map(s => deposit.amount + s.accrued);

            content.innerHTML = `
                <div style="padding:24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--surface-2);">
                    <h2 style="margin:0; font-size:1.4rem;">Прогноз: Депозит $${formatMoney(deposit.amount)}</h2>
                    <button onclick="UI_DASHBOARD.closeBankModal()" style="background:transparent; border:none; font-size:1.5rem; color:var(--text-dim); cursor:pointer;">&times;</button>
                </div>
                <div style="padding:24px;">
                    <div style="height:300px; position:relative; margin-bottom:24px;">
                        <canvas id="bankScheduleChart"></canvas>
                    </div>
                </div>
            `;
            
            document.getElementById('bank-modal').style.display = 'flex';
            
            let ctx = document.getElementById('bankScheduleChart');
            if (this.bankChartInstance) this.bankChartInstance.destroy();
            this.bankChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Общая сумма с процентами',
                            data: accruedData,
                            borderColor: 'rgba(52, 199, 89, 1)',
                            backgroundColor: 'rgba(52, 199, 89, 0.1)',
                            fill: true,
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { ticks: { callback: v => '$' + v } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) { return 'Сумма: $' + formatMoney(context.raw); }
                            }
                        }
                    }
                }
            });
        }
    },

    closeBankModal() {
        document.getElementById('bank-modal').style.display = 'none';
        if (this.bankChartInstance) {
            this.bankChartInstance.destroy();
            this.bankChartInstance = null;
        }
    }
};
