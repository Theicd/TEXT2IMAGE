let creditConversionRate = 50;
let services = [
    {
        id: 'image_1024',
        name: 'תמונה 1024x1024',
        supplierCost: 0.08,
        customerCost: 0.16,
        isActive: true,
        options: {
            size: '1024x1024',
            model: 'dall-e-3'
        }
    },
    {
        id: 'image_2048',
        name: 'תמונה 2048x2048',
        supplierCost: 0.16,
        customerCost: 0.32,
        isActive: true,
        options: {
            size: '2048x2048',
            model: 'dall-e-3'
        }
    }
];
let promos = [];

function loadDataFromStorage() {
    const savedData = localStorage.getItem('adminData');
    if (savedData) {
        const data = JSON.parse(savedData);
        creditConversionRate = data.creditConversionRate || 50;
        services = data.services || services;
        promos = data.promos || [];
    }
    saveDataToStorage();
}

function saveDataToStorage() {
    const dataToSave = {
        creditConversionRate: creditConversionRate,
        services: services,
        promos: promos
    };
    localStorage.setItem('adminData', JSON.stringify(dataToSave));
}

function loadAdminDashboard() {
    loadDataFromStorage();
    loadAdminStats();
    loadUserManagement();
    loadImageGenerationCostManagement();
    loadCreditConversion();
}

function loadAdminStats() {
    const adminStats = document.getElementById('adminStats');
    if (adminStats) {
        adminStats.innerHTML = `
            <p>סה"כ משתמשים: ${users.length}</p>
            <p>תמונות שנוצרו היום: ${calculateImagesCreatedToday()}</p>
            <p>סה"כ קרדיטים במערכת: ${calculateTotalCredits()}</p>
        `;
    }
}

function calculateImagesCreatedToday() {
    const today = new Date().toDateString();
    return users.reduce((total, user) => {
        return total + user.creditHistory.filter(entry => 
            entry.action.includes('יצירת תמונה') && new Date(entry.date).toDateString() === today
        ).length;
    }, 0);
}

function calculateTotalCredits() {
    return users.reduce((total, user) => total + user.credits, 0);
}

function loadUserManagement() {
    const userManagement = document.getElementById('userManagement');
    if (userManagement) {
        let userRows = '';
        users.forEach((user, index) => {
            userRows += `
                <tr>
                    <td>${user.email}</td>
                    <td>${user.credits}</td>
                    <td><button onclick="editUser('${user.email}')">ערוך</button></td>
                </tr>
            `;
        });
        userManagement.innerHTML = `
            <table>
                <tr><th>אימייל</th><th>קרדיטים</th><th>פעולות</th></tr>
                ${userRows}
            </table>
        `;
    }
}

function editUser(email) {
    const user = users.find(u => u.email === email);
    if (user) {
        const newCredits = prompt(`הזן מספר קרדיטים חדש עבור ${email}:`, user.credits);
        if (newCredits !== null && !isNaN(newCredits)) {
            user.credits = parseInt(newCredits);
            saveUsersToLocalStorage();
            loadUserManagement();
            alert(`הקרדיטים של ${email} עודכנו ל-${newCredits}`);
        }
    } else {
        alert(`משתמש עם האימייל ${email} לא נמצא`);
    }
}

