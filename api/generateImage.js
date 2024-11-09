import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt } = req.body;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        console.error('Missing OpenAI API key');
        return res.status(500).json({ error: 'Missing OpenAI API key' });
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
        res.status(200).json(data);
    } catch (error) {
        console.error('שגיאה בקריאה ל-OpenAI:', error);
        res.status(500).json({ error: error.message });
    }
}
