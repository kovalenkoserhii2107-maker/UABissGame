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
        if (typeof NOTIFY !== 'undefined') NOTIFY.success('Контракт подписан!', `Груз направляется на склад в ${GEO.getCity(targetCity).name}.`);
        
        if (typeof UI_DASHBOARD !== 'undefined') {
            UI_DASHBOARD.updateTopPanel();
            if (typeof UI_DASHBOARD.updateB2BTab === 'function') UI_DASHBOARD.updateB2BTab();
        }
    },

    autoGenerate() {
        if(!STATE.b2bOffers) STATE.b2bOffers = [];
        
        // Удаляем старые, чтобы обновить полностью
        STATE.b2bOffers = STATE.b2bOffers.filter(o => o.accepted || o.expiresDay > STATE.time.day);
        
        // Генерируем новые контракты (4-6 штук)
        const possibleItems = typeof RECIPES !== 'undefined' ? Object.keys(RECIPES.RESOURCES) : ['grain', 'wood', 'oil'];
        const count = 4 + Math.floor(Math.random() * 3);
        
        for(let i = 0; i < count; i++) {
            let itemId = possibleItems[Math.floor(Math.random() * possibleItems.length)];
            let res = typeof RECIPES !== 'undefined' ? RECIPES.RESOURCES[itemId] : { basePrice: 10 };
            
            let corp = this.CORPORATIONS[Math.floor(Math.random() * this.CORPORATIONS.length)];
            let priceVar = 0.8 + Math.random() * 0.4; // Разброс цены 80-120%
            let price = Math.max(1, Math.round(res.basePrice * priceVar));
            let qty = 10 + Math.floor(Math.random() * 90);
            
            STATE.b2bOffers.push({
                id: 'b2b_sync_' + Date.now() + '_' + i,
                company: corp.name,
                itemId: itemId,
                qty: qty,
                price: price,
                totalPrice: qty * price,
                quality: (1.0 + Math.random() * 4.0).toFixed(1),
                brandName: corp.name,
                brandPower: corp.powerLevel,
                accepted: false,
                expiresDay: STATE.time.day + (3 + Math.floor(Math.random() * 5))
            });
        }
        
        // Закрываем модалку
        let modal = document.getElementById('b2b-sync-modal');
        if(modal) modal.style.display = 'none';
        
        if(typeof NOTIFY !== 'undefined') NOTIFY.success('ИИ-Стратегия применена', 'Сгенерированы уникальные контракты от мега-корпораций.');
        if(typeof UI_DASHBOARD !== 'undefined') UI_DASHBOARD.updateB2BTab();
    }

};

;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { B2B_AI };
}
