import fetch from 'node-fetch';
import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt, email } = req.body;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!OPENAI_API_KEY) {
        console.error('Missing OpenAI API key');
        return res.status(500).json({ error: 'Missing OpenAI API key' });
    }

    if (!MONGODB_URI) {
        console.error('Missing MongoDB URI');
        return res.status(500).json({ error: 'Missing MongoDB URI' });
    }

    try {
        console.log('מתחילים קריאה ל-OpenAI API עם prompt:', prompt);

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
            const errorText = await response.text();
            console.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();

        // עדכון הקרדיטים של המשתמש במסד הנתונים
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('your_database_name'); // הכנס את שם מסד הנתונים שלך
        const usersCollection = db.collection('users');

        const creditCost = 10; // עלות הקרדיטים ליצירת תמונה
        const user = await usersCollection.findOne({ email: email });

        if (!user) {
            throw new Error('User not found');
        }

        if (user.credits < creditCost) {
            throw new Error('Not enough credits');
        }

        await usersCollection.updateOne({ email: email }, { $inc: { credits: -creditCost } });
        client.close();

        res.status(200).json(data);
    } catch (error) {
        console.error('שגיאה בקריאה ל-OpenAI:', error);
        res.status(500).json({ error: error.message });
    }
}
