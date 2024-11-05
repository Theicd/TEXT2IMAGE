let isLoggedIn = false;
let currentUser = null;
let users = [];

function initializeUserManagement() {
    loadUsersFromLocalStorage();
    checkInitialAuthState();
    setupAuthListeners();
}

function loadUsersFromLocalStorage() {
    const savedUsers = localStorage.getItem('users');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        users = [{
            email: 'admin@example.com',
            password: 'admin123',
            isAdmin: true,
            credits: 1000,
            creditHistory: []
        }];
        saveUsersToLocalStorage();
    }
}

function saveUsersToLocalStorage() {
    localStorage.setItem('users', JSON.stringify(users));
}

function setupAuthListeners() {
    const loginForm = document.getElementById('loginForm');
    const authForm = document.getElementById('authForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (authForm) authForm.addEventListener('submit', handleRegistration);
}

function openAuthModal(type) {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = "block";
    switchAuthTab(type);
}

function closeAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = "none";
}

function switchAuthTab(type) {
    const loginForm = document.getElementById('loginForm');
    const authForm = document.getElementById('authForm');
    const loginTab = document.querySelector('.auth-tab:nth-child(1)');
    const registerTab = document.querySelector('.auth-tab:nth-child(2)');

    if (type === 'login') {
        loginForm.style.display = 'flex';
        authForm.style.display = 'none';
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        authForm.style.display = 'flex';
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmailInput').value;
    const password = document.getElementById('loginPasswordInput').value;
    loginUser(email, password);
}

function handleRegistration(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    if (!validateEmail(email)) {
        alert('אנא הזן כתובת אימייל תקינה');
        return;
    }

    if (password.length < 8) {
        alert('הסיסמה חייבת להכיל לפחות 8 תווים');
        return;
    }

    if (password !== confirmPassword) {
        alert('הסיסמאות אינן תואמות');
        return;
    }

    registerUser(email, password);
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function registerUser(email, password) {
    if (users.some(user => user.email === email)) {
        alert('משתמש עם כתובת אימייל זו כבר קיים');
        return;
    }

    const newUser = {
        email: email,
        password: password,
        isAdmin: false,
        credits: 100,
        creditHistory: []
    };

    users.push(newUser);
    saveUsersToLocalStorage();
    loginUser(email, password);
}

function loginUser(email, password) {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        isLoggedIn = true;
        currentUser = user;
        updateUIAfterAuth();
        closeAuthModal();
        saveUserToLocalStorage();
    } else {
        alert('אימייל או סיסמה שגויים');
    }
}

function logout() {
    isLoggedIn = false;
    currentUser = null;
    updateUIAfterAuth();
    localStorage.removeItem('currentUser');
}

function updateUIAfterAuth() {
    const authBtn = document.getElementById('authBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const homePage = document.getElementById('homePage');
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');

    if (isLoggedIn) {
        if (authBtn) authBtn.style.display = 'none';
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-block';
            logoutBtn.textContent = `התנתקות (${currentUser.email})`;
        }
        if (dashboardBtn) {
            dashboardBtn.style.display = 'inline-block';
            dashboardBtn.textContent = currentUser.isAdmin ? 'לוח בקרה מנהל' : 'לוח בקרה';
        }
        
        if (homePage) homePage.style.display = 'block';
        if (userDashboard) userDashboard.style.display = 'none';
        if (adminDashboard) adminDashboard.style.display = 'none';
        
        const generateButton = document.getElementById('generateButton');
        if (generateButton) {
            const cost = getImageGenerationCost();
            generateButton.textContent = `צור (${cost}₪) | קרדיטים: ${currentUser.credits}`;
        }
    } else {
        if (authBtn) authBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (dashboardBtn) dashboardBtn.style.display = 'none';
        if (homePage) homePage.style.display = 'block';
        if (userDashboard) userDashboard.style.display = 'none';
        if (adminDashboard) adminDashboard.style.display = 'none';
    }
}

function initializeCreditHistoryTable() {
    const userDashboard = document.getElementById('userDashboard');
    if (!userDashboard) return;

    // ניקוי הטבלה הקיימת אם יש
    const existingTable = document.getElementById('creditHistoryTable');
    if (existingTable) {
        existingTable.remove();
    }

    // יצירת טבלה חדשה
    const table = document.createElement('table');
    table.id = 'creditHistoryTable';
    
    // יצירת כותרת הטבלה
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['תאריך', 'פעולה', 'קרדיטים', 'יתרה'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // יצירת גוף הטבלה
    const tbody = document.createElement('tbody');
    tbody.id = 'creditHistoryBody';
    table.appendChild(tbody);

    // הוספת הטבלה לדשבורד
    const historySection = document.createElement('div');
    historySection.className = 'history-section';
    historySection.innerHTML = '<h3>היסטוריית שימוש בקרדיטים:</h3>';
    historySection.appendChild(table);
    userDashboard.appendChild(historySection);
}

function logCreditUsage(action, amount, forceUpdate = false) {
    if (currentUser) {
        try {
            // בדיקה והכנת מערך ההיסטוריה
            if (!currentUser.creditHistory) {
                currentUser.creditHistory = [];
            }

            // יצירת רשומה חדשה
            const entry = {
                date: new Date().toLocaleString('he-IL'),
                action: action,
                amount: amount,
                balance: currentUser.credits
            };

            // הוספת הרשומה בתחילת המערך
            currentUser.creditHistory.unshift(entry);

            // עדכון המשתמש במערך המשתמשים
            const userIndex = users.findIndex(u => u.email === currentUser.email);
            if (userIndex !== -1) {
                users[userIndex] = currentUser;
                saveUsersToLocalStorage();
            }

            // שמירת המשתמש הנוכחי
            saveUserToLocalStorage();

            // עדכון התצוגה רק אם נדרש
            if (forceUpdate) {
                loadCreditHistory();
            }

            console.log('נרשמה פעולת קרדיט:', action, amount);
            return true;
        } catch (error) {
            console.error('שגיאה ברישום פעולת קרדיט:', error);
            return false;
        }
    }
    return false;
}

function loadCreditHistory() {
    const tbody = document.getElementById('creditHistoryBody');
    if (!tbody || !currentUser || !currentUser.creditHistory) {
        console.log('לא ניתן לטעון היסטוריה - נתונים חסרים');
        return;
    }

    // ניקוי הטבלה הקיימת
    tbody.innerHTML = '';
    
    // הוספת כל הרשומות
    currentUser.creditHistory.forEach(entry => {
        const row = document.createElement('tr');
        
        // תאריך
        const dateCell = document.createElement('td');
        dateCell.textContent = entry.date;
        row.appendChild(dateCell);
        
        // פעולה
        const actionCell = document.createElement('td');
        actionCell.textContent = entry.action;
        row.appendChild(actionCell);
        
        // סכום
        const amountCell = document.createElement('td');
        amountCell.textContent = entry.amount;
        amountCell.style.color = entry.amount < 0 ? 'red' : 'green';
        row.appendChild(amountCell);
        
        // יתרה
        const balanceCell = document.createElement('td');
        balanceCell.textContent = entry.balance;
        row.appendChild(balanceCell);
        
        tbody.appendChild(row);
    });
}

function updateUserCredits(amount) {
    if (currentUser) {
        // שמירת היתרה הקודמת
        const previousBalance = currentUser.credits;
        
        // עדכון הקרדיטים
        currentUser.credits += amount;
        console.log('עדכון קרדיטים:', amount, 'יתרה חדשה:', currentUser.credits);
        
        // עדכון המשתמש במערך המשתמשים
        const userIndex = users.findIndex(u => u.email === currentUser.email);
        if (userIndex !== -1) {
            users[userIndex] = currentUser;
            saveUsersToLocalStorage();
        }
        
        // שמירת המשתמש הנוכחי
        saveUserToLocalStorage();
        
        // עדכון התצוגה
        updateUserCreditsDisplay();
        
        return true;
    }
    return false;
}

function updateUserCreditsDisplay() {
    // עדכון תצוגת הקרדיטים בלוח הבקרה
    const creditBalance = document.getElementById('creditBalance');
    if (creditBalance) {
        creditBalance.textContent = currentUser.credits;
    }
    
    // עדכון תצוגת הקרדיטים בכפתור היצירה
    const generateButton = document.getElementById('generateButton');
    if (generateButton) {
        const cost = getImageGenerationCost();
        generateButton.textContent = `צור (${cost}₪) | קרדיטים: ${currentUser.credits}`;
    }
}

function loadUserDashboard() {
    console.log('טוען לוח בקרה למשתמש');
    const homePage = document.getElementById('homePage');
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');

    if (homePage) homePage.style.display = 'none';
    if (userDashboard) {
        userDashboard.style.display = 'block';
        // אתחול טבלת ההיסטוריה
        initializeCreditHistoryTable();
    }
    if (adminDashboard) adminDashboard.style.display = 'none';

    if (currentUser) {
        updateUserCreditsDisplay();
        loadCreditHistory();
    }
}

function checkInitialAuthState() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isLoggedIn = true;
        updateUIAfterAuth();
    }
}

function saveUserToLocalStorage() {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

function getCurrentUser() {
    return currentUser;
}

function isUserLoggedIn() {
    return isLoggedIn;
}

function isUserAdmin() {
    return isLoggedIn && currentUser.isAdmin;
}

// חשיפת פונקציות נחוצות באופן גלובלי
window.initializeUserManagement = initializeUserManagement;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegistration = handleRegistration;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.isUserLoggedIn = isUserLoggedIn;
window.isUserAdmin = isUserAdmin;
window.updateUserCredits = updateUserCredits;
window.logCreditUsage = logCreditUsage;
window.loadUserDashboard = loadUserDashboard;