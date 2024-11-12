// script.js
class ImageGenerator {
    constructor() {
        this.imageGrid = document.getElementById('imageGrid');
        this.promptInput = document.getElementById('promptInput');
        this.generateButton = document.getElementById('generateButton');
        this.loadingIndicator = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.generateButton) {
            this.generateButton.addEventListener('click', () => this.generateImage());
        }

        // מאזין לשינויים בגודל התמונה
        const sizeSelector = document.getElementById('imageSize');
        if (sizeSelector) {
            sizeSelector.addEventListener('change', () => this.updateGenerateButtonText());
        }
    }

    showLoading() {
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'loading-indicator';
        this.loadingIndicator.innerHTML = `
            <div class="spinner"></div>
            <p>מייצר תמונה...</p>
        `;
        this.generateButton.parentNode.insertBefore(
            this.loadingIndicator,
            this.generateButton.nextSibling
        );
        this.generateButton.disabled = true;
    }

    hideLoading() {
        if (this.loadingIndicator && this.loadingIndicator.parentNode) {
            this.loadingIndicator.parentNode.removeChild(this.loadingIndicator);
        }
        this.generateButton.disabled = false;
    }

    async generateImage() {
        if (!isUserLoggedIn()) {
            alert('עליך להתחבר כדי ליצור תמונות');
            openAuthModal('login');
            return;
        }

        const prompt = this.promptInput.value.trim();
        if (!prompt) {
            alert('אנא הזן תיאור לתמונה');
            return;
        }

        const size = document.getElementById('imageSize')?.value || '1024x1024';
        const currentUser = getCurrentUser();
        const cost = getImageGenerationCost(size);

        if (!cost) {
            alert('השירות אינו זמין כרגע');
            return;
        }

        if (currentUser.credits < cost) {
            alert('אין מספיק קרדיטים. אנא רכוש קרדיטים נוספים.');
            this.showCreditPurchaseDialog(cost - currentUser.credits);
            return;
        }

        this.showLoading();

        try {
            const response = await fetch('/api/generateImage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.token}`
                },
                body: JSON.stringify({
                    prompt,
                    email: currentUser.email,
                    size
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate image');
            }

            const data = await response.json();
            
            // עדכון ממשק המשתמש
            this.addImageToGrid(data.data[0].url, prompt);
            this.promptInput.value = '';
            
            // עדכון קרדיטים
            await this.updateUserCredits(data.credits.remaining);
            
            this.showSuccessMessage('התמונה נוצרה בהצלחה!');

        } catch (error) {
            console.error('Error generating image:', error);
            this.showErrorMessage(error.message);
        } finally {
            this.hideLoading();
        }
    }

    addImageToGrid(imageUrl, prompt) {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';

        imageCard.innerHTML = `
            <img src="${imageUrl}" alt="${prompt}" loading="lazy">
            <p>${prompt}</p>
            <div class="image-actions">
                <button onclick="downloadImage('${imageUrl}')">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="shareImage('${imageUrl}', '${prompt}')">
                    <i class="fas fa-share"></i>
                </button>
            </div>
        `;

        if (this.imageGrid.firstChild) {
            this.imageGrid.insertBefore(imageCard, this.imageGrid.firstChild);
        } else {
            this.imageGrid.appendChild(imageCard);
        }
    }

    async updateUserCredits(newAmount) {
        const currentUser = getCurrentUser();
        currentUser.credits = newAmount;
        saveUserToLocalStorage(currentUser);
        this.updateGenerateButtonText();
        
        const creditDisplay = document.getElementById('creditDisplay');
        if (creditDisplay) {
            creditDisplay.textContent = newAmount;
        }
    }

    updateGenerateButtonText() {
        const size = document.getElementById('imageSize')?.value || '1024x1024';
        const cost = getImageGenerationCost(size);
        const currentUser = getCurrentUser();

        if (this.generateButton) {
            if (!cost) {
                this.generateButton.disabled = true;
                this.generateButton.textContent = 'השירות אינו זמין';
                return;
            }

            if (currentUser) {
                this.generateButton.textContent = `צור (${cost} קרדיטים) | נותרו: ${currentUser.credits}`;
                this.generateButton.disabled = currentUser.credits < cost;
            } else {
                this.generateButton.textContent = `צור (${cost} קרדיטים)`;
            }
        }
    }

    showCreditPurchaseDialog(suggestedAmount) {
        const dialog = document.createElement('div');
        dialog.className = 'credit-purchase-dialog';
        dialog.innerHTML = `
            <h3>רכישת קרדיטים</h3>
            <p>נדרשים לפחות ${suggestedAmount} קרדיטים נוספים</p>
            <div class="purchase-options">
                ${this.generatePurchaseOptions(suggestedAmount)}
            </div>
            <button onclick="closePurchaseDialog()">סגור</button>
        `;
        document.body.appendChild(dialog);
    }

    generatePurchaseOptions(suggestedAmount) {
        const options = [
            { amount: Math.ceil(suggestedAmount / 10) * 10, price: 5 },
            { amount: Math.ceil(suggestedAmount / 10) * 20, price: 9 },
            { amount: Math.ceil(suggestedAmount / 10) * 50, price: 20 }
        ];

        return options.map(option => `
            <div class="purchase-option" onclick="purchaseCredits(${option.amount}, ${option.price})">
                <h4>${option.amount} קרדיטים</h4>
                <p>$${option.price}</p>
                ${option.amount >= suggestedAmount ? '<span class="recommended">מומלץ</span>' : ''}
            </div>
        `).join('');
    }

    showSuccessMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    showErrorMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
}

// יצירת מופע של מחולל התמונות
const imageGenerator = new ImageGenerator();

// פונקציות עזר גלובליות
async function downloadImage(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'generated-image.png';
        link.click();
    } catch (error) {
        console.error('Error downloading image:', error);
        imageGenerator.showErrorMessage('שגיאה בהורדת התמונה');
    }
}

async function shareImage(url, prompt) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'תמונה שנוצרה ב-TextToImg',
                text: prompt,
                url: url
            });
        } catch (error) {
            console.error('Error sharing image:', error);
        }
    } else {
        // נעתיק את הקישור ללוח
        navigator.clipboard.writeText(url);
        imageGenerator.showSuccessMessage('הקישור הועתק ללוח');
    }
}

async function purchaseCredits(amount, price) {
    // פתיחת חלון תשלום
    try {
        const response = await fetch('/api/credits/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCurrentUser().token}`
            },
            body: JSON.stringify({
                email: getCurrentUser().email,
                amount,
                price
            })
        });

        if (!response.ok) {
            throw new Error('Failed to process payment');
        }

        const data = await response.json();
        imageGenerator.updateUserCredits(data.user.credits);
        imageGenerator.showSuccessMessage(`נרכשו ${amount} קרדיטים בהצלחה!`);
        
        const dialog = document.querySelector('.credit-purchase-dialog');
        if (dialog) {
            dialog.remove();
        }

    } catch (error) {
        console.error('Error purchasing credits:', error);
        imageGenerator.showErrorMessage('שגיאה ברכישת הקרדיטים');
    }
}

function closePurchaseDialog() {
    const dialog = document.querySelector('.credit-purchase-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// חשיפת פונקציות גלובליות
window.downloadImage = downloadImage;
window.shareImage = shareImage;
window.purchaseCredits = purchaseCredits;
window.closePurchaseDialog = closePurchaseDialog;
