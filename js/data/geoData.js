// Глобальный справочник гео-экономики: Страны и Города
const GEO = {
    // 1. СТРАНЫ И ИХ МАКРОЭКОНОМИКА
    COUNTRIES: {
        'ua': {
            name: 'Украина',
            currency: '$',
            // Налогообложение
            taxes: {
                corporate: 0.18,       // Налог на прибыль (18%)
                payroll: 0.22,         // Социальный взнос / налог на ФОТ (22%)
                vat: 0.20              // НДС / Розничный налог (20%)
            },
            // Внешняя торговля
            customs: {
                importDutyRaw: 0.05,       // Ввозная пошлина на базовое сырье (5%)
                importDutyEquip: 0.10,     // Ввозная пошлина на станки/оборудование (10%)
                importDutyFinished: 0.15   // Пошлина на готовую продукцию (15%)
            },
            // Покупательская способность рынка
            macro: {
                solvencyMult: 1.0,         // Базовый уровень платежеспособности
                logisticsBaseRate: 0.015    // Базовая стоимость логистики ($/км за м³)
            }
        }
        // Задел на будущее: сюда легко добавятся 'pl' (Польша), 'de' (Германия) и т.д.
    },

    // 2. ГОРОДА
    CITIES: {
        'kyiv': {
            id: 'kyiv',
            country: 'ua',
            name: 'Киев',
            population: 3000000,
            
            // Экономические коэффициенты
            rentMult: 1.5,         // Дорогая недвижимость (х1.5)
            salaryMult: 1.35,      // Высокие зарплаты сотрудников (х1.35)
            demandMult: 1.5,       // Высокий трафик и объем продаж (х1.5)
            
            // Координаты для расчета расстояний логистики (условная сетка X / Y)
            coords: { x: 50, y: 50 } 
        },
        'kharkiv': {
            id: 'kharkiv',
            country: 'ua',
            name: 'Харьков',
            population: 1400000,
            rentMult: 1.0,
            salaryMult: 1.0,
            demandMult: 1.1,
            coords: { x: 75, y: 45 }
        },
        'odesa': {
            id: 'odesa',
            country: 'ua',
            name: 'Одесса',
            population: 1000000,
            rentMult: 1.2,
            salaryMult: 1.1,
            demandMult: 1.25,      // Торгово-логистический хаб
            coords: { x: 45, y: 80 }
        },
        'dnipro': {
            id: 'dnipro',
            country: 'ua',
            name: 'Днепр',
            population: 1000000,
            rentMult: 1.1,
            salaryMult: 1.05,
            demandMult: 1.1,
            coords: { x: 65, y: 60 }
        },
        'lviv': {
            id: 'lviv',
            country: 'ua',
            name: 'Львов',
            population: 700000,
            rentMult: 1.3,         // Туристический центр, плотная застройка
            salaryMult: 1.15,
            demandMult: 1.05,
            coords: { x: 20, y: 48 }
        }
    },

    // 3. УТИЛИТЫ ДЛЯ БЫСТРОГО ДОСТУПА ИЗ ДРУГИХ МОДУЛЕЙ
    getCity(cityId) {
        return this.CITIES[cityId] || this.CITIES['odesa'];
    },

    getCountryByCity(cityId) {
        let city = this.getCity(cityId);
        return this.COUNTRIES[city.country] || this.COUNTRIES['ua'];
    },

    // Расчет расстояния между городами (в условных километрах)
    getDistance(cityIdA, cityIdB) {
        if (cityIdA === cityIdB) return 10; // Внутригородская доставка (10 км)
        let a = this.getCity(cityIdA).coords;
        let b = this.getCity(cityIdB).coords;
        // Евклидово расстояние масштабированное в км
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        return Math.round(Math.sqrt(dx * dx + dy * dy) * 10);
    },

    // НОВЫЙ МЕТОД: Универсальный расчет логистики
    getLogisticsCost(sourceCityId, targetCityId, volume, routeType, locMult = 1.0) {
        if (volume <= 0) return 0;
        let dist = 10;
        
        if (sourceCityId !== targetCityId) {
            // Межгородская логистика (реальное расстояние по координатам)
            dist = this.getDistance(sourceCityId, targetCityId);
        } else {
            // Внутригородская логистика
            if (routeType === 'market') {
                dist = 50; // Биржа (оптовые базы за городом)
            } else if (routeType === 'store') {
                if (locMult > 1.1) dist = 10;      // Центр (пробки, сложный подъезд)
                else if (locMult < 1.0) dist = 1;  // Пригород (рядом со складом)
                else dist = 5;                     // Спальный район
            } else if (routeType === 'factory') {
                dist = 10; // Заводы находятся в промзонах
            }
        }
        
        let countryObj = this.COUNTRIES[this.getCity(sourceCityId).country] || this.COUNTRIES['ua'];
        let baseRate = countryObj.macro.logisticsBaseRate || 0.015;
        
        return Number((dist * baseRate * volume).toFixed(2));
    }
};

// Для обратной совместимости, чтобы ничего не крашилось
window.CITIES = GEO.CITIES;
