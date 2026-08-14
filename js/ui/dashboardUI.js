// Глобальные утилиты форматирования
window.formatMoney = function(amount) {
    return Number(amount).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.formatFinancialResult = function(amount) {
    if (amount > 0) return '+$' + formatMoney(amount);
    if (amount < 0) return '-$' + formatMoney(Math.abs(amount));
    return '$' + formatMoney(0);
};

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
            
        } catch (err) {
            this.showError(err);
        }
    },

    // --- 1. ТОП-ПАНЕЛЬ ---
    updateTopPanel() {
        if (document.getElementById('ui-day')) document.getElementById('ui-day').innerText = STATE.time.day;
        if (document.getElementById('ui-balance')) document.getElementById('ui-balance').innerText = formatMoney(STATE.finances.balance);
        if (document.getElementById('ui-credit')) document.getElementById('ui-credit').innerText = STATE.finances.creditScore;
    },

    // --- ИНИЦИАЛИЗАЦИЯ ГРАФИКОВ ---
    initCharts() {
        if (!this.charts) this.charts = { cashflow: null, assets: null };
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
        document.getElementById('dash-kpi-brand').innerText = (STATE.retail && STATE.retail.brand) ? STATE.retail.brand.toFixed(1) : '10.0';
        document.getElementById('dash-kpi-credit').innerText = typeof FINANCE !== 'undefined' ? formatMoney(FINANCE.getAvailableLimit()) : '0.00';

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
                availList.innerHTML = '<li><small style="color:#7f8c8d;">Пока нет новых тендеров. Вернитесь через пару дней.</small></li>';
            } else {
                STATE.contracts.available.forEach(c => {
                    let itemName = RECIPES.RESOURCES[c.item].name;
                    availList.innerHTML += `
                    <li style="background: #fdfefe; border: 1px solid #d0d3d4; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                        <strong style="color: #2c3e50;">Заказ: ${itemName} (${c.qty} шт.)</strong><br>
                        <small>Цена поставки: $${formatMoney(c.price)}/шт (Сумма: <span class="success">$${formatMoney(c.totalReward)}</span>)</small><br>
                        <small>Жесткий срок: <strong>${c.deadline} дн.</strong> | Штраф: <span class="danger">$${formatMoney(c.penalty)}</span></small><br>
                        <button onclick="CONTRACTS.accept(${c.id})" style="background: #3498db; width: 100%; margin-top: 5px;">Подписать контракт</button>
                    </li>`;
                });
            }
        }

        let activeList = document.getElementById('ui-contracts-active');
        if (activeList) {
            activeList.innerHTML = '';
            if (STATE.contracts.active.length === 0) {
                activeList.innerHTML = '<li><small style="color:#7f8c8d;">Нет активных обязательств.</small></li>';
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
                    
                    let bg = canFulfill ? '#e8f8f5' : (c.deadline <= 3 ? '#fdedec' : '#fdfefe');
                    
                    activeList.innerHTML += `
                    <li style="background: ${bg}; border: 1px solid #d0d3d4; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                        <strong>Поставка: ${itemName}</strong><br>
                        <small>На складе: <strong>${inv} / ${c.qty}</strong> шт. | Оплата: <span class="success">$${formatMoney(c.totalReward)}</span></small><br>
                        <small>Осталось времени: <strong class="${c.deadline <= 3 ? 'danger' : ''}">${c.deadline} дн.</strong> | Неустойка: <span class="danger">$${formatMoney(c.penalty)}</span></small><br>
                        <button onclick="CONTRACTS.fulfill(${c.id})" ${!canFulfill ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="background: #27ae60; width: 100%; margin-top: 5px;">Отгрузить партию</button>
                    </li>`;
                });
            }
        }
    },

    // --- 4. ЛАБОРАТОРИЯ R&D ---
    updateRnDTab() {
        if (typeof RND === 'undefined') return;
        RND.init();
        
        let rndStaffPanel = document.getElementById('ui-rnd-staff');
        let lvl = STATE.rnd.facility.level || 0;

        let buyContainer = document.getElementById('ui-buy-businesses');
        if (buyContainer) {
            buyContainer.innerHTML = '';
            Object.keys(RECIPES.BUSINESSES).forEach(key => {
                let tpl = RECIPES.BUSINESSES[key];
                
                // Исключаем магазины и офисы из вкладки заводов
                if (tpl.isRetail || tpl.isMarketing) return;

                let isUnlocked = (tpl.researchCost === 0) || (STATE.rnd && STATE.rnd.unlocked && STATE.rnd.unlocked.includes(key));
                if (isUnlocked) {
                    buyContainer.innerHTML += `<button onclick="PRODUCTION.buyBusiness('${key}')" style="background: #27ae60; color: white; border: none; cursor: pointer; border-radius: 4px; margin-bottom: 5px; margin-right: 5px; padding: 8px 12px;">Построить ${tpl.name} ($${formatMoney(tpl.area * 50)})</button> `;
                }
            });
        }

        if (lvl === 0) {
            if (rndStaffPanel) {
                rndStaffPanel.innerHTML = `
                    <div style="background: #fdfefe; padding: 25px; border: 1px dashed #e74c3c; border-radius: 5px; text-align: center;">
                        <h3 style="margin-top:0; color: #c0392b;">🔬 Нет Научно-Исследовательского Центра</h3>
                        <p style="color: #7f8c8d; font-size: 1.1em;">Для разработки новых технологий необходимо инвестировать в строительство первого корпуса НИИ.</p>
                        <button onclick="RND.upgradeFacility()" style="background: #e67e22; padding: 12px 25px; font-size: 1.1em; border-radius: 4px; cursor: pointer;">
                            Построить корпус НИИ ($${formatMoney(RND.getUpgradeCost())})
                        </button>
                    </div>
                `;
            }
            if (document.getElementById('ui-rnd-active')) document.getElementById('ui-rnd-active').innerHTML = '';
            if (document.getElementById('ui-rnd-available')) document.getElementById('ui-rnd-available').innerHTML = '';
            return; 
        }

        if (rndStaffPanel) {
            let rpSpeed = RND.getDailyRP();
            let eqCount = STATE.rnd.facility.equipment.count || 0;
            let cond = STATE.rnd.facility.equipment.condition !== undefined ? STATE.rnd.facility.equipment.condition : 100;
            let condColor = cond >= 70 ? '#27ae60' : (cond >= 30 ? '#f39c12' : '#c0392b');
            let maxStaff = RND.getMaxStaff();
            let curStaff = (STATE.rnd.staff.scientist || 0) + (STATE.rnd.staff.lead_scientist || 0);
            
            let eqWarning = curStaff > eqCount ? `<br><small style="color:#e74c3c;">Внимание: Учёных больше, чем ПК!</small>` : '';

            rndStaffPanel.innerHTML = `
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="flex: 1; min-width: 250px; background: #fff; padding: 15px; border: 1px solid #dcdde1; border-radius: 5px;">
                        <h4 style="margin:0 0 10px 0;">🏢 Корпус НИИ (Ур. ${lvl})</h4>
                        <p style="margin:0 0 5px 0;"><strong>Скорость:</strong> <span class="success">+${rpSpeed} RP/день</span></p>
                        <p style="margin:0 0 10px 0;">Места: ${curStaff} / ${maxStaff}</p>
                        <button onclick="RND.upgradeFacility()" style="background: #f39c12; width: 100%; padding: 6px;">Расширить НИИ ($${formatMoney(RND.getUpgradeCost())})</button>
                    </div>

                    <div style="flex: 1; min-width: 250px; background: #fdfefe; padding: 15px; border: 1px dashed #bdc3c7; border-radius: 5px;">
                        <h4 style="margin:0 0 10px 0;">💻 Оборудование (ПК)</h4>
                        Установлено: <strong>${eqCount} / ${maxStaff}</strong> | Износ: <strong style="color:${condColor}">${cond.toFixed(1)}%</strong>${eqWarning}
                        <div style="margin-top: 10px; display: flex; gap: 5px;">
                            <input type="number" id="install-pc-qty" value="1" min="1" max="${maxStaff - eqCount}" style="width:60px; padding:4px;">
                            <button onclick="RND.installEquipment(parseInt(document.getElementById('install-pc-qty').value))" style="background:#2980b9; flex-grow: 1;">Установить</button>
                            <button onclick="RND.repairEquipment()" style="background:#8e44ad;">ТО</button>
                        </div>
                    </div>
                </div>

                <div style="background: #ecf0f1; padding: 15px; border-radius: 4px; border: 1px solid #bdc3c7;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 10px;">ПЕРСОНАЛ (${curStaff}/${maxStaff}):</strong>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span>Лаборант (Занято: <strong>${STATE.rnd.staff.scientist}</strong>)</span>
                        <div>
                            <button onclick="RND.removeStaff('scientist')" style="padding: 2px 10px; background:#e74c3c;">-</button> 
                            <button onclick="RND.assignStaff('scientist')" style="padding: 2px 10px; background:#2ecc71;">+</button> 
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Ст. Научный (Занято: <strong>${STATE.rnd.staff.lead_scientist}</strong>)</span>
                        <div>
                            <button onclick="RND.removeStaff('lead_scientist')" style="padding: 2px 10px; background:#e74c3c;">-</button> 
                            <button onclick="RND.assignStaff('lead_scientist')" style="padding: 2px 10px; background:#2ecc71;">+</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // ВИЗУАЛЬНО РАЗДЕЛЕННЫЕ БЛОКИ (КАРТОЧКИ)
        let rndActive = document.getElementById('ui-rnd-active');
        let rndAvail = document.getElementById('ui-rnd-available');
        if (rndActive && rndAvail) {
            let activeHTML = '';
            
            // 1. Блок текущего проекта
            if (STATE.rnd.activeProject) {
                let tpl = RECIPES.BUSINESSES[STATE.rnd.activeProject];
                let isUnlocked = STATE.rnd.unlocked && STATE.rnd.unlocked.includes(STATE.rnd.activeProject);
                let targetCost = isUnlocked ? (tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000) : tpl.researchCost; 
                let titleName = isUnlocked ? `Совершенствование: ${tpl.name}` : `Изучение: ${tpl.name}`;
                let percent = targetCost > 0 ? Math.min(100, (STATE.rnd.points / targetCost) * 100).toFixed(1) : '100.0';
                
                activeHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #fdfefe; padding: 12px; border: 1px solid #f39c12; border-radius: 6px; margin-bottom: 10px;">
                        <div>
                            <strong>${titleName}</strong> — Собрано: ${STATE.rnd.points} / ${targetCost} RP (${percent}%)
                        </div>
                        <button onclick="RND.pauseProject()" style="background: #e67e22; padding: 6px 14px; font-size: 0.9em;">Приостановить</button>
                    </div>
                `;
            } else {
                activeHTML += `<div style="color:#7f8c8d; margin-bottom: 10px;">Нет активных исследований. Выберите проект ниже.</div>`;
            }

            // 2. Блок приостановленных проектов (если они есть > 0 очков)
            if (STATE.rnd.savedProgress && Object.keys(STATE.rnd.savedProgress).length > 0) {
                activeHTML += `<div style="background: #fcf3cf; padding: 12px; border-radius: 6px; border: 1px solid #f9e79f; margin-top: 10px;">
                    <strong style="color: #b7950b; display: block; margin-bottom: 8px;">⏸️ Приостановленные проекты:</strong>
                    <ul style="padding-left: 0; list-style: none; margin-bottom: 0;">`;
                
                Object.keys(STATE.rnd.savedProgress).forEach(bizId => {
                    let pts = STATE.rnd.savedProgress[bizId];
                    if (pts > 0) {
                        let tpl = RECIPES.BUSINESSES[bizId];
                        let isUnlocked = STATE.rnd.unlocked.includes(bizId);
                        let targetCost = isUnlocked ? (tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000) : tpl.researchCost;
                        let titleName = isUnlocked ? `Совершенствование: ${tpl.name}` : `Изучение: ${tpl.name}`;
                        let percent = targetCost > 0 ? Math.min(100, (pts / targetCost) * 100).toFixed(1) : '100.0';

                        activeHTML += `
                            <li style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 8px 10px; margin-bottom: 6px; border-radius: 4px; border: 1px solid #f7dc6f;">
                                <div><strong>${titleName}</strong> <small style="color:#7f8c8d;">(${pts} / ${targetCost} RP - ${percent}%)</small></div>
                                <button onclick="RND.startProject('${bizId}')" style="background: #27ae60; padding: 4px 10px; font-size: 0.85em;">Продолжить</button>
                            </li>
                        `;
                    }
                });
                activeHTML += `</ul></div>`;
            }

            rndActive.innerHTML = activeHTML;

            let newTechListHTML = '';
            let upgradeTechListHTML = '';
            let maxedTechListHTML = ''; // Блок для полностью изученных
            
            let hasNew = false;
            let hasUpgrade = false;
            let hasMaxed = false;

            if (!STATE.rnd.unlocked) STATE.rnd.unlocked = ['microchips', 'parts3d'];
            if (!STATE.rnd.unlocked.includes('microchips')) STATE.rnd.unlocked.push('microchips');
            if (!STATE.rnd.unlocked.includes('parts3d')) STATE.rnd.unlocked.push('parts3d');

            Object.keys(RECIPES.BUSINESSES).forEach(key => {
                let tpl = RECIPES.BUSINESSES[key];
                
                // Проверяем статус проекта (Активен или на Паузе)
                let isPaused = STATE.rnd.savedProgress && STATE.rnd.savedProgress[key] > 0;
                let isResearching = STATE.rnd.activeProject === key;

                // ИСКЛЮЧЕНИЕ: Если проект сейчас изучается или на паузе — не выводим его в нижние списки
                if (isPaused || isResearching) return;

                if (tpl.researchCost >= 0) {
                    let isUnlocked = STATE.rnd.unlocked.includes(key);
                    let currentLevel = (STATE.rnd.techLevels && STATE.rnd.techLevels[key]) ? STATE.rnd.techLevels[key] : 1.0;

                    // ЕСЛИ УЖЕ ОТКРЫТО (Идет в Апгрейд или в Максимум)
                    if (isUnlocked) {
                        if (currentLevel >= 2.0) {
                            hasMaxed = true;
                            maxedTechListHTML += `<li style="margin-bottom: 10px; padding: 10px; background: #fdfefe; border: 1px solid #dcdde1; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; opacity: 0.8;">
                                <div><strong>${tpl.name}</strong> <span style="color:#27ae60; font-size: 0.9em; margin-left: 10px;">🏆 Максимальный уровень: v2.00</span></div> 
                                <span style="color:#27ae60; font-weight: bold;">[Завершено]</span>
                            </li>`;
                        } else {
                            hasUpgrade = true;
                            let upgradeCost = tpl.researchCost > 0 ? tpl.researchCost * 2 : 1000;
                            upgradeTechListHTML += `<li style="margin-bottom: 10px; padding: 10px; background: #fff; border: 1px solid #dcdde1; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                <div><strong>${tpl.name}</strong> <span style="color:#3498db; font-size: 0.9em; margin-left: 10px;">Уровень качества: v${currentLevel.toFixed(2)} / 2.0</span></div> 
                                <button onclick="RND.startProject('${key}')" style="padding: 6px 14px; background:#2980b9;">Улучшить качество (${upgradeCost} RP)</button>
                            </li>`;
                        }
                    } 
                    // ЕСЛИ ЕЩЕ НЕ ОТКРЫТО (Идет в Новые технологии)
                    else if (tpl.researchCost > 0) {
                        hasNew = true;
                        newTechListHTML += `<li style="margin-bottom: 10px; padding: 10px; background: #fff; border: 1px solid #dcdde1; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                            <div><strong>${tpl.name}</strong> <span style="color:#e67e22; font-size: 0.9em; margin-left: 10px;">[Требует изучения: ${tpl.researchCost} RP]</span></div> 
                            <button onclick="RND.startProject('${key}')" style="padding: 6px 14px; background:#8e44ad;">Изучить (${tpl.researchCost} RP)</button>
                        </li>`;
                    }
                }
            });

            if (!hasNew) newTechListHTML = '<p style="color:#7f8c8d; font-style: italic; padding: 5px;">Все доступные чертежи изучены.</p>';
            if (!hasUpgrade) upgradeTechListHTML = '<p style="color:#7f8c8d; font-style: italic; padding: 5px;">Нет доступных для улучшения технологий.</p>';
            if (!hasMaxed) maxedTechListHTML = '<p style="color:#7f8c8d; font-style: italic; padding: 5px;">Пока нет полностью усовершенствованных технологий.</p>';

            // Рендерим все три блока
            rndAvail.innerHTML = `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; margin-bottom: 20px;">
                    <h4 style="margin-top: 0; color: #2c3e50; border-bottom: 2px solid #bdc3c7; padding-bottom: 8px;">📜 Новые технологии (Открытие чертежей)</h4>
                    <ul style="padding-left: 0; list-style: none; margin-bottom: 0;">${newTechListHTML}</ul>
                </div>

                <div style="background: #f1f8fc; padding: 15px; border-radius: 8px; border: 1px solid #d4e6f1; margin-bottom: 20px;">
                    <h4 style="margin-top: 0; color: #2980b9; border-bottom: 2px solid #85c1e9; padding-bottom: 8px;">⚙️ Совершенствование производства (Рост качества до v2.0)</h4>
                    <ul style="padding-left: 0; list-style: none; margin-bottom: 0;">${upgradeTechListHTML}</ul>
                </div>

                <div style="background: #eafaf1; padding: 15px; border-radius: 8px; border: 1px solid #abebc6;">
                    <h4 style="margin-top: 0; color: #1e8449; border-bottom: 2px solid #58d68d; padding-bottom: 8px;">🏆 Полностью усовершенствованные (Максимум)</h4>
                    <ul style="padding-left: 0; list-style: none; margin-bottom: 0;">${maxedTechListHTML}</ul>
                </div>
            `;
        }
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

                let invHtml = '';
                if (!wh.inventory) wh.inventory = {};
                
                Object.keys(RECIPES.RESOURCES).forEach(key => {
                    let inv = wh.inventory[key];
                    if (inv && inv.qty > 0) {
                        let res = RECIPES.RESOURCES[key];
                        let totalVal = inv.qty * inv.avgCost;
                        let volStr = res.volume > 0 ? res.volume + ' м³/шт' : 'Цифровой товар';
                        
                        let storeOptions = '';
                        STATE.company.businesses.forEach(b => {
                            let bTpl = RECIPES.BUSINESSES[b.type];
                            if (bTpl.isRetail && bTpl.accepts && bTpl.accepts.includes(key)) {
                                let storeCityName = typeof GEO !== 'undefined' ? GEO.getCity(b.city || 'odesa').name : '';
                                let extraCost = (b.city || 'odesa') !== cId ? ' (Платная логистика)' : '';
                                storeOptions += `<option value="${b.uid}">${b.name} - ${storeCityName}${extraCost}</option>`;
                            }
                        });
                        
                        let transferHtml = '';
                        if (storeOptions !== '') {
                            transferHtml = `<div style="margin-top: 8px; display: flex; gap: 5px; align-items:center;">
                                <select id="trans-store-${cId}-${key}" style="font-size:0.85em; padding:4px; max-width:140px; border-radius:3px; border:1px solid #bdc3c7;">
                                    <option value="">В магазин...</option>${storeOptions}
                                </select>
                                <input type="number" id="trans-qty-${cId}-${key}" value="${inv.qty}" max="${inv.qty}" style="width:60px; font-size:0.85em; padding:4px; border-radius:3px; border:1px solid #bdc3c7;">
                                <button onclick="UI_DASHBOARD.transferToStore('${key}', '${cId}')" style="background:#e67e22; color:white; border:none; padding: 4px 10px; border-radius:3px; cursor:pointer;">Отгрузить</button>
                            </div>`;
                        }

                        invHtml += `<tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 10px;">
                                <strong style="font-size:1.1em; color:#2c3e50;">${res.name}</strong><br>
                                <small style="color: #7f8c8d;">${volStr}</small>
                                ${transferHtml}
                            </td>
                            <td><strong style="color: #2980b9; font-size:1.1em;">${inv.qty} шт.</strong></td>
                            <td><span style="color: #8e44ad; font-weight: bold;">★ ${(inv.quality || 1.0).toFixed(2)}</span></td>
                            <td>$${formatMoney(inv.avgCost)}</td>
                            <td><strong>$${formatMoney(totalVal)}</strong></td>
                        </tr>`;
                    }
                });
                
                if (invHtml === '') invHtml = '<tr><td colspan="5" style="text-align:center; padding: 15px; color:#7f8c8d;">Склад пуст. Закупите сырье на бирже или запустите производство.</td></tr>';

                warehouseList.innerHTML += `
                <li class="card" style="margin-bottom: 20px; list-style-type: none; padding: 0; overflow: hidden; border: 1px solid #dcdde1; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
                    <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fdfefe;">
                        <div>
                            <h3 style="margin: 0 0 5px 0; color: #2c3e50; font-size:1.3em;">📍 Логистический хаб: ${city.name} <span style="color:#3498db; font-size:0.8em;">(Ур. ${wh.level})</span></h3>
                            <p style="margin: 0; color: #7f8c8d; font-size:1.05em;">Аренда земли: <strong style="color:#c0392b;">$${formatMoney(dailyRent)}</strong> / день</p>
                        </div>
                        <div style="text-align: right; min-width: 250px;">
                            <p style="margin: 0 0 8px 0; font-size:1em; color: #2c3e50;">Занято: <strong>${curVol.toFixed(1)}</strong> м³ из <strong>${maxVol}</strong> м³</p>
                            <div style="width: 100%; background: var(--surface-3); height: 10px; border-radius: 5px; overflow:hidden;">
                                <div style="width: ${percent}%; background: ${percent > 90 ? '#e74c3c' : '#3498db'}; height: 100%;"></div>
                            </div>
                        </div>
                    </div>
                    <div style="padding: 20px;">
                        <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
                            <tr style="border-bottom: 2px solid #bdc3c7; text-align: left;">
                                <th style="padding: 8px 10px;">Товарная позиция</th>
                                <th style="padding: 8px 10px;">В наличии</th>
                                <th style="padding: 8px 10px;">Качество</th>
                                <th style="padding: 8px 10px;">Себестоимость</th>
                                <th style="padding: 8px 10px;">Итоговая стоимость</th>
                            </tr>
                            ${invHtml}
                        </table>
                        <div style="margin-top: 20px; text-align: right; border-top: 1px dashed #bdc3c7; padding-top: 15px;">
                            <button onclick="WAREHOUSE.upgrade('${cId}')" style="background: #f39c12; color: white; border: none; cursor: pointer; padding: 8px 16px; border-radius: 4px; font-weight:bold; font-size:1em;">
                                Расширить площадь ($${formatMoney(upgradeCost)}) <br>
                                <small style="font-weight:normal;">Даст +${addedVol} м³ | Аренда +$${addedRent}/дн</small>
                            </button>
                        </div>
                    </div>
                </li>`;
            }
        });

        if (!hasWarehouses) {
            warehouseList.innerHTML = '<div style="text-align:center; padding: 40px; color:#7f8c8d; font-size:1.1em; background: #fff; border-radius: 8px; border: 1px solid #eee;">У вас нет открытых складов. Откройте первый склад, нажав кнопку выше.</div>';
        }
    },

    // --- 6. ПРОИЗВОДСТВО ---
    updateProductionTab() {
        let bizList = document.getElementById('ui-active-businesses');
        if (bizList) {
            bizList.innerHTML = '';
            
            let hasFactories = false;
            STATE.company.businesses.forEach(biz => {
                let tpl = RECIPES.BUSINESSES[biz.type];
                
                // ИГНОРИРУЕМ МАГАЗИНЫ И ОФИСЫ
                if (tpl.isRetail || tpl.isMarketing) return; 
                hasFactories = true;

                if (!biz.assigned) biz.assigned = { junior: 0, middle: 0, senior: 0 };
                if (!biz.stats) biz.stats = { daily: 0, monthly: [], total: 0, lastOutput: 0 };
                
                let level = biz.level || 1;
                let eqCount = biz.equipment.count || 0;
                let maxSlots = level * (tpl.slotsPerLevel || 10);
                let cond = biz.equipment.condition !== undefined ? biz.equipment.condition : 100;
                let condColor = cond >= 70 ? '#27ae60' : (cond >= 30 ? '#f39c12' : '#c0392b');

                let maxStaff = tpl.staffReq * level;
                let maxOutByEquip = eqCount * (tpl.outputPerMachine || 10);
                let assignedTotal = biz.assigned.junior + biz.assigned.middle + biz.assigned.senior;
                let isFull = assignedTotal >= maxStaff;
                
                let prodPower = (biz.assigned.junior * HR.GRADES.junior.prodMult) + (biz.assigned.middle * HR.GRADES.middle.prodMult) + (biz.assigned.senior * HR.GRADES.senior.prodMult);
                let uiEfficiency = maxStaff > 0 ? (prodPower / maxStaff) : 1;
                if (assignedTotal === 0) uiEfficiency = 0;

                let conditionMult = cond < 70 ? Math.max(0.0, cond/70) : 1.0;
                let effPercent = (uiEfficiency * conditionMult * 100).toFixed(0);
                let statusColor = (uiEfficiency * conditionMult) >= 1 ? 'color: #8e44ad; font-weight: bold;' : ((uiEfficiency * conditionMult) > 0 ? 'color: #27ae60;' : 'color: #c0392b;');
                
                let cityId = biz.city || 'odesa';
                let cityData = typeof GEO !== 'undefined' ? GEO.getCity(cityId) : { name: cityId, rentMult: 1.0, salaryMult: 1.0 };
                
                let salaryCost = ((biz.assigned.junior * HR.GRADES.junior.salary) + (biz.assigned.middle * HR.GRADES.middle.salary) + (biz.assigned.senior * HR.GRADES.senior.salary)) * cityData.salaryMult;
                let adminCost = tpl.area * 2 * level * cityData.rentMult; 
                let upgradeCost = tpl.area * 50 * level * cityData.rentMult;

                let localWh = STATE.company.warehouses[cityId];
                if (localWh && !localWh.inventory) localWh.inventory = {};
                let localInv = localWh ? localWh.inventory : {};

                let outRes = RECIPES.RESOURCES[tpl.output] || { name: 'Услуги' };
                let outInvData = localInv[tpl.output] || { qty: 0, quality: 1.0 };
                let outInv = outInvData.qty;
                
                let capacityOutput = Math.floor(maxOutByEquip * uiEfficiency * conditionMult);
                
                let eqQuality = biz.equipment.quality || 1.0;
                let q_tech = (STATE.rnd && STATE.rnd.techLevels && STATE.rnd.techLevels[biz.type]) ? STATE.rnd.techLevels[biz.type] : 1.0;
                let q_hr = 1.0;
                if (assignedTotal > 0) q_hr = ((biz.assigned.junior * 1.0) + (biz.assigned.middle * 1.2) + (biz.assigned.senior * 1.5)) / assignedTotal;

                let whOptions = '';
                Object.keys(STATE.company.warehouses).forEach(cId => {
                    if (STATE.company.warehouses[cId].level > 0) {
                        let cName = typeof GEO !== 'undefined' ? GEO.getCity(cId).name : cId;
                        whOptions += `<option value="${cId}">${cName}</option>`;
                    }
                });

                let sourceWh = biz.sourceWh || cityId;
                let targetWh = biz.targetWh || cityId;
         
                let inputsHtml = '';
                let sumMatQuality = 0;
                let totalInputsCount = 0;
                let inputsKeys = Object.keys(tpl.inputs);
                
                if (inputsKeys.length === 0) {
                    inputsHtml = '<span style="color:#7f8c8d;">Не требует сырья</span>';
                } else {
                    let inArr = [];
                    inputsKeys.forEach(k => {
                        let reqNum = tpl.inputs[k];
                        let inName = RECIPES.RESOURCES[k].name;
                        
                        let invMat = localInv[k];
                        let inQty = invMat ? invMat.qty : 0;
                        let matQ = (invMat && invMat.qty > 0) ? (invMat.quality || 1.0) : 1.0;
                        
                        sumMatQuality += (matQ * reqNum);
                        totalInputsCount += reqNum;
                        
                        let totalReqPerDay = reqNum * capacityOutput;
                        let color = inQty < totalReqPerDay ? 'color: #e74c3c; font-weight:bold;' : 'color: #27ae60;';
                        inArr.push(`&bull; ${inName}: <span style="${color}">${inQty} шт.</span> (Расход: ${totalReqPerDay}/дн)`);
                    });
                    inputsHtml = inArr.join('<br>');
                }
                
                let q_mat = totalInputsCount > 0 ? (sumMatQuality / totalInputsCount) : 1.0;
                let expectedQuality = (eqQuality * 0.1) + (q_mat * 0.3) + (q_hr * 0.2) + (q_tech * 0.4);

                let freeJun = typeof HR !== 'undefined' ? HR.getUnassigned('junior') : 0;
                let freeMid = typeof HR !== 'undefined' ? HR.getUnassigned('middle') : 0;
                let freeSen = typeof HR !== 'undefined' ? HR.getUnassigned('senior') : 0;

                if (!biz.routing) biz.routing = {};
                let viableRoutes = [];
                
                STATE.company.businesses.forEach(other => {
                    if (other.uid === biz.uid) return;
                    let otherTpl = RECIPES.BUSINESSES[other.type];
                    
                    if (otherTpl.inputs && otherTpl.inputs[tpl.output] !== undefined) {
                        viableRoutes.push({ id: other.uid, name: `🏭 ${other.name || otherTpl.name}` });
                    }
                    else if (otherTpl.isRetail && otherTpl.accepts && otherTpl.accepts.includes(tpl.output)) {
                        viableRoutes.push({ id: other.uid, name: `🏪 ${other.name}` });
                    }
                });

                let logisticsSelectorsHtml = `
                <div style="background: #fdfefe; padding: 12px; border: 1px solid #bdc3c7; border-radius: 4px; margin-top: 12px; font-size: 0.9em;">
                    <strong style="color:#2c3e50;">ЛОГИСТИКА И СНАБЖЕНИЕ:</strong><br>
                    <div style="display:flex; justify-content:space-between; margin-top:8px; align-items:center;">
                        <span>Брать сырьё со склада:</span>
                        <select id="source-wh-${biz.uid}" onchange="UI_DASHBOARD.setFactoryWarehouses(${biz.uid})" style="padding:4px; border-radius:3px; border: 1px solid #ccc; width: 140px;">
                            ${whOptions.replace(`value="${sourceWh}"`, `value="${sourceWh}" selected`)}
                        </select>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:8px; align-items:center;">
                        <span>Отгружать готовую продукцию на:</span>
                        <select id="target-wh-${biz.uid}" onchange="UI_DASHBOARD.setFactoryWarehouses(${biz.uid})" style="padding:4px; border-radius:3px; border: 1px solid #ccc; width: 140px;">
                            ${whOptions.replace(`value="${targetWh}"`, `value="${targetWh}" selected`)}
                        </select>
                    </div>
                    <div style="color:#c0392b; margin-top:8px; font-size:0.85em; font-style:italic;">* Доставка из других городов платная (за м³ и км пробега).</div>
                </div>`;
                
                // ВОССТАНОВЛЕНА ПЕРЕМЕННАЯ routingHtml
                let routingHtml = `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; border: 1px solid #f1c40f; margin-top: 10px;">
                    <strong style="font-size: 0.9em; color: #b9770e;">АВТО-ПОСТАВКИ (ШТУК В ДЕНЬ):</strong><br>`;

                if (viableRoutes.length === 0) {
                    routingHtml += `<div style="font-size:0.85em; color:#7f8c8d;">Нет потребителей. 100% уходит на выбранный склад.</div>`;
                } else {
                    viableRoutes.forEach(route => {
                        let val = biz.routing[route.id] || 0;
                        routingHtml += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; font-size:0.85em;">
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${route.name}</span>
                            <span style="white-space: nowrap;"><input type="number" id="route-${biz.uid}-${route.id}" value="${val}" min="0" style="width:65px; padding:2px; text-align:right;"> шт.</span>
                        </div>`;
                    });
                }
                let destsStr = viableRoutes.map(r => r.id).join(',');
                if (viableRoutes.length > 0) {
                    routingHtml += `<button onclick="UI_DASHBOARD.saveRoutes(${biz.uid}, '${destsStr}')" style="margin-top:8px; background:#d4ac0d; padding:4px 10px; font-size:0.85em; width:100%; color:#fff; border:none; cursor:pointer;">Сохранить квоты отгрузки</button>`;
                }
                routingHtml += `</div>`;

                let displayName = biz.name || tpl.name;

                bizList.innerHTML += `
                <li style="margin-bottom: 20px; background: #fff; padding: 15px; border: 1px solid #dcdde1; border-radius: 8px; list-style-type: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                        <strong style="font-size: 1.1em; color: #2c3e50;">${displayName} <span style="color:#3498db; font-size: 0.9em; font-weight: normal;">(Ур. ${level} | Технология v${q_tech.toFixed(2)})</span></strong>
                        <span style="${statusColor}">[КПД: ${effPercent}%]</span>
                    </div>
                    
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 250px;">
                            <p style="margin: 0 0 5px 0;"><strong>📦 Выпуск:</strong> ${outRes.name} <span style="color:#2980b9; margin-left:10px;">(Склад ${cityData.name}: <strong>${outInv} шт.</strong>)</span></p>
                            <p style="margin: 0 0 5px 0;"><small>План (Мощность) на сегодня: <strong style="color:#27ae60; font-size: 1.2em;">${capacityOutput} шт.</strong> / Лимит станков: ${maxOutByEquip}</small></p>
                            <p style="margin: 0 0 10px 0;"><small>✨ Ожидаемое качество: <strong style="color:#8e44ad; font-size: 1.1em;">★ ${expectedQuality.toFixed(2)}</strong></small></p>
                            
                            <div style="background: #f9f9f9; padding: 8px; border-radius: 4px; font-size: 0.85em; border: 1px dashed #ccc;">
                                <strong style="color:#7f8c8d;">ПОТРЕБНОСТЬ В СЫРЬЕ (Склад ${cityData.name}):</strong><br>
                                ${inputsHtml}
                            </div>
                            ${logisticsSelectorsHtml}
                            ${routingHtml}
                            <div style="background: #fdfefe; padding: 10px; border: 1px dashed #bdc3c7; border-radius: 4px; margin-top: 10px; font-size: 0.9em;">
                                <strong style="color:#2c3e50;">ОБОРУДОВАНИЕ (${RECIPES.RESOURCES[tpl.equipmentType].name}):</strong><br>
                                Слотов: <strong>${eqCount} / ${maxSlots}</strong> | Состояние: <strong style="color:${condColor}">${cond.toFixed(1)}%</strong>
                                <div style="margin-top: 8px; display: flex; gap: 5px;">
                                    <input type="number" id="install-qty-${biz.uid}" value="1" min="1" max="${maxSlots - eqCount}" style="width:50px; padding:3px;">
                                    <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" style="background:#2980b9; flex-grow: 1; border: none; color: white; cursor: pointer;">Установить</button>
                                    <button onclick="PRODUCTION.repairEquipment(${biz.uid})" style="background:#8e44ad; padding: 4px 12px; border: none; color: white; cursor: pointer;">ТО</button>
                                </div>
                            </div>
                        </div>

                        <div style="flex: 1; min-width: 250px;">
                            <p style="margin: 0 0 5px 0;"><small>💰 ФОТ: <strong>$${formatMoney(salaryCost)}</strong>/дн | 🏢 Админ: <strong>$${formatMoney(adminCost)}</strong>/дн</small></p>
                            <p style="margin: 0 0 10px 0;"><small>🏭 Текущая Себестоимость: <strong>$${formatMoney(biz.lastCogs)}</strong>/шт</small></p>
                            
                            <div style="background: #ecf0f1; padding: 10px; border-radius: 4px;">
                                <strong style="font-size: 0.85em; color: #7f8c8d;">СМЕНА (${assignedTotal} / ${maxStaff} мест):</strong><br>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 0.9em;">
                                    <span>Jun <small style="color:#7f8c8d;">(Резерв: ${freeJun})</small></span>
                                    <div>
                                        <button onclick="HR.removeFromBusiness(${biz.uid}, 'junior')" ${biz.assigned.junior===0?'disabled style="opacity:0.5;"':''} style="padding: 2px 8px; background:#e74c3c; border:none; color:white; cursor:pointer;">-</button> 
                                        <strong style="display:inline-block; width:20px; text-align:center;">${biz.assigned.junior}</strong> 
                                        <button onclick="HR.assignToBusiness(${biz.uid}, 'junior')" ${isFull||freeJun===0?'disabled style="opacity:0.5;"':''} style="padding: 2px 8px; background:#2ecc71; border:none; color:white; cursor:pointer;">+</button>
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 0.9em;">
                                    <span>Mid <small style="color:#7f8c8d;">(Резерв: ${freeMid})</small></span>
                                    <div>
                                        <button onclick="HR.removeFromBusiness(${biz.uid}, 'middle')" ${biz.assigned.middle===0?'disabled style="opacity:0.5;"':''} style="padding: 2px 8px; background:#e74c3c; border:none; color:white; cursor:pointer;">-</button> 
                                        <strong style="display:inline-block; width:20px; text-align:center;">${biz.assigned.middle}</strong> 
                                        <button onclick="HR.assignToBusiness(${biz.uid}, 'middle')" ${isFull||freeMid===0?'disabled style="opacity:0.5;"':''} style="padding: 2px 8px; background:#2ecc71; border:none; color:white; cursor:pointer;">+</button>
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 0.9em;">
                                    <span>Sen <small style="color:#7f8c8d;">(Резерв: ${freeSen})</small></span>
                                    <div>
                                        <button onclick="HR.removeFromBusiness(${biz.uid}, 'senior')" ${biz.assigned.senior===0?'disabled style="opacity:0.5;"':''} style="padding: 2px 8px; background:#e74c3c; border:none; color:white; cursor:pointer;">-</button> 
                                        <strong style="display:inline-block; width:20px; text-align:center;">${biz.assigned.senior}</strong> 
                                        <button onclick="HR.assignToBusiness(${biz.uid}, 'senior')" ${isFull||freeSen===0?'disabled style="opacity:0.5;"':''} style="padding: 2px 8px; background:#2ecc71; border:none; color:white; cursor:pointer;">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 15px; text-align: right; border-top: 1px solid #eee; padding-top: 10px;">
                        <button onclick="PRODUCTION.upgradeBusiness(${biz.uid})" style="background: #f39c12; color: white; border: none; cursor: pointer; font-size: 0.85em; padding: 6px 12px; border-radius: 4px;">Расширить завод ($${formatMoney(upgradeCost)})</button>
                    </div>
                </li>`;
            });
            if (!hasFactories) bizList.innerHTML = '<li style="color:var(--text-dim);">У вас пока нет заводов. Откройте первый, инвестировав в производство.</li>';
        }
    },

    // --- БИРЖА С РАБОЧИМИ ФИЛЬТРАМИ И АКТИВНЫМИ ОРДЕРАМИ ---
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
            marketContainer.innerHTML = '<div style="padding: 20px; text-align:center; color:#7f8c8d;">У вас нет ни одного активного склада! Сначала постройте хаб.</div>';
            return;
        }

        let filterHtml = `
        <div style="margin-bottom: 20px; display: flex; gap: 10px;">
            <button onclick="UI_DASHBOARD.setMarketFilter('all')" style="background: ${this.marketFilter==='all' ? 'var(--blue)' : 'var(--surface-3)'}; color: ${this.marketFilter==='all' ? '#fff' : 'var(--text)'};">Все товары</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('raw')" style="background: ${this.marketFilter==='raw' ? 'var(--blue)' : 'var(--surface-3)'}; color: ${this.marketFilter==='raw' ? '#fff' : 'var(--text)'};">Только сырье</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('finished')" style="background: ${this.marketFilter==='finished' ? 'var(--blue)' : 'var(--surface-3)'}; color: ${this.marketFilter==='finished' ? '#fff' : 'var(--text)'};">Готовая продукция</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('equipment')" style="background: ${this.marketFilter==='equipment' ? 'var(--blue)' : 'var(--surface-3)'}; color: ${this.marketFilter==='equipment' ? '#fff' : 'var(--text)'};">Оборудование / ПК</button>
        </div>`;

        // Рендер активных ордеров (Товары в пути)
        let pendingOrdersHtml = '';
        if (STATE.logistics && STATE.logistics.deliveries) {
            let marketOrders = STATE.logistics.deliveries.filter(d => d.isMarketOrder);
            if (marketOrders.length > 0) {
                pendingOrdersHtml += `
                <div style="margin-bottom: 20px; background: #fffcf2; border: 1px solid #f1c40f; border-radius: 6px; padding: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #d35400;">📦 Оформленные поставки (В пути)</h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                        <tr style="border-bottom: 1px solid #f1c40f; text-align: left; color: #b9770e;">
                            <th style="padding: 5px;">Товар</th>
                            <th style="padding: 5px;">Кол-во</th>
                            <th style="padding: 5px;">Качество/Бренд</th>
                            <th style="padding: 5px;">Цена (ед)</th>
                            <th style="padding: 5px;">Партия</th>
                            <th style="padding: 5px;">Доставка</th>
                            <th style="padding: 5px;">Списано</th>
                            <th style="padding: 5px; text-align: right;">Действие</th>
                        </tr>
                `;
                
                marketOrders.forEach(d => {
                    let resName = RECIPES.RESOURCES[d.item] ? RECIPES.RESOURCES[d.item].name : d.item;
                    let unitPrice = d.cost / d.qty;
                    let cName = typeof GEO !== 'undefined' ? GEO.getCity(d.targetCity).name : d.targetCity;

                    pendingOrdersHtml += `
                        <tr style="border-bottom: 1px dashed #fdebd0;">
                            <td style="padding: 8px 5px;"><strong>${resName}</strong><br><small style="color:#7f8c8d;">В г. ${cName}</small></td>
                            <td style="padding: 8px 5px; color:#2980b9; font-weight:bold;">${d.qty} шт.</td>
                            <td style="padding: 8px 5px;">★ ${(d.quality||1.0).toFixed(2)}<br><small>Бренд: ${d.brand||0}</small></td>
                            <td style="padding: 8px 5px;">$${formatMoney(unitPrice)}</td>
                            <td style="padding: 8px 5px;">$${formatMoney(d.cost)}</td>
                            <td style="padding: 8px 5px; color:#c0392b;">$${formatMoney(d.logCost)}</td>
                            <td style="padding: 8px 5px; color:#27ae60; font-weight:bold;">$${formatMoney(d.totalCost)}</td>
                            <td style="padding: 8px 5px; text-align: right;">
                                <button onclick="MARKET.cancelOrder('${d.id}')" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:0.85em;">Отменить</button>
                            </td>
                        </tr>
                    `;
                });
                
                pendingOrdersHtml += `</table></div>`;
            }
        }

        let html = `
        ${filterHtml}
        <div style="margin-bottom: 15px; padding: 15px; background: #e8f8f5; border: 1px solid #1abc9c; border-radius: 6px; display: flex; align-items: center;">
            <strong style="color: #16a085; margin-right: 15px;">📍 Склад назначения (доставка):</strong>
            <select id="market-target-city" style="padding: 6px 10px; font-size: 1em; border-radius: 4px; border: 1px solid #bdc3c7; cursor: pointer; flex-grow: 1; max-width: 400px;">
                ${cityOptions}
            </select>
        </div>
        ${pendingOrdersHtml}
        <table style="width: 100%; border-collapse: collapse; font-size: 0.95em;">
            <tr style="border-bottom: 2px solid #34495e; text-align: left;">
                <th style="padding: 10px;">Сырье / Товар</th>
                <th style="padding: 10px;">Резерв биржи</th>
                <th style="padding: 10px;">Характеристики</th>
                <th style="padding: 10px;">Цена (B2B)</th>
                <th style="padding: 10px;">Ордер на закупку</th>
            </tr>
        `;

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            
            if (this.marketFilter === 'raw' && !res.isRaw) return;
            if (this.marketFilter === 'finished' && (res.isRaw || res.isEquipment)) return;
            if (this.marketFilter === 'equipment' && !res.isEquipment) return;

            let basePrice = MARKET.getCurrentPrice(key);
            let availQty = MARKET.getAvailablePool(key);
            let b2bQuality = 1.00;
            let b2bBrand = 0;
            
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.inventory && wh.inventory[key] && wh.inventory[key].qty > 0) {
                    let inv = wh.inventory[key];
                    let finalPrice = basePrice * (inv.quality || 1.0);
                    let cityName = typeof GEO !== 'undefined' ? GEO.getCity(cId).name : cId;
                    html += `
                    <tr style="background: #f4f6f7; border-bottom: 2px solid #bdc3c7;">
                        <td style="padding: 10px; border-left: 4px solid #2980b9;">
                            <strong>${res.name}</strong><br><small style="color:#2980b9; font-weight: bold;">(Ваш склад: ${cityName})</small>
                        </td>
                        <td><strong style="color: #2c3e50;">${inv.qty} шт.</strong></td>
                        <td><strong style="color:#8e44ad;">★ ${(inv.quality || 1.0).toFixed(2)}</strong></td>
                        <td><strong style="color:#2c3e50; font-size: 1.1em;">$${formatMoney(finalPrice)}</strong></td>
                        <td>
                            <button onclick="MARKET.sell('${key}', ${inv.qty}, '${cId}')" style="background:#e67e22; width: 100%; padding: 6px 12px; color: white; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">Продать ($${formatMoney(finalPrice * inv.qty)})</button>
                        </td>
                    </tr>`;
                }
            });
            
            html += `
            <tr style="border-bottom: 1px solid #ecf0f1;">
                <td style="padding: 10px;">
                    <strong style="color: #2c3e50; font-size: 1.1em;">${res.name}</strong><br>
                    <small style="color:#7f8c8d;">Объем: ${res.volume || 1} м³/шт</small>
                </td>
                <td style="padding: 10px; color:#2980b9; font-weight:bold; font-size: 1.1em;">
                    ${availQty} шт.
                </td>
                <td style="padding: 10px;">
                    <span style="color:#8e44ad; font-weight:bold;">★ ${b2bQuality.toFixed(2)}</span><br>
                    <small style="color:#e67e22;">Бренд: ${b2bBrand}</small>
                </td>
                <td style="padding: 10px; font-size: 1.2em; color: #27ae60;">
                    <strong>$${formatMoney(basePrice)}</strong>
                </td>
                <td style="padding: 10px; min-width: 220px;">
                    <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                        <input type="number" id="buy-qty-${key}" value="10" min="1" style="width: 80px; padding: 6px; border: 1px solid #bdc3c7; border-radius: 4px;">
                        <button onclick="UI_DASHBOARD.submitBuy('${key}')" style="background:#3498db; color:white; border:none; padding: 6px 15px; border-radius: 4px; cursor:pointer; font-weight: bold;">Купить</button>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button onclick="document.getElementById('buy-qty-${key}').value = 10" style="font-size:0.8em; padding:3px 6px; background:#ecf0f1; border:1px solid #bdc3c7; border-radius:3px; cursor:pointer;">10</button>
                        <button onclick="document.getElementById('buy-qty-${key}').value = 100" style="font-size:0.8em; padding:3px 6px; background:#ecf0f1; border:1px solid #bdc3c7; border-radius:3px; cursor:pointer;">100</button>
                        <button onclick="document.getElementById('buy-qty-${key}').value = 1000" style="font-size:0.8em; padding:3px 6px; background:#ecf0f1; border:1px solid #bdc3c7; border-radius:3px; cursor:pointer;">1k</button>
                        <button onclick="UI_DASHBOARD.setMaxBuy('${key}')" style="font-size:0.8em; padding:3px 8px; background:#f39c12; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">MAX</button>
                    </div>
                </td>
            </tr>`;
        });

        html += `</table>`;
        marketContainer.innerHTML = html;
    },

    // Умный расчет максимально возможной закупки с учетом логистики и товаров в пути
    setMaxBuy(itemKey) {
        let citySelect = document.getElementById('market-target-city');
        if (!citySelect) return;
        
        let cityId = citySelect.value;
        let price = MARKET.getCurrentPrice(itemKey);
        let availMarket = MARKET.getAvailablePool(itemKey);
        
        let itemVol = RECIPES.RESOURCES[itemKey].volume || 1.0;
        let dist = typeof GEO !== 'undefined' ? Math.max(10, GEO.getDistance('kyiv', cityId)) : 10;
        let logBase = typeof GEO !== 'undefined' ? GEO.COUNTRIES['ua'].macro.logisticsBaseRate : 0.15;
        let logCostPerItem = dist * logBase * itemVol;

        // Ограничение по балансу: стоимость товара + стоимость его доставки
        let maxByMoney = Math.floor(STATE.finances.balance / (price + logCostPerItem));
        
        // Ограничение по объему с учетом товаров в пути
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

// Обработка покупки с рынка
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
    },

    // --- 8. БАНК И КРЕДИТЫ ---
    updateBankTab() {
        if (typeof FINANCE === 'undefined') return;
        
        if (document.getElementById('ui-rate')) document.getElementById('ui-rate').innerText = (FINANCE.getCurrentRate() * 100).toFixed(1);
        if (document.getElementById('ui-credit-limit')) document.getElementById('ui-credit-limit').innerText = formatMoney(FINANCE.getAvailableLimit());
        
        let loansList = document.getElementById('ui-active-loans');
        if (loansList) {
            let totalDebt = STATE.finances.loans.reduce((sum, l) => sum + l.remainingPrincipal, 0);
            if(document.getElementById('ui-debt')) document.getElementById('ui-debt').innerText = formatMoney(totalDebt);
            
            loansList.innerHTML = '';
            if (STATE.finances.loans.length === 0) {
                loansList.innerHTML = '<li><small style="color:#7f8c8d;">Нет активных кредитов.</small></li>';
            } else {
                STATE.finances.loans.forEach(l => {
                    let currentDailyInterest = (l.remainingPrincipal * l.rate) / 365;
                    let currentDailyPayment = l.dailyPrincipal + currentDailyInterest;
                    
                    loansList.innerHTML += `<li style="margin-bottom: 15px; border-bottom: 1px dashed #eee; padding-bottom: 10px; list-style-type: none;">
                        <strong>Заём $${formatMoney(l.amount)}</strong> (Осталось: ${l.remainingDays} дн.)<br>
                        <small>Ставка: ${(l.rate*100).toFixed(1)}% | Долг: <span class="danger">$${formatMoney(l.remainingPrincipal)}</span> | Платёж сегодня: $${formatMoney(currentDailyPayment)}</small><br>
                        <button onclick="FINANCE.payOffLoan(${l.id})" style="background: #e67e22; font-size: 0.8em; margin-top: 5px; padding: 4px 10px;">Досрочно погасить ($${formatMoney(l.remainingPrincipal + currentDailyInterest)})</button>
                    </li>`;
                });
            }
        }

        let depList = document.getElementById('ui-active-deposits');
        if (depList) {
            if (!STATE.finances.deposits) STATE.finances.deposits = [];
            depList.innerHTML = '';
            if (STATE.finances.deposits.length === 0) {
                depList.innerHTML = '<li><small style="color:#7f8c8d;">Нет открытых вкладов.</small></li>';
            } else {
                STATE.finances.deposits.forEach(d => {
                    let payoutText = d.payoutType === 'daily' ? 'Выплата % ежедневно' : 'Капитализация в конце';
                    let accText = d.payoutType === 'daily' ? 'выплачивается' : `$${formatMoney(d.accrued)}`;
                    depList.innerHTML += `<li style="margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 5px; list-style-type: none;">
                        <strong>Вклад $${formatMoney(d.amount)}</strong> (Осталось: ${d.daysLeft} дн.)<br>
                        <small>Ставка: ${(d.rate*100).toFixed(1)}% | ${payoutText} | Накоплено: <span class="success">${accText}</span></small>
                    </li>`;
                });
            }
        }
    },

    // --- 9. ФИНАНСОВАЯ ОТЧЕТНОСТЬ (МСФО) ---
    updateFinanceTab() {
        if (!document.getElementById('ui-balance-sheet') || typeof LEDGER === 'undefined') return;
        LEDGER.init();
        
        // --- РАСЧЕТ БАЛАНСА ---
        
        // 1. Текущие активы (Деньги + Инвестиции)
        let cash = Math.max(0, STATE.finances.balance);
        let depositsValue = 0;
        if (STATE.finances.deposits) {
            STATE.finances.deposits.forEach(d => { depositsValue += d.amount + d.accrued; });
        }

        // 1.1. Инвентаризация (Мульти-склады + Полки магазинов)
        let inventoryValue = 0;
        
        // Считаем товары на складах всех городов
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
        
        // Считаем товары на полках магазинов
        STATE.company.businesses.forEach(b => {
            if (b.localInventory) {
                Object.keys(b.localInventory).forEach(k => {
                    inventoryValue += b.localInventory[k].qty * b.localInventory[k].avgCost;
                });
            }
        });

        // 1.2. ЛОГИСТИКА: Товары и деньги в пути (Дебиторка и Авансы)
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

        // Теперь текущие активы включают товары в пути и ожидаемую выручку!
        let currentAssets = cash + inventoryValue + depositsValue + logisticsValue + receivablesValue;

        // 2. Внеоборотные активы (Основные средства)
        let realEstateValue = 0; 
        let equipmentValue = 0;  

        // 2.1. Предприятия (Заводы, Магазины, Офисы)
        STATE.company.businesses.forEach(b => {
            let tpl = RECIPES.BUSINESSES[b.type];
            let locMult = b.locMult || 1.0; 
            
            let baseCost = tpl.area * 50 * locMult;
            realEstateValue += baseCost;
            for (let i = 1; i < (b.level || 1); i++) realEstateValue += (tpl.area * 50 * i * locMult); 

            if (b.equipment && b.equipment.count > 0) {
                let eqPrice = RECIPES.RESOURCES[tpl.equipmentType].basePrice;
                let cond = b.equipment.condition || 0;
                equipmentValue += (b.equipment.count * eqPrice) * (cond / 100);
            }
        });

        // 2.2. Мульти-Склады
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
        
        // 2.3. НИИ
        if (STATE.rnd && STATE.rnd.facility) {
            let rndLvl = STATE.rnd.facility.level || 0;
            for (let i = 1; i <= rndLvl; i++) realEstateValue += i * 10000;
            
            if (STATE.rnd.facility.equipment && STATE.rnd.facility.equipment.count > 0) {
                let pcPrice = RECIPES.RESOURCES['smart_pc'] ? RECIPES.RESOURCES['smart_pc'].basePrice : (RECIPES.RESOURCES['pc_workstation'] ? RECIPES.RESOURCES['pc_workstation'].basePrice : 800);
                let rndCond = STATE.rnd.facility.equipment.condition || 0;
                equipmentValue += (STATE.rnd.facility.equipment.count * pcPrice) * (rndCond / 100);
            }
        }
        
        let fixedAssets = realEstateValue + equipmentValue;
        let totalAssets = currentAssets + fixedAssets;

        // 3. Пассивы и Капитал
        let totalLiabilities = 0;
        if (STATE.finances.loans) {
            STATE.finances.loans.forEach(l => { totalLiabilities += l.remainingPrincipal; });
        }
        if (STATE.finances.balance < 0) totalLiabilities += Math.abs(STATE.finances.balance);

        let startCapital = STATE.finances.startCapital || 25000;
        let retainedEarnings = totalAssets - totalLiabilities - startCapital;
        let totalEquity = startCapital + retainedEarnings;

        // ОТРИСОВКА БАЛАНСА
        document.getElementById('ui-balance-sheet').innerHTML = `
            <h3>Отчет о финансовом положении (Баланс)</h3>
            <table style="width:100%; font-size:0.9em;">
                <tr style="background:#2c3e50; color:white;"><th colspan="2" style="padding:5px; text-align:center;">АКТИВЫ (Имущество)</th></tr>
                <tr><td>Денежные средства:</td><td style="text-align:right;">$${formatMoney(cash)}</td></tr>
                <tr><td>Запасы продукции (Склады и Магазины):</td><td style="text-align:right; color:#2980b9;">$${formatMoney(inventoryValue)}</td></tr>
                <tr><td>Товары в пути (Оплаченные поставки):</td><td style="text-align:right; color:#8e44ad;">$${formatMoney(logisticsValue)}</td></tr>
                <tr><td>Дебиторская задолженность (Выручка в пути):</td><td style="text-align:right; color:#f39c12;">$${formatMoney(receivablesValue)}</td></tr>
                <tr><td>Краткосрочные инвестиции:</td><td style="text-align:right;">$${formatMoney(depositsValue)}</td></tr>
                <tr style="font-weight:bold; background:#fdfefe; border-bottom: 2px solid #bdc3c7;"><td>Итого Текущие Активы:</td><td style="text-align:right;">$${formatMoney(currentAssets)}</td></tr>
                
                <tr><td>Недвижимость (Цехи, Магазины, Склады):</td><td style="text-align:right;">$${formatMoney(realEstateValue)}</td></tr>
                <tr><td>Оборудование (Остаточная стоимость):</td><td style="text-align:right;">$${formatMoney(equipmentValue)}</td></tr>
                <tr style="font-weight:bold; background:#fdfefe; border-bottom: 1px dashed #bdc3c7;"><td>Итого Внеоборотные Активы:</td><td style="text-align:right;">$${formatMoney(fixedAssets)}</td></tr>
                
                <tr style="font-weight:bold; font-size:1.1em; border-top:2px solid #333;">
                    <td>ИТОГО АКТИВОВ:</td><td style="text-align:right; color:#27ae60;">$${formatMoney(totalAssets)}</td>
                </tr>
                
                <tr><td colspan="2">&nbsp;</td></tr>
                <tr style="background:#2c3e50; color:white;"><th colspan="2" style="padding:5px; text-align:center;">ПАССИВЫ (Источники средств)</th></tr>
                
                <tr><td>Кредиты и займы:</td><td style="text-align:right; color:#c0392b;">$${formatMoney(totalLiabilities)}</td></tr>
                <tr style="font-weight:bold; background:#fdfefe; border-bottom: 1px dashed #bdc3c7;"><td>Итого Обязательства:</td><td style="text-align:right; color:#c0392b;">$${formatMoney(totalLiabilities)}</td></tr>
                
                <tr><td>Уставной капитал:</td><td style="text-align:right;">$${formatMoney(startCapital)}</td></tr>
                <tr><td>Нераспределенная прибыль:</td><td style="text-align:right; color:${retainedEarnings >= 0 ? '#27ae60' : '#c0392b'};">$${formatMoney(retainedEarnings)}</td></tr>
                <tr style="font-weight:bold; background:#fdfefe;"><td>Итого Капитал:</td><td style="text-align:right;">$${formatMoney(totalEquity)}</td></tr>
                
                <tr style="font-weight:bold; font-size:1.1em; border-top:2px solid #333;">
                    <td>ИТОГО ПАССИВОВ:</td><td style="text-align:right;">$${formatMoney(totalLiabilities + totalEquity)}</td>
                </tr>
            </table>
        `;

        // --- РАСЧЕТ И ОТРИСОВКА P&L ---
        let y = STATE.ledger.yesterday;
        let t = STATE.ledger.total;
        
        let yFinFees = y.fin_fees || 0; let tFinFees = t.fin_fees || 0;
        let yExpFines = y.exp_fines || 0; let tExpFines = t.exp_fines || 0;
        let yExpRepair = y.exp_repair || 0; let tExpRepair = t.exp_repair || 0; 
        
        let yTaxPayroll = y.exp_taxes_payroll || 0; let tTaxPayroll = t.exp_taxes_payroll || 0;
        let yTaxCorp = y.exp_taxes_corp || 0; let tTaxCorp = t.exp_taxes_corp || 0;
        
        let yRevB2C = y.rev_b2c || 0; let tRevB2C = t.rev_b2c || 0;
        let yRevOther = y.rev_other || 0; let tRevOther = t.rev_other || 0; 
        let yExpMarketing = y.exp_marketing || 0; let tExpMarketing = t.exp_marketing || 0;
        let yExpLogistics = y.exp_logistics || 0; let tExpLogistics = t.exp_logistics || 0;
        
        let yRev = y.rev_b2b + y.rev_b2g + yRevB2C + yRevOther;
        let tRev = t.rev_b2b + t.rev_b2g + tRevB2C + tRevOther;
        
        let yOpex = y.exp_salary + y.exp_admin + y.exp_hr + yExpFines + yExpRepair + yTaxPayroll + yExpMarketing + yExpLogistics;
        let tOpex = t.exp_salary + t.exp_admin + t.exp_hr + tExpFines + tExpRepair + tTaxPayroll + tExpMarketing + tExpLogistics;
        
        let yEbitda = yRev - y.exp_materials - yOpex;
        let tEbitda = tRev - t.exp_materials - tOpex;
        
        let yFin = y.fin_income - y.fin_expense - yFinFees;
        let tFin = t.fin_income - t.fin_expense - tFinFees;
        
        let yEbt = yEbitda + yFin;
        let tEbt = tEbitda + tFin;
        
        let yNet = yEbt - yTaxCorp;
        let tNet = tEbt - tTaxCorp;

        let taxInfoHTML = '';
        if (STATE.taxes) {
            let tb = STATE.taxes.taxableBase || 0;
            let dtr = STATE.taxes.daysToReport || 30;
            let corpRate = (typeof GEO !== 'undefined' && GEO.COUNTRIES['ua']) ? GEO.COUNTRIES['ua'].taxes.corporate : 0.18;
            let estimatedTax = tb > 0 ? tb * corpRate : 0;
            
            taxInfoHTML = `
                <div style="background: #e8f8f5; border: 1px solid #1abc9c; padding: 15px; margin-bottom: 20px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0 0 8px 0; color: #16a085; font-size: 1.1em;">🏛 Налоговый календарь (Отчетный период)</h4>
                        Дней до подачи декларации: <strong style="font-size: 1.1em;">${dtr} дн.</strong><br>
                        Текущая база (Накопленная прибыль): <strong style="color: ${tb >= 0 ? '#27ae60' : '#c0392b'};">$${formatMoney(tb)}</strong> ${tb < 0 ? '<small>(Убыток — налог 0)</small>' : ''}
                    </div>
                    <div style="text-align: right; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #bdc3c7;">
                        <small style="color: #7f8c8d; display: block; margin-bottom: 5px;">Резерв под налог (18%):</small>
                        <strong style="font-size: 1.3em; color: #c0392b;">$${formatMoney(estimatedTax)}</strong>
                    </div>
                </div>
            `;
        }

        document.getElementById('ui-pnl-statement').innerHTML = `
            ${taxInfoHTML}
            <h3>Отчет о прибылях и убытках (P&L)</h3>
            <table style="width:100%; font-size:0.85em; text-align:right; border-collapse: collapse;">
                <tr style="border-bottom:2px solid #333; text-align:right;">
                    <th style="text-align:left; padding-bottom:5px;">Статья (Метод начисления / МСФО)</th><th>Вчера</th><th>За всё время</th>
                </tr>
                <tr style="font-weight:bold; background:#ecf0f1;"><td style="text-align:left; padding: 3px 0;">Операционные Доходы</td><td>$${formatMoney(yRev)}</td><td>$${formatMoney(tRev)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">- B2B (Свободный рынок)</td><td>$${formatMoney(y.rev_b2b)}</td><td>$${formatMoney(t.rev_b2b)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">- B2G (Тендеры)</td><td>$${formatMoney(y.rev_b2g)}</td><td>$${formatMoney(t.rev_b2g)}</td></tr>
                <tr><td style="text-align:left; color:#2980b9; font-weight:bold;">- B2C (Розничная сеть)</td><td style="color:#2980b9;">$${formatMoney(yRevB2C)}</td><td style="color:#2980b9;">$${formatMoney(tRevB2C)}</td></tr>
                <tr><td style="text-align:left; color:#16a085;">- Прочие доходы (События, Гранты)</td><td style="color:#16a085;">$${formatMoney(yRevOther)}</td><td style="color:#16a085;">$${formatMoney(tRevOther)}</td></tr>
                
                <tr style="font-weight:bold; background:#ecf0f1; border-top:1px solid #ccc;"><td style="text-align:left; padding: 3px 0;">Операционные Расходы (OPEX)</td><td>$${formatMoney(y.exp_materials + yOpex)}</td><td>$${formatMoney(t.exp_materials + tOpex)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">- Закупка сырья и оборудования</td><td>$${formatMoney(y.exp_materials)}</td><td>$${formatMoney(t.exp_materials)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">- Фонд оплаты труда</td><td>$${formatMoney(y.exp_salary)}</td><td>$${formatMoney(t.exp_salary)}</td></tr>
                <tr><td style="text-align:left; color:#e67e22;">- Социальные взносы (20% на ФОТ)</td><td style="color:#e67e22;">$${formatMoney(yTaxPayroll)}</td><td style="color:#e67e22;">$${formatMoney(tTaxPayroll)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">- Аренда (Магазины, Офисы, Цехи)</td><td>$${formatMoney(y.exp_admin)}</td><td>$${formatMoney(t.exp_admin)}</td></tr>
                <tr><td style="text-align:left; color:#8e44ad; font-weight:bold;">- Маркетинг и Реклама</td><td style="color:#8e44ad;">$${formatMoney(yExpMarketing)}</td><td style="color:#8e44ad;">$${formatMoney(tExpMarketing)}</td></tr>
                <tr><td style="text-align:left; color:#f39c12;">- Логистика (Доставка)</td><td style="color:#f39c12;">$${formatMoney(yExpLogistics)}</td><td style="color:#f39c12;">$${formatMoney(tExpLogistics)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">- ТО и Ремонт</td><td>$${formatMoney(yExpRepair)}</td><td>$${formatMoney(tExpRepair)}</td></tr>
                <tr><td style="text-align:left; color:#c0392b;">- Прочие расходы (Штрафы, ЧП)</td><td style="color:#c0392b;">$${formatMoney(yExpFines)}</td><td style="color:#c0392b;">$${formatMoney(tExpFines)}</td></tr>
                
                <tr style="font-weight:bold; font-size:1.1em; border-top:1px solid #333;"><td style="text-align:left; padding: 5px 0;">EBITDA</td>
                    <td style="color:${yEbitda>=0?'#27ae60':'#c0392b'}">$${formatMoney(yEbitda)}</td>
                    <td style="color:${tEbitda>=0?'#27ae60':'#c0392b'}">$${formatMoney(tEbitda)}</td>
                </tr>
                
                <tr style="background:#fdfefe;"><td style="text-align:left; font-weight:bold; padding: 3px 0;">Финансовые операции</td><td>$${formatMoney(yFin)}</td><td>$${formatMoney(tFin)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">+ Проценты по вкладам</td><td>$${formatMoney(y.fin_income)}</td><td>$${formatMoney(t.fin_income)}</td></tr>
                <tr><td style="text-align:left; color:#7f8c8d;">- Проценты по кредитам</td><td>$${formatMoney(y.fin_expense)}</td><td>$${formatMoney(t.fin_expense)}</td></tr>
                
                <tr style="font-weight:bold; font-size:1.1em; border-top:2px solid #333;"><td style="text-align:left; padding: 5px 0;">ПРИБЫЛЬ ДО НАЛОГОВ (EBT)</td>
                    <td style="color:${yEbt>=0?'#27ae60':'#c0392b'}">$${formatMoney(yEbt)}</td>
                    <td style="color:${tEbt>=0?'#27ae60':'#c0392b'}">$${formatMoney(tEbt)}</td>
                </tr>
                <tr><td style="text-align:left; color:#c0392b; font-weight:bold;">- Налог на прибыль корпораций</td><td style="color:#c0392b;">$${formatMoney(yTaxCorp)}</td><td style="color:#c0392b;">$${formatMoney(tTaxCorp)}</td></tr>
                
                <tr style="font-weight:bold; font-size:1.2em; border-top:3px double #333; background:#fff3cd;">
                    <td style="text-align:left; padding: 8px 0;">ЧИСТАЯ ПРИБЫЛЬ</td>
                    <td style="color:${yNet>=0?'#27ae60':'#c0392b'}">$${formatMoney(yNet)}</td>
                    <td style="color:${tNet>=0?'#27ae60':'#c0392b'}">$${formatMoney(tNet)}</td>
                </tr>
            </table>
        `;
    },

    // --- 7. HR И КАДРЫ ---
    updateHRTab() {
        if (typeof HR === 'undefined' || !document.getElementById('ui-staff-total')) return;
        HR.init();
        
        document.getElementById('ui-staff-total').innerText = HR.getTotalStaff();
        if(document.getElementById('ui-staff-salary')) document.getElementById('ui-staff-salary').innerText = formatMoney(HR.getDailySalaryFund());
        
        let breakdownDiv = document.getElementById('ui-hr-breakdown');
        if (breakdownDiv) {
            let html = '<strong>В штате числятся:</strong> ';
            let parts = [];
            Object.keys(HR.GRADES).forEach(grade => {
                let total = STATE.hr && STATE.hr.staff ? (STATE.hr.staff[grade] || 0) : 0;
                if (total > 0) parts.push(`<strong>${HR.GRADES[grade].name.split(' ')[0]}:</strong> ${total} чел.`);
            });
            
            let trainingCount = STATE.hr.trainingQueue.length;
            if (trainingCount > 0) parts.push(`<strong>На учебе:</strong> ${trainingCount} чел.`);
            
            breakdownDiv.innerHTML = html + (parts.length > 0 ? parts.join(' | ') : '<small style="color:#7f8c8d;">Нет сотрудников</small>');
        }

        let hireFactory = document.getElementById('ui-hire-factory');
        let hireRnd = document.getElementById('ui-hire-rnd');
        if (hireFactory && hireRnd) {
            hireFactory.innerHTML = '';
            hireRnd.innerHTML = '';
            
            Object.keys(HR.GRADES).forEach(grade => {
                let info = HR.GRADES[grade];
                let btnHtml = `<button onclick="HR.hire('${grade}')" style="width: 100%; margin-bottom: 8px; padding: 10px; background: ${info.role === 'rnd' ? '#1abc9c' : '#2ecc71'}; text-align: left; display: flex; justify-content: space-between; border-radius: 4px;">
                    <span><strong>Найм: ${info.name.split(' ')[0]}</strong> ($${formatMoney(info.hireCost)})</span>
                    <span style="opacity: 0.9;">ЗП: $${formatMoney(info.salary)}/дн</span>
                </button>`;
                
                if (info.role === 'factory') hireFactory.innerHTML += btnHtml;
                else hireRnd.innerHTML += btnHtml;
            });
        }
        
        let trainingDiv = document.getElementById('ui-hr-training-list');
        if (trainingDiv) {
            if (STATE.hr.trainingQueue.length === 0) {
                trainingDiv.innerHTML = '<small style="color:#7f8c8d;">В данный момент никто не проходит обучение.</small>';
            } else {
                let tHtml = '<ul style="padding-left: 20px;">';
                STATE.hr.trainingQueue.forEach(t => {
                    let nextName = HR.GRADES[t.toGrade].name.split(' ')[0];
                    tHtml += `<li style="margin-bottom: 5px;">Повышение до <strong>${nextName}</strong>. Осталось учиться: <strong class="danger">${t.daysLeft} дн.</strong> <small style="color:#7f8c8d;">(Сотрудник получает ЗП $${t.salary}/дн)</small></li>`;
                });
                tHtml += '</ul>';
                trainingDiv.innerHTML = tHtml;
            }
        }

        let reserveContainer = document.getElementById('ui-hr-reserve-table');
        if (reserveContainer) {
            let html = `<table style="width: 100%; border-collapse: collapse;">`;
            Object.keys(HR.GRADES).forEach(grade => {
                let free = HR.getUnassigned(grade);
                let info = HR.GRADES[grade];
                
                let trainCost = grade === 'junior' ? 250 : (grade === 'middle' ? 800 : (grade === 'scientist' ? 1500 : null));
                let trainDays = grade === 'junior' ? 3 : (grade === 'middle' ? 7 : (grade === 'scientist' ? 10 : null));
                let nextGradeName = grade === 'junior' ? 'Middle' : (grade === 'middle' ? 'Senior' : (grade === 'scientist' ? 'Ст. Научного' : ''));
                
                let trainBtn = '';
                if (trainCost) {
                    trainBtn = `<button onclick="HR.train('${grade}')" ${free===0?'disabled style="opacity:0.5;"':'style="background:#3498db;"'}>Начать обучение до ${nextGradeName} ($${trainCost} / ${trainDays} дн.)</button>`;
                }

                html += `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px 0;"><strong>${info.name}</strong> <span style="color:#7f8c8d;">(Свободно: ${free})</span></td>
                    <td style="text-align: right;">${trainBtn} <button onclick="HR.fire('${grade}')" ${free===0?'disabled style="opacity:0.5;"':'style="background:#e74c3c;"'}>Уволить</button></td>
                </tr>`;
            });
            html += `</table>`;
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
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        event.currentTarget.classList.add('active');
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
        
        retailBody.innerHTML = '';
        
        if (!STATE.retail) STATE.retail = { prices: {}, brand: 10, history: [] };
        
        // Панель управления магазинами (без блока бренда)
        retailBody.innerHTML += `
        <div style="background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #dcdde1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <div>
                <h3 style="margin: 0 0 5px 0; color: #2c3e50;">Управление розничной сетью</h3>
                <small style="color: #7f8c8d;">Стройте магазины, нанимайте персонал и выходите на B2C рынок.</small>
            </div>
            <div>
                <button onclick="PRODUCTION.buyBusiness('retail_store')" style="background: #27ae60; color: white; font-weight: bold; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer;">+ Открыть Фирменный магазин</button>
            </div>
        </div>`;

        let hasRetail = false;

        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl.isRetail) return;
            hasRetail = true;
            
            let level = biz.level || 1;
            let locMult = biz.locMult || 1.0;
            let adminCost = tpl.area * 2 * level * locMult;
            
            if (!biz.assigned) biz.assigned = {};
            if (biz.assigned.salesman === undefined) biz.assigned.salesman = 0;
            if (biz.assigned.store_manager === undefined) biz.assigned.store_manager = 0;
            
            let freeSales = typeof HR !== 'undefined' ? HR.getUnassigned('salesman') : 0;
            let freeMgr = typeof HR !== 'undefined' ? HR.getUnassigned('store_manager') : 0;
            let assignedTotal = biz.assigned.salesman + biz.assigned.store_manager;
            let maxStaff = tpl.staffReq * level;

            let maxVol = tpl.area * level * locMult * 2;
            let currentVol = 0;
            let invHtml = '';
            
            if (biz.localInventory) {
                Object.keys(biz.localInventory).forEach(k => {
                    let inv = biz.localInventory[k];
                    if (inv.qty > 0) {
                        let rTpl = RECIPES.RESOURCES[k];
                        currentVol += inv.qty * (rTpl.volume || 0);
                        let b2bPrice = typeof MARKET !== 'undefined' ? MARKET.getCurrentPrice(k) : 0;
                        if (!biz.prices) biz.prices = {};
                        let retailPrice = biz.prices[k] || (b2bPrice * 2.5);
                        let margin = b2bPrice > 0 ? (retailPrice / b2bPrice) : 1;
                        let marginColor = margin >= 4 ? '#e74c3c' : (margin >= 2.5 ? '#f39c12' : '#27ae60');
                        let soldYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].qty : 0;
                        let revYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].revenue : 0;

                        invHtml += `<tr>
                            <td style="padding:10px 0; border-bottom:1px solid #f1f2f6;"><strong>${rTpl.name}</strong><br><small style="color:#8e44ad;">★ ${(inv.quality||1.0).toFixed(2)}</small></td>
                            <td style="border-bottom:1px solid #f1f2f6;"><strong style="color:#2980b9;">${inv.qty} шт.</strong><br><small style="color:#7f8c8d;">Закуп: $${formatMoney(inv.avgCost)}</small></td>
                            <td style="border-bottom:1px solid #f1f2f6;"><small style="color:#7f8c8d;">Опт: $${formatMoney(b2bPrice)}</small><br>
                                <div style="display:flex; align-items:center; gap:3px; margin-top:2px;">
                                    $ <input type="number" id="price-${biz.uid}-${k}" value="${retailPrice.toFixed(0)}" style="width:70px; padding:3px 4px; font-size:0.9em; border:1px solid #ccc; border-radius:3px;">
                                    <button onclick="UI_DASHBOARD.saveStorePrice(${biz.uid}, '${k}')" style="background:#3498db; color:white; border:none; padding:4px 6px; font-size:0.85em; border-radius:3px; cursor:pointer;">OK</button>
                                </div>
                                <small style="color:${marginColor};">Наценка: x${margin.toFixed(2)}</small>
                            </td>
                            <td style="border-bottom:1px solid #f1f2f6; text-align:right;">
                                <strong style="color:#27ae60;">${soldYesterday} шт.</strong><br>
                                <small style="color:#7f8c8d;">+$${formatMoney(revYesterday)}</small>
                            </td>
                        </tr>`;
                    }
                });
            }
            if (invHtml === '') invHtml = '<tr><td colspan="4" style="text-align:center; color:#7f8c8d; padding:15px;">Товара на полках нет</td></tr>';
            
            let volPercent = Math.min(100, (currentVol/maxVol)*100).toFixed(1);
            let eqCount = biz.equipment.count || 0;
            let maxSlots = level * (tpl.slotsPerLevel || 5);

            retailBody.innerHTML += `
            <li style="margin-bottom: 25px; background: #fff; padding: 25px; border: 1px solid #dcdde1; border-radius: 8px; list-style-type: none; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
                <h3 style="margin-top:0; border-bottom: 2px solid #3498db; padding-bottom: 12px; color:#2c3e50; font-size:1.4em;">🏪 ${biz.name}</h3>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="background:#fffcf2; padding:15px; border-radius:6px; border:1px solid #f1c40f;">
                            <strong style="color:#d35400; font-size:1.1em;">📦 Склад магазина (Занято ${volPercent}%)</strong><br>
                            <small style="color:#7f8c8d;">Вместимость: ${currentVol.toFixed(1)} / ${maxVol.toFixed(1)} м³</small>
                            <table style="width:100%; margin-top:12px; font-size:0.95em; border-collapse: collapse;">
                                <tr style="border-bottom:2px solid #bdc3c7;">
                                    <th style="text-align:left; padding-bottom:5px;">Товар</th><th style="text-align:left; padding-bottom:5px;">Сток</th><th style="text-align:left; padding-bottom:5px;">Цена</th><th style="text-align:right; padding-bottom:5px;">Продано</th>
                                </tr>
                                ${invHtml}
                            </table>
                        </div>
                        <div style="background: #fdfefe; padding: 15px; border: 1px dashed #bdc3c7; border-radius: 6px; margin-top: 15px;">
                            <strong style="color:#2c3e50;">МЕБЕЛЬ (${RECIPES.RESOURCES[tpl.equipmentType].name}):</strong><br>
                            Установлено витрин: <strong>${eqCount} / ${maxSlots}</strong>
                            <div style="margin-top: 12px; display: flex; gap: 5px;">
                                <input type="number" id="install-qty-${biz.uid}" value="1" min="1" max="${maxSlots - eqCount}" style="width:60px; padding:6px; border: 1px solid #ccc; border-radius: 3px;">
                                <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" style="background:#2980b9; flex-grow: 1; border: none; color: white; cursor: pointer; border-radius: 3px;">Докупить витрину</button>
                            </div>
                        </div>
                    </div>
                    <div style="flex: 1; min-width: 250px;">
                        <p style="margin: 0 0 15px 0; font-size:1.1em;">🏢 Аренда: <strong style="color:#c0392b;">$${formatMoney(adminCost)}</strong>/дн</p>
                        <div class="retail-staff-card" style="background: var(--surface, #fff); padding: 16px; border-radius: 12px; border: 1px solid var(--border, #dcdde1); box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong style="font-size: 1.05em; color: var(--text, #1D1D1F);">👥 КАДРЫ (${assignedTotal} / ${maxStaff} мест):</strong>
                            </div>
                            <small style="color: var(--text-dim, #86868B); display: block; margin-bottom: 10px;">Обязателен 1 директор. Остальные — продавцы.</small>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f2f6;">
                                <div>
                                    <strong>Директор магазина</strong><br>
                                    <small style="color: var(--text-dim, #86868B);">В резерве: <strong style="color:var(--blue, #007AFF);">${freeMgr}</strong> чел.</small>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button onclick="HR.removeFromBusiness(${biz.uid}, 'store_manager')" ${biz.assigned.store_manager === 0 ? 'disabled' : ''} style="width:34px; height:34px; min-height:34px; padding:0; display:inline-flex; align-items:center; justify-content:center; background:#ff3b30; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer;">-</button> 
                                    <strong style="display: inline-block; width: 24px; text-align: center; font-size:1.1rem;">${biz.assigned.store_manager}</strong> 
                                    <button onclick="HR.assignToBusiness(${biz.uid}, 'store_manager')" ${biz.assigned.store_manager >= 1 || freeMgr === 0 ? 'disabled' : ''} style="width:34px; height:34px; min-height:34px; padding:0; display:inline-flex; align-items:center; justify-content:center; background:#34c759; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; box-shadow:0 2px 8px rgba(52,199,89,0.35);">+</button>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; margin-top: 4px;">
                                <div>
                                    <strong>Продавец-консультант</strong><br>
                                    <small style="color: var(--text-dim, #86868B);">В резерве: <strong style="color:var(--blue, #007AFF);">${freeSales}</strong> чел.</small>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button onclick="HR.removeFromBusiness(${biz.uid}, 'salesman')" ${biz.assigned.salesman === 0 ? 'disabled' : ''} style="width:34px; height:34px; min-height:34px; padding:0; display:inline-flex; align-items:center; justify-content:center; background:#ff3b30; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer;">-</button> 
                                    <strong style="display: inline-block; width: 24px; text-align: center; font-size:1.1rem;">${biz.assigned.salesman}</strong> 
                                    <button onclick="HR.assignToBusiness(${biz.uid}, 'salesman')" ${biz.assigned.salesman >= (maxStaff - 1) || freeSales === 0 ? 'disabled' : ''} style="width:34px; height:34px; min-height:34px; padding:0; display:inline-flex; align-items:center; justify-content:center; background:#34c759; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; box-shadow:0 2px 8px rgba(52,199,89,0.35);">+</button>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top: 20px; text-align: right;">
                            <button onclick="PRODUCTION.upgradeBusiness(${biz.uid})" style="background: #f39c12; color: white; border: none; cursor: pointer; padding: 10px 15px; border-radius: 4px;">Расширить площадь ($${formatMoney(tpl.area * 50 * level)})</button>
                        </div>
                    </div>
                </div>
            </li>`;
        });
        
        if (!hasRetail) retailBody.innerHTML += '<div style="text-align:center; padding: 40px; color:#7f8c8d; font-size:1.2em;">У вас пока нет розничных магазинов.</div>';
    },

    // --- 11. НОВАЯ ВКЛАДКА: МАРКЕТИНГ ---
    updateMarketingTab() {
        let marketingBody = document.getElementById('ui-marketing-businesses');
        if (!marketingBody) return;
        
        marketingBody.innerHTML = '';
        
        if (!STATE.retail) STATE.retail = { prices: {}, brand: 10, history: [] };
        let currentBrand = STATE.retail.brand || 10;

        // Блок глобальной силы бренда теперь живет здесь
        marketingBody.innerHTML += `
        <div style="background: #fdfefe; padding: 20px; border-radius: 8px; border-left: 5px solid #8e44ad; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <h3 style="margin-top:0; color:#8e44ad;">🌟 Глобальная сила Бренда: ${currentBrand.toFixed(1)}%</h3>
            <p style="margin:0; color:#2c3e50; font-size:1.05em;">Узнаваемость бренда увеличивает ежедневный поток покупателей во всех ваших магазинах. Открывайте маркетинговые агентства ниже, чтобы усиливать бренд и запускать таргетированные кампании.</p>
        </div>

        <div style="background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #dcdde1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <div>
                <h3 style="margin: 0 0 5px 0; color: #2c3e50;">Управление маркетингом и PR</h3>
                <small style="color: #7f8c8d;">Создавайте креативные агентства для продвижения бренда, точек продаж или товаров.</small>
            </div>
            <div>
                <button onclick="PRODUCTION.buyBusiness('marketing_agency')" style="background: #8e44ad; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+ Открыть Маркетинговое Агентство</button>
            </div>
        </div>`;

        let hasMarketing = false;

        STATE.company.businesses.forEach(biz => {
            let tpl = RECIPES.BUSINESSES[biz.type];
            if (!tpl.isMarketing) return; 
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
            
            let currentCampaign = biz.campaign || 0;
            let targetType = biz.targetType || 'brand';
            let targetId = biz.targetId || '';

            let targetOptions = `<option value="brand_global" ${targetType==='brand' ? 'selected' : ''}>🌍 Глобальный бренд компании</option>`;
            
            targetOptions += `<optgroup label="🏪 Продвижение конкретного магазина">`;
            STATE.company.businesses.forEach(store => {
                if (RECIPES.BUSINESSES[store.type].isRetail) {
                    let isSelected = (targetType === 'store' && targetId == store.uid) ? 'selected' : '';
                    targetOptions += `<option value="store_${store.uid}" ${isSelected}>Магазин: ${store.name}</option>`;
                }
            });
            targetOptions += `</optgroup>`;

            targetOptions += `<optgroup label="📦 Продвижение конкретного товара">`;
            Object.keys(RECIPES.RESOURCES).forEach(k => {
                let res = RECIPES.RESOURCES[k];
                if (!res.isRaw && !res.isEquipment) {
                    let isSelected = (targetType === 'product' && targetId === k) ? 'selected' : '';
                    targetOptions += `<option value="product_${k}" ${isSelected}>Товар: ${res.name}</option>`;
                }
            });
            targetOptions += `</optgroup>`;

            marketingBody.innerHTML += `
            <li style="margin-bottom: 25px; background: #fff; padding: 25px; border: 1px solid #dcdde1; border-radius: 8px; list-style-type: none; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
                <h3 style="margin-top:0; border-bottom: 2px solid #9b59b6; padding-bottom: 12px; color:#2c3e50; font-size:1.4em;">📢 ${biz.name}</h3>
                
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="background:#f4ecf7; padding:15px; border-radius:6px; border:1px solid #d2b4de;">
                            <strong style="color:#8e44ad; font-size:1.1em;">🎯 Управление кампанией</strong><br>
                            
                            <div style="margin-top:10px;">
                                <strong style="color:#8e44ad; font-size:0.9em;">Цель продвижения (Таргет):</strong><br>
                                <select id="marketing-target-${biz.uid}" onchange="UI_DASHBOARD.setMarketingTarget(${biz.uid})" style="width:100%; padding:6px; margin-top:5px; border-radius:4px; border:1px solid #bdc3c7; cursor:pointer;">
                                    ${targetOptions}
                                </select>
                            </div>

                            <div style="margin-top:15px; border-top: 1px solid #d2b4de; padding-top: 10px;">
                                <strong style="color:#8e44ad; font-size:0.9em;">Рекламный бюджет (Каналы):</strong><br>
                                <select id="campaign-${biz.uid}" onchange="UI_DASHBOARD.setCampaign(${biz.uid})" style="width:100%; padding:6px; margin-top:5px; border-radius:4px; border:1px solid #bdc3c7; cursor:pointer;">
                                    <option value="0" ${currentCampaign==0?'selected':''}>Партизанский маркетинг — $0/дн</option>
                                    <option value="1" ${currentCampaign==1?'selected':''}>Контекстная реклама — $100/дн (Эффект x1.5)</option>
                                    <option value="2" ${currentCampaign==2?'selected':''}>Блогеры и СМИ — $500/дн (Эффект x2.5)</option>
                                    <option value="3" ${currentCampaign==3?'selected':''}>Национальное ТВ — $2000/дн (Эффект x5.0)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="background: #fdfefe; padding: 15px; border: 1px dashed #bdc3c7; border-radius: 6px; margin-top: 15px;">
                            <strong style="color:#2c3e50;">ОБОРУДОВАНИЕ (${RECIPES.RESOURCES[tpl.equipmentType].name}):</strong><br>
                            Рабочих мест (ПК): <strong>${eqCount} / ${maxSlots}</strong>
                            <div style="margin-top: 12px; display: flex; gap: 5px;">
                                <input type="number" id="install-qty-${biz.uid}" value="1" min="1" max="${maxSlots - eqCount}" style="width:60px; padding:6px; border: 1px solid #ccc; border-radius: 3px;">
                                <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" style="background:#8e44ad; flex-grow: 1; border: none; color: white; cursor: pointer; border-radius: 3px;">Купить ПК</button>
                            </div>
                        </div>
                    </div>

                    <div style="flex: 1; min-width: 250px;">
                        <p style="margin: 0 0 15px 0; font-size:1.1em;">🏢 Аренда офиса: <strong style="color:#c0392b;">$${formatMoney(adminCost)}</strong>/дн</p>
                        
                        <div style="background: #f4f6f7; padding: 15px; border-radius: 6px; border: 1px solid #eee;">
                            <strong style="font-size: 1.1em; color: #2c3e50;">КАДРЫ (${assignedTotal} / ${maxStaff} мест):</strong><br>
                            <small style="color:${assignedTotal > eqCount ? '#e74c3c' : '#7f8c8d'}; display:block; margin-bottom:12px;">${assignedTotal > eqCount ? '⚠️ Не хватает ПК! Часть команды простаивает.' : 'Каждому сотруднику нужен ПК.'}</small>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                <span>Маркетолог <small style="color:#7f8c8d;">(Резерв: ${freeMarketer})</small></span>
                                <div>
                                    <button onclick="HR.removeFromBusiness(${biz.uid}, 'marketer')" ${biz.assigned.marketer===0?'disabled style="opacity:0.5;"':''} style="padding: 4px 10px; background:#e74c3c; border:none; color:white; cursor:pointer; border-radius:3px;">-</button> 
                                    <strong style="display:inline-block; width:25px; text-align:center;">${biz.assigned.marketer}</strong> 
                                    <button onclick="HR.assignToBusiness(${biz.uid}, 'marketer')" ${isFull||freeMarketer===0?'disabled style="opacity:0.5;"':''} style="padding: 4px 10px; background:#2ecc71; border:none; color:white; cursor:pointer; border-radius:3px;">+</button>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                                <span>PR-Менеджер <small style="color:#7f8c8d;">(Резерв: ${freePR})</small></span>
                                <div>
                                    <button onclick="HR.removeFromBusiness(${biz.uid}, 'pr_manager')" ${biz.assigned.pr_manager===0?'disabled style="opacity:0.5;"':''} style="padding: 4px 10px; background:#e74c3c; border:none; color:white; cursor:pointer; border-radius:3px;">-</button> 
                                    <strong style="display:inline-block; width:25px; text-align:center;">${biz.assigned.pr_manager}</strong> 
                                    <button onclick="HR.assignToBusiness(${biz.uid}, 'pr_manager')" ${isFull||freePR===0?'disabled style="opacity:0.5;"':''} style="padding: 4px 10px; background:#2ecc71; border:none; color:white; cursor:pointer; border-radius:3px;">+</button>
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 20px; text-align: right;">
                            <button onclick="PRODUCTION.upgradeBusiness(${biz.uid})" style="background: #f39c12; color: white; border: none; cursor: pointer; padding: 10px 15px; border-radius: 4px;">Расширить офис ($${formatMoney(tpl.area * 50 * level)})</button>
                        </div>
                    </div>
                </div>
            </li>`;
        });
        
        if (!hasMarketing) {
            marketingBody.innerHTML += '<div style="text-align:center; padding: 40px; color:#7f8c8d; font-size:1.2em;">У вас пока нет маркетинговых агентств.</div>';
        }
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

        // РАСЧЕТ СТОИМОСТИ ЛОГИСТИКИ (МЕЖДУ ГОРОДАМИ)
        let sourceCity = cityId;
        let targetCity = store.city || 'odesa';
        let dist = typeof GEO !== 'undefined' ? GEO.getDistance(sourceCity, targetCity) : 10;
        let logBase = typeof GEO !== 'undefined' ? GEO.COUNTRIES['ua'].macro.logisticsBaseRate : 0.15;
        
        // Формула: Расстояние * Базовая ставка * Объем груза (м³)
        let totalVolume = qty * itemVol;
        let logCost = dist * logBase * totalVolume;

        if (STATE.finances.balance < logCost) {
            NOTIFY.error('Ошибка логистики', `Не хватает средств на оплату транспортной компании. Нужно $${formatMoney(logCost)}.`);
            return;
        }

        // Списываем деньги и записываем в P&L
        STATE.finances.balance -= logCost;
        if (typeof LEDGER !== 'undefined') LEDGER.record('exp_logistics', logCost);
        
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
    }
};
