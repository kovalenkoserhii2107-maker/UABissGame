// Справочник ресурсов и производственных цепочек
const RECIPES = {
    // Ресурсы, которые могут лежать на складе
    RESOURCES: {
        // --- НОВЫЙ БЛОК: Агросектор и Пищевая промышленность (FMCG) ---
        grain:       { name: 'Зерно (Пшеница)', isRaw: true, volume: 0.5, basePrice: 1, dailyMarketPool: 50000 },
        vegetables:  { name: 'Свежие овощи и фрукты', isRaw: false, volume: 0.3, basePrice: 3, dailyMarketPool: 20000 },
        meat_raw:    { name: 'Сырое мясо', isRaw: true, volume: 0.4, basePrice: 6, dailyMarketPool: 10000 },
        milk_raw:    { name: 'Сырое молоко', isRaw: true, volume: 0.2, basePrice: 2, dailyMarketPool: 15000 },
        bakery:      { name: 'Хлеб и Выпечка', isRaw: false, volume: 0.2, basePrice: 5, dailyMarketPool: 15000 },
        canned_food: { name: 'Бакалея и Консервы', isRaw: false, volume: 0.2, basePrice: 10, dailyMarketPool: 8000 },

        // --- НОВЫЙ БЛОК: Легкая промышленность и Быт ---
        cotton:      { name: 'Хлопок / Ткань', isRaw: true, volume: 0.5, basePrice: 4, dailyMarketPool: 10000 },
        wood:        { name: 'Древесина / Доски', isRaw: true, volume: 2.0, basePrice: 5, dailyMarketPool: 8000 },
        chemicals:   { name: 'Хим. реагенты', isRaw: true, volume: 0.2, basePrice: 8, dailyMarketPool: 5000 },
        
        detergent:   { name: 'Бытовая химия', isRaw: false, volume: 0.3, basePrice: 15, dailyMarketPool: 5000 },
        clothing:    { name: 'Одежда (Масс-маркет)', isRaw: false, volume: 0.5, basePrice: 35, dailyMarketPool: 3000 },
        toys:        { name: 'Детские игрушки', isRaw: false, volume: 0.8, basePrice: 25, dailyMarketPool: 4000 },
        furniture:   { name: 'Мебель (Эконом)', isRaw: false, volume: 4.0, basePrice: 120, dailyMarketPool: 500 },

        // --- TIER 1: Сырьевая база (Милитари / Тех) ---
        plastic:  { name: 'ABS Пластик', isRaw: true, volume: 0.2, basePrice: 2, dailyMarketPool: 10000 },
        glass:    { name: 'Стекло (Оптика)', isRaw: true, volume: 0.3, basePrice: 3, dailyMarketPool: 8000 },
        silicon:  { name: 'Кремний (Тех.)', isRaw: true, volume: 0.1, basePrice: 5, dailyMarketPool: 5000 },
        copper:   { name: 'Медь (Прокат)', isRaw: true, volume: 0.2, basePrice: 6, dailyMarketPool: 4000 },
        aluminum: { name: 'Алюминий', isRaw: true, volume: 0.4, basePrice: 8, dailyMarketPool: 4000 },
        lithium:  { name: 'Литий', isRaw: true, volume: 0.1, basePrice: 12, dailyMarketPool: 2000 },

        // --- TIER 2: Базовые компоненты ---
        parts3d:  { name: '3D Детали', isRaw: false, volume: 1.0, basePrice: 12, dailyMarketPool: 1000 },
        optics:   { name: 'Оптика', isRaw: false, volume: 0.5, basePrice: 18, dailyMarketPool: 800 },
        chips:    { name: 'Микросхемы', isRaw: false, volume: 0.1, basePrice: 25, dailyMarketPool: 600 },
        motors:   { name: 'Сервоприводы', isRaw: false, volume: 0.5, basePrice: 35, dailyMarketPool: 400 },
        batteries:{ name: 'Аккумуляторы', isRaw: false, volume: 0.4, basePrice: 40, dailyMarketPool: 300 },

        // --- TIER 3: Сложные узлы и IT ---
        camera_mod:{ name: 'Модуль камеры', isRaw: false, volume: 0.2, basePrice: 60, dailyMarketPool: 150 },
        drops:     { name: 'Системы сброса', isRaw: false, volume: 1.5, basePrice: 80, dailyMarketPool: 100 },
        software:  { name: 'ПО (Лицензия)', isRaw: false, volume: 0, basePrice: 200, dailyMarketPool: 999999 },
        ai_core:   { name: 'ШІ-Ядро', isRaw: false, volume: 0, basePrice: 600, dailyMarketPool: 999999 },

        // --- TIER 4: Готовая продукция ---
        smart_pc:  { name: 'Смарт-электроника (ПК)', isRaw: false, volume: 0.5, basePrice: 280, isEquipment: true, dailyMarketPool: 100 },
        mil_radio: { name: 'Военная рация (РЭБ)', isRaw: false, volume: 1.0, basePrice: 350, dailyMarketPool: 50 },
        drones:    { name: 'FPV-Дроны', isRaw: false, volume: 3.0, basePrice: 450, dailyMarketPool: 30 },
        drones_ai: { name: 'Дроны с автозахватом', isRaw: false, volume: 3.5, basePrice: 1500, dailyMarketPool: 5 },

        // --- TIER 5: Капитальное оборудование ---
        retail_display: { name: 'Торговая витрина', isRaw: false, volume: 3.0, basePrice: 800, isEquipment: true, dailyMarketPool: 10 },
        server_rack:    { name: 'Серверная стойка', isRaw: false, volume: 2.0, basePrice: 1500, isEquipment: true, dailyMarketPool: 5 },
        machine_tool:   { name: 'Промышленный станок', isRaw: false, volume: 5.0, basePrice: 2500, isEquipment: true, dailyMarketPool: 5 }
    },

    // Матрица бизнесов
    BUSINESSES: {
        // -- FMCG И ПОТРЕБИТЕЛЬСКИЙ СЕКТОР (Снабжение розницы) --
        bakery_fab: { 
            name: 'Пекарня (Хлебозавод)', area: 120, inputs: { grain: 2 }, output: 'bakery', staffReq: 2,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 30, researchCost: 0
        },
        canned_fab: { 
            name: 'Мясокомбинат / Консервы', area: 180, inputs: { meat_raw: 1, vegetables: 1 }, output: 'canned_food', staffReq: 3,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 15, researchCost: 400
        },
        textile_fab: { 
            name: 'Швейная фабрика (Одежда)', area: 150, inputs: { cotton: 2, chemicals: 1 }, output: 'clothing', staffReq: 4,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 10, researchCost: 300
        },
        detergent_fab: { 
            name: 'Химкомбинат бытовой химии', area: 160, inputs: { chemicals: 2, plastic: 1 }, output: 'detergent', staffReq: 3,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 15, researchCost: 350
        },
        furniture_fab: { 
            name: 'Мебельная фабрика', area: 250, inputs: { wood: 2, plastic: 1 }, output: 'furniture', staffReq: 4,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 4, researchCost: 500
        },

        // -- TIER 2 FACTORIES --
        parts3d: { 
            name: 'Фабрика 3D-печати', area: 150, inputs: { plastic: 2 }, output: 'parts3d', staffReq: 2,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 20, researchCost: 0
        },
        optics_fab: { 
            name: 'Оптический завод', area: 200, inputs: { glass: 2, plastic: 1 }, output: 'optics', staffReq: 3,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 15, researchCost: 500
        },
        microchips: { 
            name: 'Завод микросхем', area: 200, inputs: { silicon: 1, plastic: 1, copper: 1 }, output: 'chips', staffReq: 4,
            equipmentType: 'machine_tool', slotsPerLevel: 10, outputPerMachine: 10, researchCost: 800
        },
        motor_fab: { 
            name: 'Сборка сервоприводов', area: 200, inputs: { aluminum: 1, copper: 1 }, output: 'motors', staffReq: 3,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 10, researchCost: 800
        },
        battery_fab: { 
            name: 'Химический цех (АКБ)', area: 250, inputs: { lithium: 1, copper: 1, plastic: 1 }, output: 'batteries', staffReq: 4,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 8, researchCost: 1000
        },

        // -- TIER 3 FACTORIES --
        camera_fab: { 
            name: 'Сборка оптоэлектроники', area: 200, inputs: { optics: 1, chips: 1 }, output: 'camera_mod', staffReq: 5,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 5, researchCost: 1200
        },
        drops_fab: { 
            name: 'Сборка систем сброса', area: 100, inputs: { parts3d: 1, motors: 1 }, output: 'drops', staffReq: 3,
            equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 10, researchCost: 1000
        },
        software: { 
            name: 'IT-Компания (ПО)', area: 300, inputs: {}, output: 'software', staffReq: 6,
            equipmentType: 'server_rack', slotsPerLevel: 20, outputPerMachine: 5, researchCost: 1500
        },
        ai_lab: { 
            name: 'Лаборатория ИИ', area: 300, inputs: { software: 2 }, output: 'ai_core', staffReq: 8,
            equipmentType: 'server_rack', slotsPerLevel: 10, outputPerMachine: 2, researchCost: 4000
        },

        // -- TIER 4 FACTORIES --
        pc_assembly: {
            name: 'Завод электроники (ПК)', area: 300, inputs: { chips: 3, parts3d: 2, aluminum: 1 }, output: 'smart_pc',
            staffReq: 5, equipmentType: 'machine_tool', slotsPerLevel: 10, outputPerMachine: 4, researchCost: 2000
        },
        radio_assembly: {
            name: 'Сборка систем связи', area: 300, inputs: { chips: 2, plastic: 1, software: 1 }, output: 'mil_radio',
            staffReq: 5, equipmentType: 'machine_tool', slotsPerLevel: 8, outputPerMachine: 3, researchCost: 2500
        },
        drones: { 
            name: 'Сборка FPV-дронов', area: 400, inputs: { parts3d: 1, motors: 4, batteries: 1, camera_mod: 1 }, output: 'drones',
            staffReq: 8, equipmentType: 'machine_tool', slotsPerLevel: 15, outputPerMachine: 5, researchCost: 3000
        },
        drones_ai_fab: { 
            name: 'Оборонный завод (ШІ-Дроны)', area: 600, inputs: { drones: 1, ai_core: 1 }, output: 'drones_ai',
            staffReq: 10, equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 2, researchCost: 6000
        },

        // -- TIER 5 FACTORIES (Оборудование) --
        display_factory: {
            name: 'Завод торг. оборудования', area: 250, inputs: { plastic: 5, aluminum: 2, smart_pc: 1 }, output: 'retail_display',
            staffReq: 5, equipmentType: 'machine_tool', slotsPerLevel: 10, outputPerMachine: 2, researchCost: 2500
        },
        server_assembly: {
            name: 'Завод серверных систем', area: 400, inputs: { aluminum: 5, chips: 10, copper: 5 }, output: 'server_rack',
            staffReq: 8, equipmentType: 'machine_tool', slotsPerLevel: 8, outputPerMachine: 1, researchCost: 3500
        },
        heavy_machinery: { 
            name: 'Машиностроительный завод', area: 600, inputs: { aluminum: 10, motors: 5, chips: 3 }, output: 'machine_tool',
            staffReq: 10, equipmentType: 'machine_tool', slotsPerLevel: 5, outputPerMachine: 1, researchCost: 5000
        },

        // -- СПЕЦИАЛЬНЫЕ АКТИВЫ (Ритейл и Маркетинг) --
        retail_store: {
            name: 'Фирменный магазин', area: 100, inputs: {}, output: 'none',
            // ДОБАВЛЕНЫ НОВЫЕ ПОТРЕБИТЕЛЬСКИЕ ТОВАРЫ ДЛЯ ПРОДАЖИ!
            accepts: ['vegetables', 'bakery', 'canned_food', 'detergent', 'clothing', 'toys', 'furniture', 'smart_pc', 'software', 'camera_mod', 'optics', 'drones'], 
            staffReq: 4, equipmentType: 'retail_display', slotsPerLevel: 5, isRetail: true, researchCost: 0 
        },
        marketing_agency: {
            name: 'Отдел Маркетинга', area: 150, inputs: {}, output: 'none', 
            staffReq: 5, equipmentType: 'smart_pc', 
            slotsPerLevel: 5, isMarketing: true, researchCost: 0 
        }
    }
};
