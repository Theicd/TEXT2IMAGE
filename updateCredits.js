// updateCredits.js
const connectToDatabase = require('./dbConnection');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, amount } = req.body;

  if (!email || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    // עדכון הקרדיטים של המשתמש
    const result = await usersCollection.findOneAndUpdate(
      { email: email },
      { $inc: { credits: amount } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'Credits updated successfully', user: result.value });
  } catch (error) {
    console.error('Error updating credits:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
