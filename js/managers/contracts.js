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
        
        let basePrice = MARKET.BASE_PRICES[item];
        
        // Балансировка количества (чипов нужно много, дронов мало)
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
            alert(`✅ Контракт подписан! У вас есть ${c.deadline} дн. на производство ${c.qty} шт. "${RECIPES.RESOURCES[c.item].name}".`);
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
                
                // Начисляем деньги и репутацию
                STATE.finances.balance += c.totalReward;
                if (typeof LEDGER !== 'undefined') LEDGER.record('rev_b2g', c.totalReward);
                STATE.finances.creditScore += 15;
                if (STATE.finances.creditScore > 1000) STATE.finances.creditScore = 1000;
                
                STATE.contracts.active.splice(idx, 1); // Удаляем выполненный
                UI_DASHBOARD.update();
                alert(`🎉 Поставка выполнена успешно! Вы заработали $${formatMoney(c.totalReward)}.`);
            } else {
                alert(`❌ Не хватает товара! Произведите еще.`);
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
                if (typeof LEDGER !== 'undefined') LEDGER.record('exp_fines', c.penalty);
                STATE.finances.creditScore -= 50; // Сильный удар по скорингу
                alert(`🚨 КОНТРАКТ ПРОВАЛЕН! Сорваны сроки поставки товара "${RECIPES.RESOURCES[c.item].name}".\n\nШтраф: $${formatMoney(c.penalty)} и падение репутации.`);
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
