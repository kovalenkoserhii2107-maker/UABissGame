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
                                <span style="background:rgba(255,149,0,0.1); color:var(--orange); padding:4px 8px; border-radius:6px; font-weight:600;">Качество: ${stars} (${offer.quality.toFixed(1)})</span>
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
                        <span style="background:var(--surface-3); padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:700;">Тир ${comp.tier}</span>
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
