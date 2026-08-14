// =========================================================
// TUTORIAL — независимый модуль онбординга (стейт-машина)
// Полный интерактивный обучающий курс «От и До»
// =========================================================
const TUTORIAL = {

    // --- СЦЕНАРИЙ ОБУЧЕНИЯ (12 шагов) ---
    STEPS: [
        {
            target: null, // Центрированное модальное окно
            title: 'Добро пожаловать в UABiz! 🇺🇦',
            text: 'Вы начинаете путь предпринимателя с капиталом $25,000. Впереди 5 глав развития — от розничной точки до национальной корпорации. Давайте пошагово запустим ваш первый прибыльный магазин!',
            trigger: { type: 'manual' }
        },
        {
            target: '#ui-quest-widget',
            tab: 'tab-dashboard',
            title: 'Квест-Центр и Главы Империи 🎯',
            text: 'Здесь отображаются стратегические цели текущей главы. За выполнение каждой задачи вы получаете финансовые гранты, очки кредитного рейтинга и доступ к новым отраслям.',
            trigger: { type: 'manual' }
        },
        {
            target: '[onclick*="\'tab-retail\'"]',
            title: 'Торговля и Розница 🏪',
            text: 'Самый надежный способ начать — розничная торговля ходовыми товарами. Нажмите на вкладку «Розница».',
            trigger: { type: 'click' }
        },
        {
            target: '[onclick*="buyBusiness(\'retail_store\')"]',
            tab: 'tab-retail',
            title: 'Открытие фирменного магазина 🏬',
            text: 'Нажмите «+ Открыть Фирменный магазин» и выберите стартовый город (например, Одессу, Харьков или Днепр). В городах с высоким спросом выручка выше!',
            trigger: {
                type: 'condition',
                check: (state) => state.company && state.company.businesses && state.company.businesses.some(b => b.type === 'retail_store')
            }
        },
        {
            target: '[onclick*="\'tab-hr\'"]',
            title: 'Отдел кадров (HR) 👥',
            text: 'Магазину требуются специалисты: Директор магазина (управляет точкой) и Продавец-консультант (обслуживает покупателей). Перейдите во вкладку «HR».',
            trigger: { type: 'click' }
        },
        {
            target: '[onclick*="HR.hire(\'store_manager\')"]',
            tab: 'tab-hr',
            title: 'Найм Директора магазина 👔',
            text: 'Сначала наймите 1 Директора магазина (Store Manager), который будет руководить торговой точкой.',
            trigger: {
                type: 'condition',
                check: (state) => (state.hr && state.hr.staff && (state.hr.staff.store_manager || 0) > 0) || (state.company && state.company.businesses && state.company.businesses.some(b => b.assigned && (b.assigned.store_manager || 0) > 0))
            }
        },
        {
            target: '[onclick*="HR.hire(\'salesman\')"]',
            tab: 'tab-hr',
            title: 'Найм Продавца-консультанта 🛒',
            text: 'Отлично! Теперь нажмите на подсвеченную кнопку и наймите 1 Продавца-консультанта (Salesman).',
            trigger: {
                type: 'condition',
                check: (state) => (state.hr && state.hr.staff && (state.hr.staff.salesman || 0) > 0) || (state.company && state.company.businesses && state.company.businesses.some(b => b.assigned && (b.assigned.salesman || 0) > 0))
            }
        },
        {
            target: '[onclick*="\'tab-retail\'"]',
            title: 'Распределение персонала 🧑‍💼',
            text: 'Штат нанят! Вернитесь во вкладку «Розница» и назначьте сотрудников в ваш магазин с помощью кнопок «+».',
            trigger: {
                type: 'condition',
                check: (state) => state.company && state.company.businesses && state.company.businesses.some(b => b.type === 'retail_store' && b.assigned && ((b.assigned.store_manager || 0) >= 1 || (b.assigned.salesman || 0) >= 1))
            }
        },
        {
            target: '[onclick*="\'tab-market\'"]',
            title: 'Оптовая товарная биржа ⚖️',
            text: 'Команда готова! Теперь нужно наполнить полки товарами. Перейдите во вкладку «Биржа».',
            trigger: { type: 'click' }
        },
        {
            target: '#market-target-city',
            tab: 'tab-market',
            title: 'Закупка ходовых товаров 📦',
            text: 'Выберите город вашего магазина, укажите количество (например, 50-100 шт. Хлеба или Овощей) и нажмите «Купить». Груз отправится в доставку!',
            trigger: {
                type: 'condition',
                check: (state) => (state.logistics && state.logistics.deliveries && state.logistics.deliveries.length > 0) || (state.company && state.company.warehouses && Object.values(state.company.warehouses).some(w => Object.values(w.inventory || {}).some(i => i.qty > 0)))
            }
        },
        {
            target: '[onclick*="\'tab-warehouse\'"]',
            title: 'Склады и автопополнение 🚛',
            text: 'Во вкладке «Склады» вы можете отслеживать остатки в каждом городе, настраивать правила автоснабжения магазинов и расширять складские площади.',
            trigger: { type: 'click' }
        },
        {
            target: '.btn-primary-lg',
            title: 'Завершение операционного дня 🌅',
            text: 'Нажмите «Закрыть операционный день», чтобы товары прибыли на склад, магазин открыл двери и принес первую выручку!',
            trigger: { type: 'click' }
        },
        {
            target: null, // Центрированное поздравление
            title: '🎉 Первый день позади! Поздравляем!',
            text: 'Вы успешно открыли бизнес! Следите за отчетами P&L, выполняйте квесты, стройте собственные заводы и захватывайте рынок Украины! Вы всегда можете перезапустить этот курс кнопкой «🎓 Обучение» в шапке.',
            trigger: { type: 'manual' }
        }
    ],

    els: {},
    _listeners: [],
    _currentTargetSelector: null,
    _scrollTimer: null,
    _onReposition: null,
    _updateHooked: false,
    scrollParent: null,

    // --- ИНИЦИАЛИЗАЦИЯ ---
    init(force = false) {
        if (force) {
            if (!STATE.tutorial) STATE.tutorial = {};
            STATE.tutorial.isActive = true;
            STATE.tutorial.step = 0;
        } else if (!STATE.tutorial) {
            let alreadyDone = false;
            try {
                alreadyDone = (typeof localStorage !== 'undefined') && localStorage.getItem('uabiz_tutorial_done') === '1';
            } catch(e) {}
            STATE.tutorial = { isActive: !alreadyDone, step: 0 };
        }

        this._buildDOM();
        this.scrollParent = document.querySelector('.content');
        this._attachUpdateHook();

        if (STATE.tutorial && STATE.tutorial.isActive) {
            this.renderStep();
        }
    },

    // Создаёт DOM-структуру оверлея один раз и кэширует ссылки в this.els
    _buildDOM() {
        if (document.getElementById('tutorial-root')) {
            const root = document.getElementById('tutorial-root');
            this.els = {
                root: root,
                curtainTop: root.querySelector('.tc-top'),
                curtainBottom: root.querySelector('.tc-bottom'),
                curtainLeft: root.querySelector('.tc-left'),
                curtainRight: root.querySelector('.tc-right'),
                ring: root.querySelector('.tutorial-ring'),
                tooltip: root.querySelector('.tutorial-tooltip'),
                badge: root.querySelector('.tutorial-tooltip-badge'),
                title: root.querySelector('.tutorial-tooltip-title'),
                text: root.querySelector('.tutorial-tooltip-text'),
                waitingHint: root.querySelector('.tutorial-waiting-hint'),
                nextBtn: root.querySelector('.tutorial-next'),
                skipBtn: root.querySelector('.tutorial-skip')
            };
            return;
        }

        if (!document.body) return;

        const root = document.createElement('div');
        root.id = 'tutorial-root';
        root.innerHTML =
            '<div class="tutorial-curtain tc-top"></div>' +
            '<div class="tutorial-curtain tc-bottom"></div>' +
            '<div class="tutorial-curtain tc-left"></div>' +
            '<div class="tutorial-curtain tc-right"></div>' +
            '<div class="tutorial-ring"></div>' +
            '<div class="tutorial-tooltip" role="dialog" aria-live="polite">' +
                '<div class="tutorial-tooltip-badge"></div>' +
                '<div class="tutorial-tooltip-title"></div>' +
                '<div class="tutorial-tooltip-text"></div>' +
                '<div class="tutorial-waiting-hint"></div>' +
                '<div class="tutorial-tooltip-actions">' +
                    '<button type="button" class="tutorial-skip">Пропустить обучение</button>' +
                    '<button type="button" class="tutorial-next">Понятно, далее →</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(root);

        this.els = {
            root: root,
            curtainTop: root.querySelector('.tc-top'),
            curtainBottom: root.querySelector('.tc-bottom'),
            curtainLeft: root.querySelector('.tc-left'),
            curtainRight: root.querySelector('.tc-right'),
            ring: root.querySelector('.tutorial-ring'),
            tooltip: root.querySelector('.tutorial-tooltip'),
            badge: root.querySelector('.tutorial-tooltip-badge'),
            title: root.querySelector('.tutorial-tooltip-title'),
            text: root.querySelector('.tutorial-tooltip-text'),
            waitingHint: root.querySelector('.tutorial-waiting-hint'),
            nextBtn: root.querySelector('.tutorial-next'),
            skipBtn: root.querySelector('.tutorial-skip')
        };

        this.els.nextBtn.addEventListener('click', () => this.advance());
        this.els.skipBtn.addEventListener('click', () => this.skip());
    },

    // --- РЕНДЕР ШАГА ---
    renderStep() {
        if (!STATE.tutorial || !STATE.tutorial.isActive) { this.hide(); return; }

        this._buildDOM();
        if (!this.els.root) return;

        const step = this.STEPS[STATE.tutorial.step];
        if (!step) { this.finish(false); return; }

        this._cleanupListeners();
        this.show();
        this._renderContent(step);
        this._positionForStep(step);
        this._wireTrigger(step);
    },

    _renderContent(step) {
        this.els.badge.textContent = `Шаг ${STATE.tutorial.step + 1} из ${this.STEPS.length}`;
        this.els.title.textContent = step.title;
        this.els.text.textContent = step.text;

        const isManual = step.trigger.type === 'manual';
        this.els.nextBtn.style.display = isManual ? 'inline-flex' : 'none';
        this.els.waitingHint.style.display = isManual ? 'none' : 'block';
        this.els.waitingHint.textContent = step.trigger.type === 'click'
            ? '👉 Нажмите на подсвеченный элемент'
            : (step.trigger.type === 'condition' ? '⏳ Выполните действие в игре, чтобы продолжить' : '');
    },

    _positionForStep(step) {
        clearTimeout(this._scrollTimer);

        if (!step.target) {
            this._currentTargetSelector = null;
            this._drawFullscreen();
            return;
        }

        // Если для шага требуется определенная вкладка, автоматически открываем её
        if (step.tab && typeof UI_DASHBOARD !== 'undefined') {
            const tabBtn = document.querySelector(`[onclick*="'${step.tab}'"]`);
            if (tabBtn && !tabBtn.classList.contains('active')) {
                UI_DASHBOARD.switchTab({ currentTarget: tabBtn }, step.tab);
            }
        }

        const el = document.querySelector(step.target);
        if (!el) {
            console.warn('[TUTORIAL] Целевой элемент не найден для шага:', step.target);
            this._drawFullscreen();
            return;
        }

        this._currentTargetSelector = step.target;
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch(e) {}
        this._scrollTimer = setTimeout(() => this._drawAround(el), 150);
        this._attachReposition();
    },

    // Полноэкранное затемнение без конкретной цели (приветственный/финальный шаг)
    _drawFullscreen() {
        if (!this.els.curtainTop) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        Object.assign(this.els.curtainTop.style, { left: '0px', top: '0px', width: vw + 'px', height: vh + 'px' });
        Object.assign(this.els.curtainBottom.style, { width: '0px', height: '0px' });
        Object.assign(this.els.curtainLeft.style, { width: '0px', height: '0px' });
        Object.assign(this.els.curtainRight.style, { width: '0px', height: '0px' });
        this.els.ring.style.opacity = '0';

        this.els.tooltip.classList.add('is-centered');
        this.els.tooltip.style.top = '';
        this.els.tooltip.style.left = '';
        this.els.tooltip.classList.add('is-visible');
    },

    // Строит 4 "шторки" + светящееся кольцо вокруг конкретного элемента
    _drawAround(el) {
        if (!el || !this.els.curtainTop) return;
        const rect = el.getBoundingClientRect();
        const pad = 8;
        const vw = window.innerWidth, vh = window.innerHeight;

        const top = Math.max(0, rect.top - pad);
        const bottom = Math.min(vh, rect.bottom + pad);
        const left = Math.max(0, rect.left - pad);
        const right = Math.min(vw, rect.right + pad);

        Object.assign(this.els.curtainTop.style, { left: '0px', top: '0px', width: vw + 'px', height: top + 'px' });
        Object.assign(this.els.curtainBottom.style, { left: '0px', top: bottom + 'px', width: vw + 'px', height: Math.max(0, vh - bottom) + 'px' });
        Object.assign(this.els.curtainLeft.style, { left: '0px', top: top + 'px', width: left + 'px', height: (bottom - top) + 'px' });
        Object.assign(this.els.curtainRight.style, { left: right + 'px', top: top + 'px', width: Math.max(0, vw - right) + 'px', height: (bottom - top) + 'px' });

        Object.assign(this.els.ring.style, {
            left: left + 'px', top: top + 'px',
            width: (right - left) + 'px', height: (bottom - top) + 'px',
            opacity: '1'
        });

        this.els.tooltip.classList.remove('is-centered');
        this.els.tooltip.classList.add('is-visible');

        // Позиционируем тултип: под элементом, если влезает, иначе — над ним
        const tw = this.els.tooltip.offsetWidth || 320;
        const th = this.els.tooltip.offsetHeight || 180;
        let tooltipTop = bottom + 14;
        if (tooltipTop + th > vh - 12) {
            tooltipTop = top - th - 14;
        }
        if (tooltipTop < 12) tooltipTop = 12;

        let tooltipLeft = rect.left;
        if (tooltipLeft + tw > vw - 12) tooltipLeft = vw - tw - 12;
        if (tooltipLeft < 12) tooltipLeft = 12;

        this.els.tooltip.style.top = tooltipTop + 'px';
        this.els.tooltip.style.left = tooltipLeft + 'px';
    },

    _wireTrigger(step) {
        if (step.trigger.type === 'click' && step.target) {
            const el = document.querySelector(step.target);
            if (el) {
                const handler = () => setTimeout(() => this.advance(), 50);
                el.addEventListener('click', handler, { once: true });
                this._listeners.push({ el, handler });
            }
        }
    },

    // Вызывается автоматически после каждого UI_DASHBOARD.update()
    check() {
        if (!STATE.tutorial || !STATE.tutorial.isActive) return;
        const step = this.STEPS[STATE.tutorial.step];
        if (!step || step.trigger.type !== 'condition') return;

        try {
            if (step.trigger.check(STATE)) this.advance();
        } catch (e) {
            console.error('[TUTORIAL] Ошибка проверки условия:', e);
        }
    },

    // --- ПЕРЕХОДЫ ---
    advance() {
        if (!STATE.tutorial || !STATE.tutorial.isActive) return;
        STATE.tutorial.step++;
        if (STATE.tutorial.step >= this.STEPS.length) {
            this.finish(false);
        } else {
            this.renderStep();
        }
    },

    skip() {
        this.finish(true);
    },

    finish(bySkip) {
        if (STATE.tutorial) {
            STATE.tutorial.isActive = false;
            STATE.tutorial.step = this.STEPS.length;
        }
        this.hide();
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('uabiz_tutorial_done', '1');
            }
        } catch(e) {}
        if (!bySkip && typeof NOTIFY !== 'undefined') {
            NOTIFY.success('Успех 🏆', 'Обучение успешно пройдено! Вперед к победам!');
        }
    },

    show() {
        if (this.els.root) this.els.root.classList.add('is-active');
    },

    hide() {
        if (this.els.root) this.els.root.classList.remove('is-active');
        if (this.els.tooltip) this.els.tooltip.classList.remove('is-visible', 'is-centered');
        this._cleanupListeners();
        clearTimeout(this._scrollTimer);
    },

    _cleanupListeners() {
        this._listeners.forEach(({ el, handler }) => el.removeEventListener('click', handler));
        this._listeners = [];
        if (this._onReposition) {
            window.removeEventListener('resize', this._onReposition);
            window.removeEventListener('scroll', this._onReposition, true);
            if (this.scrollParent) this.scrollParent.removeEventListener('scroll', this._onReposition);
        }
    },

    _attachReposition() {
        this._onReposition = () => {
            if (this._currentTargetSelector) {
                const el = document.querySelector(this._currentTargetSelector);
                if (el) this._drawAround(el);
            }
        };
        window.addEventListener('resize', this._onReposition);
        window.addEventListener('scroll', this._onReposition, true);
        if (this.scrollParent) this.scrollParent.addEventListener('scroll', this._onReposition);
    },

    // Аддитивно оборачивает UI_DASHBOARD.update()
    _attachUpdateHook() {
        if (this._updateHooked) return;
        const tryHook = () => {
            if (typeof UI_DASHBOARD === 'undefined' || !UI_DASHBOARD.update) {
                setTimeout(tryHook, 50);
                return;
            }
            const original = UI_DASHBOARD.update.bind(UI_DASHBOARD);
            UI_DASHBOARD.update = function () {
                original();
                TUTORIAL.check();
            };
            this._updateHooked = true;
        };
        tryHook();
    },

    restart() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('uabiz_tutorial_done');
            }
        } catch(e) {}
        if (!STATE.tutorial) STATE.tutorial = {};
        STATE.tutorial.isActive = true;
        STATE.tutorial.step = 0;
        this.init(true);
        this.renderStep();
        if (typeof NOTIFY !== 'undefined') {
            NOTIFY.info('Обучение', 'Интерактивный курс перезапущен!');
        }
    }
};

// Автозапуск при загрузке документа
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TUTORIAL.init());
    } else {
        TUTORIAL.init();
    }
}
