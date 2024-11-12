// api/generateImage.js
import { MongoClient } from 'mongodb';

// MongoDB connection
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }

    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DATABASE_NAME || 'textToImage');
    cachedDb = db;
    return db;
}

// קבלת הגדרות מערכת
async function getSystemSettings(db) {
    const settings = await db.collection('settings').findOne({ type: 'adminSettings' });
    if (!settings) {
        return {
            creditConversionRate: 50,
            services: [
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
                }
            ]
        };
    }
    return settings;
}

// חישוב עלות התמונה
async function calculateImageCost(db, size = '1024x1024') {
    const settings = await getSystemSettings(db);
    const service = settings.services.find(s => 
        s.options.size === size && s.isActive
    );

    if (!service) {
        throw new Error('Service not available');
    }

    return Math.round(service.customerCost * settings.creditConversionRate);
}

// בדיקת קרדיטים והורדתם
async function validateAndDeductCredits(db, email, cost) {
    const result = await db.collection('users').findOneAndUpdate(
        {
            email,
            credits: { $gte: cost },
            isActive: true
        },
        {
            $inc: { credits: -cost },
            $push: {
                creditHistory: {
                    date: new Date(),
                    action: 'יצירת תמונה',
                    amount: -cost,
                    description: 'יצירת תמונה חדשה'
                }
            }
        },
        { returnDocument: 'after' }
    );

    if (!result.value) {
        const user = await db.collection('users').findOne({ email });
        if (!user) throw new Error('User not found');
        if (!user.isActive) throw new Error('User account is inactive');
        throw new Error('Insufficient credits');
    }

    return result.value;
}

// יצירת תמונה ב-OpenAI
async function generateOpenAIImage(prompt, size) {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "dall-e-3",
            prompt,
            size,
            n: 1
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
    }

    return await response.json();
}

// שמירת היסטוריית יצירת תמונות
async function saveGenerationHistory(db, data) {
    await db.collection('generationHistory').insertOne({
        ...data,
        createdAt: new Date()
    });
}

// הטיפול בבקשה
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, email, size = '1024x1024' } = req.body;

    if (!prompt || !email) {
        return res.status(400).json({
            error: 'Missing required fields',
            details: {
                prompt: !prompt ? 'Prompt is required' : null,
                email: !email ? 'Email is required' : null
            }
        });
    }

    let db;
    try {
        db = await connectToDatabase();

        // חישוב עלות
        const cost = await calculateImageCost(db, size);

        // בדיקת והורדת קרדיטים
        const user = await validateAndDeductCredits(db, email, cost);

        // יצירת התמונה
        let imageData;
        try {
            imageData = await generateOpenAIImage(prompt, size);
        } catch (error) {
            // החזרת קרדיטים במקרה של כשל
            await db.collection('users').updateOne(
                { email },
                {
                    $inc: { credits: cost },
                    $push: {
                        creditHistory: {
                            date: new Date(),
                            action: 'החזר קרדיטים',
                            amount: cost,
                            description: 'החזר עקב שגיאה ביצירת תמונה'
                        }
                    }
                }
            );
            throw error;
        }

        // שמירת היסטוריה
        await saveGenerationHistory(db, {
            email,
            prompt,
            imageUrl: imageData.data[0].url,
            size,
            cost,
            status: 'success'
        });

        // החזרת תשובה
        return res.status(200).json({
            success: true,
            data: imageData.data,
            credits: {
                used: cost,
                remaining: user.credits
            }
        });

    } catch (error) {
        console.error('Error generating image:', error);

        // שמירת היסטוריית שגיאות
        if (db) {
            await db.collection('errorLogs').insertOne({
                timestamp: new Date(),
                error: error.message,
                stack: error.stack,
                email,
                prompt,
                size
            });
        }

        // החזרת קוד שגיאה מתאים
        switch (error.message) {
            case 'User not found':
                return res.status(404).json({ error: 'User not found' });
            case 'Insufficient credits':
                return res.status(402).json({ error: 'Insufficient credits' });
            case 'User account is inactive':
                return res.status(403).json({ error: 'Account is inactive' });
            case 'Service not available':
                return res.status(503).json({ error: 'Service is currently unavailable' });
            default:
                if (error.message.includes('OpenAI API error')) {
                    return res.status(502).json({ error: 'Error generating image', details: error.message });
                }
                return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
