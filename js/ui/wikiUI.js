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

    ARTICLES: {
        retail: {
            title: 'Розничная торговля и управление спросом (B2C)',
            subtitle: 'Как привлекать покупателей, настраивать наценку и выжимать максимум из каждого квадратного метра',
            content: `
                <div style="background: rgba(0,122,255,0.06); border-left: 4px solid var(--blue, #007AFF); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: var(--blue, #007AFF);">📌 Ключевой принцип розницы:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Розничный магазин — главный генератор стабильного денежного потока (Cash Flow) на старте. Вы закупаете товары по оптовым ценам на бирже или производите на своих фабриках, выставляете на полки и продаете населению с розничной наценкой.</p>
                </div>

                <h3 style="color: var(--text);">1. Формула покупательского спроса</h3>
                <p>Ежедневный объем продаж товара в магазине рассчитывается по формуле:</p>
                
                <div style="background: var(--surface-2); padding: 16px; border-radius: 10px; border: 1px solid var(--border); font-family: var(--font-mono); font-size: 0.9em; margin: 12px 0;">
                    <strong>Продажи (шт/день)</strong> = Базовый поток × Коэффициент города × Эластичность цены × Эффективность витрин × Сила бренда
                </div>

                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: var(--surface-3);">
                        <th style="padding: 10px;">Параметр</th>
                        <th style="padding: 10px;">Влияние на продажи</th>
                        <th style="padding: 10px;">Как улучшить</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Наценка на товар</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">При наценке до +30-40% спрос 100%. При наценке >100% спрос падает, если бренд слабый.</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Держать наценку 35-60% на старте</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Торговые витрины (Мебель)</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Без витрин конверсия 50%. Каждая витрина дает +20% к эффективности (до 150%).</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Докупать витрины в карточке магазина</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Сила бренда компании</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Каждый 1% бренда повышает устойчивость к высоким ценам на +1%. При бренде 50%+ покупатели берут товар даже с наценкой +150%!</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Открывать PR-агентства в Маркетинге</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Персонал магазина</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Директор:</strong> управляет точкой (обязателен 1 чел).<br><strong>Продавцы:</strong> обслуживают объем входящего трафика.</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Нанимать в HR и назначать в рознице</td>
                    </tr>
                </table>

                <h3 style="color: var(--text); margin-top: 24px;">2. Настройка розничных цен и автопополнения</h3>
                <p>В карточке каждого магазина вы можете задать индивидуальную розничную цену на каждый товар и нажать <code>OK</code>. Чтобы не возить товар вручную каждый день, включите во вкладке <strong>«Склады»</strong> правило автопополнения полок со склада города.</p>
            `
        },

        market: {
            title: 'Оптовая товарная биржа (B2B)',
            subtitle: 'Закупка сырья, ценообразование, волатильность и оптовые поставки',
            content: `
                <div style="background: rgba(52,199,89,0.06); border-left: 4px solid var(--green, #34C759); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: var(--green, #34C759);">💡 Что такое B2B-биржа:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Оптовый рынок, где можно купить любое сырье и готовые товары крупными партиями, а также продать излишки продукции со своих заводов.</p>
                </div>

                <h3 style="color: var(--text);">1. Колебания котировок</h3>
                <p>Биржевые цены не статичны — каждый день они меняются в пределах ±5-15% в зависимости от сезонности, макроэкономических новостей и объемов спроса. Покупайте сырье на просадках цен, чтобы снизить себестоимость готовой продукции!</p>

                <h3 style="color: var(--text); margin-top: 20px;">2. Логистика доставки с биржи</h3>
                <p>При покупке партии на бирже вы выбираете <strong>Город назначения</strong>. Товар передается в доставку и поступает на ваш региональный склад через 1-2 дня в зависимости от расстояния.</p>
            `
        },

        production: {
            title: 'Производство и цепочки создания стоимости',
            subtitle: 'Полная карта переработки сырья от фермерских товаров до High-Tech дронов',
            content: `
                <div style="background: rgba(255,149,0,0.06); border-left: 4px solid var(--orange, #FF9500); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: var(--orange, #FF9500);">🏭 Зачем строить свои заводы:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Собственное производство позволяет забирать 100% добавленной стоимости себе вместо переплаты посредникам на бирже.</p>
                </div>

                <h3 style="color: var(--text);">Производственные цепочки UABiz</h3>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin: 16px 0;">
                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
                        <strong style="color: var(--text); font-size: 1.05em;">🥖 Хлебозавод (Пекарня)</strong>
                        <p style="font-size: 0.85em; color: var(--text-dim); margin: 6px 0;">Вход: 2 ед. Зерно (Grain)<br>Выход: 1 ед. <strong>Хлеб и выпечка (Bakery)</strong></p>
                        <small style="color: var(--blue);">Потребительский сектор FMCG</small>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
                        <strong style="color: var(--text); font-size: 1.05em;">🥫 Мясокомбинат / Консервы</strong>
                        <p style="font-size: 0.85em; color: var(--text-dim); margin: 6px 0;">Вход: 1 ед. Мясо + 1 ед. Овощи<br>Выход: 1 ед. <strong>Консервы (Canned Food)</strong></p>
                        <small style="color: var(--blue);">Длительное хранение, высокий спрос</small>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
                        <strong style="color: var(--text); font-size: 1.05em;">👕 Швейная фабрика</strong>
                        <p style="font-size: 0.85em; color: var(--text-dim); margin: 6px 0;">Вход: 2 ед. Хлопок + 1 ед. Химикаты<br>Выход: 1 ед. <strong>Одежда (Clothing)</strong></p>
                        <small style="color: var(--green);">Высокая розничная маржа (+80%)</small>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
                        <strong style="color: var(--text); font-size: 1.05em;">🧼 Химкомбинат</strong>
                        <p style="font-size: 0.85em; color: var(--text-dim); margin: 6px 0;">Вход: 2 ед. Химикаты + 1 ед. Пластик<br>Выход: 1 ед. <strong>Бытовая химия (Detergent)</strong></p>
                        <small style="color: var(--green);">Стабильные B2G контракты</small>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
                        <strong style="color: var(--text); font-size: 1.05em;">🪑 Мебельная фабрика</strong>
                        <p style="font-size: 0.85em; color: var(--text-dim); margin: 6px 0;">Вход: 2 ед. Древесина + 1 ед. Пластик<br>Выход: 1 ед. <strong>Мебель и витрины</strong></p>
                        <small style="color: var(--orange);">Снабжает ваши розничные магазины</small>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
                        <strong style="color: var(--text); font-size: 1.05em;">🚁 Завод БПЛА / Дронов</strong>
                        <p style="font-size: 0.85em; color: var(--text-dim); margin: 6px 0;">Вход: 2 ед. Пластик + 1 ед. Камера + 1 ед. Софт<br>Выход: 1 ед. <strong>FPV-дрон (Drones)</strong></p>
                        <small style="color: #9b59b6; font-weight: bold;">Оборонзаказ и госзакупки ($$$)</small>
                    </div>
                </div>

                <h3 style="color: var(--text); margin-top: 20px;">Оборудование и износ</h3>
                <p>Каждому заводу требуются станки. Без станков завод простаивает. Станки постепенно изнашиваются в процессе работы — следите за показателем состояния (%) и проводите техобслуживание, чтобы не допустить падения качества продукции.</p>
            `
        },

        warehouse: {
            title: 'Складская логистика и Гео-экономика',
            subtitle: 'Распределительные хабы, коэффициенты городов и межгородская доставка',
            content: `
                <div style="background: rgba(0,122,255,0.06); border-left: 4px solid var(--blue, #007AFF); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: var(--blue, #007AFF);">📦 Зачем нужны склады:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Склады служат логистическими буферами в каждом городе Украины. На них хранится сырье для заводов и готовая продукция для полок магазинов.</p>
                </div>

                <h3 style="color: var(--text);">Экономика городов Украины</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: var(--surface-3);">
                        <th style="padding: 10px;">Город</th>
                        <th style="padding: 10px;">Население</th>
                        <th style="padding: 10px;">Аренда</th>
                        <th style="padding: 10px;">Зарплаты</th>
                        <th style="padding: 10px;">Спрос</th>
                        <th style="padding: 10px;">Стратегическая роль</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Киев</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">3.0 млн</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#e74c3c;">x1.5</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#e74c3c;">x1.35</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#27ae60; font-weight:bold;">x1.5</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Гигантский рынок сбыта</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Харьков</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">1.4 млн</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#27ae60; font-weight:bold;">x1.0</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#27ae60; font-weight:bold;">x1.0</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.1</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#27ae60;">Идеален для старта (Низкие косты)</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Одесса</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">1.0 млн</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.2</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.1</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#27ae60;">x1.25</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Портовый хаб, высокий трафик</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Днепр</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">1.0 млн</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.1</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.05</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.1</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Промышленный центр</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Львов</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">0.7 млн</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.3</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.15</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">x1.05</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">Западный транзитный узел</td>
                    </tr>
                </table>
            `
        },

        rnd: {
            title: 'Наука, Исследования и Патенты (R&D)',
            subtitle: 'Разработка технологий, повышение качества продукции и доступ к оборонзаказу',
            content: `
                <div style="background: rgba(142,68,173,0.06); border-left: 4px solid #8e44ad; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: #8e44ad;">🧪 Роль R&D корпуса:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Без науки невозможно строить заводы высоких технологий (Электроника, FPV-дроны, Оптика, Софт). Лаборатории генерируют очки науки (RP), открывающие новые патенты.</p>
                </div>

                <h3 style="color: var(--text);">Генерация очков науки</h3>
                <p>Скорость исследований зависит от количества ученых и качества рабочих станций (ПК):</p>
                <ul>
                    <li><strong>Лаборант (Junior Scientist):</strong> +10 очков науки в день (ЗП $150/дн).</li>
                    <li><strong>Старший научный сотрудник (Senior Scientist):</strong> +35 очков науки в день (ЗП $400/дн).</li>
                </ul>
            `
        },

        hr: {
            title: 'Управление персоналом и Академия кадров (HR)',
            subtitle: 'Специализации, фонд оплаты труда (ФОТ), грейды и производительность',
            content: `
                <div style="background: rgba(46,204,113,0.06); border-left: 4px solid var(--green, #34C759); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: var(--green, #34C759);">👥 Кадровая политика:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Сотрудники нанимаются в кадровый резерв компании, после чего распределяются по заводам, магазинам и лабораториям.</p>
                </div>

                <h3 style="color: var(--text);">Грейды инженеров на производстве</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: var(--surface-3);">
                        <th style="padding: 10px;">Грейд</th>
                        <th style="padding: 10px;">Выработка</th>
                        <th style="padding: 10px;">Стоимость найма</th>
                        <th style="padding: 10px;">Дневная ставка</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Junior (Сборщик)</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">1.0x (Базовая норма)</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">$150</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">$30/дн</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Middle (Мастер)</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">2.5x нормы</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">$500</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">$60/дн</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);"><strong>Senior (Инженер)</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border); color:#27ae60; font-weight:bold;">5.0x нормы</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">$1,500</td>
                        <td style="padding: 10px; border-bottom: 1px solid var(--border);">$120/дн</td>
                    </tr>
                </table>
                <p><strong>Лайфхак:</strong> 1 Senior заменяет 5 Junior-ов и экономит $30/день на зарплатном фонде!</p>
            `
        },

        finance: {
            title: 'Банковская система, Налогообложение и Скоринг',
            subtitle: 'Кредиты, депозиты, налоги на прибыль (18%) и единый соцвзнос (22%)',
            content: `
                <div style="background: rgba(231,76,60,0.06); border-left: 4px solid #e74c3c; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: #e74c3c;">⚠️ Управление ликвидностью:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Отрицательный баланс приводит к кассовому разрыву и штрафным процентам. Следите за ежедневным оттоком средств!</p>
                </div>

                <h3 style="color: var(--text);">1. Налоговая система Украины</h3>
                <ul>
                    <li><strong>Корпоративный налог на прибыль (18%):</strong> Уплачивается с чистой прибыли (Доходы минус Расходы). Если день закрыт в убыток — налог 0.</li>
                    <li><strong>Единый социальный взнос на ФОТ (22%):</strong> Начисляется поверх всех выплаченных зарплат.</li>
                </ul>

                <h3 style="color: var(--text); margin-top: 20px;">2. Кредитный скоринг (Credit Score)</h3>
                <p>Стартовый скоринг — <strong>200 пунктов</strong>. Скоринг растет при своевременном погашении кредитов, сдаче B2G-тендеров и выполнении квестов. Чем выше скоринг — тем больше доступный кредитный лимит и ниже ставка банка!</p>
            `
        },

        contracts: {
            title: 'Государственные закупки и Тендеры (B2G)',
            subtitle: 'Крупнооптовые контракты, контроль качества и ответственность за срыв сроков',
            content: `
                <div style="background: rgba(52,152,219,0.06); border-left: 4px solid #3498db; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: #3498db;">📜 Что такое B2G Тендеры:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Государственные и муниципальные заказы на поставку крупных партий продовольствия, текстиля, электроники и дронов.</p>
                </div>

                <h3 style="color: var(--text);">Правила выполнения</h3>
                <ul>
                    <li>Тендер требует поставить точный объем продукции строго в указанный срок (дней).</li>
                    <li>Требуется соблюсти минимальный <strong>Quality Score (★)</strong>. Качество зависит от состояния станков на ваших заводах.</li>
                    <li>При успешной сдаче контракта вы получаете крупную выплату и солидный прирост к Кредитному скорингу. При срыве сроков начисляется штраф.</li>
                </ul>
            `
        },

        empire: {
            title: '5 Глав Империи — Дорожная карта магната',
            subtitle: 'Стратегический путь развития от $25,000 до национального промышленного холдинга',
            content: `
                <div style="background: rgba(241,196,15,0.1); border-left: 4px solid #f1c40f; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 6px 0; color: #d35400;">👑 Главная цель игры:</h4>
                    <p style="margin: 0; font-size: 0.92em; color: var(--text);">Построить замкнутую вертикально интегрированную корпорацию полного цикла с капитализацией более $2,500,000 во всех регионах Украины.</p>
                </div>

                <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 16px;">
                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border-left: 4px solid #3498db;">
                        <strong>Глава 1: Розничный магазин (Выживание)</strong>
                        <p style="margin: 4px 0 0 0; font-size: 0.88em; color: var(--text-dim);">Открыть первый магазин, нанять директора и продавца, заработать начальный оборотный капитал.</p>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border-left: 4px solid #2ecc71;">
                        <strong>Глава 2: Торговая сеть и Бренд (Экспансия)</strong>
                        <p style="margin: 4px 0 0 0; font-size: 0.88em; color: var(--text-dim);">Открыть магазины в 2+ городах, открыть PR-агентство, прокачать узнаваемость бренда до 20%+.</p>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border-left: 4px solid #f39c12;">
                        <strong>Глава 3: Вертикальная интеграция (Свои цеха)</strong>
                        <p style="margin: 4px 0 0 0; font-size: 0.88em; color: var(--text-dim);">Построить свои фабрики (Пекарня/Швейка), снабжать магазины напрямую и победить в B2G тендере.</p>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border-left: 4px solid #9b59b6;">
                        <strong>Глава 4: High-Tech и Наука (Инновации)</strong>
                        <p style="margin: 4px 0 0 0; font-size: 0.88em; color: var(--text-dim);">Построить НИИ, нанять ученых, разработать технологии электроники и военных FPV-дронов.</p>
                    </div>

                    <div style="background: var(--surface-2); padding: 14px; border-radius: 10px; border-left: 4px solid #e74c3c;">
                        <strong>Глава 5: Национальная империя (Господство)</strong>
                        <p style="margin: 4px 0 0 0; font-size: 0.88em; color: var(--text-dim);">Присутствие во всех 5 городах Украины, замкнутый цикл полного цикла и капитализация $2,500,000+.</p>
                    </div>
                </div>
            `
        }
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

        const article = this.ARTICLES[this.currentCategory] || this.ARTICLES['retail'];
        
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
                        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--blue, #007AFF); font-weight: 800;">UABiz Knowledge Base</span>
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
