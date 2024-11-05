// Override console.log to also display in the UI
const originalConsoleLog = console.log;
console.log = function() {
    originalConsoleLog.apply(console, arguments);
    
    let debugElement = document.getElementById('debug-output');
    if (!debugElement) {
        debugElement = document.createElement('div');
        debugElement.id = 'debug-output';
        debugElement.style.position = 'fixed';
        debugElement.style.bottom = '0';
        debugElement.style.left = '0';
        debugElement.style.width = '100%';
        debugElement.style.maxHeight = '200px';
        debugElement.style.overflowY = 'scroll';
        debugElement.style.backgroundColor = 'rgba(0,0,0,0.8)';
        debugElement.style.color = 'white';
        debugElement.style.fontFamily = 'monospace';
        debugElement.style.padding = '10px';
        debugElement.style.zIndex = '9999';
        document.body.appendChild(debugElement);
    }
    
    const logMessage = Array.from(arguments).join(' ');
    debugElement.innerHTML += `<div>${new Date().toISOString()} - ${logMessage}</div>`;
    debugElement.scrollTop = debugElement.scrollHeight;
};

function getImageGenerationCost() {
    const savedData = localStorage.getItem('adminData');
    if (savedData) {
        const data = JSON.parse(savedData);
        return Math.round((0.16 * data.creditConversionRate)); // 0.16 דולר * שער המרה
    }
    return 10; // ברירת מחדל
}

async function generateImage() {
    console.log('התחלת תהליך יצירת תמונה');
    if (!isUserLoggedIn()) {
        console.log('משתמש לא מחובר');
        alert('עליך להתחבר כדי ליצור תמונות');
        openAuthModal('login');
        return;
    }

    const promptInput = document.getElementById('promptInput');
    const generateButton = document.getElementById('generateButton');
    const imageGrid = document.getElementById('imageGrid');

    if (!promptInput || !generateButton || !imageGrid) {
        console.error('אחד או יותר מהאלמנטים הנדרשים חסרים בדף');
        alert('אירעה שגיאה בטעינת הדף. אנא רענן את הדף ונסה שוב.');
        return;
    }

    const prompt = promptInput.value.trim();
    if (prompt === '') {
        console.log('תיאור תמונה ריק');
        alert('אנא הזן תיאור לתמונה');
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
        console.error('לא ניתן לקבל את פרטי המשתמש הנוכחי');
        alert('אירעה שגיאה באימות המשתמש. אנא התנתק והתחבר מחדש.');
        return;
    }
    console.log('משתמש נוכחי:', currentUser.email);

    const cost = getImageGenerationCost();
    console.log('עלות יצירת תמונה:', cost);
    if (currentUser.credits < cost) {
        console.log('אין מספיק קרדיטים');
        alert('אין מספיק קרדיטים. אנא רכוש קרדיטים נוספים.');
        return;
    }

    // הוספת אינדיקטור טעינה
    const loadingIndicator = document.createElement('div');
    loadingIndicator.textContent = 'מייצר תמונה...';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.marginTop = '10px';
    generateButton.parentNode.insertBefore(loadingIndicator, generateButton.nextSibling);
    generateButton.disabled = true;

    try {
        console.log('מתחיל ליצור תמונה');

        // קריאה לפונקציית serverless שנמצאת ב-Vercel (api/generateImage)
        console.log('שולח בקשה ל-OpenAI דרך פונקציית צד שרת');
        const response = await fetch('/api/generateImage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error('שגיאה בקריאה לפונקציה צד שרת');
        }

        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].url) {
            const imageUrl = data.data[0].url;
            console.log('התקבלה תמונה:', imageUrl);

            // חיוב הקרדיטים רק לאחר שהתמונה נוצרה בהצלחה
            if (updateUserCredits(-cost)) {
                const creditAction = `יצירת תמונה: ${prompt}`;
                if (logCreditUsage(creditAction, -cost, true)) {
                    // יצירת אלמנטים חדשים לתמונה
                    const imageCard = document.createElement('div');
                    imageCard.className = 'image-card';

                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.alt = prompt;

                    const p = document.createElement('p');
                    p.textContent = prompt;

                    imageCard.appendChild(img);
                    imageCard.appendChild(p);

                    imageGrid.prepend(imageCard);
                    promptInput.value = '';
                    updateGenerateButtonText(); // עדכון הכפתור אחרי השימוש
                    alert('התמונה נוצרה בהצלחה!');
                }
            }
        } else {
            throw new Error('לא התקבל URL לתמונה');
        }
    } catch (error) {
        console.error('שגיאה ביצירת תמונה:', error);
        alert('אירעה שגיאה ביצירת התמונה: ' + error.message);
    } finally {
        // הסרת אינדיקטור הטעינה
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
        generateButton.disabled = false;
    }
}

