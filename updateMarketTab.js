const fs = require('fs');
let txt = fs.readFileSync('js/ui/dashboardUI.js', 'utf8');

let startMarker = '    updateMarketTab() {';
let endMarker = '    // --- 8. БАНК И КРЕДИТЫ ---';
let startIdx = txt.indexOf(startMarker);
let endIdx = txt.indexOf(endMarker);

if (startIdx > -1 && endIdx > -1) {
    let newContent = `    // Словарь иконок для ресурсов
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
                    cityOptions += \`<option value="\${cId}">\${GEO.CITIES[cId].name} (Свободно: \${freeSpace} м³)</option>\`;
                }
            });
        }

        if (cityOptions === '') {
            marketContainer.innerHTML = '<div style="padding: 40px; text-align:center; color:var(--text-dim);">У вас нет ни одного активного склада! Сначала постройте склад (вкладка Производство или Склады).</div>';
            return;
        }

        let filterHtml = \`
        <div style="margin-bottom: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="UI_DASHBOARD.setMarketFilter('all')" class="btn-filter \${this.marketFilter==='all' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: \${this.marketFilter==='all' ? 'var(--blue)' : 'var(--surface-2)'}; color: \${this.marketFilter==='all' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Все товары</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('raw')" class="btn-filter \${this.marketFilter==='raw' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: \${this.marketFilter==='raw' ? 'var(--blue)' : 'var(--surface-2)'}; color: \${this.marketFilter==='raw' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Только сырье</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('finished')" class="btn-filter \${this.marketFilter==='finished' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: \${this.marketFilter==='finished' ? 'var(--blue)' : 'var(--surface-2)'}; color: \${this.marketFilter==='finished' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Готовая продукция</button>
            <button onclick="UI_DASHBOARD.setMarketFilter('equipment')" class="btn-filter \${this.marketFilter==='equipment' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: \${this.marketFilter==='equipment' ? 'var(--blue)' : 'var(--surface-2)'}; color: \${this.marketFilter==='equipment' ? '#fff' : 'var(--text-dim)'}; transition: 0.2s;">Оборудование</button>
        </div>\`;

        // Активные ордера (Товары в пути)
        let pendingOrdersHtml = '';
        if (STATE.logistics && STATE.logistics.deliveries) {
            let marketOrders = STATE.logistics.deliveries.filter(d => d.isMarketOrder);
            if (marketOrders.length > 0) {
                pendingOrdersHtml += \`
                <div style="margin-bottom: 24px; background: rgba(243,156,18,0.05); border: 1px solid rgba(243,156,18,0.2); border-radius: 12px; padding: 20px;">
                    <h4 style="margin: 0 0 16px 0; color: var(--orange); display:flex; align-items:center; gap:8px;"><span style="font-size:1.4rem;">📦</span> В пути (Закупки с рынка)</h4>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">\`;
                
                marketOrders.forEach(d => {
                    let resName = RECIPES.RESOURCES[d.item] ? RECIPES.RESOURCES[d.item].name : d.item;
                    let icon = this._resIcons && this._resIcons[d.item] ? this._resIcons[d.item] : '📦';
                    let cName = typeof GEO !== 'undefined' ? GEO.getCity(d.targetCity).name : d.targetCity;
                    pendingOrdersHtml += \`
                        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="font-size:2rem;">\${icon}</div>
                                <div>
                                    <div style="font-weight:700; color:var(--text); font-size:0.95rem;">\${resName} <span style="color:var(--text-dim); font-weight:400;">x\${d.qty}</span></div>
                                    <div style="font-size:0.75rem; color:var(--text-dim);">📍 в \${cName} • ★\${(d.quality||1.0).toFixed(2)}</div>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="color:var(--green); font-weight:700; font-size:0.95rem;">$\${formatMoney(d.totalCost)}</div>
                                <button onclick="MARKET.cancelOrder('\${d.id}')" style="background:var(--red-dim); color:var(--red); border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600; margin-top:4px;">Отменить</button>
                            </div>
                        </div>\`;
                });
                pendingOrdersHtml += \`</div></div>\`;
            }
        }

        let html = \`
        <div style="background: linear-gradient(135deg, rgba(52,152,219,0.1), rgba(41,128,185,0.05)); border: 1px solid rgba(52,152,219,0.2); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
                <h2 style="margin: 0 0 6px 0; color: var(--blue);">🛒 Глобальный Рынок B2B</h2>
                <p style="margin: 0; color: var(--text-dim); font-size: 0.9rem;">Закупайте сырье и продавайте излишки. Цены формируются динамически.</p>
            </div>
            <div style="display:flex; align-items:center; gap:12px; background:var(--surface); padding:8px 14px; border-radius:12px; border:1px solid var(--border);">
                <span style="font-size:1.2rem;">📍</span>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:0.7rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">Склад для доставки</span>
                    <select id="market-target-city" style="border:none; background:transparent; font-size:0.95rem; font-weight:700; color:var(--text); cursor:pointer; outline:none; padding:0;">
                        \${cityOptions}
                    </select>
                </div>
            </div>
        </div>
        \${filterHtml}
        \${pendingOrdersHtml}
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
        \`;

        Object.keys(RECIPES.RESOURCES).forEach(key => {
            let res = RECIPES.RESOURCES[key];
            if (this.marketFilter === 'raw' && !res.isRaw) return;
            if (this.marketFilter === 'finished' && (res.isRaw || res.isEquipment)) return;
            if (this.marketFilter === 'equipment' && !res.isEquipment) return;

            let basePrice = MARKET.getCurrentPrice(key);
            let availQty = MARKET.getAvailablePool(key);
            let icon = this._resIcons && this._resIcons[key] ? this._resIcons[key] : '📦';
            
            // Если есть на складах - возможность продать (сверху в карточке)
            let inventoryHtml = '';
            Object.keys(STATE.company.warehouses).forEach(cId => {
                let wh = STATE.company.warehouses[cId];
                if (wh.inventory && wh.inventory[key] && wh.inventory[key].qty > 0) {
                    let inv = wh.inventory[key];
                    let finalPrice = basePrice * (inv.quality || 1.0);
                    let cityName = typeof GEO !== 'undefined' ? GEO.getCity(cId).name : cId;
                    inventoryHtml += \`
                    <div style="background:rgba(39,174,96,0.08); border:1px solid rgba(39,174,96,0.2); border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div style="font-size:0.8rem; color:var(--text-dim);">На складе <span style="font-weight:700; color:var(--text);">\${cityName}</span></div>
                            <div style="font-weight:800; color:var(--green); font-size:0.9rem;">\${inv.qty} шт</div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="font-size:0.8rem;">★ \${(inv.quality || 1.0).toFixed(2)} <span style="color:var(--text-faint);">($\${formatMoney(finalPrice)}/шт)</span></div>
                            <button onclick="MARKET.sell('\${key}', \${inv.qty}, '\${cId}')" style="background:var(--green); color:white; border:none; padding:6px 12px; border-radius:6px; font-weight:700; font-size:0.8rem; cursor:pointer;">Продать</button>
                        </div>
                    </div>\`;
                }
            });

            html += \`
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:16px; box-shadow:var(--shadow-card); overflow:hidden; display:flex; flex-direction:column; transition:transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <div style="padding:16px; cursor:pointer;" onclick="UI_DASHBOARD.showMarketModal('\${key}')">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="font-size:2.4rem;">\${icon}</div>
                            <div>
                                <h3 style="margin:0; font-size:1.1rem; color:var(--text);">\${res.name}</h3>
                                <div style="color:var(--text-dim); font-size:0.75rem;">Объем: \${res.volume || 1} м³</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.3rem; font-weight:800; color:var(--text);">$\${formatMoney(basePrice)}</div>
                            <div style="font-size:0.75rem; color:var(--text-faint);">за ед.</div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-2); padding:8px 12px; border-radius:8px;">
                        <span style="font-size:0.8rem; color:var(--text-dim);">Доступно на бирже</span>
                        <span style="font-weight:700; color:var(--blue); font-size:0.95rem;">\${availQty} шт</span>
                    </div>
                </div>
                
                <div style="padding:0 16px;">\${inventoryHtml}</div>

                <div style="padding:16px; border-top:1px solid var(--border); background:var(--surface-2); margin-top:auto;">
                    <div style="display:flex; gap:8px;">
                        <input type="number" id="buy-qty-\${key}" value="10" min="1" style="flex:1; width:50px; padding:10px; border:1px solid var(--border); border-radius:8px; font-weight:700; font-size:1rem; text-align:center; background:var(--surface); color:var(--text);">
                        <button onclick="UI_DASHBOARD.submitBuy('\${key}')" style="background:var(--blue); color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:700; font-size:0.95rem; cursor:pointer;">Купить</button>
                    </div>
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <button onclick="document.getElementById('buy-qty-\${key}').value = 100" style="flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:6px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600;">100</button>
                        <button onclick="document.getElementById('buy-qty-\${key}').value = 1000" style="flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:6px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600;">1k</button>
                        <button onclick="UI_DASHBOARD.setMaxBuy('\${key}')" style="flex:2; background:rgba(243,156,18,0.1); color:var(--orange); border:1px solid rgba(243,156,18,0.3); padding:6px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:700;">MAX</button>
                    </div>
                </div>
            </div>`;
        });

        html += \`</div>\`;
        marketContainer.innerHTML = html;
    },

    showMarketModal(itemKey) {
        let res = RECIPES.RESOURCES[itemKey];
        if(!res) return;
        let icon = this._resIcons && this._resIcons[itemKey] ? this._resIcons[itemKey] : '📦';
        let basePrice = MARKET.getCurrentPrice(itemKey);
        
        // Определяем кто производит и кто потребляет
        let producers = [];
        let consumers = [];
        if(RECIPES.BUSINESSES) {
            Object.values(RECIPES.BUSINESSES).forEach(biz => {
                if(biz.output === itemKey) producers.push(biz.name);
                if(biz.inputs && biz.inputs[itemKey]) consumers.push(biz.name);
            });
        }
        
        let descHtml = \`<div style="font-size:0.9rem; color:var(--text-dim); line-height:1.5; margin-bottom:20px;">
            <p><strong>\${res.name}</strong> — \${res.isRaw ? 'Базовое сырье' : res.isEquipment ? 'Оборудование' : 'Готовая продукция'}.
            Широко используется на глобальном рынке B2B. Цены зависят от спроса и глобальной инфляции.</p>
            \${producers.length ? \`<p><strong>Производится на:</strong> \${producers.join(', ')}</p>\` : ''}
            \${consumers.length ? \`<p><strong>Используется на:</strong> \${consumers.join(', ')}</p>\` : ''}
        </div>\`;

        let content = document.getElementById('market-modal-content');
        content.innerHTML = \`
            <div style="padding:24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg, rgba(52,152,219,0.05), rgba(41,128,185,0.02));">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="font-size:3rem;">\${icon}</div>
                    <div>
                        <h2 style="margin:0 0 4px 0; font-size:1.6rem;">\${res.name}</h2>
                        <div style="font-size:1.2rem; font-weight:800; color:var(--blue);">$\${formatMoney(basePrice)}</div>
                    </div>
                </div>
                <button onclick="UI_DASHBOARD.closeMarketModal()" style="background:transparent; border:none; font-size:1.5rem; color:var(--text-dim); cursor:pointer;">&times;</button>
            </div>
            <div style="padding:24px;">
                \${descHtml}
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0;">📈 Динамика цены</h3>
                    <div style="display:flex; gap:8px;">
                        <button onclick="UI_DASHBOARD.updateMarketChart('\${itemKey}', 7)" style="padding:4px 10px; border-radius:12px; border:1px solid var(--blue); background:var(--blue); color:white; font-size:0.8rem; cursor:pointer;">Неделя</button>
                        <button onclick="UI_DASHBOARD.updateMarketChart('\${itemKey}', 30)" style="padding:4px 10px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:0.8rem; cursor:pointer;">Месяц</button>
                        <button onclick="UI_DASHBOARD.updateMarketChart('\${itemKey}', 365)" style="padding:4px 10px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:0.8rem; cursor:pointer;">Год</button>
                    </div>
                </div>
                <div style="height:250px; position:relative;">
                    <canvas id="marketChart"></canvas>
                </div>
            </div>
        \`;
        
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
        // Генерируем фейковую историческую дату для наглядности (с волатильностью)
        let labels = [];
        let data = [];
        let curPrice = basePrice * (1 - (Math.random()*0.2 - 0.1)); // цена N дней назад
        
        for(let i=days; i>=0; i--) {
            if(days <= 30) labels.push(\`День \${STATE.time.day - i > 0 ? STATE.time.day - i : 1}\`);
            else if(i%30===0) labels.push(\`Мес \${Math.floor(i/30)}\`);
            
            curPrice = curPrice + (curPrice * (Math.random()*0.06 - 0.03));
            if(i===0) curPrice = basePrice; // сегодня - реальная цена
            
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
        
        // Обновление активной кнопки (простой визуал)
        let btns = ctx.parentElement.previousElementSibling.querySelectorAll('button');
        btns.forEach(b => {
            b.style.background = 'var(--surface-2)'; b.style.color = 'var(--text)'; b.style.borderColor = 'var(--border)';
            if((days===7 && b.innerText==='Неделя') || (days===30 && b.innerText==='Месяц') || (days===365 && b.innerText==='Год')) {
                b.style.background = 'var(--blue)'; b.style.color = 'white'; b.style.borderColor = 'var(--blue)';
            }
        });
    },

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

        document.getElementById(\`buy-qty-\${itemKey}\`).value = maxPossible;
    },

    submitBuy(itemKey) {
        let input = document.getElementById(\`buy-qty-\${itemKey}\`);
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
`;

    txt = txt.slice(0, startIdx) + newContent + txt.slice(endIdx);
    fs.writeFileSync('js/ui/dashboardUI.js', txt);
    console.log('Successfully updated Market Tab!');
} else {
    console.log('Error finding markers!');
}