function loadImageGenerationCostManagement() {
    const costManagement = document.getElementById('costManagement');
    if (costManagement) {
        costManagement.innerHTML = `
            <h3>ניהול שירותים ועלויות</h3>
            
            <div class="conversion-section">
                <h4>הגדרות המרת קרדיטים</h4>
                <div class="setting-group">
                    <label>קרדיטים לכל דולר:</label>
                    <input type="number" 
                           id="creditConversionRate" 
                           value="${creditConversionRate}" 
                           min="1">
                    <button onclick="updateConversionRate()">עדכן שער המרה</button>
                </div>
            </div>

            <div class="services-section">
                <h4>שירותים זמינים</h4>
                <table class="services-table">
                    <thead>
                        <tr>
                            <th>שירות</th>
                            <th>עלות ספק ($)</th>
                            <th>עלות לקוח ($)</th>
                            <th>מחיר בקרדיטים</th>
                            <th>סטטוס</th>
                            <th>פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${services.map(service => `
                            <tr>
                                <td>${service.name}</td>
                                <td>${service.supplierCost}</td>
                                <td>${service.customerCost}</td>
                                <td>${service.customerCost * creditConversionRate}</td>
                                <td>${service.isActive ? 'פעיל' : 'לא פעיל'}</td>
                                <td>
                                    <button onclick="editService('${service.id}')">ערוך</button>
                                    <button onclick="toggleService('${service.id}')">${service.isActive ? 'השבת' : 'הפעל'}</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button onclick="addNewService()" class="add-service-btn">הוסף שירות חדש</button>
            </div>
        `;
    }
}

function editService(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    const newData = {
        supplierCost: prompt('עלות ספק ($):', service.supplierCost),
        customerCost: prompt('עלות לקוח ($):', service.customerCost),
        name: prompt('שם השירות:', service.name)
    };

    if (newData.supplierCost && newData.customerCost && newData.name) {
        service.supplierCost = parseFloat(newData.supplierCost);
        service.customerCost = parseFloat(newData.customerCost);
        service.name = newData.name;
        saveDataToStorage();
        loadImageGenerationCostManagement();
        updateAllGenerateButtons();
    }
}

function toggleService(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (service) {
        service.isActive = !service.isActive;
        saveDataToStorage();
        loadImageGenerationCostManagement();
        updateAllGenerateButtons();
    }
}

function addNewService() {
    const newService = {
        id: 'service_' + Date.now(),
        name: prompt('שם השירות:'),
        supplierCost: parseFloat(prompt('עלות ספק ($):')),
        customerCost: parseFloat(prompt('עלות לקוח ($):')),
        isActive: true,
        options: {}
    };

    if (newService.name && !isNaN(newService.supplierCost) && !isNaN(newService.customerCost)) {
        services.push(newService);
        saveDataToStorage();
        loadImageGenerationCostManagement();
        updateAllGenerateButtons();
    } else {
        alert('נתונים לא תקינים');
    }
}

function updateConversionRate() {
    const newRate = parseInt(document.getElementById('creditConversionRate').value);
    if (!isNaN(newRate) && newRate > 0) {
        creditConversionRate = newRate;
        saveDataToStorage();
        loadImageGenerationCostManagement();
        updateAllGenerateButtons();
        alert('שער ההמרה עודכן בהצלחה');
    } else {
        alert('שער המרה לא תקין');
    }
}

function updateAllGenerateButtons() {
    const generateButtons = document.querySelectorAll('[id^="generateButton"]');
    generateButtons.forEach(button => {
        if (button) {
            const currentUser = getCurrentUser();
            const cost = getImageGenerationCost();
            if (currentUser) {
                button.textContent = `צור (${cost} קרדיטים) | קרדיטים: ${currentUser.credits}`;
            } else {
                button.textContent = `צור (${cost} קרדיטים)`;
            }
        }
    });
}

function loadCreditConversion() {
    const conversionRate = document.getElementById('conversionRate');
    if (conversionRate) conversionRate.value = creditConversionRate;
    loadPromos();
}

function calculateCredits() {
    const dollarAmount = document.getElementById('dollarAmount');
    const calculatedCredits = document.getElementById('calculatedCredits');
    const amount = parseFloat(dollarAmount.value);
    if (!isNaN(amount) && amount > 0) {
        let credits = amount * creditConversionRate;
        const applicablePromo = promos.find(p => p.amount <= amount);
        if (applicablePromo) {
            credits = applicablePromo.credits;
        }
        calculatedCredits.textContent = credits;
    } else {
        alert('סכום לא תקין.');
    }
}

function loadPromos() {
    const promoList = document.getElementById('promoList');
    if (promoList) {
        promoList.innerHTML = '';
        promos.forEach((promo, index) => {
            const li = document.createElement('li');
            li.textContent = `קנה ב-$${promo.amount}, קבל ${promo.credits} קרדיטים`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'הסר';
            removeBtn.onclick = () => removePromo(index);
            li.appendChild(removeBtn);
            promoList.appendChild(li);
        });
    }
}

function addPromo() {
    const promoAmount = document.getElementById('promoAmount');
    const promoCredits = document.getElementById('promoCredits');
    const amount = parseFloat(promoAmount.value);
    const credits = parseInt(promoCredits.value);
    if (!isNaN(amount) && !isNaN(credits) && amount > 0 && credits > 0) {
        promos.push({ amount, credits });
        loadPromos();
        saveDataToStorage();
        promoAmount.value = '';
        promoCredits.value = '';
    } else {
        alert('נתוני מבצע לא תקינים.');
    }
}

function removePromo(index) {
    promos.splice(index, 1);
    loadPromos();
    saveDataToStorage();
}

function getImageGenerationCost(size = '1024x1024') {
    const service = services.find(s => s.options.size === size && s.isActive);
    if (service) {
        return Math.round(service.customerCost * creditConversionRate);
    }
    // אם לא נמצא שירות פעיל, נחזיר ערך ברירת מחדל
    const defaultService = services[0];
    return Math.round(defaultService.customerCost * creditConversionRate);
}

function generateReport() {
    const reportContainer = document.getElementById('reportContainer');
    if (reportContainer) {
        const totalCreditsUsed = users.reduce((total, user) => 
            total + user.creditHistory.reduce((sum, entry) => sum + Math.abs(entry.amount), 0), 0);
        
        const imagesCreated = users.reduce((total, user) => 
            total + user.creditHistory.filter(entry => entry.action.includes('יצירת תמונה')).length, 0);

        reportContainer.innerHTML = `
            <h4>דוח שימוש בקרדיטים</h4>
            <p>סה"כ קרדיטים שנוצלו: ${totalCreditsUsed}</p>
            <p>סה"כ תמונות שנוצרו: ${imagesCreated}</p>
        `;
    }
}

// חשיפת פונקציות גלובליות
window.loadAdminDashboard = loadAdminDashboard;
window.editUser = editUser;
window.updateConversionRate = updateConversionRate;
window.calculateCredits = calculateCredits;
window.addPromo = addPromo;
window.removePromo = removePromo;
window.generateReport = generateReport;
window.getImageGenerationCost = getImageGenerationCost;
window.saveDataToStorage = saveDataToStorage;
window.editService = editService;
window.toggleService = toggleService;
window.addNewService = addNewService;
window.updateAllGenerateButtons = updateAllGenerateButtons;