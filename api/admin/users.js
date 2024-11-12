// api/admin/users.js
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please define MONGODB_URI environment variable');
}

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

async function checkAdminAuth(req) {
    if (!req.headers.authorization) {
        throw new Error('No authorization token');
    }

    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({
        email: req.headers['user-email'],
        isAdmin: true
    });

    if (!user) {
        throw new Error('Unauthorized');
    }

    return user;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Email');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await checkAdminAuth(req);
        const db = await connectToDatabase();

        switch (req.method) {
            case 'GET':
                // קבלת רשימת משתמשים עם פילטרים ומיון
                const { 
                    page = 1, 
                    limit = 50,
                    sort = 'email',
                    order = 'asc',
                    filter = ''
                } = req.query;

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const sortQuery = { [sort]: order === 'asc' ? 1 : -1 };
                
                const filterQuery = filter ? {
                    $or: [
                        { email: { $regex: filter, $options: 'i' } },
                        { name: { $regex: filter, $options: 'i' } }
                    ]
                } : {};

                const [users, total] = await Promise.all([
                    db.collection('users').find(filterQuery)
                        .sort(sortQuery)
                        .skip(skip)
                        .limit(parseInt(limit))
                        .toArray(),
                    db.collection('users').countDocuments(filterQuery)
                ]);

                return res.status(200).json({
                    users,
                    pagination: {
                        total,
                        pages: Math.ceil(total / parseInt(limit)),
                        currentPage: parseInt(page),
                        perPage: parseInt(limit)
                    }
                });

            case 'POST':
                // עדכון פרטי משתמש
                const { email, updates } = req.body;

                if (!email || !updates) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                // מניעת עדכון שדות רגישים
                delete updates.isAdmin;
                delete updates.password;

                const updateResult = await db.collection('users').findOneAndUpdate(
                    { email },
                    { 
                        $set: updates,
                        $push: {
                            updateHistory: {
                                timestamp: new Date(),
                                adminEmail: req.headers['user-email'],
                                changes: updates
                            }
                        }
                    },
                    { returnDocument: 'after' }
                );

                if (!updateResult.value) {
                    return res.status(404).json({ error: 'User not found' });
                }

                // רישום פעולת העדכון
                await db.collection('adminActions').insertOne({
                    timestamp: new Date(),
                    adminEmail: req.headers['user-email'],
                    action: 'UPDATE_USER',
                    targetUser: email,
                    changes: updates
                });

                return res.status(200).json(updateResult.value);

            case 'PUT':
                // עדכון קרדיטים
                const { userEmail, credits, reason } = req.body;

                if (!userEmail || typeof credits !== 'number') {
                    return res.status(400).json({ error: 'Invalid request data' });
                }

                const creditResult = await db.collection('users').findOneAndUpdate(
                    { email: userEmail },
                    {
                        $inc: { credits },
                        $push: {
                            creditHistory: {
                                date: new Date(),
                                action: 'עדכון קרדיטים ידני',
                                amount: credits,
                                reason,
                                adminEmail: req.headers['user-email']
                            }
                        }
                    },
                    { returnDocument: 'after' }
                );

                if (!creditResult.value) {
                    return res.status(404).json({ error: 'User not found' });
                }

                // רישום פעולת הקרדיטים
                await db.collection('adminActions').insertOne({
                    timestamp: new Date(),
                    adminEmail: req.headers['user-email'],
                    action: 'UPDATE_CREDITS',
                    targetUser: userEmail,
                    amount: credits,
                    reason
                });

                return res.status(200).json(creditResult.value);

            case 'DELETE':
                // השבתת משתמש (לא מחיקה פיזית)
                const { userToDeactivate } = req.body;

                if (!userToDeactivate) {
                    return res.status(400).json({ error: 'Missing user email' });
                }

                const deactivateResult = await db.collection('users').findOneAndUpdate(
                    { email: userToDeactivate },
                    { 
                        $set: { 
                            isActive: false,
                            deactivatedAt: new Date(),
                            deactivatedBy: req.headers['user-email']
                        }
                    },
                    { returnDocument: 'after' }
                );

                if (!deactivateResult.value) {
                    return res.status(404).json({ error: 'User not found' });
                }

                // רישום פעולת ההשבתה
                await db.collection('adminActions').insertOne({
                    timestamp: new Date(),
                    adminEmail: req.headers['user-email'],
                    action: 'DEACTIVATE_USER',
                    targetUser: userToDeactivate
                });

                return res.status(200).json(deactivateResult.value);

            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Admin users error:', error);
        
        if (error.message === 'Unauthorized') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
