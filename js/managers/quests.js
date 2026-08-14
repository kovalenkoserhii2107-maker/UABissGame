// Модуль системы квестов, глав и карьерной прогрессии (Gamification Engine)
const QUESTS = {
    CHAPTERS: {
        1: {
            id: 1,
            title: 'Глава 1: Розничный магазин (Выживание)',
            desc: 'Начните с малого: откройте свой первый магазин, наладьте сбыт ходовых товаров и выйдите на стабильную прибыль.',
            icon: '🏪'
        },
        2: {
            id: 2,
            title: 'Глава 2: Торговая сеть и Бренд (Экспансия)',
            desc: 'Масштабируйте бизнес в другие города, запустите собственное PR-агентство и сформируйте узнаваемый бренд.',
            icon: '📢'
        },
        3: {
            id: 3,
            title: 'Глава 3: Вертикальная интеграция (Свои цеха)',
            desc: 'Откажитесь от посредников: постройте собственные фабрики, снабжайте розницу напрямую и побеждайте в гостендерах.',
            icon: '🏭'
        },
        4: {
            id: 4,
            title: 'Глава 4: High-Tech и Наука (Инновации)',
            desc: 'Инвестируйте в НИИ, нанимайте ученых, разрабатывайте передовую электронику и военные FPV-дроны.',
            icon: '🧪'
        },
        5: {
            id: 5,
            title: 'Глава 5: Национальная империя (Господство)',
            desc: 'Постройте замкнутые цепочки полного цикла во всех регионах Украины и управляйте рынком на национальном уровне.',
            icon: '👑'
        }
    },

    LIST: [
        // --- ГЛАВА 1 ---
        {
            id: 'q1_open_store',
            chapter: 1,
            title: 'Первая торговая точка',
            desc: 'Откройте свой первый фирменный магазин в любом городе.',
            reward: { money: 3000, score: 20, text: '+$3,000 (Грант на развитие торговли), +20 Скоринг' },
            check: (s) => s.company.businesses.some(b => RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isRetail),
            progress: (s) => {
                let cnt = s.company.businesses.filter(b => RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isRetail).length;
                return { current: Math.min(cnt, 1), target: 1, label: `${Math.min(cnt, 1)} / 1 магазин` };
            }
        },
        {
            id: 'q1_hire_staff',
            chapter: 1,
            title: 'Команда магазина',
            desc: 'Наймите 1 Директора магазина и минимум 1 Продавца-консультанта и назначьте их в магазин.',
            reward: { money: 2000, score: 30, text: '+$2,000 (Субсидия на создание рабочих мест), +30 Скоринг' },
            check: (s) => s.company.businesses.some(b => {
                let tpl = RECIPES.BUSINESSES[b.type];
                return tpl && tpl.isRetail && b.assigned && (b.assigned.store_manager || 0) >= 1 && (b.assigned.salesman || 0) >= 1;
            }),
            progress: (s) => {
                let ok = s.company.businesses.some(b => {
                    let tpl = RECIPES.BUSINESSES[b.type];
                    return tpl && tpl.isRetail && b.assigned && (b.assigned.store_manager || 0) >= 1 && (b.assigned.salesman || 0) >= 1;
                });
                return { current: ok ? 1 : 0, target: 1, label: ok ? 'Штат укомплектован' : 'Требуется Директор и Продавец' };
            }
        },
        {
            id: 'q1_buy_stock',
            chapter: 1,
            title: 'Заполнить витрины',
            desc: 'Завезите на склад магазина минимум 30 единиц любого товара для продажи.',
            reward: { money: 2500, score: 15, text: '+$2,500 (Оптовая скидка поставщиков)' },
            check: (s) => s.company.businesses.some(b => {
                if (!RECIPES.BUSINESSES[b.type] || !RECIPES.BUSINESSES[b.type].isRetail || !b.localInventory) return false;
                let totalQty = Object.values(b.localInventory).reduce((acc, it) => acc + (it.qty || 0), 0);
                return totalQty >= 30;
            }),
            progress: (s) => {
                let maxStoreQty = 0;
                s.company.businesses.forEach(b => {
                    if (RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isRetail && b.localInventory) {
                        let q = Object.values(b.localInventory).reduce((acc, it) => acc + (it.qty || 0), 0);
                        if (q > maxStoreQty) maxStoreQty = q;
                    }
                });
                return { current: Math.min(maxStoreQty, 30), target: 30, label: `${Math.min(maxStoreQty, 30)} / 30 шт. на полках` };
            }
        },
        {
            id: 'q1_first_sales',
            chapter: 1,
            title: 'Первые покупатели',
            desc: 'Достигните суммарной розничной выручки (B2C) от $5,000.',
            reward: { money: 4000, score: 35, text: '+$4,000 (Бонус за торговый оборот), +35 Скоринг' },
            check: (s) => (s.ledger && s.ledger.total && s.ledger.total.rev_b2c >= 5000),
            progress: (s) => {
                let cur = (s.ledger && s.ledger.total && s.ledger.total.rev_b2c) ? s.ledger.total.rev_b2c : 0;
                return { current: Math.min(cur, 5000), target: 5000, label: `$${formatMoney(cur)} / $5,000` };
            }
        },
        {
            id: 'q1_capital_goal',
            chapter: 1,
            title: 'Финансовая подушка',
            desc: 'Накопите на корпоративном счете не менее $35,000 свободного капитала.',
            reward: { money: 5000, score: 50, text: '+$5,000, +50 Скоринг, Переход во 2 Главу!' },
            check: (s) => (s.finances.balance >= 35000),
            progress: (s) => {
                let bal = Math.max(0, s.finances.balance);
                return { current: Math.min(bal, 35000), target: 35000, label: `$${formatMoney(bal)} / $35,000` };
            }
        },

        // --- ГЛАВА 2 ---
        {
            id: 'q2_multi_stores',
            chapter: 2,
            title: 'Региональная сеть',
            desc: 'Откройте магазины минимум в 2 разных городах Украины.',
            reward: { money: 8000, score: 40, text: '+$8,000 (Инвестиционный транш), +40 Скоринг' },
            check: (s) => {
                let cities = new Set();
                s.company.businesses.forEach(b => {
                    if (RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isRetail && b.city) {
                        cities.add(b.city);
                    }
                });
                return cities.size >= 2;
            },
            progress: (s) => {
                let cities = new Set();
                s.company.businesses.forEach(b => {
                    if (RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isRetail && b.city) {
                        cities.add(b.city);
                    }
                });
                return { current: Math.min(cities.size, 2), target: 2, label: `${Math.min(cities.size, 2)} / 2 города` };
            }
        },
        {
            id: 'q2_marketing_agency',
            chapter: 2,
            title: 'Маркетинговый штаб',
            desc: 'Откройте Маркетинговое Агентство и наймите маркетологов для продвижения бренда.',
            reward: { money: 10000, score: 30, text: '+$10,000, +30 Скоринг' },
            check: (s) => s.company.businesses.some(b => RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isMarketing),
            progress: (s) => {
                let ok = s.company.businesses.some(b => RECIPES.BUSINESSES[b.type] && RECIPES.BUSINESSES[b.type].isMarketing);
                return { current: ok ? 1 : 0, target: 1, label: ok ? 'Агентство открыто' : 'Откройте агентство' };
            }
        },
        {
            id: 'q2_brand_power',
            chapter: 2,
            title: 'Сила бренда 20%+',
            desc: 'С помощью рекламных кампаний и PR поднимите узнаваемость бренда до 20% и выше.',
            reward: { money: 12000, score: 40, text: '+$12,000 (Премия за бренд)' },
            check: (s) => (s.retail && s.retail.brand >= 20),
            progress: (s) => {
                let b = (s.retail && s.retail.brand) ? s.retail.brand : 10;
                return { current: Math.min(b, 20), target: 20, label: `${b.toFixed(1)}% / 20%` };
            }
        },
        {
            id: 'q2_turnover_milestone',
            chapter: 2,
            title: 'Большой оборот ($50k B2C)',
            desc: 'Достигните суммарной выручки розничной сети в размере $50,000.',
            reward: { money: 15000, score: 50, text: '+$15,000, +50 Скоринг, Переход в 3 Главу!' },
            check: (s) => (s.ledger && s.ledger.total && s.ledger.total.rev_b2c >= 50000),
            progress: (s) => {
                let cur = (s.ledger && s.ledger.total && s.ledger.total.rev_b2c) ? s.ledger.total.rev_b2c : 0;
                return { current: Math.min(cur, 50000), target: 50000, label: `$${formatMoney(cur)} / $50,000` };
            }
        },

        // --- ГЛАВА 3 ---
        {
            id: 'q3_first_factory',
            chapter: 3,
            title: 'Первое производство',
            desc: 'Постройте собственный цех или фабрику (Пекарню, Швейную фабрику, Цех 3D-печати и т.д.).',
            reward: { money: 15000, score: 40, text: '+$15,000 (Промышленная субсидия), +40 Скоринг' },
            check: (s) => s.company.businesses.some(b => {
                let t = RECIPES.BUSINESSES[b.type];
                return t && !t.isRetail && !t.isMarketing;
            }),
            progress: (s) => {
                let ok = s.company.businesses.some(b => {
                    let t = RECIPES.BUSINESSES[b.type];
                    return t && !t.isRetail && !t.isMarketing;
                });
                return { current: ok ? 1 : 0, target: 1, label: ok ? 'Цех построен' : 'Постройте фабрику' };
            }
        },
        {
            id: 'q3_produce_goods',
            chapter: 3,
            title: 'Сделано в Украине',
            desc: 'Произведите на собственных заводах суммарно не менее 100 единиц готовой продукции.',
            reward: { money: 20000, score: 30, text: '+$20,000' },
            check: (s) => {
                let totalProd = 0;
                s.company.businesses.forEach(b => {
                    if (b.stats && b.stats.total) totalProd += b.stats.total;
                });
                return totalProd >= 100;
            },
            progress: (s) => {
                let totalProd = 0;
                s.company.businesses.forEach(b => {
                    if (b.stats && b.stats.total) totalProd += b.stats.total;
                });
                return { current: Math.min(totalProd, 100), target: 100, label: `${Math.min(totalProd, 100)} / 100 шт.` };
            }
        },
        {
            id: 'q3_tender_fulfill',
            chapter: 3,
            title: 'Государственный подряд',
            desc: 'Выполните минимум 1 тендерный контракт (B2G поставка).',
            reward: { money: 25000, score: 60, text: '+$25,000, +60 Скоринг' },
            check: (s) => (s.ledger && s.ledger.total && s.ledger.total.rev_b2g > 0),
            progress: (s) => {
                let ok = (s.ledger && s.ledger.total && s.ledger.total.rev_b2g > 0);
                return { current: ok ? 1 : 0, target: 1, label: ok ? 'Тендер выполнен' : 'Исполните контракт' };
            }
        },
        {
            id: 'q3_networth_goal',
            chapter: 3,
            title: 'Капитал $250,000',
            desc: 'Достигните общей капитализации компании (Net Worth) не менее $250,000.',
            reward: { money: 30000, score: 50, text: '+$30,000, +50 Скоринг, Переход в 4 Главу!' },
            check: (s) => {
                let cash = Math.max(0, s.finances.balance);
                return cash >= 150000;
            },
            progress: (s) => {
                let cash = Math.max(0, s.finances.balance);
                return { current: Math.min(cash, 150000), target: 150000, label: `$${formatMoney(cash)} / $150,000 Cash` };
            }
        },

        // --- ГЛАВА 4 ---
        {
            id: 'q4_rnd_facility',
            chapter: 4,
            title: 'Научно-технический центр',
            desc: 'Постройте корпус НИИ и укомплектуйте его минимум 2 рабочими станциями ПК.',
            reward: { money: 35000, score: 50, text: '+$35,000 (Инновационный грант), +50 Скоринг' },
            check: (s) => (s.rnd && s.rnd.facility && s.rnd.facility.level >= 1 && s.rnd.facility.equipment && s.rnd.facility.equipment.count >= 2),
            progress: (s) => {
                let cnt = (s.rnd && s.rnd.facility && s.rnd.facility.equipment) ? s.rnd.facility.equipment.count : 0;
                return { current: Math.min(cnt, 2), target: 2, label: `${Math.min(cnt, 2)} / 2 ПК в НИИ` };
            }
        },
        {
            id: 'q4_tech_unlock',
            chapter: 4,
            title: 'Новая технология',
            desc: 'Разработайте в лаборатории технологию производства электроники, оптики или FPV-дронов.',
            reward: { money: 45000, score: 60, text: '+$45,000, +60 Скоринг' },
            check: (s) => (s.rnd && s.rnd.unlocked && s.rnd.unlocked.length >= 3),
            progress: (s) => {
                let u = (s.rnd && s.rnd.unlocked) ? s.rnd.unlocked.length : 2;
                return { current: Math.min(u, 3), target: 3, label: `${Math.min(u, 3)} / 3 технологии` };
            }
        },
        {
            id: 'q4_drone_factory',
            chapter: 4,
            title: 'Оборонный заказ',
            desc: 'Постройте Завод FPV-дронов или Сборку систем связи.',
            reward: { money: 60000, score: 80, text: '+$60,000, +80 Скоринг, Переход в 5 Главу!' },
            check: (s) => s.company.businesses.some(b => ['drones', 'drones_ai_fab', 'pc_assembly', 'radio_assembly'].includes(b.type)),
            progress: (s) => {
                let ok = s.company.businesses.some(b => ['drones', 'drones_ai_fab', 'pc_assembly', 'radio_assembly'].includes(b.type));
                return { current: ok ? 1 : 0, target: 1, label: ok ? 'Завод построен' : 'Постройте High-Tech цех' };
            }
        },

        // --- ГЛАВА 5 ---
        {
            id: 'q5_all_cities',
            chapter: 5,
            title: 'Всеукраинское присутствие',
            desc: 'Имейте действующие предприятия и хабы во всех 5 городах Украины (Киев, Харьков, Одесса, Днепр, Львов).',
            reward: { money: 150000, score: 100, text: '+$150,000, +100 Скоринг' },
            check: (s) => {
                let cities = new Set();
                s.company.businesses.forEach(b => { if (b.city) cities.add(b.city); });
                return cities.size >= 5;
            },
            progress: (s) => {
                let cities = new Set();
                s.company.businesses.forEach(b => { if (b.city) cities.add(b.city); });
                return { current: Math.min(cities.size, 5), target: 5, label: `${Math.min(cities.size, 5)} / 5 городов` };
            }
        },
        {
            id: 'q5_brand_titan',
            chapter: 5,
            title: 'Культовый национальный бренд',
            desc: 'Поднимите узнаваемость бренда компании до 60% и выше.',
            reward: { money: 250000, score: 100, text: '+$250,000' },
            check: (s) => (s.retail && s.retail.brand >= 60),
            progress: (s) => {
                let b = (s.retail && s.retail.brand) ? s.retail.brand : 10;
                return { current: Math.min(b, 60), target: 60, label: `${b.toFixed(1)}% / 60%` };
            }
        },
        {
            id: 'q5_empire_tycoon',
            chapter: 5,
            title: '🏆 Промышленный Магнат Украины',
            desc: 'Достигните суммарной капитализации компании (Net Worth) от $2,500,000.',
            reward: { money: 1000000, score: 200, text: '🏆 ПОБЕДА! Титул "Промышленный Магнат Украины", +$1,000,000' },
            check: (s) => {
                let cash = Math.max(0, s.finances.balance);
                return cash >= 1000000;
            },
            progress: (s) => {
                let cash = Math.max(0, s.finances.balance);
                return { current: Math.min(cash, 1000000), target: 1000000, label: `$${formatMoney(cash)} / $1,000,000 Cash` };
            }
        }
    ],

    init() {
        if (!STATE.quests) {
            STATE.quests = {
                currentChapter: 1,
                completed: [],
                claimed: []
            };
        }
        if (!STATE.quests.completed) STATE.quests.completed = [];
        if (!STATE.quests.claimed) STATE.quests.claimed = [];
        if (!STATE.quests.currentChapter) STATE.quests.currentChapter = 1;
    },

    checkProgress() {
        this.init();
        let newlyCompleted = [];

        this.LIST.forEach(q => {
            if (q.chapter <= STATE.quests.currentChapter) {
                if (!STATE.quests.completed.includes(q.id)) {
                    if (q.check(STATE)) {
                        STATE.quests.completed.push(q.id);
                        newlyCompleted.push(q);
                    }
                }
            }
        });

        if (newlyCompleted.length > 0) {
            newlyCompleted.forEach(q => {
                if (typeof NOTIFY !== 'undefined') {
                    NOTIFY.success('Цель достигнута! 🎯', `Выполнена задача: "${q.title}". Заберите награду в Квест-Центре!`);
                }
            });
        }

        // Авто-повышение главы, если все квесты текущей главы завершены
        let currentChapterQuests = this.LIST.filter(q => q.chapter === STATE.quests.currentChapter);
        let allDone = currentChapterQuests.every(q => STATE.quests.completed.includes(q.id));
        if (allDone && STATE.quests.currentChapter < 5) {
            STATE.quests.currentChapter++;
            if (typeof NOTIFY !== 'undefined') {
                let ch = this.CHAPTERS[STATE.quests.currentChapter];
                NOTIFY.success('НОВАЯ ГЛАВА ИМПЕРИИ! 🚀', `Открыта ${ch.title}! Впереди новые стратегические вызовы.`);
            }
        }
    },

    claimReward(questId) {
        this.init();
        let q = this.LIST.find(item => item.id === questId);
        if (!q) return;

        if (!STATE.quests.completed.includes(questId)) {
            NOTIFY.error('Ошибка', 'Задача еще не выполнена.');
            return;
        }

        if (STATE.quests.claimed.includes(questId)) {
            NOTIFY.info('Уведомление', 'Награда за эту задачу уже получена.');
            return;
        }

        STATE.quests.claimed.push(questId);

        // Начисление наград
        if (q.reward.money) {
            STATE.finances.balance += q.reward.money;
            if (typeof LEDGER !== 'undefined') LEDGER.record('rev_other', q.reward.money);
        }
        if (q.reward.score) {
            STATE.finances.creditScore = Math.min(1000, (STATE.finances.creditScore || 200) + q.reward.score);
        }

        NOTIFY.success('Награда получена! 🎁', `Зачислено: ${q.reward.text}`);
        if (typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.update();
    }
};
