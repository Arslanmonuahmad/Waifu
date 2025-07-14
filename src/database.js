const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

class Database {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.usersPath = path.join(this.dataDir, 'users.json');
        this.logsPath = path.join(this.dataDir, 'logs.json');
        this.statsPath = path.join(this.dataDir, 'stats.json');
        this.ordersPath = path.join(this.dataDir, 'orders.json');
        
        this.initializeDatabase();
    }

    async initializeDatabase() {
            // Ensure data directory exists
            await fs.ensureDir(path.dirname(this.usersPath));
            
            // Initialize users file if it doesn't exist
            if (!await fs.pathExists(this.usersPath)) {
                await fs.writeJson(this.usersPath, {});
            }
            
            // Initialize logs file if it doesn't exist
            if (!await fs.pathExists(this.logsPath)) {
                await fs.writeJson(this.logsPath, []);
            }
            
            // Initialize stats file if it doesn't exist
            if (!await fs.pathExists(this.statsPath)) {
                await fs.writeJson(this.statsPath, {
                    totalUsers: 0,
                    dailyActiveUsers: {},
                    totalMessages: 0,
                    totalImages: 0,
                    totalReferrals: 0
                });
            }
            
            console.log('✅ Database initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing database:', error);
        }
    }

    async getUsers() {
        try {
            return await fs.readJson(this.usersPath);
        } catch (error) {
            console.error('Error reading users:', error);
            return {};
        }
    }

    async saveUsers(users) {
        try {
            await fs.writeJson(this.usersPath, users, { spaces: 2 });
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    async getUser(telegramId) {
        try {
            const users = await this.getUsers();
            return users[telegramId] || null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    async createUser(userData) {
        try {
            const users = await this.getUsers();
            const telegramId = userData.telegramId;
            
            const newUser = {
                telegramId: telegramId,
                username: userData.username,
                messagesLeft: userData.messagesLeft || parseInt(process.env.STARTING_MESSAGES),
                imagesLeft: userData.imagesLeft || parseInt(process.env.STARTING_IMAGES),
                referrals: 0,
                referralCode: userData.referralCode || '',
                referredBy: null,
                nsfwUnlocked: false,
                joinedAt: userData.joinedAt || new Date(),
                lastActive: new Date(),
                totalMessagesUsed: 0,
                totalImagesUsed: 0,
                chatHistory: []
            };
            
            users[telegramId] = newUser;
            await this.saveUsers(users);
            
            // Update stats
            await this.updateStats('userCreated');
            
            // Log user creation
            await this.addLog('user_created', {
                telegramId: telegramId,
                username: userData.username,
                referralCode: userData.referralCode
            });
            
            console.log(`✅ New user created: ${userData.username} (${telegramId})`);
            return newUser;
        } catch (error) {
            console.error('Error creating user:', error);
            return null;
        }
    }

    async updateUser(telegramId, updateData) {
        try {
            const users = await this.getUsers();
            
            if (!users[telegramId]) {
                console.error('User not found:', telegramId);
                return false;
            }
            
            // Update user data
            users[telegramId] = {
                ...users[telegramId],
                ...updateData,
                lastActive: new Date()
            };
            
            await this.saveUsers(users);
            
            // Update daily active users
            await this.updateDailyActiveUser(telegramId);
            
            return true;
        } catch (error) {
            console.error('Error updating user:', error);
            return false;
        }
    }

    async deleteUser(telegramId) {
        try {
            const users = await this.getUsers();
            
            if (users[telegramId]) {
                delete users[telegramId];
                await this.saveUsers(users);
                
                await this.addLog('user_deleted', { telegramId });
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error deleting user:', error);
            return false;
        }
    }

    async getAllUsers() {
        try {
            const users = await this.getUsers();
            return Object.values(users);
        } catch (error) {
            console.error('Error getting all users:', error);
            return [];
        }
    }

    async getUserStats() {
        try {
            const users = await this.getAllUsers();
            const today = moment().format('YYYY-MM-DD');
            
            const stats = {
                totalUsers: users.length,
                activeToday: users.filter(user => 
                    moment(user.lastActive).format('YYYY-MM-DD') === today
                ).length,
                totalMessages: users.reduce((sum, user) => sum + (user.totalMessagesUsed || 0), 0),
                totalImages: users.reduce((sum, user) => sum + (user.totalImagesUsed || 0), 0),
                totalReferrals: users.reduce((sum, user) => sum + (user.referrals || 0), 0),
                usersWithCredits: users.filter(user => user.messagesLeft > 0 || user.imagesLeft > 0).length
            };
            
            return stats;
        } catch (error) {
            console.error('Error getting user stats:', error);
            return {};
        }
    }

    async updateDailyActiveUser(telegramId) {
        try {
            const stats = await fs.readJson(this.statsPath);
            const today = moment().format('YYYY-MM-DD');
            
            if (!stats.dailyActiveUsers[today]) {
                stats.dailyActiveUsers[today] = [];
            }
            
            if (!stats.dailyActiveUsers[today].includes(telegramId)) {
                stats.dailyActiveUsers[today].push(telegramId);
            }
            
            await fs.writeJson(this.statsPath, stats, { spaces: 2 });
        } catch (error) {
            console.error('Error updating daily active user:', error);
        }
    }

    async updateStats(action, data = {}) {
        try {
            const stats = await fs.readJson(this.statsPath);
            
            switch (action) {
                case 'userCreated':
                    stats.totalUsers++;
                    break;
                case 'messageUsed':
                    stats.totalMessages++;
                    break;
                case 'imageUsed':
                    stats.totalImages++;
                    break;
                case 'referralCompleted':
                    stats.totalReferrals++;
                    break;
            }
            
            await fs.writeJson(this.statsPath, stats, { spaces: 2 });
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    async addLog(action, data) {
        try {
            const logs = await fs.readJson(this.logsPath);
            
            const logEntry = {
                timestamp: new Date(),
                action: action,
                data: data
            };
            
            logs.push(logEntry);
            
            // Keep only last 1000 logs to prevent file from growing too large
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }
            
            await fs.writeJson(this.logsPath, logs, { spaces: 2 });
        } catch (error) {
            console.error('Error adding log:', error);
        }
    }

    async getLogs(limit = 100) {
        try {
            const logs = await fs.readJson(this.logsPath);
            return logs.slice(-limit).reverse(); // Return latest logs first
        } catch (error) {
            console.error('Error getting logs:', error);
            return [];
        }
    }

    async addChatMessage(telegramId, message, isUser = true) {
        try {
            const users = await this.getUsers();
            
            if (!users[telegramId]) {
                return false;
            }
            
            if (!users[telegramId].chatHistory) {
                users[telegramId].chatHistory = [];
            }
            
            const chatEntry = {
                timestamp: new Date(),
                message: message,
                isUser: isUser
            };
            
            users[telegramId].chatHistory.push(chatEntry);
            
            // Keep only last 50 messages to prevent data from growing too large
            if (users[telegramId].chatHistory.length > 50) {
                users[telegramId].chatHistory = users[telegramId].chatHistory.slice(-50);
            }
            
            await this.saveUsers(users);
            return true;
        } catch (error) {
            console.error('Error adding chat message:', error);
            return false;
        }
    }

    async getChatHistory(telegramId, limit = 10) {
        try {
            const user = await this.getUser(telegramId);
            
            if (!user || !user.chatHistory) {
                return [];
            }
            
            return user.chatHistory.slice(-limit);
        } catch (error) {
            console.error('Error getting chat history:', error);
            return [];
        }
    }

    async searchUsers(query) {
        try {
            const users = await this.getAllUsers();
            
            return users.filter(user => 
                user.username.toLowerCase().includes(query.toLowerCase()) ||
                user.telegramId.toString().includes(query)
            );
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    async getUsersByReferrals(minReferrals = 1) {
        try {
            const users = await this.getAllUsers();
            
            return users.filter(user => (user.referrals || 0) >= minReferrals)
                       .sort((a, b) => (b.referrals || 0) - (a.referrals || 0));
        } catch (error) {
            console.error('Error getting users by referrals:', error);
            return [];
        }
    }

    async getActiveUsers(days = 7) {
        try {
            const users = await this.getAllUsers();
            const cutoffDate = moment().subtract(days, 'days');
            
            return users.filter(user => 
                moment(user.lastActive).isAfter(cutoffDate)
            );
        } catch (error) {
            console.error('Error getting active users:', error);
            return [];
        }
    }

    // Payment order management
    async createPaymentOrder(orderData) {
        try {
            const orders = await this.getPaymentOrders();
            orders[orderData.orderId] = {
                ...orderData,
                createdAt: new Date().toISOString()
            };
            
            await fs.writeFile(this.ordersPath, JSON.stringify(orders, null, 2));
            console.log(`💰 Payment order created: ${orderData.orderId}`);
            
            return orders[orderData.orderId];
        } catch (error) {
            console.error('❌ Error creating payment order:', error.message);
            throw error;
        }
    }

    async getPaymentOrder(orderId) {
        try {
            const orders = await this.getPaymentOrders();
            return orders[orderId] || null;
        } catch (error) {
            console.error('❌ Error getting payment order:', error.message);
            return null;
        }
    }

    async updatePaymentOrder(orderId, updateData) {
        try {
            const orders = await this.getPaymentOrders();
            if (orders[orderId]) {
                orders[orderId] = {
                    ...orders[orderId],
                    ...updateData,
                    updatedAt: new Date().toISOString()
                };
                
                await fs.writeFile(this.ordersPath, JSON.stringify(orders, null, 2));
                console.log(`💰 Payment order updated: ${orderId}`);
            }
            
            return orders[orderId];
        } catch (error) {
            console.error('❌ Error updating payment order:', error.message);
            throw error;
        }
    }

    async getPaymentOrders() {
        try {
            if (await fs.pathExists(this.ordersPath)) {
                const data = await fs.readFile(this.ordersPath, 'utf8');
                return JSON.parse(data);
            }
            return {};
        } catch (error) {
            console.error('❌ Error reading payment orders:', error.message);
            return {};
        }
    }

    async getPaymentStats() {
        try {
            const orders = await this.getPaymentOrders();
            const stats = {
                totalOrders: 0,
                completedOrders: 0,
                totalRevenue: 0,
                pendingOrders: 0,
                failedOrders: 0
            };

            Object.values(orders).forEach(order => {
                stats.totalOrders++;
                
                switch (order.status) {
                    case 'completed':
                        stats.completedOrders++;
                        stats.totalRevenue += order.amount;
                        break;
                    case 'created':
                    case 'pending':
                        stats.pendingOrders++;
                        break;
                    case 'failed':
                        stats.failedOrders++;
                        break;
                }
            });

            return stats;
        } catch (error) {
            console.error('❌ Error getting payment stats:', error.message);
            return null;
        }
    }
}

module.exports = Database;

