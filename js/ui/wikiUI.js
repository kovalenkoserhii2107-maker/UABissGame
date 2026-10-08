// =========================================================
// UABiz WIKI — Внутренняя интерактивная энциклопедия механик игры
// =========================================================
const WIKI = {
    currentCategory: 'retail',

    CATEGORIES: [
        { id: 'retail', title: '🏪 Розница и Покупатели', badge: 'B2C' },
        { id: 'market', title: '⚖️ Оптовая биржа и Сырье', badge: 'B2B' },
        { id: 'production', title: '🏭 Производство и Цепочки', badge: 'Supply Chains' },
        { id: 'warehouse', title: '📦 Склады и Логистика', badge: 'Logistics' },
        { id: 'rnd', title: '🧪 R&D и Инновации', badge: 'High-Tech' },
        { id: 'hr', title: '👥 HR и Кадры', badge: 'Staff' },
        { id: 'finance', title: '🏦 Банк, Налоги и Скоринг', badge: 'Finance' },
        { id: 'contracts', title: '📜 Госзакупки и Тендеры', badge: 'B2G' },
        { id: 'empire', title: '👑 5 Глав Империи', badge: 'Strategy' }
    ],

    getArticles() {
        const names = entries => Object.entries(entries ?? {}).map(([id, qty]) => `${qty} × ${RECIPES.RESOURCES[id].name}`).join(' + ') || '—';
        const chains = Object.values(RECIPES.BUSINESSES).filter(t => !t.isRetail && !t.isMarketing).map(t => `<tr><td>${t.name}</td><td>${names(t.inputs)}</td><td>${RECIPES.RESOURCES[t.output].name}</td></tr>`).join('');
        const staff = Object.values(HR.GRADES).map(g => `<tr><td>${g.name}</td><td>$${formatMoney(g.salary)}</td><td>${g.rp ?? g.prodMult ?? '—'}</td></tr>`).join('');
        const articles = {
            retail: `<p>Магазину нужны директор и продавец. Закупите товар на рынке, дождитесь доставки, затем отгрузите его со склада на полки. Автопополнение настраивается в карточке магазина.</p><p>Начальная цена — 2,5 базовой цены товара. Спрос зависит от города, штата, бренда, качества, цены и витрин. Размер покупки учитывает стоимость товара; общий бюджет покупателей ограничен. Продажи проходят при закрытии дня.</p><p>Без витрин эффективность равна 0,5. С витринами: 0,6 + min(количество, 5) × 0,1 × состояние / 100. Вместимость магазина: площадь × уровень × 2 м³.</p>`,
            market: `<p>Покупка резервирует место с учётом грузов в пути. Товар приходит на следующий день. Поставка идёт из Киева; доставка включается в себестоимость. Отменить можно только ещё не доставленный ордер.</p><p>Котировки и история отражают закрытые игровые дни. Оптовая продажа ограничена дневным спросом. Выручка и себестоимость учитываются при продаже, деньги поступают позже как дебиторская задолженность.</p><p>Предложения конкурентов обновляются раз в 7 дней; это локальная игровая симуляция.</p>`,
            production: `<p>Назначьте работников, установите оборудование, закупите сырьё и выберите склады. Для выпуска нужна технология. Прямые маршруты отправляют продукцию на полки магазина или в буфер следующего цеха. Производство рассчитывается в порядке цепочки; циклы маршрутов недопустимы.</p><p>Выпуск ограничен сырьём, трудом, состоянием оборудования, местом назначения и деньгами на доставку. Ремонт восстанавливает работоспособность, а не балансовую стоимость оборудования.</p><table><thead><tr><th>Цех</th><th>Вход на единицу</th><th>Выход</th></tr></thead><tbody>${chains}</tbody></table>`,
            warehouse: `<p>Первый бизнес включает склад первого уровня в своём городе. Отдельный склад покупается во вкладке «Склады». Неактивный склад не принимает поставки.</p><p>Грузы в пути резервируют вместимость. Если место временно занято, прибывший груз ожидает разгрузки и не пропадает. Ручная отгрузка и автопополнение учитывают вместимость магазина, качество, бренд и стоимость доставки. Цифровые товары занимают 0 м³.</p>`,
            rnd: `<p>Постройте НИИ, установите ПК и назначьте ученых из кадрового резерва. Очки начисляются только активному проекту; простой не расходует оборудование. Производительность зависит от числа сотрудников и ПК, состояния оборудования.</p><p>Стоимость корпуса: $10 000 × следующий уровень; каждый уровень даёт 5 мест. Зарплаты и базовые RP приведены в таблице кадров.</p>`,
            hr: `<p>Нанятые сотрудники оплачиваются и в резерве. На предприятии зарплата умножается на коэффициент города. Студенты получают прежнюю зарплату до выпуска; налог начисляется на фактически оплаченный фонд дня.</p><table><thead><tr><th>Грейд</th><th>Базовая зарплата в день</th><th>RP / сила производства</th></tr></thead><tbody>${staff}</tbody></table>`,
            finance: `<p>Налог на зарплату: ${TAXES.RATES.payroll * 100}%. Налог на положительную прибыль: ${TAXES.RATES.corporate * 100}%. НДС и пошлины в справочнике стран зарезервированы для будущих механик и сейчас не списываются.</p><p>Кредит погашается равными долями основного долга; проценты начисляются на остаток. Комиссия выдачи — 3%. Депозит учитывается как актив вместе с начисленным доходом.</p><p>P&amp;L показывает доходы и расходы, Cash Flow — реальные движения денег по трём видам деятельности. Капитализация — стоимость активов минус обязательства. Оборудование учитывается по фактической покупке с амортизацией.</p><p>Акции доступны на бирже; контрольный пакет 51% можно выкупить с премией 20% у основателей. Брокерская комиссия — ${STOCK_MARKET.BROKER_FEE * 100}%.</p><p>Ваша компания выходит на IPO только по кнопке «Выйти на IPO» при капитализации от $${formatMoney(STOCK_MARKET.IPO_THRESHOLD)}. До этого на бирже видны компании-конкуренты. Листинг не меняет кэш; котировки меняют стоимость только купленных акций.</p><p>Причины изменения кэша перечислены в разделе «Компания» и в отчёте Cash Flow: зарплаты (включая резерв), аренда, налоги, кредитные платежи, закупки и другие операции. Без объектов случайные события не происходят. Проверка пожарной безопасности может оштрафовать компанию только после открытия помещения.</p>`,
            contracts: `<p>Принятый тендер резервирует обязательство, но не товар. Поставьте требуемое количество подходящего качества со складов компании и нажмите «Выполнить». Последний день с остатком срока 0 доступен для исполнения; на следующий день начисляется штраф.</p>`,
            empire: `<p>В игре ${Object.keys(QUESTS.CHAPTERS).length} глав и ${QUESTS.LIST.length} задач. Задачи проверяются после действий и закрытия дня. Награда требует отдельного нажатия и доступна после перехода в следующую главу.</p><p>Игра автоматически сохраняется в браузере. Меню «Сохранение» позволяет экспортировать и импортировать файл. Кнопка «Рестарт» начинает новую компанию с резервной копией прежнего сохранения. Обучение запускается в разделе «Помощь».</p>`
        };
        return Object.fromEntries(this.CATEGORIES.map(c => [c.id, { title: c.title, subtitle: 'Правила текущей версии игры', content: articles[c.id] }]));
    },

    init() {
        this.render();
    },

    setCategory(catId) {
        this.currentCategory = catId;
        this.render();
    },

    render() {
        const container = document.getElementById('ui-wiki-container');
        if (!container) return;

        const navHtml = this.CATEGORIES.map(cat => {
            const isActive = cat.id === this.currentCategory;
            return `
                <div onclick="WIKI.setCategory('${cat.id}')" style="padding: 12px 14px; border-radius: 10px; margin-bottom: 6px; cursor: pointer; transition: 0.15s ease; background: ${isActive ? 'var(--surface, #fff)' : 'transparent'}; border: 1px solid ${isActive ? 'var(--border, rgba(0,0,0,0.1))' : 'transparent'}; box-shadow: ${isActive ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'}; display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: ${isActive ? 'var(--blue, #007AFF)' : 'var(--text, #1D1D1F)'}; font-size: 0.92em;">${cat.title}</strong>
                    <span style="font-size: 0.72em; background: ${isActive ? 'var(--blue-dim, rgba(0,122,255,0.1))' : 'var(--surface-3, #E8E8ED)'}; color: ${isActive ? 'var(--blue, #007AFF)' : 'var(--text-dim, #86868B)'}; padding: 2px 6px; border-radius: 6px; font-weight: 600;">${cat.badge}</span>
                </div>
            `;
        }).join('');

        const articles = this.getArticles();
        const article = articles[this.currentCategory] || articles.retail;

        let imageUrl = '';
        if (['finance', 'market', 'empire'].includes(this.currentCategory)) imageUrl = 'assets/wiki_finance_1786758956618.jpg';
        if (['production', 'warehouse'].includes(this.currentCategory)) imageUrl = 'assets/wiki_factory_1786758964128.jpg';
        if (['rnd'].includes(this.currentCategory)) imageUrl = 'assets/wiki_rnd_1786758971681.jpg';
        if (['hr', 'retail', 'contracts'].includes(this.currentCategory)) imageUrl = 'assets/wiki_hr_1786758980159.jpg';

        const imageHtml = imageUrl ? `<div style="width: 100%; height: 260px; background-image: url('${imageUrl}'); background-size: cover; background-position: center; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);"></div>` : '';

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start;">
                <!-- ЛЕВАЯ КОЛОНКА: ОГЛАВЛЕНИЕ -->
                <div class="card" style="padding: 16px; margin-bottom: 0; background: var(--surface-2, #F5F5F7); border: 1px solid var(--border, rgba(0,0,0,0.08)); border-radius: 20px;">
                    <h4 style="margin: 4px 0 16px 8px; color: var(--text-dim, #86868B); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800;">Оглавление</h4>
                    <div>${navHtml}</div>
                </div>

                <!-- ПРАВАЯ КОЛОНКА: СТАТЬЯ -->
                <div class="card" style="padding: 32px; margin-bottom: 0; background: var(--surface, #fff); border-radius: 20px; box-shadow: var(--shadow-card);">
                    ${imageHtml}
                    <div style="border-bottom: 1px solid var(--border, rgba(0,0,0,0.08)); padding-bottom: 16px; margin-bottom: 20px;">
                        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--blue, #007AFF); font-weight: 800;">База знаний UABiz</span>
                        <h2 style="margin: 8px 0 6px 0; color: var(--text, #1D1D1F); font-size: 1.8rem;">${article.title}</h2>
                        <p style="margin: 0; color: var(--text-dim, #86868B); font-size: 1rem; line-height: 1.5;">${article.subtitle}</p>
                    </div>
                    <div style="font-size: 1.05rem; line-height: 1.6; color: var(--text);">
                        ${article.content}
                    </div>
                </div>
            </div>
        `;
    }
};
