const fs = require('fs');

const replacement = `        <!-- ВКЛАДКА: HR-ОТДЕЛ -->
        <div id="tab-hr" class="tab-content">
            <!-- ШАПКА вкладки -->
            <div style="background: linear-gradient(135deg, rgba(52, 199, 89, 0.1), rgba(0, 122, 255, 0.1)); border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 20px; padding: 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="font-size: 2.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">👥</div>
                    <div>
                        <h2 style="margin: 0 0 4px 0; color: var(--text); font-size: 1.6rem;">Управление Персоналом (HR)</h2>
                        <p style="margin: 0; color: var(--text-dim); font-size: 0.95rem;">Штатное расписание, найм сотрудников и корпоративная академия.</p>
                    </div>
                </div>
                <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Общий штат</div>
                        <div style="font-size: 1.4rem; font-weight: 800; color: var(--text);"><span id="ui-staff-total">0</span> чел.</div>
                    </div>
                    <div style="width: 1px; height: 40px; background: var(--border);"></div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Фонд оплаты труда</div>
                        <div style="font-size: 1.4rem; font-weight: 800; color: var(--red);" id="ui-staff-salary">$0.00 / дн.</div>
                    </div>
                </div>
            </div>

            <!-- Верхний блок: Диаграмма + Резерв -->
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px; margin-bottom: 24px;">
                <!-- Диаграмма штата -->
                <div class="card" style="margin-bottom: 0; background: var(--surface);">
                    <h3 style="margin: 0 0 16px 0; font-size: 1.15rem;">Структура штата</h3>
                    <div style="position: relative; height: 180px; width: 100%; display: flex; justify-content: center; align-items: center;">
                        <canvas id="chart-hr-staff"></canvas>
                    </div>
                    <div id="ui-hr-breakdown" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; justify-content: center;"></div>
                </div>

                <!-- Резерв и Академия (кратко) -->
                <div class="card" style="margin-bottom: 0; background: var(--surface); display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <h3 style="margin: 0; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;"><span style="font-size:1.3rem;">🎓</span> Корпоративная Академия</h3>
                        <span style="background: var(--blue-dim); color: var(--blue); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;" id="ui-training-count">Обучается: 0</span>
                    </div>
                    <div id="ui-hr-training-list" style="flex: 1; display: flex; flex-direction: column; gap: 12px; max-height: 250px; overflow-y: auto; padding-right: 8px;"></div>
                </div>
            </div>

            <!-- Департаменты (Найм) -->
            <h3 style="margin: 0 0 16px 0; font-size: 1.25rem;">Отделы и Департаменты</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 32px;">
                <!-- Производство -->
                <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(52, 152, 219, 0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">🏭</div>
                        <h4 style="margin: 0; font-size: 1.1rem;">Производство</h4>
                    </div>
                    <div id="ui-hire-factory" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>

                <!-- R&D -->
                <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(155, 89, 182, 0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">🔬</div>
                        <h4 style="margin: 0; font-size: 1.1rem;">R&D и Наука</h4>
                    </div>
                    <div id="ui-hire-rnd" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>

                <!-- Ритейл -->
                <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(46, 204, 113, 0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">🏪</div>
                        <h4 style="margin: 0; font-size: 1.1rem;">Розничная сеть</h4>
                    </div>
                    <div id="ui-hire-retail" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>

                <!-- Маркетинг -->
                <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(230, 126, 34, 0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">📢</div>
                        <h4 style="margin: 0; font-size: 1.1rem;">Маркетинг и PR</h4>
                    </div>
                    <div id="ui-hire-marketing" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>
            </div>

            <!-- Резерв -->
            <h3 style="margin: 0 0 16px 0; font-size: 1.25rem;">Кадровый резерв (Свободные сотрудники)</h3>
            <div id="ui-hr-reserve-table" style="background: var(--surface); padding: 20px; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-card);"></div>
        </div>`;

let txt = fs.readFileSync('index.html', 'utf8');
let startMarker = '        <!-- ВКЛАДКА: HR-ОТДЕЛ -->';
let endMarker = '        <!-- ВКЛАДКА: БАНК -->';

let startIdx = txt.indexOf(startMarker);
let endIdx = txt.indexOf(endMarker, startIdx);

if (startIdx > -1 && endIdx > -1) {
    let before = txt.slice(0, startIdx);
    let after = txt.slice(endIdx);
    fs.writeFileSync('index.html', before + replacement + '\n\n' + after);
    console.log("Success HR HTML");
} else {
    console.log("Failed HR HTML", startIdx, endIdx);
}
