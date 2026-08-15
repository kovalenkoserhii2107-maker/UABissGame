// Глобальное состояние игры
const STATE = {
    time: {
        day: 1
    },
    finances: {
        startCapital: 25000, // Стартовый капитал малого бизнеса ($25,000)
        balance: 25000,
        creditScore: 200,
        loans: [], 
        deposits: []
    },
    company: {
        businesses: [],
        warehouses: {},
        inventory: {},
        warehouse: null
    },
    retail: {
        brand: 5.0 // Стартовая узнаваемость бренда 5%
    },
    hr: {
        staff: {},
        trainingQueue: []
    },
    rnd: {
        unlocked: ['bakery_fab', 'parts3d'],
        activeProject: null,
        points: 0,
        staff: {}
    },
    contracts: {
        available: [],
        active: []
    },
    quests: {
        currentChapter: 1,
        completed: [],
        claimed: []
    },
    tutorial: {
        isActive: true,
        step: 0
    },
    ledger: null, // Инициализируется менеджером
    b2bOffers: [] // Контракты B2B от AI конкурентов
};
