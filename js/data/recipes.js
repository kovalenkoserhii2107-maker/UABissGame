// Справочник ресурсов и производственных цепочек
const RECIPES = {
    // Ресурсы, которые могут лежать на складе
    // Справочник ресурсов (с учетом объема в м3)
    RESOURCES: {
        silicon: { name: 'Кремний', isRaw: true, volume: 0.1 },      // Мелкий порошок/слитки
        plastic: { name: 'ABS Пластик', isRaw: true, volume: 0.2 },  // Гранулы (занимают чуть больше места)
        chips: { name: 'Микросхемы', isRaw: false, volume: 0.1 },    // Коробки с чипами компактные
        parts3d: { name: '3D Детали', isRaw: false, volume: 1.0 },   // Объемный пластиковый корпус
        software: { name: 'ПО для дронов', isRaw: false, volume: 0 },// Цифровой товар (не занимает места на складе)
        drops: { name: 'Системы сброса', isRaw: false, volume: 1.5 },// Громоздкая механика
        drones: { name: 'FPV Дроны', isRaw: false, volume: 3.0 },     // Готовый собранный дрон в упаковке
        machine_tool: {
            name: 'Промышленный станок',
            basePrice: 2500, // Капитальное оборудование стоит дорого
            volume: 5.0,     // Занимает много места на складе (5 кубов)
            isRaw: false,
            isEquipment: true // Специальный флаг, чтобы в будущем отличать станки от сырья
        },
        server_rack: {
            name: 'Серверная стойка',
            basePrice: 1200,
            volume: 2.0,
            isRaw: false,
            isEquipment: true
        },
        pc_workstation: {
            name: 'Рабочая станция (ПК)',
            basePrice: 800,
            volume: 0.5,
            isRaw: false,
            isEquipment: true
        },
        retail_display: {
            name: 'Торговая витрина / Касса',
            basePrice: 1500,
            volume: 3.0,
            isRaw: false,
            isEquipment: true
        }
    },

    // Матрица бизнесов
    BUSINESSES: {
        microchips: { 
            name: 'Завод микросхем', area: 200, inputs: { silicon: 1, plastic: 1 }, output: 'chips', staffReq: 4,
            equipmentType: 'machine_tool', slotsPerLevel: 10, outputPerMachine: 10,
            researchCost: 0 // Базовый завод, доступен сразу
        },
        parts3d: { 
            name: 'Фабрика 3D-печати', area: 150, inputs: { plastic: 2 }, output: 'parts3d', staffReq: 2,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 20,
            researchCost: 0 // Базовый завод, доступен сразу
        },
        drops: { 
            name: 'Сборка систем сброса', area: 100, inputs: { plastic: 1, parts3d: 1 }, output: 'drops', staffReq: 3,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 15,
            researchCost: 500 // Требует исследований
        },
        software: { 
            name: 'IT-Компания (ПО)', area: 300, inputs: {}, output: 'software', staffReq: 6,
            equipmentType: 'server_rack', slotsPerLevel: 20, outputPerMachine: 5,
            researchCost: 1000 // Требует исследований
        },
        drones: { 
            name: 'Сборка FPV-дронов', area: 400, inputs: { chips: 1, drops: 1, software: 1 }, output: 'drones', staffReq: 8,
            equipmentType: 'machine_tool', slotsPerLevel: 15, outputPerMachine: 5,
            researchCost: 2500 // Требует исследований
        },
        // --- НОВЫЙ ЭНДГЕЙМ-ЗАВОД ---
        heavy_machinery: { 
            name: 'Машиностроительный завод', area: 600, 
            inputs: { silicon: 50, plastic: 20, chips: 10, parts3d: 5 }, // Огромное потребление сырья
            output: 'machine_tool', // Производит станки
            staffReq: 10, // Требует большого штата
            equipmentType: 'machine_tool', // Для производства станков тоже нужны станки!
            slotsPerLevel: 5, // Максимум 5 сборочных линий на уровень
            outputPerMachine: 1, // 1 сборочная линия делает 1 станок в день
            researchCost: 5000 // Высший тир исследований
        },
        // --- НОВЫЕ ВЫСОКОТЕХНОЛОГИЧНЫЕ ЗАВОДЫ ---
        pc_assembly: {
            name: 'Завод электроники (ПК)', area: 300,
            inputs: { chips: 3, plastic: 2, silicon: 1 }, // Легкая архитектура
            output: 'pc_workstation', // Производит ПК
            staffReq: 5,
            equipmentType: 'machine_tool', // Сборка идет на промышленных станках
            slotsPerLevel: 10,
            outputPerMachine: 4, // 1 сборочная линия выдает 4 ПК в день
            researchCost: 1500 // Средний тир
        },
        server_assembly: {
            name: 'Завод серверного оборудования', area: 400,
            inputs: { chips: 8, plastic: 4, parts3d: 2, silicon: 5 }, // Сложная сборка
            output: 'server_rack', // Производит Серверные стойки
            staffReq: 8,
            equipmentType: 'machine_tool', 
            slotsPerLevel: 8,
            outputPerMachine: 1, // 1 сборочная линия выдает 1 стойку в день
            researchCost: 3500 // Высокий тир
        },
        // --- НОВЫЙ БИЗНЕС: ПРОИЗВОДСТВО ТОРГОВОГО ОБОРУДОВАНИЯ ---
        display_factory: {
            name: 'Завод торгового оборудования', area: 250,
            inputs: { plastic: 10, chips: 2, silicon: 2 }, // Витрины со смарт-терминалами
            output: 'retail_display',
            staffReq: 5,
            equipmentType: 'machine_tool',
            slotsPerLevel: 10,
            outputPerMachine: 2,
            researchCost: 2000
        },
        // --- НОВЫЙ БИЗНЕС: РОЗНИЧНЫЙ МАГАЗИН (СИСТЕМА ЛОКАЦИЙ) ---
        retail_store: {
            name: 'Фирменный магазин', 
            area: 100, 
            inputs: {}, 
            output: 'none', 
            accepts: ['chips', 'parts3d', 'software', 'drops', 'drones'], // <--- НОВАЯ СТРОКА: Что можно продавать
            staffReq: 4, 
            equipmentType: 'retail_display', 
            slotsPerLevel: 5, 
            isRetail: true, 
            researchCost: 0 
        },
        // --- НОВЫЙ БИЗНЕС: ОТДЕЛ МАРКЕТИНГА ---
        marketing_agency: {
            name: 'Отдел Маркетинга', 
            area: 150,
            inputs: {}, 
            output: 'none', 
            staffReq: 5, 
            equipmentType: 'pc_workstation', // Требует ПК для маркетологов
            slotsPerLevel: 5,
            isMarketing: true, // Флаг для движка
            researchCost: 1500 // Требует изучения
        }
    }
};
