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

// UI Functions - לא משתנות
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

// Authentication Handlers
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmailInput').value;
    const password = document.getElementById('loginPasswordInput').value;
    await loginUser(email, password);
}

async function handleRegistration(e) {
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

    await registerUser(email, password);
}
// Core Authentication Functions
async function registerUser(email, password) {
    try {
        const response = await fetch('/api/registerUser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error registering user');
        }

        // רישום מוצלח - ביצוע התחברות
        await loginUser(email, password);
        
    } catch (error) {
        console.error('Error registering user:', error);
        alert(error.message);
    }
}

async function loginUser(email, password) {
    try {
        const response = await fetch('/api/loginUser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('אימייל או סיסמה שגויים');
        }

        const userData = await response.json();
        
        isLoggedIn = true;
        currentUser = userData;
        updateUIAfterAuth();
        closeAuthModal();
        saveUserToLocalStorage();
        
    } catch (error) {
        alert(error.message);
    }
}

function logout() {
    isLoggedIn = false;
    currentUser = null;
    updateUIAfterAuth();
    localStorage.removeItem('currentUser');
}

// UI Update Functions - לא משתנות
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
        
        updateGenerateButtonText();
    } else {
        if (authBtn) authBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (dashboardBtn) dashboardBtn.style.display = 'none';
        if (homePage) homePage.style.display = 'block';
        if (userDashboard) userDashboard.style.display = 'none';
        if (adminDashboard) adminDashboard.style.display = 'none';
    }
}
