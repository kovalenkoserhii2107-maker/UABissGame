// Модуль B2B/B2G контрактов и тендеров
const CONTRACTS = {
    init() {
        if (!STATE.contracts) {
            STATE.contracts = {
                available: [], // Список доступных тендеров на бирже
                active: []     // Взятые в работу контракты
            };
        }
    },

    // Генерация случайного тендера
    generateContract() {
        this.init();
        
        // Выбираем только готовую продукцию (не сырье)
        const items = Object.keys(RECIPES.RESOURCES).filter(k => !RECIPES.RESOURCES[k].isRaw);
        const item = items[Math.floor(Math.random() * items.length)];
        
        // ИСПРАВЛЕНИЕ: Берем базовую цену из рецептов или текущую с биржи
        let basePrice = RECIPES.RESOURCES[item].basePrice || 10;
        if (typeof MARKET !== 'undefined' && MARKET.getCurrentPrice) {
            basePrice = MARKET.getCurrentPrice(item);
        }
        
        // Балансировка количества
        let qty = Math.floor(Math.random() * 50) + 10; 
        if(item === 'drones') qty = Math.floor(Math.random() * 15) + 5;
        if(item === 'chips') qty = Math.floor(Math.random() * 100) + 50;

        // Премия к рынку от +20% до +80%
        let premium = 1.2 + Math.random() * 0.6; 
        let price = Math.floor(basePrice * premium);
        
        // Срок от 5 до 14 дней
        let deadline = Math.floor(Math.random() * 10) + 5; 

        let contract = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            item: item,
            qty: qty,
            price: price,
            totalReward: price * qty,
            penalty: Math.floor(price * qty * 0.4), // Штраф 40% от общей суммы
            deadline: deadline
        };

        STATE.contracts.available.push(contract);
        
        // Храним на бирже не больше 4 тендеров одновременно
        if (STATE.contracts.available.length > 4) {
            STATE.contracts.available.shift(); 
        }
    },

    // Игрок берет контракт в работу
    accept(id) {
        let idx = STATE.contracts.available.findIndex(c => c.id === id);
        if (idx !== -1) {
            let c = STATE.contracts.available.splice(idx, 1)[0];
            STATE.contracts.active.push(c);
            UI_DASHBOARD.update();
            
            // ИСПРАВЛЕНИЕ: Красивое уведомление вместо alert
            if (typeof NOTIFY !== 'undefined') {
                NOTIFY.success('Тендер взят!', `У вас есть ${c.deadline} дн. на производство ${c.qty} шт. "${RECIPES.RESOURCES[c.item].name}".`);
            }
        }
    },

    // Игрок отгружает товар по контракту
    fulfill(id) {
        let idx = STATE.contracts.active.findIndex(c => c.id === id);
        if (idx !== -1) {
            let c = STATE.contracts.active[idx];
            let inv = STATE.company.inventory[c.item];
            
            if (inv && inv.qty >= c.qty) {
                // Списываем товар
                inv.qty -= c.qty;
                if (inv.qty === 0) inv.avgCost = 0;
                
                // Начисляем деньги
                STATE.finances.balance += c.totalReward;
                
                // Улучшенная запись в финансовый лог
                if (typeof LEDGER !== 'undefined' && LEDGER.record) {
                    LEDGER.record('rev_b2g', c.totalReward);
                } else if (STATE.ledger && STATE.ledger.yesterday) {
                    STATE.ledger.yesterday.rev_b2g = (STATE.ledger.yesterday.rev_b2g || 0) + c.totalReward;
                }
                
                // Начисляем репутацию
                STATE.finances.creditScore += 15;
                if (STATE.finances.creditScore > 1000) STATE.finances.creditScore = 1000;
                
                STATE.contracts.active.splice(idx, 1); // Удаляем выполненный
                UI_DASHBOARD.update();
                
                // ИСПРАВЛЕНИЕ: Красивое уведомление
                if (typeof NOTIFY !== 'undefined') NOTIFY.success('Поставка выполнена!', `Вы заработали $${formatMoney(c.totalReward)}.`);
            } else {
                if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка логистики', `Не хватает товара для отгрузки!`);
            }
        }
    },

    // Ежедневный цикл
    processDaily() {
        this.init();
        
        // 1. Уменьшаем таймеры взятых контрактов
        for (let i = STATE.contracts.active.length - 1; i >= 0; i--) {
            let c = STATE.contracts.active[i];
            c.deadline--;
            
            if (c.deadline <= 0) {
                // ПРОВАЛ КОНТРАКТА
                STATE.finances.balance -= c.penalty;
                
                if (typeof LEDGER !== 'undefined' && LEDGER.record) {
                    LEDGER.record('exp_fines', c.penalty);
                } else if (STATE.ledger && STATE.ledger.yesterday) {
                    STATE.ledger.yesterday.exp_fines = (STATE.ledger.yesterday.exp_fines || 0) + c.penalty;
                }
                
                STATE.finances.creditScore -= 50; // Сильный удар по скорингу
                
                if (typeof NOTIFY !== 'undefined') {
                    NOTIFY.error('Срыв сроков поставки!', `Контракт провален. Выписан штраф: $${formatMoney(c.penalty)}.`);
                }
                
                STATE.contracts.active.splice(i, 1);
            }
        }
        
        // 2. Имитация живой биржи (старые тендеры иногда пропадают)
        if (Math.random() < 0.15 && STATE.contracts.available.length > 0) {
            STATE.contracts.available.shift();
        }

        // 3. Появление новых тендеров (30% шанс каждый день)
        if (Math.random() < 0.3) {
            this.generateContract();
        }
    }
};
