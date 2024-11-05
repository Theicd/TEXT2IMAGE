// openai-service.js

const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateImageWithOpenAI(prompt) {
    console.log('התחלת קריאה ל-OpenAI');
    
    const requestBody = {
        model: "dall-e-3",
        prompt: prompt,
        size: "1024x1024",
        n: 1
    };

    try {
        // שליחת הבקשה ל-OpenAI
        const response = await fetch(OPENAI_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('התקבלה תשובה מ-OpenAI:', response.status);

        // בדיקת שגיאות
        if (!response.ok) {
            const errorText = await response.text();
            console.error('שגיאת API:', errorText);
            throw new Error('שגיאה בקריאה ל-OpenAI API');
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
        console.error('שגיאה:', error);
        throw error;
    }
}

// חשיפת הפונקציה לחלון הגלובלי
window.generateImageWithOpenAI = generateImageWithOpenAI;
