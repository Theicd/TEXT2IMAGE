// generateImage.js - עדכון לקובץ הקיים
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt, email } = req.body;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!OPENAI_API_KEY || !MONGODB_URI) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    let client;

    try {
        // חיבור למונגו
        client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db(process.env.MONGODB_DB || 'your_database_name');
        const usersCollection = db.collection('users');

        // בדיקת משתמש וקרדיטים
        const creditCost = 10;
        const user = await usersCollection.findOne({ email });

        if (!user) {
            throw new Error('User not found');
        }

        if (user.credits < creditCost) {
            throw new Error('Not enough credits');
        }

        // יצירת התמונה מול OpenAI
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: prompt,
                size: "1024x1024",
                n: 1
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();

        // עדכון קרדיטים והיסטוריה
        await usersCollection.updateOne(
            { email },
            {
                $inc: { credits: -creditCost },
                $push: {
                    creditHistory: {
                        date: new Date(),
                        action: 'יצירת תמונה',
                        amount: -creditCost,
                        prompt: prompt,
                        balance: user.credits - creditCost
                    }
                }
            }
        );

        res.status(200).json(data);

    } catch (error) {
        console.error('Error:', error);
        res.status(error.message.includes('User not found') ? 404 :
                  error.message.includes('Not enough credits') ? 402 : 500)
           .json({ error: error.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
};
