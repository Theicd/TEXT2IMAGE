// api/registerUser.js
import { 
    connectToDatabase, 
    withTransaction, 
    findUserByEmail,
    getSystemSettings 
} from '../../lib/dbConnection';

async function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
    }
}

async function getInitialCredits() {
    const settings = await getSystemSettings();
    return settings?.initialCredits || 100; // ברירת מחדל: 100 קרדיטים
}

async function createUserDocument(email, hashedPassword, initialCredits) {
    return {
        email,
        password: hashedPassword,
        credits: initialCredits,
        isAdmin: false,
        isActive: true,
        createdAt: new Date(),
        lastLogin: null,
        creditHistory: [
            {
                date: new Date(),
                action: 'הרשמה למערכת',
                amount: initialCredits,
                description: 'קרדיטים התחלתיים'
            }
        ],
        settings: {
            language: 'he',
            notifications: true,
            emailUpdates: true
        },
        verificationStatus: {
            email: false,
            emailToken: Math.random().toString(36).substring(2, 15)
        }
    };
}

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

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Missing required fields',
            details: {
                email: !email ? 'Email is required' : null,
                password: !password ? 'Password is required' : null
            }
        });
    }

    try {
        // וולידציית אימייל
        await validateEmail(email);

        // בדיקת סיסמה
        if (password.length < 8) {
            return res.status(400).json({ 
                error: 'Password too short',
                details: 'Password must be at least 8 characters long'
            });
        }

        const db = await connectToDatabase();

        // בדיקה אם המשתמש כבר קיים
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // קבלת מספר קרדיטים התחלתי מהגדרות המערכת
        const initialCredits = await getInitialCredits();

        // הצפנת סיסמה
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        // יצירת מסמך המשתמש
        const newUser = await createUserDocument(email, hashedPassword, initialCredits);

        // שמירת המשתמש בטרנזקציה
        await withTransaction(async (session) => {
            // שמירת המשתמש
            await db.collection('users').insertOne(newUser, { session });

            // שמירת לוג הרשמה
            await db.collection('registrationLogs').insertOne({
                email,
                timestamp: new Date(),
                initialCredits,
                userAgent: req.headers['user-agent'],
                ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
            }, { session });
        });

        // שליחת אימייל אימות
        try {
            await sendVerificationEmail(email, newUser.verificationStatus.emailToken);
        } catch (error) {
            console.error('Failed to send verification email:', error);
            // לא נכשיל את ההרשמה אם שליחת האימייל נכשלה
        }

        // החזרת תשובה מוצלחת
        res.status(201).json({
            success: true,
            user: {
                email: newUser.email,
                credits: newUser.credits,
                isActive: newUser.isActive,
                createdAt: newUser.createdAt,
                settings: newUser.settings
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.message === 'Invalid email format') {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        res.status(500).json({ 
            error: 'Failed to register user',
            message: error.message 
        });
    }
}

// פונקציית עזר לשליחת אימייל אימות
async function sendVerificationEmail(email, token) {
    // כאן יש להוסיף את הלוגיקה לשליחת אימייל
    // לדוגמה, שימוש ב-SendGrid או שירות אימייל אחר
    console.log('Verification email would be sent to:', email, 'with token:', token);
}

// api/verifyEmail.js - נקודת קצה נפרדת לאימות אימייל
export async function verifyEmail(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, token } = req.body;

    try {
        const db = await connectToDatabase();
        
        const result = await db.collection('users').findOneAndUpdate(
            {
                email,
                'verificationStatus.emailToken': token,
                'verificationStatus.email': false
            },
            {
                $set: {
                    'verificationStatus.email': true,
                    'verificationStatus.verifiedAt': new Date()
                },
                $unset: {
                    'verificationStatus.emailToken': 1
                }
            },
            { returnDocument: 'after' }
        );

        if (!result.value) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Failed to verify email' });
    }
}
