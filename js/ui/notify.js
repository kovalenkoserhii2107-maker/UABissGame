// =========================================================
// NOTIFY — независимый модуль toast-уведомлений
// Полная замена alert(). Vanilla JS, без зависимостей.
// Подключить <script src="notify.js"></script> ДО gameLoop.js
// и после того, как в <style> вставлен notify.css
// =========================================================
const NOTIFY = {

    container: null,
    counter: 0,
    DEFAULT_DURATION: 6000, // 6 секунд, попадает в требуемые 5-7 сек

    ICONS: {
        success: '✅',
        error: '🚨',
        info: 'ℹ️',
        warning: '⚠️'
    },

    // Ленивая инициализация контейнера-стека (создаётся один раз)
    init() {
        if (this.container) return;
        let el = document.getElementById('notify-stack');
        if (!el) {
            el = document.createElement('div');
            el.id = 'notify-stack';
            el.setAttribute('aria-live', 'polite');
            el.setAttribute('aria-atomic', 'false');
            document.body.appendChild(el);
        }
        this.container = el;
    },

    // Экранирование текста, чтобы нельзя было случайно/специально сломать разметку
    _escape(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    // Базовый метод показа. type: success | error | info | warning
    show(type, title, text, duration) {
        this.init();
        duration = duration || this.DEFAULT_DURATION;

        const id = 'toast-' + (++this.counter);
        const toast = document.createElement('div');
        toast.className = 'notify-toast type-' + type;
        toast.id = id;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

        toast.innerHTML =
            '<div class="notify-icon">' + (this.ICONS[type] || 'ℹ️') + '</div>' +
            '<div class="notify-body">' +
                '<div class="notify-title">' + this._escape(title) + '</div>' +
                (text ? '<div class="notify-text">' + this._escape(text) + '</div>' : '') +
            '</div>' +
            '<button class="notify-close" aria-label="Закрыть уведомление" onclick="NOTIFY.dismiss(\'' + id + '\')">&times;</button>' +
            '<div class="notify-progress"><div class="notify-progress-bar"></div></div>';

        this.container.appendChild(toast);

        const bar = toast.querySelector('.notify-progress-bar');
        let remaining = duration;
        let startedAt = Date.now();
        let timer = null;

        const startCountdown = () => {
            startedAt = Date.now();
            timer = setTimeout(() => this.dismiss(id), remaining);
            if (bar) {
                bar.style.transition = 'none';
                bar.style.width = getComputedStyle(bar).width; // фиксируем текущую точку
                // форсируем reflow, затем запускаем плавный переход к 0%
                void bar.offsetWidth;
                bar.style.transition = 'width ' + remaining + 'ms linear';
                bar.style.width = '0%';
            }
        };

        const pauseCountdown = () => {
            clearTimeout(timer);
            remaining -= (Date.now() - startedAt);
            if (remaining < 0) remaining = 0;
            if (bar) {
                bar.style.width = getComputedStyle(bar).width;
                bar.style.transition = 'none';
            }
        };

        // Наведение мышью ставит таймер на паузу — удобно, если уведомлений много
        toast.addEventListener('mouseenter', pauseCountdown);
        toast.addEventListener('mouseleave', () => {
            if (remaining > 0) startCountdown();
        });

        // Появление на следующем кадре, чтобы сработала CSS-анимация
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('is-visible');
                startCountdown();
            });
        });

        return id;
    },

    // Ручное/программное закрытие конкретного уведомления
    dismiss(id) {
        const toast = document.getElementById(id);
        if (!toast) return;
        toast.classList.remove('is-visible');
        toast.classList.add('is-leaving');

        let removed = false;
        const remove = () => {
            if (removed) return;
            removed = true;
            if (toast.parentNode) toast.remove();
        };
        toast.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 500); // страховка, если transitionend не сработал
    },

    // Убрать всё разом (например, при старте нового дня/новой игры)
    clear() {
        if (!this.container) return;
        this.container.innerHTML = '';
    },

    // --- Публичное API, требуемое ТЗ ---
    success(title, text, duration) { return this.show('success', title, text, duration); },
    error(title, text, duration)   { return this.show('error', title, text, duration); },
    info(title, text, duration)    { return this.show('info', title, text, duration); },
    warning(title, text, duration) { return this.show('warning', title, text, duration); }
};
