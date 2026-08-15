const fs = require('fs');

const replacement = `        <!-- ВКЛАДКА: БАНК -->
        <div id="tab-bank" class="tab-content">
            
            <!-- Сводный дашборд банка -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 20px;">
                <div class="card" style="margin-bottom: 0; background: linear-gradient(135deg, rgba(52, 199, 89, 0.05), rgba(52, 199, 89, 0.1)); border-color: rgba(52, 199, 89, 0.2);">
                    <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                        <h4 style="margin:0 0 10px 0; color: var(--text-dim);">Доступный лимит (Кредит)</h4>
                        <div style="font-size:1.8rem; filter:grayscale(0.2); opacity:0.8;">🏦</div>
                    </div>
                    <h2 style="margin:0; color: var(--green);">$<span id="ui-credit-limit">0.00</span></h2>
                    <div style="font-size: 0.85rem; margin-top:10px; color:var(--text-dim); font-weight:500;">Базовая ставка: <span id="ui-rate" style="color:var(--text); font-weight:800;">15</span>% годовых</div>
                </div>
                
                <div class="card" style="margin-bottom: 0; background: linear-gradient(135deg, rgba(255, 59, 48, 0.05), rgba(255, 59, 48, 0.1)); border-color: rgba(255, 59, 48, 0.2);">
                    <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                        <h4 style="margin:0 0 10px 0; color: var(--text-dim);">Общий долг (Кредиты)</h4>
                        <div style="font-size:1.8rem; filter:grayscale(0.2); opacity:0.8;">📉</div>
                    </div>
                    <h2 style="margin:0; color: var(--red);">$<span id="ui-debt">0.00</span></h2>
                    <div style="font-size: 0.85rem; margin-top:10px; color:var(--text-dim); font-weight:500;">Все ваши активные кредиты</div>
                </div>

                <div class="card" style="margin-bottom: 0; background: linear-gradient(135deg, rgba(0, 122, 255, 0.05), rgba(0, 122, 255, 0.1)); border-color: rgba(0, 122, 255, 0.2);">
                    <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                        <h4 style="margin:0 0 10px 0; color: var(--text-dim);">Общие вклады (Депозиты)</h4>
                        <div style="font-size:1.8rem; filter:grayscale(0.2); opacity:0.8;">📈</div>
                    </div>
                    <h2 style="margin:0; color: var(--blue);">$<span id="ui-total-deposits">0.00</span></h2>
                    <div style="font-size: 0.85rem; margin-top:10px; color:var(--text-dim); font-weight:500;">Все ваши активные инвестиции</div>
                </div>
            </div>

            <!-- Основной контент -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 20px;">
                <!-- ЛЕВАЯ КОЛОНКА: ДЕЙСТВИЯ -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Взять кредит -->
                    <div class="card" style="margin-bottom: 0;">
                        <div style="display:flex; align-items:center; gap: 14px; margin-bottom: 18px;">
                            <div style="width:48px; height:48px; border-radius:12px; background:var(--orange-dim); display:flex; align-items:center; justify-content:center; font-size:1.6rem; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);">💸</div>
                            <h3 style="margin:0;">Кредитование бизнеса</h3>
                        </div>
                        <div style="margin-bottom: 16px; background:var(--surface-2); padding:16px; border-radius:12px; border:1px solid var(--border);">
                            <label style="display:block; margin-bottom: 8px; font-size: 0.85em; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.03em;">Сумма кредита ($):</label>
                            <input type="number" id="input-loan-amount" placeholder="Например: 5000" style="width: 100%; margin-bottom: 16px; font-size:1.05rem; padding:12px; border-radius:10px;">

                            <label style="display:block; margin-bottom: 8px; font-size: 0.85em; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.03em;">Срок кредитования:</label>
                            <select id="select-loan-term" style="width: 100%; font-size:1.05rem; padding:12px; background:var(--surface); border-radius:10px;">
                                <option value="7">Краткосрочный (7 дней)</option>
                                <option value="30" selected>Месяц (30 дней)</option>
                                <option value="90">Квартал (90 дней)</option>
                                <option value="180">Полгода (180 дней)</option>
                                <option value="270">3 квартала (270 дней)</option>
                                <option value="360">Год (360 дней)</option>
                            </select>
                        </div>
                        <button onclick="UI_DASHBOARD.submitLoan()" style="width: 100%; padding:14px; font-size:1.05rem; background:var(--blue); font-weight:700; border-radius:12px;">Подать заявку на кредит</button>
                    </div>

                    <!-- Открыть депозит -->
                    <div class="card" style="margin-bottom: 0;">
                        <div style="display:flex; align-items:center; gap: 14px; margin-bottom: 18px;">
                            <div style="width:48px; height:48px; border-radius:12px; background:var(--blue-dim); display:flex; align-items:center; justify-content:center; font-size:1.6rem; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);">💎</div>
                            <div>
                                <h3 style="margin:0;">Размещение депозитов</h3>
                                <div style="font-size:0.8rem; color:var(--text-dim); margin-top:4px; font-weight:500;">Доходность растет от срока + капитализация 1%</div>
                            </div>
                        </div>
                        <div style="margin-bottom: 16px; background:var(--surface-2); padding:16px; border-radius:12px; border:1px solid var(--border);">
                            <label style="display:block; margin-bottom: 8px; font-size: 0.85em; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.03em;">Сумма вклада ($):</label>
                            <input type="number" id="input-dep-amount" placeholder="Например: 10000" style="width: 100%; margin-bottom: 16px; font-size:1.05rem; padding:12px; border-radius:10px;">

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                                <div>
                                    <label style="display:block; margin-bottom: 8px; font-size: 0.85em; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.03em;">Срок:</label>
                                    <select id="select-dep-term" style="width: 100%; font-size:1rem; padding:12px; background:var(--surface); border-radius:10px;">
                                        <option value="7">7 дн (4%)</option>
                                        <option value="30">30 дн (6%)</option>
                                        <option value="90">90 дн (9%)</option>
                                        <option value="180">180 дн (12%)</option>
                                        <option value="270">270 дн (14%)</option>
                                        <option value="360">360 дн (16%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display:block; margin-bottom: 8px; font-size: 0.85em; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.03em;">Выплата %:</label>
                                    <select id="select-dep-type" style="width: 100%; font-size:1rem; padding:12px; background:var(--surface); border-radius:10px;">
                                        <option value="daily">Ежедневно</option>
                                        <option value="end">В конце (+1%)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <button onclick="UI_DASHBOARD.submitDeposit()" style="width: 100%; background: var(--text); padding:14px; font-size:1.05rem; font-weight:700; border-radius:12px;">Открыть депозит</button>
                    </div>
                </div>

                <!-- ПРАВАЯ КОЛОНКА: ПОРТФЕЛИ -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="card" style="margin-bottom: 0; flex:1; background:var(--surface);">
                        <h3 style="margin-bottom:20px; font-size:1.15rem;">Портфель обязательств (Мои кредиты)</h3>
                        <div id="ui-active-loans" style="display:flex; flex-direction:column; gap:16px;">
                            <!-- JS Инжект -->
                        </div>
                    </div>

                    <div class="card" style="margin-bottom: 0; flex:1; background:var(--surface);">
                        <h3 style="margin-bottom:20px; font-size:1.15rem;">Портфель активов (Мои депозиты)</h3>
                        <div id="ui-active-deposits" style="display:flex; flex-direction:column; gap:16px;">
                            <!-- JS Инжект -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
`;

let txt = fs.readFileSync('index.html', 'utf8');
let startMarker = '<div id="tab-bank" class="tab-content">';
let endMarker = '<!-- ВКЛАДКА: ФИНАНСОВАЯ ОТЧЕТНОСТЬ';

let startIdx = txt.indexOf(startMarker);
let endIdx = txt.indexOf(endMarker, startIdx);

if (startIdx > -1 && endIdx > -1) {
    let before = txt.slice(0, startIdx);
    let after = txt.slice(endIdx);
    let newHtml = before + replacement + '\n        ' + after;
    fs.writeFileSync('index.html', newHtml);
    console.log("Success");
} else {
    console.log("Failed", startIdx, endIdx);
}