function updateGenerateButtonText() {
    const generateButton = document.getElementById('generateButton');
    const cost = getImageGenerationCost();
    if (generateButton && isUserLoggedIn()) {
        const currentUser = getCurrentUser();
        generateButton.textContent = `צור (${cost} קרדיטים) | קרדיטים: ${currentUser.credits}`;
    } else if (generateButton) {
        generateButton.textContent = `צור (${cost} קרדיטים)`;
    }
}

function loadDataFromStorage() {
    // טעינת נתוני המערכת מה-localStorage
    const savedData = localStorage.getItem('adminData');
    if (savedData) {
        console.log('נטענו נתוני מערכת');
        updateGenerateButtonText(); // עדכון הכפתור בטעינה
    }
}

function openDashboard() {
    const homePage = document.getElementById('homePage');
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');

    if (homePage) homePage.style.display = 'none';
    
    if (isUserAdmin()) {
        if (adminDashboard) {
            adminDashboard.style.display = 'block';
            loadAdminDashboard();
        }
        if (userDashboard) userDashboard.style.display = 'none';
    } else {
        if (userDashboard) {
            userDashboard.style.display = 'block';
            loadUserDashboard();
        }
        if (adminDashboard) adminDashboard.style.display = 'none';
    }
}

function returnToHomePage() {
    const homePage = document.getElementById('homePage');
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');

    if (homePage) homePage.style.display = 'block';
    if (userDashboard) userDashboard.style.display = 'none';
    if (adminDashboard) adminDashboard.style.display = 'none';
    
    // עדכון כפתור היצירה בחזרה לדף הבית
    updateGenerateButtonText();
}

// אתחול המערכת בטעינת הדף
document.addEventListener('DOMContentLoaded', function() {
    // אתחול ניהול משתמשים
    initializeUserManagement();

    // אתחול נתוני המערכת
    loadDataFromStorage();

    // הגדרת אירועי לחיצה
    const generateButton = document.getElementById('generateButton');
    const authBtn = document.getElementById('authBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const homeButtons = document.querySelectorAll('.home-button');

    // הגדרת מאזיני אירועים
    if (generateButton) {
        generateButton.addEventListener('click', generateImage);
    }

    if (authBtn) {
        authBtn.addEventListener('click', () => openAuthModal('register'));
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', openDashboard);
    }

    // מאזין לחיצה על כפתורי "חזרה לדף הבית"
    homeButtons.forEach(button => {
        button.addEventListener('click', returnToHomePage);
    });

    // עדכון כפתור היצירה עם העלות הנוכחית
    updateGenerateButtonText();

    // אתחול מצב התחברות ראשוני
    checkInitialAuthState();
});

// חשיפת פונקציות גלובליות
window.returnToHomePage = returnToHomePage;
window.openDashboard = openDashboard;
window.updateGenerateButtonText = updateGenerateButtonText;
window.generateImage = generateImage;
window.getImageGenerationCost = getImageGenerationCost;
