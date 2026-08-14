// =========================================================
// TUTORIAL — независимый модуль онбординга (стейт-машина)
// Не требует правок в dashboardUI.js / gameLoop.js / STATE.js.
// Подключить <script src="tutorial.js"></script> в конце index.html,
// после dashboardUI.js и после NOTIFY (notify.js).
// =========================================================
const TUTORIAL = {

    // --- СЦЕНАРИЙ (можно свободно дополнять новыми шагами) ---
    // target: CSS-селектор подсвечиваемого элемента (null = приветственный экран без подсветки)
    // trigger.type:
    //   'manual'    — шаг закрывается кнопкой "Понятно, далее"
    //   'click'     — шаг закрывается кликом по самому подсвеченному элементу
    //   'condition' — шаг закрывается, когда trigger.check(STATE) вернёт true
    //                 (проверяется автоматически после каждого UI_DASHBOARD.update())
    STEPS: [
        {
            target: '.topbar',
            title: 'Добро пожаловать в бизнес!',
            text: 'Ваш стартовый капитал — $25,000. Ваша первая задача — открыть успешный розничный магазин, наладить сбыт ходовых товаров и заработать начальный капитал.',
            trigger: { type: 'manual' }
        },
        {
            target: '[onclick*="\'tab-retail\'"]',
            title: 'Торговля и Розница',
            text: 'Перейдите во вкладку «Розница», чтобы открыть свой первый фирменный магазин.',
            trigger: { type: 'click' }
        },
        {
            target: '[onclick*="buyBusiness(\'retail_store\')"]',
            title: 'Открытие магазина',
            text: 'Нажмите «+ Открыть Фирменный магазин» и выберите стартовый город.',
            trigger: {
                type: 'condition',
                check: (state) => state.company.businesses.some(b => b.type === 'retail_store')
            }
        },
        {
            target: '[onclick*="\'tab-hr\'"]',
            title: 'Отдел кадров',
            text: 'Магазину требуются сотрудники: Директор магазина и Продавец-консультант. Перейдите в HR.',
            trigger: { type: 'click' }
        },
        {
            target: '[onclick*="HR.hire(\'store_manager\')"]',
            title: 'Найм персонала',
            text: 'Наймите 1 Директора магазина (Store Manager) и Продавца (Salesman) в кадровый резерв.',
            trigger: {
                type: 'condition',
                check: (state) => (state.hr && state.hr.staff && (state.hr.staff.store_manager || 0) > 0)
            }
        },
        {
            target: '[onclick*="\'tab-market\'"]',
            title: 'Оптовая биржа',
            text: 'Пора закупить ходовые потребительские товары для полок вашего магазина.',
            trigger: { type: 'click' }
        },
        {
            target: '[onclick*="submitBuy(\'bakery\')"]',
            title: 'Закупка товаров',
            text: 'Купите партию «Хлеб и Выпечка» (или других продуктов) с доставкой на склад в ваш город.',
            trigger: { type: 'click' }
        },
        {
            target: '[onclick*="\'tab-dashboard\'"]',
            title: 'Квест-Центр и Стратегия',
            text: 'На главном дашборде активен Квест-Центр. Закрывайте цели глав, забирайте гранты и развивайтесь от магазина до национальной корпорации!',
            trigger: { type: 'click' }
        },
        {
            target: '[onclick*="GAME.nextDay()"]',
            title: 'Старт бизнеса',
            text: 'Нажмите «Следующий день», чтобы принять поставку, открыть двери магазина и получить первую выручку!',
            trigger: { type: 'click' }
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
    init() {
        if (!STATE.tutorial) {
            const alreadyDone = (typeof localStorage !== 'undefined') &&
                localStorage.getItem('uabiz_tutorial_done') === '1';
            STATE.tutorial = { isActive: !alreadyDone, step: 0 };
        }

        this._buildDOM();
        this.scrollParent = document.querySelector('.content');
        this._attachUpdateHook();

        if (STATE.tutorial.isActive) {
            this.renderStep();
        }
    },

    // Создаёт DOM-структуру оверлея один раз и кэширует ссылки в this.els
    _buildDOM() {
        if (document.getElementById('tutorial-root')) return;

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

        const el = document.querySelector(step.target);
        if (!el) {
            // Защита от софт-лока: если элемент не найден (напр. изменилась вёрстка) — пропускаем шаг
            console.warn('[TUTORIAL] Целевой элемент не найден для шага:', step.target);
            this.advance();
            return;
        }

        this._currentTargetSelector = step.target;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Ждём завершения плавного скролла перед замером координат
        this._scrollTimer = setTimeout(() => this._drawAround(el), 380);
        this._attachReposition();
    },

    // Полноэкранное затемнение без конкретной цели (приветственный шаг)
    _drawFullscreen() {
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
        const tw = this.els.tooltip.offsetWidth;
        const th = this.els.tooltip.offsetHeight;
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
        // 'condition' — обрабатывается через check(), 'manual' — через статичную кнопку "Далее"
    },

    // Вызывается автоматически после каждого UI_DASHBOARD.update() (см. _attachUpdateHook)
    check() {
        if (!STATE.tutorial || !STATE.tutorial.isActive) return;
        const step = this.STEPS[STATE.tutorial.step];
        if (!step || step.trigger.type !== 'condition') return;

        try {
            if (step.trigger.check(STATE)) this.advance();
        } catch (e) {
            console.warn('[TUTORIAL] Ошибка проверки условия шага:', e);
        }
    },

    advance() {
        this._cleanupListeners();
        STATE.tutorial.step++;
        if (STATE.tutorial.step >= this.STEPS.length) {
            this.finish(false);
            return;
        }
        this.renderStep();
    },

    skip() {
        this.finish(true);
    },

    finish(bySkip) {
        STATE.tutorial.isActive = false;
        this.hide();
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('uabiz_tutorial_done', '1');
        }
        if (!bySkip && typeof NOTIFY !== 'undefined') {
            NOTIFY.success('Успех', 'Обучение пройдено! Дальше вы сами.');
        }
    },

    show() {
        this.els.root.classList.add('is-active');
    },

    hide() {
        if (this.els.root) this.els.root.classList.remove('is-active');
        this.els.tooltip && this.els.tooltip.classList.remove('is-visible', 'is-centered');
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

    // Аддитивно оборачивает UI_DASHBOARD.update(), чтобы после каждого пересчёта
    // проверять условие текущего шага. Ничего не меняет в существующих модулях.
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
    }
};

// Используем addEventListener('load', ...), а НЕ window.onload = ...,
// чтобы не перезаписать window.onload из gameLoop.js (там уже вызывается GAME.init()).
window.addEventListener('load', () => TUTORIAL.init());
