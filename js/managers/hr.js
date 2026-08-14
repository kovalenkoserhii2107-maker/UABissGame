// Модуль управления персоналом (HR)
const HR = {
    GRADES: {
        // Производственный персонал
        junior: { name: 'Junior (Сборщик)', role: 'factory', prodMult: 0.4, salary: 30, hireCost: 150 },
        middle: { name: 'Middle (Специалист)', role: 'factory', prodMult: 0.7, salary: 60, hireCost: 500 },
        senior: { name: 'Senior (Инженер)', role: 'factory', prodMult: 1.0, salary: 120, hireCost: 1500 },
        
        // Научный персонал (R&D)
        scientist: { name: 'Лаборант', role: 'rnd', rp: 3, salary: 150, hireCost: 800 },
        lead_scientist: { name: 'Ст. научный сотрудник', role: 'rnd', rp: 10, salary: 400, hireCost: 3000 },
        
        // --- НОВОЕ: Персонал Розничной сети (B2C) ---
        salesman: { name: 'Продавец-консультант', role: 'retail', prodMult: 1.0, salary: 40, hireCost: 200 },
        store_manager: { name: 'Директор магазина', role: 'retail', prodMult: 1.5, salary: 100, hireCost: 800 },

        // --- НОВОЕ: Персонал Маркетинга ---
        marketer: { name: 'Маркетолог (SMM)', role: 'marketing', bp: 2, salary: 80, hireCost: 600 },
        pr_manager: { name: 'PR-Менеджер', role: 'marketing', bp: 5, salary: 180, hireCost: 1500 }
    },

    init() {
        if (!STATE.hr) STATE.hr = { staff: {} };
        if (!STATE.hr.staff) STATE.hr.staff = {};
        if (!STATE.hr.trainingQueue) STATE.hr.trainingQueue = []; // Массив для обучающихся
    },

    hire(grade) {
        this.init();
        let cost = this.GRADES[grade].hireCost;
        if (STATE.finances.balance >= cost) {
            STATE.finances.balance -= cost;
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_hr', cost);
            if (!STATE.hr.staff[grade]) STATE.hr.staff[grade] = 0;
            
            STATE.hr.staff[grade]++;
            NOTIFY.success('Успех', `Нанят ${this.GRADES[grade].name}. Зачислен в кадровый резерв.`);
            UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', `Недостаточно средств (нужно $${formatMoney(cost)})`);
        }
    },

    fire(grade) {
        this.init();
        if (this.getUnassigned(grade) > 0) {
            let severancePay = this.GRADES[grade].salary * 2;
            STATE.finances.balance -= severancePay;
            if (typeof LEDGER !== 'undefined') LEDGER.record('exp_hr', severancePay);
            STATE.hr.staff[grade]--;
            NOTIFY.info('Уведомление', `Вы уволили специалиста. Выплачено выходное пособие: $${formatMoney(severancePay)}.`);
            UI_DASHBOARD.update();
        } else {
            NOTIFY.error('Ошибка', 'Нет свободных сотрудников для увольнения. Снимите их с объекта.');
        }
    },

    train(grade) {
        this.init();
        let nextGrade = null;
        let trainCost = 0;
        let trainDays = 0;
        
        // НОВАЯ ЭКОНОМИКА: Обучать дешево, но требует времени
        if (grade === 'junior') { nextGrade = 'middle'; trainCost = 250; trainDays = 3; }
        else if (grade === 'middle') { nextGrade = 'senior'; trainCost = 800; trainDays = 7; }
        else if (grade === 'scientist') { nextGrade = 'lead_scientist'; trainCost = 1500; trainDays = 10; }
        else if (grade === 'salesman') { nextGrade = 'store_manager'; trainCost = 600; trainDays = 5; }
        else if (grade === 'marketer') { nextGrade = 'pr_manager'; trainCost = 1200; trainDays = 8; }

        if (!nextGrade) return;

        if (this.getUnassigned(grade) > 0) {
            if (STATE.finances.balance >= trainCost) {
                STATE.finances.balance -= trainCost;
                if (typeof LEDGER !== 'undefined') LEDGER.record('exp_hr', trainCost);
                STATE.hr.staff[grade]--; // Забираем из штата
                
                // Помещаем в академию
                STATE.hr.trainingQueue.push({
                    fromGrade: grade,
                    toGrade: nextGrade,
                    daysLeft: trainDays,
                    salary: this.GRADES[grade].salary // Платим старую ЗП во время учебы
                });
                
                NOTIFY.info('Уведомление', `Сотрудник отправлен на курсы. Обучение займет ${trainDays} дн. (Стоимость курса: $${formatMoney(trainCost)}).`);
                UI_DASHBOARD.update();
            } else {
                NOTIFY.error('Ошибка', `Недостаточно средств на обучение (нужно $${formatMoney(trainCost)}).`);
            }
        } else {
            NOTIFY.error('Ошибка', 'Сотрудник занят на объекте. Отправьте его в резерв для начала учебы.');
        }
    },

    // Ежедневный прогресс обучения
    processDaily() {
        this.init();
        
        // Объект для сбора статистики по сегодняшним выпускникам
        let graduatedToday = {}; 

        // Идем с конца массива, чтобы безопасно удалять элементы
        for (let i = STATE.hr.trainingQueue.length - 1; i >= 0; i--) {
            let trainee = STATE.hr.trainingQueue[i];
            trainee.daysLeft--;
            
            if (trainee.daysLeft <= 0) {
                // Зачисляем в штат
                if (!STATE.hr.staff[trainee.toGrade]) STATE.hr.staff[trainee.toGrade] = 0;
                STATE.hr.staff[trainee.toGrade]++; 
                
                // Добавляем в счетчик для уведомления
                if (!graduatedToday[trainee.toGrade]) graduatedToday[trainee.toGrade] = 0;
                graduatedToday[trainee.toGrade]++;

                // Убираем из академии
                STATE.hr.trainingQueue.splice(i, 1); 
            }
        }

        // Если сегодня кто-то выпустился, показываем одно сводное окно
        let graduatedKeys = Object.keys(graduatedToday);
        if (graduatedKeys.length > 0) {
            let msgParts = [];
            graduatedKeys.forEach(grade => {
                let count = graduatedToday[grade];
                let gradeName = this.GRADES[grade].name.split(' ')[0]; // Берем только первое слово (Junior, Middle и т.д.)
                msgParts.push(`${gradeName}: ${count} чел.`);
            });
            
            NOTIFY.success('Успех', `Обучение завершено! В кадровый резерв поступили новые специалисты: ${msgParts.join(', ')}`);
        }
    },

    assignToBusiness(bizUid, grade) {
        this.init();
        if (!this.GRADES[grade]) return;

        if (this.getUnassigned(grade) > 0) {
            let biz = STATE.company.businesses.find(b => b.uid === bizUid);
            if (biz) {
                if (!biz.assigned) biz.assigned = {};
                
                let tpl = RECIPES.BUSINESSES[biz.type];
                let level = biz.level || 1; // Учитываем уровень объекта
                let maxStaff = tpl.staffReq * level;
                let assignedTotal = Object.values(biz.assigned).reduce((a, b) => a + (Number(b) || 0), 0);
                
                // Проверка: есть ли физическое место на объекте
                if (assignedTotal < maxStaff) {
                    biz.assigned[grade] = (biz.assigned[grade] || 0) + 1;
                    UI_DASHBOARD.update();
                } else {
                    NOTIFY.error('Ошибка', `На предприятии нет свободных мест! Максимум: ${maxStaff} чел. Расширьте площадь.`);
                }
            }
        } else {
            NOTIFY.error('Ошибка', 'В кадровом резерве нет свободных сотрудников этого грейда.');
        }
    },

    removeFromBusiness(bizUid, grade) {
        let biz = STATE.company.businesses.find(b => b.uid === bizUid);
        if (biz && biz.assigned && (biz.assigned[grade] || 0) > 0) {
            biz.assigned[grade]--;
            UI_DASHBOARD.update();
        }
    },

    getUnassigned(grade) {
        this.init();
        let totalOfGrade = STATE.hr.staff[grade] || 0;
        let assignedOfGrade = 0;
        
        // 1. Ищем сотрудников на ВСЕХ объектах (Заводы, Магазины, Офисы)
        STATE.company.businesses.forEach(biz => {
            if (biz.assigned && biz.assigned[grade]) {
                assignedOfGrade += biz.assigned[grade];
            }
        });

        // 2. Ищем ученых в Лаборатории (НИИ) - у них своя структура
        if (this.GRADES[grade].role === 'rnd') {
            if (STATE.rnd && STATE.rnd.staff && STATE.rnd.staff[grade]) {
                assignedOfGrade += STATE.rnd.staff[grade];
            }
        }
        
        return totalOfGrade - assignedOfGrade;
    },

    getTotalStaff() {
        this.init();
        let total = Object.values(STATE.hr.staff).reduce((a, b) => a + b, 0);
        total += STATE.hr.trainingQueue.length; // Плюсуем тех, кто на учебе
        return total;
    },

    getDailySalaryFund() {
        this.init();
        let total = 0;
        let assignedCounts = {};
        Object.keys(this.GRADES).forEach(g => assignedCounts[g] = 0);

        // ЗП сотрудников на объектах (с учетом регионального коэффициента)
        STATE.company.businesses.forEach(biz => {
            if (!biz.assigned) return;
            let cityId = biz.city || 'odesa';
            let cityMult = typeof GEO !== 'undefined' ? GEO.getCity(cityId).salaryMult : 1.0;
            
            Object.keys(biz.assigned).forEach(grade => {
                let count = biz.assigned[grade] || 0;
                if (count > 0 && this.GRADES[grade]) {
                    assignedCounts[grade] += count;
                    total += count * this.GRADES[grade].salary * cityMult;
                }
            });
        });

        // Ученые в НИИ (пока НИИ глобальный, считаем по базе или столице)
        if (STATE.rnd && STATE.rnd.staff) {
            Object.keys(STATE.rnd.staff).forEach(grade => {
                let count = STATE.rnd.staff[grade] || 0;
                if (count > 0 && this.GRADES[grade]) {
                    assignedCounts[grade] += count;
                    total += count * this.GRADES[grade].salary;
                }
            });
        }

        // ЗП резерва (свободные сотрудники сидят на базовой ставке)
        Object.keys(this.GRADES).forEach(g => {
            let totalOfGrade = STATE.hr.staff[g] || 0;
            let unassigned = totalOfGrade - assignedCounts[g];
            if (unassigned > 0) total += unassigned * this.GRADES[g].salary;
        });

        // ЗП студентов
        STATE.hr.trainingQueue.forEach(trainee => total += trainee.salary);

        return total;
    }
};
