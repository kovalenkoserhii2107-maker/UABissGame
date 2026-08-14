// Глобальное состояние игры
const STATE = {
    time: {
        day: 1
    },
    finances: {
        startCapital: 25000, // Базовый уставной капитал для отчета
        balance: 25000,
        creditScore: 200,
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
