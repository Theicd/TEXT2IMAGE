// api/admin/settings.js
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

// מידלוור לבדיקת הרשאות מנהל
const checkAdminAuth = async (req) => {
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
};

export default async function handler(req, res) {
    // אפשר CORS בסביבת פיתוח
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Email');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await checkAdminAuth(req);
        const db = await connectToDatabase();

        switch (req.method) {
            case 'GET':
                const settings = await db.collection('settings').findOne({ type: 'adminSettings' });
                return res.status(200).json(settings || {
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
                        },
                        {
                            id: 'image_2048',
                            name: 'תמונה 2048x2048',
                            supplierCost: 0.16,
                            customerCost: 0.32,
                            isActive: true,
                            options: {
                                size: '2048x2048',
                                model: 'dall-e-3'
                            }
                        }
                    ],
                    promos: []
                });

            case 'POST':
                const { creditConversionRate, services, promos } = req.body;

                // וולידציה בסיסית
                if (!creditConversionRate || !Array.isArray(services)) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await db.collection('settings').findOneAndUpdate(
                    { type: 'adminSettings' },
                    {
                        $set: {
                            type: 'adminSettings',
                            creditConversionRate,
                            services,
                            promos: promos || [],
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true, returnDocument: 'after' }
                );

                // שמירת היסטוריית שינויים
                await db.collection('settingsHistory').insertOne({
                    timestamp: new Date(),
                    adminEmail: req.headers['user-email'],
                    changes: {
                        creditConversionRate,
                        services,
                        promos
                    }
                });

                return res.status(200).json(result.value);

            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Admin settings error:', error);
        
        if (error.message === 'Unauthorized') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// api/admin/stats.js
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await checkAdminAuth(req);
        const db = await connectToDatabase();

        // מביא את כל הסטטיסטיקות בשאילתה אחת
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stats = await db.collection('users').aggregate([
            {
                $facet: {
                    'totalUsers': [{ $count: 'count' }],
                    'totalCredits': [
                        { $group: { _id: null, total: { $sum: '$credits' } } }
                    ],
                    'imagesCreatedToday': [
                        {
                            $lookup: {
                                from: 'generationHistory',
                                pipeline: [
                                    {
                                        $match: {
                                            createdAt: { $gte: today }
                                        }
                                    }
                                ],
                                as: 'todayImages'
                            }
                        },
                        {
                            $project: {
                                count: { $size: '$todayImages' }
                            }
                        }
                    ],
                    'creditUsageByDay': [
                        {
                            $unwind: '$creditHistory'
                        },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: '$creditHistory.date'
                                    }
                                },
                                totalUsed: { $sum: '$creditHistory.amount' }
                            }
                        },
                        { $sort: { '_id': -1 } },
                        { $limit: 30 }
                    ]
                }
            }
        ]).toArray();

        return res.status(200).json({
            totalUsers: stats[0].totalUsers[0]?.count || 0,
            totalCredits: stats[0].totalCredits[0]?.total || 0,
            imagesCreatedToday: stats[0].imagesCreatedToday[0]?.count || 0,
            creditUsageByDay: stats[0].creditUsageByDay || []
        });

    } catch (error) {
        console.error('Admin stats error:', error);
        
        if (error.message === 'Unauthorized') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        return res.status(500).json({ error: 'Internal server error' });
    }
}
