// Глобальное состояние игры
const STATE = {
    time: {
        day: 1
    },
    finances: {
        startCapital: 250000000, // Базовый уставной капитал для отчета
        balance: 250000000,
        creditScore: 2000,
        loans: [], 
        deposits: []
    },
    company: {
        businesses: [],
        inventory: {},
        warehouse: { level: 1 }
    },
    hr: {
        staff: {},
        trainingQueue: []
    },
    rnd: {
        unlocked: ['fab', 'farm3d', 'it_office', 'workshop'],
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