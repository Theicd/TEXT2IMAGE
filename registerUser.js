// registerUser.js
const connectToDatabase = require('./dbConnection');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    // בדוק אם המשתמש כבר קיים
    const existingUser = await usersCollection.findOne({ email: email });
    if (existingUser) {
      return res.status(200).json({ message: 'User already exists', user: existingUser });
    }

    // יצירת משתמש חדש
    const newUser = {
      email,
      credits: 100, // קרדיטים התחלתיים
      history: [],
    };

    await usersCollection.insertOne(newUser);
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
