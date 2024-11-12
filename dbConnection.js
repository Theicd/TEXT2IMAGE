// dbConnection.js
import { MongoClient } from 'mongodb';

class DatabaseConnection {
    constructor() {
        if (!process.env.MONGODB_URI) {
            throw new Error('Please define MONGODB_URI environment variable');
        }

        this.client = null;
        this.db = null;
        this.isConnecting = false;
        this.connectionPromise = null;
    }

    async connect() {
        try {
            // אם כבר יש חיבור פעיל, נחזיר אותו
            if (this.db && this.client) {
                return this.db;
            }

            // אם יש תהליך התחברות פעיל, נחכה לו
            if (this.isConnecting) {
                return await this.connectionPromise;
            }

            this.isConnecting = true;
            this.connectionPromise = new Promise(async (resolve, reject) => {
                try {
                    console.log('Connecting to MongoDB...');
                    
                    this.client = await MongoClient.connect(process.env.MONGODB_URI, {
                        maxPoolSize: 10,
                        minPoolSize: 5,
                        retryWrites: true,
                        w: 'majority',
                        connectTimeoutMS: 5000,
                        socketTimeoutMS: 30000
                    });

                    this.db = this.client.db(process.env.MONGODB_DATABASE_NAME || 'textToImage');
                    
                    // הגדרת אינדקסים חשובים
                    await this.setupIndexes();
                    
                    console.log('Successfully connected to MongoDB');
                    resolve(this.db);
                } catch (error) {
                    console.error('MongoDB connection error:', error);
                    this.client = null;
                    this.db = null;
                    reject(error);
                } finally {
                    this.isConnecting = false;
                }
            });

            return await this.connectionPromise;
        } catch (error) {
            console.error('Error in connect():', error);
            throw error;
        }
    }

    async setupIndexes() {
        try {
            // אינדקסים לאוסף המשתמשים
            await this.db.collection('users').createIndexes([
                { key: { email: 1 }, unique: true },
                { key: { isAdmin: 1 } },
                { key: { isActive: 1 } },
                { key: { credits: 1 } }
            ]);

            // אינדקסים להיסטוריית יצירת תמונות
            await this.db.collection('generationHistory').createIndexes([
                { key: { email: 1 } },
                { key: { createdAt: -1 } },
                { key: { status: 1 } }
            ]);

            // אינדקסים להיסטוריית קרדיטים
            await this.db.collection('creditHistory').createIndexes([
                { key: { email: 1 } },
                { key: { date: -1 } },
                { key: { action: 1 } }
            ]);

            // אינדקסים לפעולות מנהל
            await this.db.collection('adminActions').createIndexes([
                { key: { adminEmail: 1 } },
                { key: { timestamp: -1 } },
                { key: { action: 1 } }
            ]);

            console.log('Database indexes setup completed');
        } catch (error) {
            console.error('Error setting up indexes:', error);
            throw error;
        }
    }

    async getCollection(name) {
        const db = await this.connect();
        return db.collection(name);
    }

    async close() {
        if (this.client) {
            try {
                await this.client.close();
                this.client = null;
                this.db = null;
                console.log('MongoDB connection closed');
            } catch (error) {
                console.error('Error closing MongoDB connection:', error);
                throw error;
            }
        }
    }

    // העמדת טרנזקציה
    async withTransaction(callback) {
        const session = this.client.startSession();
        try {
            await session.withTransaction(async () => {
                await callback(session);
            });
        } finally {
            await session.endSession();
        }
    }

    // פונקציות עזר לשאילתות נפוצות
    async findUserByEmail(email) {
        const users = await this.getCollection('users');
        return await users.findOne({ email });
    }

    async updateUserCredits(email, amount, description, session = null) {
        const users = await this.getCollection('users');
        const options = session ? { session } : {};

        const result = await users.findOneAndUpdate(
            { email },
            {
                $inc: { credits: amount },
                $push: {
                    creditHistory: {
                        date: new Date(),
                        action: description,
                        amount: amount,
                        balance: { $add: ['$credits', amount] }
                    }
                }
            },
            { ...options, returnDocument: 'after' }
        );

        if (!result.value) {
            throw new Error('User not found');
        }

        return result.value;
    }

    async logAdminAction(adminEmail, action, details) {
        const adminActions = await this.getCollection('adminActions');
        await adminActions.insertOne({
            adminEmail,
            action,
            details,
            timestamp: new Date()
        });
    }

    async getSystemSettings() {
        const settings = await this.getCollection('settings');
        return await settings.findOne({ type: 'adminSettings' });
    }
}

// יצירת מופע יחיד של החיבור
const dbConnection = new DatabaseConnection();

// ייצוא הפונקציות העיקריות
export async function connectToDatabase() {
    return await dbConnection.connect();
}

export async function getCollection(name) {
    return await dbConnection.getCollection(name);
}

export async function withTransaction(callback) {
    return await dbConnection.withTransaction(callback);
}

export async function findUserByEmail(email) {
    return await dbConnection.findUserByEmail(email);
}

export async function updateUserCredits(email, amount, description, session) {
    return await dbConnection.updateUserCredits(email, amount, description, session);
}

export async function getSystemSettings() {
    return await dbConnection.getSystemSettings();
}

export async function logAdminAction(adminEmail, action, details) {
    return await dbConnection.logAdminAction(adminEmail, action, details);
}

// ניקוי משאבים בסגירת האפליקציה
process.on('SIGINT', async () => {
    console.log('Closing MongoDB connection...');
    await dbConnection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Closing MongoDB connection...');
    await dbConnection.close();
    process.exit(0);
});
