const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const Database = require('../src/database');
const ReferralSystem = require('../src/referral');

class AdminServer {
    constructor() {
        this.app = express();
        this.port = process.env.ADMIN_PORT || 3000;
        this.adminUsername = process.env.ADMIN_USERNAME || 'monkeyspeed';
        this.adminPassword = process.env.ADMIN_PASSWORD || 'monkeyspeed';
        
        this.db = new Database();
        this.referral = new ReferralSystem();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Enable CORS
        this.app.use(cors());
        
        // Parse JSON bodies
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Serve static files
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // Session configuration
        this.app.use(session({
            secret: process.env.SESSION_SECRET || 'admin-secret-key',
            resave: false,
            saveUninitialized: false,
            cookie: { 
                secure: false, // Set to true in production with HTTPS
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        }));
    }

    setupRoutes() {
        // Serve admin panel HTML
        this.app.get('/', (req, res) => {
            if (!req.session.authenticated) {
                return res.redirect('/login');
            }
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        // Login page
        this.app.get('/login', (req, res) => {
            if (req.session.authenticated) {
                return res.redirect('/');
            }
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        });

        // Login endpoint
        this.app.post('/api/login', async (req, res) => {
            const { username, password } = req.body;
            
            if (username === this.adminUsername && password === this.adminPassword) {
                req.session.authenticated = true;
                req.session.username = username;
                res.json({ success: true, message: 'Login successful' });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        });

        // Logout endpoint
        this.app.post('/api/logout', (req, res) => {
            req.session.destroy();
            res.json({ success: true, message: 'Logged out successfully' });
        });

        // Middleware to check authentication for API routes
        this.app.use('/api', (req, res, next) => {
            if (req.path === '/login') return next();
            
            if (!req.session.authenticated) {
                return res.status(401).json({ success: false, message: 'Not authenticated' });
            }
            next();
        });

        // Dashboard stats
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.db.getUserStats();
                const logs = await this.db.getLogs(50);
                const topReferrers = await this.referral.getTopReferrers(10);
                
                res.json({
                    success: true,
                    data: {
                        stats,
                        recentLogs: logs,
                        topReferrers
                    }
                });
            } catch (error) {
                console.error('Error getting stats:', error);
                res.status(500).json({ success: false, message: 'Error getting stats' });
            }
        });

        // Get all users
        this.app.get('/api/users', async (req, res) => {
            try {
                const users = await this.db.getAllUsers();
                res.json({ success: true, data: users });
            } catch (error) {
                console.error('Error getting users:', error);
                res.status(500).json({ success: false, message: 'Error getting users' });
            }
        });

        // Get specific user
        this.app.get('/api/users/:telegramId', async (req, res) => {
            try {
                const user = await this.db.getUser(parseInt(req.params.telegramId));
                if (!user) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }
                
                const referralStats = await this.referral.getReferralStats(parseInt(req.params.telegramId));
                const chatHistory = await this.db.getChatHistory(parseInt(req.params.telegramId), 20);
                
                res.json({ 
                    success: true, 
                    data: { 
                        user, 
                        referralStats, 
                        chatHistory 
                    } 
                });
            } catch (error) {
                console.error('Error getting user:', error);
                res.status(500).json({ success: false, message: 'Error getting user' });
            }
        });

        // Update user credits
        this.app.post('/api/users/:telegramId/credits', async (req, res) => {
            try {
                const telegramId = parseInt(req.params.telegramId);
                const { messages, images, action } = req.body; // action: 'add' or 'subtract'
                
                const user = await this.db.getUser(telegramId);
                if (!user) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }

                let newMessages = user.messagesLeft;
                let newImages = user.imagesLeft;

                if (action === 'add') {
                    newMessages += parseInt(messages) || 0;
                    newImages += parseInt(images) || 0;
                } else if (action === 'subtract') {
                    newMessages -= parseInt(messages) || 0;
                    newImages -= parseInt(images) || 0;
                }

                // Ensure non-negative values
                newMessages = Math.max(0, newMessages);
                newImages = Math.max(0, newImages);

                await this.db.updateUser(telegramId, {
                    messagesLeft: newMessages,
                    imagesLeft: newImages
                });

                // Log the action
                await this.db.addLog('admin_credit_update', {
                    telegramId,
                    action,
                    messages: parseInt(messages) || 0,
                    images: parseInt(images) || 0,
                    admin: req.session.username
                });

                res.json({ success: true, message: 'Credits updated successfully' });
            } catch (error) {
                console.error('Error updating credits:', error);
                res.status(500).json({ success: false, message: 'Error updating credits' });
            }
        });

        // Delete user
        this.app.delete('/api/users/:telegramId', async (req, res) => {
            try {
                const telegramId = parseInt(req.params.telegramId);
                const success = await this.db.deleteUser(telegramId);
                
                if (success) {
                    await this.db.addLog('admin_user_deleted', {
                        telegramId,
                        admin: req.session.username
                    });
                    res.json({ success: true, message: 'User deleted successfully' });
                } else {
                    res.status(404).json({ success: false, message: 'User not found' });
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                res.status(500).json({ success: false, message: 'Error deleting user' });
            }
        });

        // Search users
        this.app.get('/api/search', async (req, res) => {
            try {
                const { q } = req.query;
                if (!q) {
                    return res.status(400).json({ success: false, message: 'Search query required' });
                }
                
                const users = await this.db.searchUsers(q);
                res.json({ success: true, data: users });
            } catch (error) {
                console.error('Error searching users:', error);
                res.status(500).json({ success: false, message: 'Error searching users' });
            }
        });

        // Get referral abuse logs
        this.app.get('/api/referral-abuse', async (req, res) => {
            try {
                const abusePatterns = await this.referral.detectReferralAbuse();
                const logs = await this.db.getLogs(200);
                const abuseLogs = logs.filter(log => log.action === 'referral_abuse');
                
                res.json({ 
                    success: true, 
                    data: { 
                        patterns: abusePatterns, 
                        logs: abuseLogs 
                    } 
                });
            } catch (error) {
                console.error('Error getting referral abuse data:', error);
                res.status(500).json({ success: false, message: 'Error getting referral abuse data' });
            }
        });

        // Get system logs
        this.app.get('/api/logs', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 100;
                const logs = await this.db.getLogs(limit);
                res.json({ success: true, data: logs });
            } catch (error) {
                console.error('Error getting logs:', error);
                res.status(500).json({ success: false, message: 'Error getting logs' });
            }
        });

        // Broadcast message to all users (placeholder - would need bot integration)
        this.app.post('/api/broadcast', async (req, res) => {
            try {
                const { message } = req.body;
                
                // Log the broadcast attempt
                await this.db.addLog('admin_broadcast', {
                    message,
                    admin: req.session.username
                });
                
                // In a real implementation, this would send the message through the bot
                res.json({ 
                    success: true, 
                    message: 'Broadcast logged (bot integration required for actual sending)' 
                });
            } catch (error) {
                console.error('Error broadcasting message:', error);
                res.status(500).json({ success: false, message: 'Error broadcasting message' });
            }
        });
    }

    start() {
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`🚀 Admin panel running on http://0.0.0.0:${this.port}`);
            console.log(`👤 Admin credentials: ${this.adminUsername} / ${this.adminPassword}`);
        });
    }
}

// Start the admin server
const adminServer = new AdminServer();
adminServer.start();

module.exports = AdminServer;

