// =========================================================
// B2B_AI — Модуль симуляции ИИ-конкурентов
// Каждые 7 дней генерирует предложения оптовых партий продукции
// от других корпораций. Продукция имеет повышенное качество и силу бренда.
// =========================================================

const B2B_AI = {
    competitors: [
        { id: 'npc_1', name: 'Global Tech', brandMod: 3.5, tier: 3 },
        { id: 'npc_2', name: 'EcoFood Ukraine', brandMod: 2.5, tier: 2 },
        { id: 'npc_3', name: 'Steel & Co', brandMod: 3.0, tier: 3 },
        { id: 'npc_4', name: 'Kyiv Bread Prom', brandMod: 1.5, tier: 1 },
        { id: 'npc_5', name: 'Dnipro Textiles', brandMod: 2.0, tier: 2 },
        { id: 'npc_6', name: 'Lviv Craft Masters', brandMod: 4.0, tier: 2 },
        { id: 'npc_7', name: 'Odesa Trade Union', brandMod: 2.5, tier: 1 },
        { id: 'npc_8', name: 'Kharkiv Electronics', brandMod: 3.0, tier: 3 },
        { id: 'npc_9', name: 'AgroPlus', brandMod: 2.0, tier: 2 },
        { id: 'npc_10', name: 'Nova Chem', brandMod: 3.5, tier: 3 }
    ],

    allowedItems: ['bread', 'canned_food', 'clothes', 'electronics', 'furniture', 'drones', 'toys'],

    generateOffers() {
        if (!STATE.b2bOffers) STATE.b2bOffers = [];
        
        STATE.b2bOffers = STATE.b2bOffers.filter(o => o.accepted || o.expiresDay > STATE.time.day);

        let numOffers = 3 + Math.floor(Math.random() * 3); 

        for (let i = 0; i < numOffers; i++) {
            let comp = this.competitors[Math.floor(Math.random() * this.competitors.length)];
            let itemId = this.allowedItems[Math.floor(Math.random() * this.allowedItems.length)];
            let basePrice = MARKET.prices[itemId] || 10;
            
            let quality = (1.5 + Math.random() * 1.5).toFixed(1);
            let pricePremium = 1.1 + (Math.random() * 0.2); 
            let price = Math.round(basePrice * pricePremium);
            
            let qty = (50 * comp.tier) + Math.floor(Math.random() * 100 * comp.tier);

            STATE.b2bOffers.push({
                id: 'b2b_' + STATE.time.day + '_' + i,
                company: comp.name,
                itemId: itemId,
                qty: qty,
                price: price,
                totalPrice: qty * price,
                quality: parseFloat(quality),
                brandName: comp.name,
                brandPower: comp.brandMod,
                accepted: false,
                expiresDay: STATE.time.day + 6
            });
        }
        
        if (typeof NOTIFY !== 'undefined') {
            NOTIFY.info('B2B Предложения', 'Поступили новые контракты от конкурентов!');
        }
        
        if (typeof UI_DASHBOARD !== 'undefined' && typeof UI_DASHBOARD.updateB2BTab === 'function') {
            UI_DASHBOARD.updateB2BTab();
        }
    },

    acceptOffer(offerId) {
        let offer = STATE.b2bOffers.find(o => o.id === offerId);
        if (!offer || offer.accepted) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка', 'Контракт не найден или уже закрыт.');
            return;
        }

        if (STATE.finances.balance < offer.totalPrice) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Нет средств', 'Недостаточно денег для выкупа контракта!');
            return;
        }

        let citiesWithWh = Object.keys(STATE.company.warehouses);
        if (citiesWithWh.length === 0) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Нет складов', 'Для покупки товаров от конкурентов необходим хотя бы один логистический хаб (склад).');
            return;
        }

        let targetCity = citiesWithWh.includes('odesa') ? 'odesa' : citiesWithWh[0];

        STATE.finances.balance -= offer.totalPrice;
        if (typeof LEDGER !== 'undefined') {
            LEDGER.record('exp_materials', offer.totalPrice);
        }

        if (!STATE.logistics) STATE.logistics = { deliveries: [] };
        
        STATE.logistics.deliveries.push({
            id: 'del_' + Date.now(),
            itemId: offer.itemId,
            qty: offer.qty,
            cost: offer.totalPrice,
            from: 'B2B: ' + offer.company,
            to: targetCity,
            daysLeft: 1,
            meta: {
                quality: offer.quality,
                brandName: offer.brandName,
                brandPower: offer.brandPower
            }
        });

        offer.accepted = true;
        if (typeof NOTIFY !== 'undefined') NOTIFY.success('Контракт подписан!', `Груз направляется на склад в ${GEO[targetCity].name}.`);
        
        if (typeof UI_DASHBOARD !== 'undefined') {
            UI_DASHBOARD.updateTopPanel();
            if (typeof UI_DASHBOARD.updateB2BTab === 'function') UI_DASHBOARD.updateB2BTab();
        }
    },

    copyPrompt() {
        let promptText = `Я играю в бизнес-симулятор.
Текущий день: ${STATE.time.day}
Мой баланс: $${STATE.finances.balance}

Сгенерируй 4-6 новых контрактов от лица 10 NPC корпораций. 
Учитывай экономическую ситуацию. 
Верни строго ТОЛЬКО JSON-массив в формате:
[
  {
    "company": "Имя NPC (выбери из списка или придумай нового)",
    "itemId": "id ресурса (например grain, drones, electronics, toys, wood, meat_raw)",
    "qty": число_шт,
    "price": цена_за_штуку (должна быть конкурентной),
    "quality": качество_от_1_до_5,
    "brandPower": сила_бренда_от_1_до_5
  }
]`;
        let ta = document.getElementById('b2b-ai-prompt');
        if(ta) {
            ta.value = promptText;
            ta.select();
            document.execCommand('copy');
            if(typeof NOTIFY !== 'undefined') NOTIFY.success('Скопировано', 'Промпт скопирован в буфер обмена.');
        }
    },

    applySync() {
        let ta = document.getElementById('b2b-ai-response');
        if(!ta) return;
        
        try {
            let val = ta.value.trim();
            if(val.startsWith('\`\`\`json')) {
                val = val.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            }
            
            let data = JSON.parse(val);
            if(!Array.isArray(data)) throw new Error('Ожидался массив');
            
            if(!STATE.b2bOffers) STATE.b2bOffers = [];
            
            // Удаляем старые, чтобы обновить полностью
            STATE.b2bOffers = STATE.b2bOffers.filter(o => o.accepted || o.expiresDay > STATE.time.day);
            
            data.forEach((offer, i) => {
                STATE.b2bOffers.push({
                    id: 'b2b_sync_' + Date.now() + '_' + i,
                    company: offer.company || 'Unknown',
                    itemId: offer.itemId || 'grain',
                    qty: offer.qty || 10,
                    price: offer.price || 10,
                    totalPrice: (offer.qty || 10) * (offer.price || 10),
                    quality: offer.quality || 1.0,
                    brandName: offer.company || 'Unknown',
                    brandPower: offer.brandPower || 1.0,
                    accepted: false,
                    expiresDay: STATE.time.day + 7
                });
            });
            
            ta.value = '';
            document.getElementById('b2b-sync-modal').style.display = 'none';
            if(typeof NOTIFY !== 'undefined') NOTIFY.success('Синхронизация успешна', 'Новые контракты от ИИ добавлены на рынок.');
            
            if(typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.updateB2BTab();
            
        } catch(e) {
            if(typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка JSON', 'Неверный формат ответа от ИИ. Убедитесь, что там только валидный JSON.');
            console.error(e);
        }
    }

};

;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { B2B_AI };
}
