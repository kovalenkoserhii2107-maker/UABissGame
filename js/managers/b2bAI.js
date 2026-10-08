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

    allowedItems: ['bakery', 'canned_food', 'clothing', 'smart_pc', 'furniture', 'drones', 'toys'],

    generateOffers() {
        if (!STATE.b2bOffers) STATE.b2bOffers = [];
        if (STATE.market.lastOffersDay !== undefined && STATE.time.day - STATE.market.lastOffersDay < 7) return false;
        STATE.market.lastOffersDay = STATE.time.day;

        STATE.b2bOffers = STATE.b2bOffers.filter(o => !o.accepted && o.expiresDay >= STATE.time.day);

        let numOffers = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < numOffers; i++) {
            let comp = this.competitors[Math.floor(Math.random() * this.competitors.length)];
            let itemId = this.allowedItems[Math.floor(Math.random() * this.allowedItems.length)];
            let basePrice = MARKET.prices[itemId] || 10;

            let quality = (1.5 + Math.random() * 1.5).toFixed(1);
            let pricePremium = 1.1 + (Math.random() * 0.2);
            let price = Math.ceil(basePrice * parseFloat(quality) * pricePremium);

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
        return true;
    },

    acceptOffer(offerId) {
        let offer = STATE.b2bOffers.find(o => o.id === offerId);
        if (!offer || offer.accepted || offer.expiresDay < STATE.time.day) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Ошибка', 'Контракт не найден или уже закрыт.');
            return;
        }

        if (STATE.finances.balance < offer.totalPrice) {
            if (typeof NOTIFY !== 'undefined') NOTIFY.error('Нет средств', 'Недостаточно денег для выкупа контракта!');
            return;
        }

        const cityId = document.getElementById('b2b-target-city')?.value;
        const citiesWithWh = Object.keys(STATE.company.warehouses).filter(id => STATE.company.warehouses[id].level > 0 && WAREHOUSE.freeSpace(id) >= offer.qty * OPERATIONS.volume(offer.itemId));
        const targetCity = citiesWithWh.includes(cityId) ? cityId : citiesWithWh[0];
        if (!targetCity) { NOTIFY.error('Нет места', 'Откройте или расширьте склад для этой партии.'); return false; }
        const logCost = GEO.getLogisticsCost('kyiv', targetCity, offer.qty * OPERATIONS.volume(offer.itemId), 'market');
        if (!OPERATIONS.quantity(offer.qty) || !Number.isFinite(offer.totalPrice) || offer.totalPrice <= 0 || STATE.finances.balance < offer.totalPrice + logCost) return false;
        LEDGER.cash(-offer.totalPrice - logCost, RECIPES.RESOURCES[offer.itemId].isEquipment ? 'investing' : 'operating', 'Покупка у NPC');
        // Товар становится активом на складе. В расходы (P&L) он пойдет только при фактической продаже.

        if (!STATE.logistics) STATE.logistics = { deliveries: [], receivables: [] };

        STATE.logistics.deliveries.push({
            id: 'del_' + OPERATIONS.id(),
            item: offer.itemId,
            qty: offer.qty,
            cost: offer.totalPrice,
            logCost,
            totalCost: offer.totalPrice + logCost,
            targetCity: targetCity,
            daysLeft: 1,
            isMarketOrder: false,
            quality: offer.quality,
            brand: offer.brandPower
        });

        offer.accepted = true;
        if (typeof NOTIFY !== 'undefined') NOTIFY.success('Контракт подписан!', `Груз направляется на склад в ${GEO.getCity(targetCity).name}.`);

        if (typeof UI_DASHBOARD !== 'undefined') {
            UI_DASHBOARD.update();
        }
    },

    autoGenerate() {
        if (!this.generateOffers()) NOTIFY.info('Предложения уже получены', 'Новые предложения доступны раз в 7 дней.');
        const modal = document.getElementById('b2b-sync-modal');
        if (modal) modal.style.display = 'none';
        UI_DASHBOARD.update();
    },

    simulateMarketActions() {
        if (typeof MARKET === 'undefined' || typeof RECIPES === 'undefined' || !STATE.market || !STATE.market.pools) return;

        let marketLog = [];

        this.competitors.forEach(comp => {
            // 1. Поведение: Выкуп сырья с рынка (если цена упала ниже базовой)
            let rawItems = Object.keys(RECIPES.RESOURCES).filter(k => RECIPES.RESOURCES[k].isRaw);
            let targetRaw = rawItems[Math.floor(Math.random() * rawItems.length)];

            let basePriceRaw = RECIPES.RESOURCES[targetRaw].basePrice;
            let currentPriceRaw = MARKET.getCurrentPrice(targetRaw);

            if (currentPriceRaw < basePriceRaw * 0.95 && STATE.market.pools[targetRaw] > 100) {
                // ИИ выкупает 10-30% пула, создавая дефицит
                let buyAmount = Math.floor(STATE.market.pools[targetRaw] * (0.1 + Math.random() * 0.2));
                if (buyAmount > 0) {
                    STATE.market.pools[targetRaw] -= buyAmount;
                    if (Math.random() < 0.05) marketLog.push(`${comp.name} массово выкупает "${RECIPES.RESOURCES[targetRaw].name}" с биржи.`);
                }
            }

            // 2. Поведение: Демпинг готовой продукции (если цена высока)
            let finishedItems = Object.keys(RECIPES.RESOURCES).filter(k => !RECIPES.RESOURCES[k].isRaw && !RECIPES.RESOURCES[k].isEquipment);
            let targetFinished = finishedItems[Math.floor(Math.random() * finishedItems.length)];

            let basePriceFin = RECIPES.RESOURCES[targetFinished].basePrice;
            let currentPriceFin = MARKET.getCurrentPrice(targetFinished);

            if (currentPriceFin > basePriceFin * 1.05) {
                // ИИ выбрасывает товар на рынок, обваливая цену
                let dailyPool = RECIPES.RESOURCES[targetFinished].dailyMarketPool || 100;
                let dumpAmount = Math.floor(dailyPool * (0.5 + Math.random() * 1.5 * comp.tier));
                STATE.market.pools[targetFinished] = (STATE.market.pools[targetFinished] || 0) + dumpAmount;
                if (Math.random() < 0.05) marketLog.push(`${comp.name} устраивает демпинг товара "${RECIPES.RESOURCES[targetFinished].name}".`);
            }
        });

        if (marketLog.length > 0 && typeof NOTIFY !== 'undefined') {
            // Показываем максимум 1 сообщение в день, чтобы не спамить
            NOTIFY.info('Рыночная активность ИИ', marketLog[0]);
        }
    }

};

;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { B2B_AI };
}
