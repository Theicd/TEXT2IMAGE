// adminCreditManagement.js
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

// מטפל בטעינת נתונים ראשונית
async function initializeAdminData() {
    try {
        await loadDataFromDb();
    } catch (error) {
        console.error('Failed to load data from DB, using local storage:', error);
        loadDataFromStorage();
    }
}

// טוען נתונים מהשרת
async function loadDataFromDb() {
    const response = await fetch('/api/admin/settings');
    if (!response.ok) throw new Error('Failed to load settings');
    
    const data = await response.json();
    creditConversionRate = data.creditConversionRate || 50;
    services = data.services || services;
    promos = data.promos || [];
    
    saveDataToStorage(); // גיבוי מקומי
    return data;
}

// טוען נתונים מאחסון מקומי
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

// שומר נתונים לשרת
async function saveDataToDb() {
    const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creditConversionRate,
            services,
            promos
        })
    });

    if (!response.ok) throw new Error('Failed to save settings');
    
    saveDataToStorage();
    return await response.json();
}

// שומר נתונים לאחסון מקומי
function saveDataToStorage() {
    localStorage.setItem('adminData', JSON.stringify({
        creditConversionRate,
        services,
        promos
    }));
}

// טוען את לוח הבקרה של המנהל
async function loadAdminDashboard() {
    await initializeAdminData();
    
    const [statsData, usersData] = await Promise.all([
        loadAdminStats(),
        loadUserManagement()
    ]);

    loadImageGenerationCostManagement();
    loadCreditConversion();

    return { statsData, usersData };
}

// טוען סטטיסטיקות מנהל
async function loadAdminStats() {
    const response = await fetch('/api/admin/stats');
    if (!response.ok) throw new Error('Failed to load admin stats');
    
    const stats = await response.json();
    const adminStats = document.getElementById('adminStats');
    
    if (adminStats) {
        adminStats.innerHTML = `
            <div class="stat-box">
                <h3>סה"כ משתמשים</h3>
                <p>${stats.totalUsers}</p>
            </div>
            <div class="stat-box">
                <h3>תמונות שנוצרו היום</h3>
                <p>${stats.imagesCreatedToday}</p>
            </div>
            <div class="stat-box">
                <h3>סה"כ קרדיטים במערכת</h3>
                <p>${stats.totalCredits}</p>
            </div>
        `;
    }

    return stats;
}

// טוען ניהול משתמשים
async function loadUserManagement() {
    const response = await fetch('/api/admin/users');
    if (!response.ok) throw new Error('Failed to load users');
    
    const users = await response.json();
    const userManagement = document.getElementById('userManagement');
    
    if (userManagement) {
        userManagement.innerHTML = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>אימייל</th>
                        <th>קרדיטים</th>
                        <th>סטטוס</th>
                        <th>פעולות</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.email}</td>
                            <td>${user.credits}</td>
                            <td>${user.isActive ? 'פעיל' : 'לא פעיל'}</td>
                            <td>
                                <button onclick="editUser('${user.email}')">ערוך</button>
                                <button onclick="toggleUserStatus('${user.email}', ${!user.isActive})">
                                    ${user.isActive ? 'השבת' : 'הפעל'}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    return users;
}

// עריכת משתמש
async function editUser(email) {
    const newCredits = prompt(`הזן מספר קרדיטים חדש עבור ${email}:`);
    if (newCredits === null || isNaN(newCredits)) return;

    try {
        const response = await fetch('/api/admin/updateUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                credits: parseInt(newCredits)
            })
        });

        if (!response.ok) throw new Error('Failed to update user');

        await loadUserManagement();
        alert(`הקרדיטים של ${email} עודכנו בהצלחה`);
    } catch (error) {
        console.error('Error updating user:', error);
        alert('שגיאה בעדכון המשתמש');
    }
}

// טוען ניהול עלויות יצירת תמונה
function loadImageGenerationCostManagement() {
    const costManagement = document.getElementById('costManagement');
    if (!costManagement) return;

    costManagement.innerHTML = `
        <div class="cost-management">
            <h3>ניהול שירותים ועלויות</h3>
            
            <div class="conversion-section">
                <h4>הגדרות המרת קרדיטים</h4>
                <div class="setting-group">
                    <label>קרדיטים לכל דולר:</label>
                    <input type="number" id="creditConversionRate" 
                           value="${creditConversionRate}" min="1">
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
                                <td>${Math.round(service.customerCost * creditConversionRate)}</td>
                                <td>${service.isActive ? 'פעיל' : 'לא פעיל'}</td>
                                <td>
                                    <button onclick="editService('${service.id}')">ערוך</button>
                                    <button onclick="toggleService('${service.id}')">
                                        ${service.isActive ? 'השבת' : 'הפעל'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button class="add-service-btn" onclick="addNewService()">
                    הוסף שירות חדש
                </button>
            </div>
        </div>
    `;
}

// עדכון שער המרת קרדיטים
async function updateConversionRate() {
    const newRate = parseInt(document.getElementById('creditConversionRate').value);
    if (isNaN(newRate) || newRate <= 0) {
        alert('שער המרה לא תקין');
        return;
    }

    try {
        creditConversionRate = newRate;
        await saveDataToDb();
        loadImageGenerationCostManagement();
        updateAllGenerateButtons();
        alert('שער ההמרה עודכן בהצלחה');
    } catch (error) {
        console.error('Error updating conversion rate:', error);
        alert('שגיאה בעדכון שער ההמרה');
    }
}

// פונקציה מרכזית לחישוב עלות יצירת תמונה
function getImageGenerationCost(size = '1024x1024') {
    const service = services.find(s => s.options.size === size && s.isActive);
    if (!service) return null;

    return Math.round(service.customerCost * creditConversionRate);
}

// עדכון כל כפתורי היצירה
function updateAllGenerateButtons() {
    const generateButtons = document.querySelectorAll('[id^="generateButton"]');
    generateButtons.forEach(button => {
        if (button) {
            const currentUser = getCurrentUser();
            const cost = getImageGenerationCost();
            if (!cost) {
                button.disabled = true;
                button.textContent = 'השירות אינו זמין';
                return;
            }
            
            if (currentUser) {
                button.textContent = `צור (${cost} קרדיטים) | קרדיטים: ${currentUser.credits}`;
                button.disabled = currentUser.credits < cost;
            } else {
                button.textContent = `צור (${cost} קרדיטים)`;
            }
        }
    });
}

// חשיפת פונקציות גלובליות
window.loadAdminDashboard = loadAdminDashboard;
window.editUser = editUser;
window.updateConversionRate = updateConversionRate;
window.getImageGenerationCost = getImageGenerationCost;
window.updateAllGenerateButtons = updateAllGenerateButtons;
window.editService = editService;
window.toggleService = toggleService;
window.addNewService = addNewService;
