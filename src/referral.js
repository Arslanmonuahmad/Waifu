const crypto = require('crypto');
const Database = require('./database');

class ReferralSystem {
    constructor() {
        this.db = new Database();
        this.botUsername = 'Lilyforyou_bot'; // Bot username without @
        this.referralBonusMessages = parseInt(process.env.REFERRAL_BONUS_MESSAGES) || 12;
        this.referralBonusImages = parseInt(process.env.REFERRAL_BONUS_IMAGES) || 2;
    }

    generateReferralCode(telegramId) {
        // Generate a unique referral code based on user ID and timestamp
        const timestamp = Date.now().toString();
        const hash = crypto.createHash('md5').update(telegramId + timestamp).digest('hex');
        return hash.substring(0, 8).toUpperCase();
    }

    async generateReferralLink(telegramId) {
        try {
            const user = await this.db.getUser(telegramId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Generate or get existing referral code
            let referralCode = user.referralCode;
            
            if (!referralCode) {
                referralCode = this.generateReferralCode(telegramId.toString());
                
                // Update user with referral code
                await this.db.updateUser(telegramId, { referralCode: referralCode });
            }

            // Create referral link
            const referralLink = `https://t.me/${this.botUsername}?start=${referralCode}`;
            
            return referralLink;
        } catch (error) {
            console.error('Error generating referral link:', error);
            return null;
        }
    }

    async processReferral(referralCode, newUserId) {
        try {
            // Find the referrer by referral code
            const users = await this.db.getUsers();
            let referrerId = null;
            
            for (const [userId, userData] of Object.entries(users)) {
                if (userData.referralCode === referralCode) {
                    referrerId = parseInt(userId);
                    break;
                }
            }

            if (!referrerId) {
                console.log('Invalid referral code:', referralCode);
                return false;
            }

            // Prevent self-referral
            if (referrerId === newUserId) {
                console.log('Self-referral attempt blocked:', newUserId);
                await this.db.addLog('referral_abuse', {
                    type: 'self_referral',
                    userId: newUserId,
                    referralCode: referralCode
                });
                return false;
            }

            // Check if user was already referred
            const newUser = await this.db.getUser(newUserId);
            if (newUser && newUser.referredBy) {
                console.log('User already referred:', newUserId);
                return false;
            }

            // Check for potential abuse (same IP, device, etc. - simplified check)
            const referrer = await this.db.getUser(referrerId);
            if (!referrer) {
                console.log('Referrer not found:', referrerId);
                return false;
            }

            // Update referrer's stats and give bonus
            const updatedReferrals = (referrer.referrals || 0) + 1;
            const updatedMessages = referrer.messagesLeft + this.referralBonusMessages;
            const updatedImages = referrer.imagesLeft + this.referralBonusImages;

            await this.db.updateUser(referrerId, {
                referrals: updatedReferrals,
                messagesLeft: updatedMessages,
                imagesLeft: updatedImages
            });

            // Update new user to mark as referred
            await this.db.updateUser(newUserId, {
                referredBy: referrerId
            });

            // Log successful referral
            await this.db.addLog('referral_success', {
                referrerId: referrerId,
                newUserId: newUserId,
                referralCode: referralCode,
                bonusGiven: {
                    messages: this.referralBonusMessages,
                    images: this.referralBonusImages
                }
            });

            // Update global stats
            await this.db.updateStats('referralCompleted');

            console.log(`✅ Referral processed: ${referrerId} referred ${newUserId}`);
            return true;

        } catch (error) {
            console.error('Error processing referral:', error);
            return false;
        }
    }

    async getReferralStats(telegramId) {
        try {
            const user = await this.db.getUser(telegramId);
            
            if (!user) {
                return null;
            }

            // Get users referred by this user
            const allUsers = await this.db.getAllUsers();
            const referredUsers = allUsers.filter(u => u.referredBy === telegramId);

            const stats = {
                totalReferrals: user.referrals || 0,
                referralCode: user.referralCode,
                referredUsers: referredUsers.map(u => ({
                    username: u.username,
                    joinedAt: u.joinedAt,
                    isActive: this.isUserActive(u)
                })),
                totalBonusEarned: {
                    messages: (user.referrals || 0) * this.referralBonusMessages,
                    images: (user.referrals || 0) * this.referralBonusImages
                }
            };

            return stats;
        } catch (error) {
            console.error('Error getting referral stats:', error);
            return null;
        }
    }

    isUserActive(user) {
        const lastActive = new Date(user.lastActive);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return lastActive > sevenDaysAgo;
    }

    async detectReferralAbuse() {
        try {
            const logs = await this.db.getLogs(500);
            const referralLogs = logs.filter(log => log.action === 'referral_success');
            
            const abusePatterns = [];

            // Check for rapid referrals from same user
            const referralsByUser = {};
            referralLogs.forEach(log => {
                const referrerId = log.data.referrerId;
                if (!referralsByUser[referrerId]) {
                    referralsByUser[referrerId] = [];
                }
                referralsByUser[referrerId].push(log);
            });

            for (const [referrerId, userReferrals] of Object.entries(referralsByUser)) {
                // Check for too many referrals in short time
                if (userReferrals.length > 5) {
                    const timestamps = userReferrals.map(r => new Date(r.timestamp));
                    timestamps.sort((a, b) => a - b);
                    
                    const firstReferral = timestamps[0];
                    const lastReferral = timestamps[timestamps.length - 1];
                    const timeDiff = lastReferral - firstReferral;
                    const hoursDiff = timeDiff / (1000 * 60 * 60);
                    
                    if (hoursDiff < 24 && userReferrals.length > 3) {
                        abusePatterns.push({
                            type: 'rapid_referrals',
                            referrerId: referrerId,
                            count: userReferrals.length,
                            timeSpan: hoursDiff,
                            severity: 'high'
                        });
                    }
                }
            }

            return abusePatterns;
        } catch (error) {
            console.error('Error detecting referral abuse:', error);
            return [];
        }
    }

    async getTopReferrers(limit = 10) {
        try {
            const users = await this.db.getAllUsers();
            
            return users
                .filter(user => (user.referrals || 0) > 0)
                .sort((a, b) => (b.referrals || 0) - (a.referrals || 0))
                .slice(0, limit)
                .map(user => ({
                    telegramId: user.telegramId,
                    username: user.username,
                    referrals: user.referrals || 0,
                    joinedAt: user.joinedAt,
                    isActive: this.isUserActive(user)
                }));
        } catch (error) {
            console.error('Error getting top referrers:', error);
            return [];
        }
    }

    async validateReferralCode(referralCode) {
        try {
            const users = await this.db.getUsers();
            
            for (const [userId, userData] of Object.entries(users)) {
                if (userData.referralCode === referralCode) {
                    return {
                        valid: true,
                        referrerId: parseInt(userId),
                        referrerUsername: userData.username
                    };
                }
            }

            return { valid: false };
        } catch (error) {
            console.error('Error validating referral code:', error);
            return { valid: false };
        }
    }

    async getReferralHistory(telegramId, limit = 20) {
        try {
            const logs = await this.db.getLogs(1000);
            
            const userReferralLogs = logs.filter(log => 
                (log.action === 'referral_success' && log.data.referrerId === telegramId) ||
                (log.action === 'referral_abuse' && log.data.userId === telegramId)
            );

            return userReferralLogs
                .slice(-limit)
                .reverse()
                .map(log => ({
                    timestamp: log.timestamp,
                    action: log.action,
                    data: log.data
                }));
        } catch (error) {
            console.error('Error getting referral history:', error);
            return [];
        }
    }

    async addManualBonus(telegramId, messages = 0, images = 0, reason = 'Manual bonus') {
        try {
            const user = await this.db.getUser(telegramId);
            
            if (!user) {
                return false;
            }

            const updatedMessages = user.messagesLeft + messages;
            const updatedImages = user.imagesLeft + images;

            await this.db.updateUser(telegramId, {
                messagesLeft: Math.max(0, updatedMessages),
                imagesLeft: Math.max(0, updatedImages)
            });

            // Log manual bonus
            await this.db.addLog('manual_bonus', {
                telegramId: telegramId,
                messages: messages,
                images: images,
                reason: reason
            });

            console.log(`✅ Manual bonus added to user ${telegramId}: +${messages} messages, +${images} images`);
            return true;
        } catch (error) {
            console.error('Error adding manual bonus:', error);
            return false;
        }
    }
}

module.exports = ReferralSystem;

