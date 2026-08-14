// Глобальное состояние игры
const STATE = {
    time: {
        day: 1
    },
    finances: {
        startCapital: 250000, // Базовый уставной капитал для отчета ($250,000)
        balance: 250000,
        creditScore: 300,
        loans: [], 
        deposits: []
    },
    company: {
        businesses: [],
        inventory: {},
        warehouse: null
    },
    hr: {
        staff: {},
        trainingQueue: []
    },
    rnd: {
        unlocked: ['microchips', 'parts3d'],
        activeProject: null,
        points: 0,
        staff: {}
    },
    contracts: {
        available: [],
        active: []
    },
    ledger: null // Инициализируется менеджером
};
