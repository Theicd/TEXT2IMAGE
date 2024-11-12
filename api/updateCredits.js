// api/updateCredits.js
import { 
    connectToDatabase, 
    withTransaction, 
    findUserByEmail,
    updateUserCredits,
    logAdminAction 
} from '../../lib/dbConnection';

async function validateCreditUpdate(amount, reason) {
    if (typeof amount !== 'number') {
        throw new Error('Amount must be a number');
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        throw new Error('Valid reason is required for credit update');
    }
}

async function checkUserStatus(db, email) {
    const user = await findUserByEmail(email);
    if (!user) {
        throw new Error('User not found');
    }
    if (!user.isActive) {
        throw new Error('User account is inactive');
    }
    return user;
}

async function processCreditPurchase(amount, cost, paymentDetails) {
    // כאן יש להוסיף אינטגרציה עם מערכת תשלומים
    // לדוגמה: Stripe, PayPal וכו'
    return {
        success: true,
        transactionId: 'mock_transaction_' + Date.now()
    };
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Email');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, amount, reason, paymentDetails, isAdminAction } = req.body;

    try {
        // וולידציה בסיסית
        await validateCreditUpdate(amount, reason);

        const db = await connectToDatabase();
        
        // בדיקת סטטוס משתמש
        const user = await checkUserStatus(db, email);

        // עיבוד התשלום אם נדרש
        let paymentResult = null;
        if (!isAdminAction && amount > 0) {
            paymentResult = await processCreditPurchase(amount, amount / 50, paymentDetails);
            if (!paymentResult.success) {
                throw new Error('Payment processing failed');
            }
        }

        // ביצוע העדכון בטרנזקציה
        let updatedUser;
        await withTransaction(async (session) => {
            // עדכון הקרדיטים
            updatedUser = await updateUserCredits(email, amount, reason, session);

            // שמירת לוג העסקה
            await db.collection('creditTransactions').insertOne({
                email,
                amount,
                reason,
                timestamp: new Date(),
                previousBalance: user.credits,
                newBalance: user.credits + amount,
                isAdminAction: !!isAdminAction,
                adminEmail: isAdminAction ? req.headers['user-email'] : null,
                paymentDetails: paymentResult ? {
                    transactionId: paymentResult.transactionId,
                    amount: amount / 50, // מחיר בדולרים
                    method: paymentDetails?.method
                } : null
            }, { session });

            // אם זו פעולת מנהל, נשמור גם בלוג המנהלים
            if (isAdminAction) {
                await logAdminAction(
                    req.headers['user-email'],
                    'UPDATE_CREDITS',
                    {
                        targetUser: email,
                        amount,
                        reason,
                        previousBalance: user.credits,
                        newBalance: user.credits + amount
                    }
                );
            }
        });

        // החזרת תשובה מוצלחת
        res.status(200).json({
            success: true,
            user: {
                email: updatedUser.email,
                credits: updatedUser.credits,
                lastTransaction: {
                    amount,
                    reason,
                    timestamp: new Date()
                }
            }
        });

    } catch (error) {
        console.error('Credit update error:', error);

        // טיפול בשגיאות ספציפיות
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        if (error.message === 'User account is inactive') {
            return res.status(403).json({ error: 'Account is inactive' });
        }
        if (error.message === 'Payment processing failed') {
            return res.status(402).json({ error: 'Payment failed' });
        }
        if (error.message.includes('Amount must be') || error.message.includes('reason')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ 
            error: 'Failed to update credits',
            message: error.message 
        });
    }
}

// api/credits/purchase.js - נקודת קצה נפרדת לרכישת קרדיטים
export async function purchaseCredits(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, amount, paymentMethod, paymentDetails } = req.body;

    try {
        const db = await connectToDatabase();
        
        // חישוב העלות בדולרים
        const settings = await db.collection('settings').findOne({ type: 'adminSettings' });
        const costPerCredit = 1 / (settings?.creditConversionRate || 50); // ברירת מחדל: 50 קרדיטים לדולר
        const costInDollars = amount * costPerCredit;

        // עיבוד התשלום
        const paymentResult = await processCreditPurchase(amount, costInDollars, {
            method: paymentMethod,
            ...paymentDetails
        });

        if (!paymentResult.success) {
            throw new Error('Payment processing failed');
        }

        // עדכון הקרדיטים
        const updatedUser = await updateUserCredits(
            email,
            amount,
            `רכישת ${amount} קרדיטים`
        );

        res.status(200).json({
            success: true,
            transaction: {
                id: paymentResult.transactionId,
                amount,
                costInDollars,
                credits: amount
            },
            user: {
                email: updatedUser.email,
                credits: updatedUser.credits
            }
        });

    } catch (error) {
        console.error('Credit purchase error:', error);
        res.status(500).json({ error: 'Failed to process purchase' });
    }
}

// api/credits/check.js - נקודת קצה לבדיקת יתרת קרדיטים
export async function checkCredits(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.query;

    try {
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            credits: user.credits,
            history: user.creditHistory.slice(0, 10) // 10 פעולות אחרונות
        });

    } catch (error) {
        console.error('Credit check error:', error);
        res.status(500).json({ error: 'Failed to check credits' });
    }
}
