async function generateImage(prompt) {
    console.log('התחלת תהליך יצירת תמונה');

    try {
        // קריאה לפונקציית serverless בשרת שלנו
        const response = await fetch('/api/generateImage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        console.log('התקבלה תשובה מהשרת:', response.status);

        // בדיקת שגיאות
        if (!response.ok) {
            const errorText = await response.text();
            console.error('שגיאת שרת:', errorText);
            throw new Error('שגיאה בקריאה לפונקציה צד שרת');
        }

        // קריאת התשובה
        const data = await response.json();
        console.log('תוכן התשובה:', data);

        // בדיקה שהתקבל URL
        if (!data.data || !data.data[0] || !data.data[0].url) {
            throw new Error('לא התקבל URL לתמונה');
        }

        // החזרת ה-URL של התמונה
        return data.data[0].url;

    } catch (error) {
        console.error('שגיאה ביצירת תמונה:', error);
        throw error;
    }
}

// חשיפת הפונקציה לחלון הגלובלי
window.generateImage = generateImage;
