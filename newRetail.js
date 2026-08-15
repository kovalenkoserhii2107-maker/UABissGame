    updateRetailTab() {
        let retailBody = document.getElementById('ui-retail-businesses');
        if (!retailBody) return;
        
        if (!STATE.retail) STATE.retail = { prices: {}, brand: 10, history: [] };
        
        let hasRetail = false;
        let activeStoresHtml = '';

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
            
            let totalSold = 0;
            let totalRev = 0;

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
                        let marginColor = margin >= 4 ? 'var(--red)' : (margin >= 2.5 ? 'var(--orange)' : 'var(--green)');
                        let soldYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].qty : 0;
                        let revYesterday = (biz.stats && biz.stats.lastSold && biz.stats.lastSold[k]) ? biz.stats.lastSold[k].revenue : 0;

                        totalSold += soldYesterday;
                        totalRev += revYesterday;

                        let icon = this._resIcons && this._resIcons[k] ? this._resIcons[k] : '📦';

                        invHtml += `
                        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                            <div style="display:flex; align-items:center; gap:12px; width: 35%;">
                                <div style="font-size:2rem;">${icon}</div>
                                <div>
                                    <div style="font-weight:700; color:var(--text); font-size:0.95rem;">${rTpl.name}</div>
                                    <div style="font-size:0.75rem; color:var(--blue); font-weight:700;">Сток: ${inv.qty} шт</div>
                                    <div style="font-size:0.75rem; color:var(--text-dim);">★ ${(inv.quality||1.0).toFixed(2)} • Опт: $${formatMoney(b2bPrice)}</div>
                                </div>
                            </div>
                            
                            <div style="width: 35%; display:flex; flex-direction:column; gap:4px;">
                                <div style="font-size:0.75rem; color:var(--text-dim);">Цена на полке (x${margin.toFixed(1)})</div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="color:var(--text); font-weight:700;">$</span>
                                    <input type="number" id="price-${biz.uid}-${k}" value="${retailPrice.toFixed(0)}" style="width:70px; padding:6px; border:1px solid var(--border); border-radius:6px; font-weight:700; font-size:0.9rem; background:var(--surface-2); color:var(--text);">
                                    <button onclick="UI_DASHBOARD.saveStorePrice(${biz.uid}, '${k}')" style="background:var(--blue); color:white; border:none; padding:6px 10px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:700;">OK</button>
                                </div>
                            </div>
                            
                            <div style="width: 30%; text-align:right;">
                                <div style="font-size:0.75rem; color:var(--text-dim);">Продано вчера</div>
                                <div style="font-weight:800; color:var(--green); font-size:1.1rem;">${soldYesterday} шт</div>
                                <div style="font-size:0.8rem; color:var(--text); font-weight:700;">+$${formatMoney(revYesterday)}</div>
                            </div>
                        </div>`;
                    }
                });
            }
            if (invHtml === '') invHtml = '<div style="text-align:center; padding:20px; color:var(--text-dim); background:var(--surface-2); border-radius:8px; border:1px dashed var(--border);">Товара на полках нет</div>';
            
            let volPercent = Math.min(100, (currentVol/maxVol)*100).toFixed(1);
            let eqCount = biz.equipment.count || 0;
            let maxSlots = level * (tpl.slotsPerLevel || 5);
            let eqName = RECIPES.RESOURCES[tpl.equipmentType].name;

            // Рендер диаграммы занятости склада
            let chartBg = volPercent > 90 ? 'var(--red)' : (volPercent > 70 ? 'var(--orange)' : 'var(--green)');

            activeStoresHtml += `
            <div style="background:var(--surface); padding:0; border:1px solid var(--border); border-radius:16px; margin-bottom:24px; box-shadow:var(--shadow-card); overflow:hidden;">
                <!-- ШАПКА МАГАЗИНА -->
                <div style="background:linear-gradient(135deg, rgba(46,204,113,0.1), rgba(39,174,96,0.05)); padding:16px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="font-size:2rem; background:white; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px; box-shadow:0 2px 6px rgba(0,0,0,0.1);">🏪</div>
                        <div>
                            <h3 style="margin:0; font-size:1.4rem; color:var(--text);">${biz.name}</h3>
                            <div style="font-size:0.85rem; color:var(--green); font-weight:700;">Уровень ${level} • Аренда $${formatMoney(adminCost)}/дн</div>
                        </div>
                    </div>
                    <div style="text-align:right; background:white; padding:10px 16px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); border:1px solid var(--border);">
                        <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:800; letter-spacing:0.5px;">ВЫРУЧКА ЗА ВЧЕРА</div>
                        <div style="font-size:1.4rem; font-weight:800; color:var(--green);">+$${formatMoney(totalRev)} <span style="font-size:0.9rem; color:var(--text-dim); font-weight:400;">(${totalSold} шт)</span></div>
                    </div>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:0;">
                    <!-- КОЛОНКА 1: ПОЛКИ И ЗАПАСЫ -->
                    <div style="flex:1.5; min-width:350px; padding:24px; border-right:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h4 style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px;">📦 Заполнение склада</h4>
                            <span style="font-weight:700; color:${chartBg};">${volPercent}%</span>
                        </div>
                        <div style="height:8px; background:var(--surface-3); border-radius:4px; margin-bottom:8px; overflow:hidden;">
                            <div style="height:100%; width:${volPercent}%; background:${chartBg}; transition:0.3s;"></div>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:16px;">
                            Занято ${currentVol.toFixed(1)} м³ из ${maxVol.toFixed(1)} м³. Доставляйте товары с производственных складов.
                        </div>
                        
                        <div style="max-height: 400px; overflow-y: auto; padding-right:8px;">
                            ${invHtml}
                        </div>
                    </div>

                    <!-- КОЛОНКА 2: МЕБЕЛЬ И ПЕРСОНАЛ -->
                    <div style="flex:1; min-width:300px; padding:24px; background:var(--surface-2);">
                        <h4 style="margin:0 0 16px 0; font-size:1.1rem;">Оборудование & Персонал</h4>
                        
                        <!-- Мебель -->
                        <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px;">
                            <div style="font-size:0.85rem; color:var(--text-dim); font-weight:700; text-transform:uppercase; margin-bottom:8px;">Торговое оборудование</div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <div><strong style="color:var(--text);">${eqName}</strong></div>
                                <div style="font-weight:700; color:var(--blue);">${eqCount} / ${maxSlots}</div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <input type="number" id="install-qty-${biz.uid}" value="1" min="1" max="${maxSlots - eqCount}" style="width:60px; padding:8px; border:1px solid var(--border); border-radius:8px; font-weight:700; text-align:center;">
                                <button onclick="PRODUCTION.installEquipment(${biz.uid}, parseInt(document.getElementById('install-qty-${biz.uid}').value))" style="flex:1; background:var(--surface-2); color:var(--text); border:1px solid var(--border); border-radius:8px; font-weight:700; cursor:pointer;">Докупить</button>
                            </div>
                        </div>

                        <!-- Персонал -->
                        <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <div style="font-size:0.85rem; color:var(--text-dim); font-weight:700; text-transform:uppercase;">Персонал</div>
                                <div style="font-weight:700; color:var(--text);">${assignedTotal} / ${maxStaff}</div>
                            </div>

                            <!-- Директор -->
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed var(--border);">
                                <div>
                                    <div style="font-weight:700; font-size:0.95rem;">Директор</div>
                                    <div style="font-size:0.75rem; color:var(--text-dim);">Резерв: <span style="color:var(--blue); font-weight:700;">${freeMgr}</span></div>
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
                                    <div style="font-size:0.75rem; color:var(--text-dim);">Резерв: <span style="color:var(--blue); font-weight:700;">${freeSales}</span></div>
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
                </div>
            </div>`;
        });
        
        let headerHtml = `
        <div style="background: linear-gradient(135deg, rgba(46,204,113,0.1), rgba(39,174,96,0.05)); border: 1px solid rgba(46,204,113,0.2); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 6px 0; color: var(--green);">🏪 Управление Розницей</h2>
            <p style="margin: 0; color: var(--text-dim); font-size: 0.95rem;">Ваши действующие магазины. Устанавливайте цены, контролируйте полки и получайте выручку.</p>
        </div>
        `;

        if (!hasRetail) {
            activeStoresHtml = '<div style="text-align:center; padding: 60px 20px; color:var(--text-dim); font-size:1.2rem; background:var(--surface); border-radius:16px; border:1px dashed var(--border); margin-bottom:24px;">У вас пока нет розничных магазинов. Откройте свой первый бизнес!</div>';
        }

        let newShopHtml = `
        <div style="background:var(--surface); border-radius:16px; border:1px solid var(--border); padding:30px; text-align:center; box-shadow:var(--shadow-card);">
            <div style="font-size:3rem; margin-bottom:12px;">🛒</div>
            <h3 style="margin:0 0 8px 0; font-size:1.5rem; color:var(--text);">Открыть новую точку</h3>
            <p style="color:var(--text-dim); max-width:400px; margin:0 auto 20px auto;">Расширяйте свою империю! Постройте новый фирменный магазин, чтобы продавать больше продукции B2C.</p>
            <button onclick="PRODUCTION.buyBusiness('retail_store')" style="background:linear-gradient(135deg, #2ecc71, #27ae60); color:white; font-size:1.1rem; font-weight:800; padding:14px 32px; border:none; border-radius:12px; cursor:pointer; box-shadow:0 6px 20px rgba(46,204,113,0.4); transition:0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">+ Построить Фирменный Магазин</button>
        </div>`;

        retailBody.innerHTML = headerHtml + activeStoresHtml + newShopHtml;
        
        // Добавим стили для кнопок HR если их нет
        if (!document.getElementById('retail-hr-styles')) {
            let style = document.createElement('style');
            style.id = 'retail-hr-styles';
            style.innerHTML = `
                .btn-hr-minus { width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; background:var(--red-dim); color:var(--red); border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; }
                .btn-hr-minus:disabled { opacity:0.5; cursor:not-allowed; }
                .btn-hr-plus { width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; background:var(--green-dim); color:var(--green); border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; }
                .btn-hr-plus:disabled { opacity:0.5; cursor:not-allowed; }
            `;
            document.head.appendChild(style);
        }
    }
