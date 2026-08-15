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
                        <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:4px;">Корпус НИИ</div>
                        <div style="font-size:1.4rem; font-weight:800; color:var(--text);">Уровень ${lvl}</div>
                    </div>
                    <div style="background: rgba(142,68,173,0.1); color:#8e44ad; font-weight:700; padding:6px 12px; border-radius:8px; font-size:0.9rem;">
                        🏢 ${curStaff}/${maxStaff} мест
                    </div>
                </div>
                <div style="background:var(--surface-2); border-radius:8px; height:8px; overflow:hidden; margin-bottom:6px;">
                    <div style="height:100%; width:${capPct}%; background:linear-gradient(90deg,#8e44ad,#3498db); border-radius:8px; transition:width 0.4s;"></div>
                </div>
                <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:16px;">Заполненность: ${capPct}%</div>
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
            <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:14px;">👨‍🔬 Персонал лаборатории</div>
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
            <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:14px;">💻 Оборудование (Смарт-ПК)</div>
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
                <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:14px;">⚡ Активное Исследование</div>
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
                    <div style="font-size:2.5rem;">${techIcon}</div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--orange); text-transform:uppercase; font-weight:700;">${titleName}</div>
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
                                <span>${ico} <strong>${t.name}</strong> <span style="color:var(--text-dim); font-size:0.8rem;">${p}%</span></span>
                                <button onclick="RND.startProject('${bizId}')" style="background:rgba(39,174,96,0.1); color:var(--green); border:1px solid rgba(39,174,96,0.3); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.82rem; font-weight:600;">▶ Продолжить</button>
                            </div>`;
                        }
                    });
                    if (pausedHtml) rndActive.innerHTML += `<div style="margin-top:14px;"><div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-dim); font-weight:700; margin-bottom:6px;">⏸ На паузе</div>${pausedHtml}</div>`;
                }
            } else {
                rndActive.innerHTML = `
                <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:12px;">⚡ Активное Исследование</div>
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
                                <span>${ico} <strong>${t.name}</strong> <span style="color:var(--text-dim); font-size:0.8rem;">${p}%</span></span>
                                <button onclick="RND.startProject('${bizId}')" style="background:rgba(39,174,96,0.1); color:var(--green); border:1px solid rgba(39,174,96,0.3); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.82rem; font-weight:600;">▶ Продолжить</button>
                            </div>`;
                        }
                    });
                    if (pausedHtml) rndActive.innerHTML += `<div style="margin-top:4px;"><div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-dim); font-weight:700; margin-bottom:6px;">⏸ На паузе</div>${pausedHtml}</div>`;
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
                    <div style="text-align:center; font-size:0.8rem; color:var(--green); font-weight:700;">✅ Завершено</div>
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
                                <div style="font-size:0.7rem; color:${color}; font-weight:600;">→ ${outRes ? outRes.name : tpl.output}</div>
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
                        <span style="font-size:0.8rem; color:var(--text);">${inName}</span>
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
                        <span style="font-size:0.8rem; color:var(--text); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</span>
                        <div style="display:flex; align-items:center; gap:4px; margin-left:8px;">
                            <input type="number" id="route-${biz.uid}-${r.id}" value="${val}" min="0" style="width:56px; padding:4px 6px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:0.8rem; text-align:right;">
                            <span style="font-size:0.75rem; color:var(--text-dim);">шт</span>
                        </div>
                    </div>`;
                }).join('');
                let destsStr = viableRoutes.map(r => r.id).join(',');
                routingHtml += `<button onclick="UI_DASHBOARD.saveRoutes(${biz.uid},'${destsStr}')" style="width:100%; background:rgba(243,156,18,0.1); color:var(--orange); border:1px solid rgba(243,156,18,0.3); padding:7px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.8rem; margin-top:4px;">💾 Сохранить маршруты</button>`;
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
                                <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" style="flex:1; background:rgba(52,152,219,0.1); color:var(--blue); border:1px solid rgba(52,152,219,0.3); padding:7px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.8rem;">⬇️ Установить</button>
                                <button onclick="PRODUCTION.repairEquipment(${biz.uid})" style="background:rgba(142,68,173,0.1); color:#8e44ad; border:1px solid rgba(142,68,173,0.3); padding:7px 10px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.8rem;">🔧 ТО</button>
                            </div>
                        </div>

                        <!-- Общая эффективность -->
                        <div style="background:${effColor}18; border-radius:10px; padding:16px; border:1px solid ${effColor}30;">
                            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:${effColor}; font-weight:700; margin-bottom:12px;">📊 Эффективность</div>
                            <div style="text-align:center;">
                                <div style="font-size:2.8rem; font-weight:900; color:${effColor}; line-height:1;">${effPercent}%</div>
                                <div style="font-size:0.75rem; color:var(--text-dim); margin-top:6px;">${effPercent >= 80 ? '🔥 Завод работает на максимуме!' : effPercent >= 40 ? '⚙️ Есть потенциал роста' : assignedTotal === 0 ? '😴 Назначьте рабочих' : '⚠️ Требует внимания'}</div>
                            </div>
                            <div style="margin-top:14px; display:flex; flex-direction:column; gap:6px; font-size:0.78rem;">
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="color:var(--text-dim);">Кач. оборуд.</span><span style="font-weight:700;">${(biz.equipment.quality||1.0).toFixed(2)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="color:var(--text-dim);">Кач. персонала</span><span style="font-weight:700;">${q_hr.toFixed(2)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="color:var(--text-dim);">Технология</span><span style="font-weight:700; color:#8e44ad;">v${q_tech.toFixed(2)}</span>
                                </div>
                                <div style="height:1px; background:var(--border);"></div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="color:var(--text-dim);">Кач. продукта ★</span><span style="font-weight:800; color:#8e44ad;">${expectedQuality}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="color:var(--text-dim);">Себестоимость</span><span style="font-weight:700; color:var(--red);">$${formatMoney(biz.lastCogs)}/шт</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
        });

        if (!hasFactories) {
            bizList.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <div style="font-size:4rem; margin-bottom:16px;">🏗️</div>
                <h3 style="color:var(--text); margin:0 0 8px 0;">Нет активных предприятий</h3>
                <p style="color:var(--text-dim); margin:0 0 24px 0; max-width:400px; margin-left:auto; margin-right:auto;">
                    Постройте первый завод, чтобы начать производство. Нажмите кнопку «+ Построить предприятие» выше.
                </p>
                <button onclick="UI_DASHBOARD.toggleBuyPanel()" style="background:linear-gradient(135deg,#3498db,#2980b9); color:white; border:none; padding:14px 32px; border-radius:var(--radius); cursor:pointer; font-weight:700; font-size:1rem; box-shadow:0 4px 15px rgba(52,152,219,0.4);">
                    🏗️ Открыть каталог предприятий
                </button>
            </div>`;
        }
    },


    // --- БИРЖА С РАБОЧИМИ ФИЛЬТРАМИ И АКТИВНЫМИ ОРДЕРАМИ ---
    updateB2BTab() {
        let container = document.getElementById('ui-b2b-offers-list');
        if (!container) return;

        let offers = STATE.b2bOffers || [];
        // Фильтруем только активные (не принятые и не просроченные)
        let activeOffers = offers.filter(o => !o.accepted && o.expiresDay >= STATE.time.day);

        if (activeOffers.length === 0) {
            container.innerHTML = '<div style="padding:20px; background:var(--surface); border-radius:12px; color:var(--text-dim); text-align:center;">Нет активных предложений от конкурентов. Контракты появляются каждые 7 дней.</div>';
            return;
        }

        let html = '';
        activeOffers.forEach(offer => {
            let itemDef = RECIPES[offer.itemId];
            if (!itemDef) return;

            let icon = itemDef.icon || '📦';
            let name = itemDef.name || offer.itemId;
            let daysLeft = offer.expiresDay - STATE.time.day;
            
            // Форматируем звезды качества
            let stars = '';
            let q = Math.round(offer.quality);
            for(let i=0; i<q; i++) stars += '⭐';

            html += `
            <div style="background:var(--surface); border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center; box-shadow: var(--shadow-card); border-left: 4px solid var(--blue);">
                <div style="display:flex; align-items:center; gap:20px;">
                    <div style="font-size:32px; background:var(--surface-2); padding:10px; border-radius:12px;">${icon}</div>
                    <div>
                        <h3 style="margin:0 0 5px 0;">Контракт от «${offer.company}»</h3>
                        <div style="color:var(--text-dim); margin-bottom: 5px;">
                            <strong>Поставка:</strong> ${offer.qty} шт. ${name}
                        </div>
                        <div style="display:flex; gap:10px; font-size:0.85rem;">
                            <span style="background:rgba(255,149,0,0.1); color:var(--orange); padding:2px 8px; border-radius:4px;">Качество: ${stars} (${offer.quality})</span>
                            <span style="background:rgba(0,122,255,0.1); color:var(--blue); padding:2px 8px; border-radius:4px;">Бренд: +${offer.brandPower}</span>
                            <span style="background:rgba(255,59,48,0.1); color:var(--red); padding:2px 8px; border-radius:4px;">Истекает: через ${daysLeft} дн.</span>
                        </div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.2rem; font-weight:bold; color:var(--text); margin-bottom:10px;">$${formatMoney(offer.totalPrice)}</div>
                    <div style="font-size:0.85rem; color:var(--text-dim); margin-bottom:10px;">Цена за шт: $${formatMoney(offer.price)}</div>
                    <button class="btn-primary-lg" onclick="B2B_AI.acceptOffer('${offer.id}')" style="background:var(--green);">Выкупить контракт</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
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

        let yOpex = (y.exp_salary || 0) + (y.exp_admin || 0) + (y.exp_hr || 0) + yTaxPayroll + yExpMarketing + yExpLogistics + yExpRepair + yExpFines;
        let tOpex = (t.exp_salary || 0) + (t.exp_admin || 0) + (t.exp_hr || 0) + tTaxPayroll + tExpMarketing + tExpLogistics + tExpRepair + tExpFines;

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
                        
                        <tr style="border-top:1px dashed var(--border);"><td style="text-align:left; padding:4px 0; color:var(--red); font-weight:600;">2. Себестоимость продаж (COGS)</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(yCogs)}</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(tCogs)}</td></tr>
                        
                        <tr style="font-weight:bold; background: rgba(52,199,89,0.06); border-top:1px solid var(--border);"><td style="text-align:left; padding:6px 4px; color:var(--green);">ВАЛОВАЯ ПРИБЫЛЬ (GROSS PROFIT)</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(yGross)}</td><td style="text-align:right; color:var(--green); font-family:var(--font-mono);">$${formatMoney(tGross)}</td></tr>
                        
                        <tr style="font-weight:bold; background: var(--surface-2); border-top:1px solid var(--border);"><td style="text-align:left; padding:6px 4px;">3. ОПЕРАЦИОННЫЕ РАСХОДЫ (OPEX)</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(yOpex)}</td><td style="text-align:right; color:var(--red); font-family:var(--font-mono);">-$${formatMoney(tOpex)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Фонд оплаты труда (ЗП)</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(y.exp_salary || 0)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(t.exp_salary || 0)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Социальный взнос ЕСВ (22%)</td><td style="text-align:right; color:var(--orange); font-family:var(--font-mono);">$${formatMoney(yTaxPayroll)}</td><td style="text-align:right; color:var(--orange); font-family:var(--font-mono);">$${formatMoney(tTaxPayroll)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Аренда недвижимости</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(y.exp_admin || 0)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(t.exp_admin || 0)}</td></tr>
                        <tr><td style="text-align:left; padding-left:12px; color:var(--text-dim);">- Межгородская логистика</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(yExpLogistics)}</td><td style="text-align:right; font-family:var(--font-mono);">$${formatMoney(tExpLogistics)}</td></tr>
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
        
        document.getElementById('ui-staff-total').innerText = HR.getTotalStaff();
        if(document.getElementById('ui-staff-salary')) document.getElementById('ui-staff-salary').innerText = formatMoney(HR.getDailySalaryFund());
        
        let breakdownDiv = document.getElementById('ui-hr-breakdown');
        if (breakdownDiv) {
            let parts = [];
            Object.keys(HR.GRADES).forEach(grade => {
                let total = STATE.hr && STATE.hr.staff ? (STATE.hr.staff[grade] || 0) : 0;
                if (total > 0) parts.push(`<span style="background:var(--blue-dim); color:var(--blue); padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:600;">${HR.GRADES[grade].name.split(' ')[0]}: ${total}</span>`);
            });
            
            let trainingCount = STATE.hr.trainingQueue.length;
            if (trainingCount > 0) parts.push(`<span style="background:var(--orange-dim); color:var(--orange); padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:600;">На учебе: ${trainingCount}</span>`);
            
            breakdownDiv.innerHTML = parts.length > 0 ? parts.join('') : '<span style="color:var(--text-faint); font-size:0.9rem;">Штат пуст</span>';
        }

        let hireFactory = document.getElementById('ui-hire-factory');
        let hireRnd = document.getElementById('ui-hire-rnd');
        if (hireFactory && hireRnd) {
            hireFactory.innerHTML = '';
            hireRnd.innerHTML = '';
            
            Object.keys(HR.GRADES).forEach(grade => {
                let info = HR.GRADES[grade];
                let isFactory = info.role === 'factory';
                
                let btnHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:12px 16px; border-radius:var(--radius-sm); border:1px solid var(--border); box-shadow:var(--shadow-card);">
                    <div>
                        <div style="font-weight:600; color:var(--text);">${info.name.split(' ')[0]}</div>
                        <div style="font-size:0.8rem; color:var(--text-dim);">ЗП: $${formatMoney(info.salary)}/дн</div>
                    </div>
                    <button onclick="HR.hire('${grade}')" style="background:${isFactory ? 'var(--blue)' : '#1abc9c'}; color:white; border:none; padding:8px 16px; border-radius:var(--radius-sm); cursor:pointer; font-weight:600; font-size:0.85rem; transition:transform 0.1s;">
                        Найм ($${formatMoney(info.hireCost)})
                    </button>
                </div>`;
                
                if (isFactory) hireFactory.innerHTML += btnHtml;
                else hireRnd.innerHTML += btnHtml;
            });
        }
        
        let trainingDiv = document.getElementById('ui-hr-training-list');
        if (trainingDiv) {
            if (STATE.hr.trainingQueue.length === 0) {
                trainingDiv.innerHTML = '<span style="color:var(--text-dim); font-size:0.9rem;">В данный момент никто не проходит обучение.</span>';
            } else {
                let tHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
                STATE.hr.trainingQueue.forEach(t => {
                    let nextName = HR.GRADES[t.toGrade].name.split(' ')[0];
                    tHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:12px 16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                        <div>
                            <span style="font-weight:600; color:var(--text);">Повышение квалификации ➔ ${nextName}</span>
                            <div style="font-size:0.8rem; color:var(--text-dim);">Сотрудник получает стипендию $${t.salary}/дн</div>
                        </div>
                        <div style="background:var(--orange-dim); color:var(--orange); font-weight:bold; padding:6px 12px; border-radius:8px; font-size:0.9rem;">
                            Осталось ${t.daysLeft} дн.
                        </div>
                    </div>`;
                });
                tHtml += '</div>';
                trainingDiv.innerHTML = tHtml;
            }
        }

        let reserveContainer = document.getElementById('ui-hr-reserve-table');
        if (reserveContainer) {
            let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
            Object.keys(HR.GRADES).forEach(grade => {
                let free = HR.getUnassigned(grade);
                let info = HR.GRADES[grade];
                
                let trainCost = grade === 'junior' ? 250 : (grade === 'middle' ? 800 : (grade === 'scientist' ? 1500 : null));
                let trainDays = grade === 'junior' ? 3 : (grade === 'middle' ? 7 : (grade === 'scientist' ? 10 : null));
                let nextGradeName = grade === 'junior' ? 'Middle' : (grade === 'middle' ? 'Senior' : (grade === 'scientist' ? 'Ст. Научного' : ''));
                
                let trainBtn = '';
                if (trainCost) {
                    trainBtn = `<button onclick="HR.train('${grade}')" ${free===0?'disabled style="opacity:0.4; cursor:not-allowed;"':''} style="background:var(--blue); color:white; border:none; padding:6px 12px; border-radius:6px; font-size:0.85rem; font-weight:600; cursor:pointer;">Обучить до ${nextGradeName} ($${trainCost})</button>`;
                }

                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm);">
                    <div>
                        <strong style="color:var(--text);">${info.name}</strong> 
                        <span style="color:var(--text-dim); margin-left:8px;">(Доступно: ${free})</span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${trainBtn} 
                        <button onclick="HR.fire('${grade}')" ${free===0?'disabled style="opacity:0.4; cursor:not-allowed;"':''} style="background:var(--red-dim); color:var(--red); border:none; padding:6px 12px; border-radius:6px; font-size:0.85rem; font-weight:600; cursor:pointer;">Уволить</button>
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
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        let targetEl = document.getElementById(tabId);
        if (targetEl) targetEl.classList.add('active');
        if (event && event.currentTarget) event.currentTarget.classList.add('active');
        if (tabId === 'tab-wiki' && typeof WIKI !== 'undefined') WIKI.render();
        if (tabId === 'tab-finance') this.updateFinanceTab();
        if (tabId === 'tab-b2b') this.updateB2BTab();
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
                    <div style="font-size:0.75rem; font-weight:700; color:${isActive ? c.color : 'var(--text-dim)'};">${c.name}</div>
                    <div style="font-size:0.7rem; color:var(--text-faint); margin-top:2px;">${c.cost > 0 ? '$' + c.cost + '/дн' : 'Бесплатно'}</div>
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
                            <div style="font-size:0.8rem; color:var(--text-dim);">Уровень ${level} • Аренда <strong style="color:var(--red);">$${formatMoney(adminCost)}</strong>/дн</div>
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
                                <div style="font-size:0.75rem; opacity:0.9;">${effPct >= 75 ? '🔥 Отличная работа!' : effPct >= 40 ? '⚙️ Есть потенциал' : '⚠️ Требует внимания'}</div>
                            </div>
                            ${assignedTotal > eqCount ? `<div style="margin-top:10px; background:rgba(230,126,34,0.1); color:var(--orange); border:1px solid rgba(230,126,34,0.3); border-radius:8px; padding:8px; font-size:0.8rem; font-weight:600;">⚠️ Сотрудников больше, чем ПК! Часть команды простаивает.</div>` : ''}
                        </div>

                        <!-- Управление кадрами -->
                        <div style="background:var(--surface-2); padding:14px; border-radius:10px; border:1px solid var(--border);">
                            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim); font-weight:700; margin-bottom:12px;">👥 Кадровый состав (${assignedTotal}/${maxStaff})</div>
                            
                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:10px 14px; border-radius:8px; border:1px solid var(--border); margin-bottom:8px;">
                                <div>
                                    <div style="font-weight:600; font-size:0.9rem;">🎨 Маркетолог</div>
                                    <div style="font-size:0.75rem; color:var(--text-dim);">Резерв: ${freeMarketer}</div>
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
                                    <div style="font-size:0.75rem; color:var(--text-dim);">Резерв: ${freePR}</div>
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
