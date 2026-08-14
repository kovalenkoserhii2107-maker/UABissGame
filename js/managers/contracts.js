// Модуль B2B/B2G контрактов и тендеров (Мульти-склад)
const CONTRACTS = {
    init() {
        if (!STATE.contracts) {
            STATE.contracts = { available: [], active: [] };
        }
    },

    generateContract() {
        this.init();
        const items = Object.keys(RECIPES.RESOURCES).filter(k => !RECIPES.RESOURCES[k].isRaw);
        const item = items[Math.floor(Math.random() * items.length)];
        
        let basePrice = RECIPES.RESOURCES[item].basePrice || 10;
        if (typeof MARKET !== 'undefined' && MARKET.getCurrentPrice) {
            basePrice = MARKET.getCurrentPrice(item);
        }
        
        let qty = Math.floor(Math.random() * 50) + 10; 
        if(item === 'drones') qty = Math.floor(Math.random() * 15) + 5;
        if(item === 'chips') qty = Math.floor(Math.random() * 100) + 50;

        let premium = 1.2 + Math.random() * 0.6; 
        let price = Math.floor(basePrice * premium);
        let deadline = Math.floor(Math.random() * 10) + 5; 

        let contract = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            item: item, qty: qty, price: price,
            totalReward: price * qty, penalty: Math.floor(price * qty * 0.4), deadline: deadline
        };

        STATE.contracts.available.push(contract);
        if (STATE.contracts.available.length > 4) STATE.contracts.available.shift(); 
    },

    accept(id) {
        let idx = STATE.contracts.available.findIndex(c => c.id === id);
        if (idx !== -1) {
            let c = STATE.contracts.available.splice(idx, 1)[0];
            STATE.contracts.active.push(c);
            UI_DASHBOARD.update();
            if (typeof NOTIFY !== 'undefined') NOTIFY.success('Тендер взят!', `У вас есть ${c.deadline} дн. на производство ${c.qty} шт. "${RECIPES.RESOURCES[c.item].name}".`);
        }
    },

    fulfill(id) {
        let idx = STATE.contracts.active.findIndex(c => c.id === id);
        if (idx !== -1) {
            let c = STATE.contracts.active[idx];
            
            // Считаем общий сток по всем городам
            let totalStock = 0;
            if (STATE.company.warehouses) {
                Object.keys(STATE.company.warehouses).forEach(cId => {
                    let wh = STATE.company.warehouses[cId];
                    if (wh.inventory && wh.inventory[c.item]) totalStock += wh.inventory[c.item].qty;
                });
            }
            
            if (totalStock >= c.qty) {
                // Списываем последовательно со складов разных городов
                let remainToDeduct = c.qty;
                Object.keys(STATE.company.warehouses).forEach(cId => {
                    let wh = STATE.company.warehouses[cId];
                    if (remainToDeduct > 0 && wh.inventory && wh.inventory[c.item] && wh.inventory[c.item].qty > 0) {
                        let take = Math.min(remainToDeduct, wh.inventory[c.item].qty);
                        wh.inventory[c.item].qty -= take;
                        if (wh.inventory[c.item].qty === 0) wh.inventory[c.item].avgCost = 0;
                        remainToDeduct -= take;
                    }
                });
                
                STATE.finances.balance += c.totalReward;
                if (typeof LEDGER !== 'undefined' && LEDGER.record) {
                    LEDGER.record('rev_b2g', c.totalReward);
                } else if (STATE.ledger && STATE.ledger.yesterday) {
                    STATE.ledger.yesterday.rev_b2g = (STATE.ledger.yesterday.rev_b2g || 0) + c.totalReward;
                }
                
                STATE.finances.creditScore += 15;
                if (STATE.finances.creditScore > 1000) STATE.finances.creditScore = 1000;
                
                STATE.contracts.active.splice(idx, 1);
                UI_DASHBOARD.update();
                if (typeof NOTIFY !== 'undefined') NOTIFY.success('Поставка выполнена!', `Вы заработали $${formatMoney(c.totalReward)}.`);
            } else {
                if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка логистики', `Не хватает товара для отгрузки!`);
            }
        }
    },

    processDaily() {
        this.init();
        for (let i = STATE.contracts.active.length - 1; i >= 0; i--) {
            let c = STATE.contracts.active[i];
            c.deadline--;
            if (c.deadline <= 0) {
                STATE.finances.balance -= c.penalty;
                if (typeof LEDGER !== 'undefined' && LEDGER.record) LEDGER.record('exp_fines', c.penalty);
                else if (STATE.ledger && STATE.ledger.yesterday) STATE.ledger.yesterday.exp_fines = (STATE.ledger.yesterday.exp_fines || 0) + c.penalty;
                STATE.finances.creditScore -= 50; 
                if (typeof NOTIFY !== 'undefined') NOTIFY.error('Срыв сроков поставки!', `Контракт провален. Штраф: $${formatMoney(c.penalty)}.`);
                STATE.contracts.active.splice(i, 1);
            }
        }
        if (Math.random() < 0.15 && STATE.contracts.available.length > 0) STATE.contracts.available.shift();
        if (Math.random() < 0.3) this.generateContract();
    }
};
