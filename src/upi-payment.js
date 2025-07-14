const crypto = require('crypto');

class UPIPayment {
    constructor() {
        this.upiId = process.env.UPI_ID || 'your-upi-id@paytm';
        this.tier1Price = parseInt(process.env.TIER_1_PRICE) || 50;
        this.tier1Messages = parseInt(process.env.TIER_1_MESSAGES) || 100;
        this.tier1Images = parseInt(process.env.TIER_1_IMAGES) || 25;
        this.tier2Price = parseInt(process.env.TIER_2_PRICE) || 100;
        this.tier2Messages = parseInt(process.env.TIER_2_MESSAGES) || 210;
        this.tier2Images = parseInt(process.env.TIER_2_IMAGES) || 32;
    }

    generatePaymentMessage(plan) {
        const planDetails = this.getPlanDetails(plan);
        if (!planDetails) {
            return null;
        }

        const message = `💰 **Payment Details for ${planDetails.name}**

💳 **UPI ID**: \`${this.upiId}\`
💵 **Amount**: ₹${planDetails.price}
📦 **You'll Get**: ${planDetails.messages} messages + ${planDetails.images} images

**Payment Steps:**
1. Open any UPI app (PhonePe, Google Pay, Paytm, etc.)
2. Send ₹${planDetails.price} to: \`${this.upiId}\`
3. After payment, copy the **UTR ID** from your transaction
4. Send the UTR ID to this bot for verification

⚠️ **Important**: 
- Make sure to send the exact amount: ₹${planDetails.price}
- Keep your UTR ID ready after payment
- Credits will be added after manual verification (usually within 1-2 hours)

Ready to pay? Send the UTR ID here after completing the payment! 💕`;

        return message;
    }

    getPlanDetails(plan) {
        switch (plan) {
            case 'tier1':
                return {
                    name: 'Basic Plan',
                    price: this.tier1Price,
                    messages: this.tier1Messages,
                    images: this.tier1Images
                };
            case 'tier2':
                return {
                    name: 'Premium Plan',
                    price: this.tier2Price,
                    messages: this.tier2Messages,
                    images: this.tier2Images
                };
            default:
                return null;
        }
    }

    generateUTRReference(userId, plan) {
        // Generate a unique reference for tracking
        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(`${userId}-${plan}-${timestamp}`).digest('hex').substring(0, 8);
        return `${plan.toUpperCase()}-${hash}`;
    }

    async logPaymentRequest(userId, plan, reference) {
        // This would typically log to database or file
        const logEntry = {
            userId: userId,
            plan: plan,
            reference: reference,
            timestamp: new Date().toISOString(),
            status: 'pending_utr',
            amount: this.getPlanDetails(plan).price
        };
        
        console.log('Payment request logged:', logEntry);
        return logEntry;
    }

    async processUTRSubmission(userId, utrId, plan) {
        // Log the UTR submission for manual verification
        const logEntry = {
            userId: userId,
            utrId: utrId,
            plan: plan,
            timestamp: new Date().toISOString(),
            status: 'pending_verification',
            amount: this.getPlanDetails(plan).price
        };
        
        console.log('UTR submission logged:', logEntry);
        
        // In a real implementation, this would:
        // 1. Save to database
        // 2. Send notification to admin
        // 3. Create a verification task
        
        return {
            success: true,
            message: `✅ UTR ID received: ${utrId}

Your payment is now under verification. You will receive your credits within 1-2 hours after verification.

Thank you for your patience! 💕`,
            reference: this.generateUTRReference(userId, plan)
        };
    }

    validateUTRFormat(utrId) {
        // Basic UTR validation (UTR IDs are typically 12 digits)
        const utrPattern = /^\d{12}$/;
        return utrPattern.test(utrId);
    }
}

module.exports = UPIPayment;

