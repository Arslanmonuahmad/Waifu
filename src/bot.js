const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const Database = require('./database');
const DeepSeekAPI = require('./deepseek');
const StableHordeAPI = require('./stablehorde'); // Now using PiAPIImageGen
const ReferralSystem = require('./referral');
const UPIPayment = require('./upi-payment');

class AIWaifuBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.channelId = process.env.TELEGRAM_CHANNEL_ID;
        this.channelName = process.env.TELEGRAM_CHANNEL_NAME;
        this.botName = process.env.BOT_NAME || 'Lily';
        
        this.bot = new TelegramBot(this.token, { polling: true });
        this.db = new Database();
        this.deepseek = new DeepSeekAPI();
        this.imageGen = new PiAPIImageGen();
        this.referral = new ReferralSystem();
        this.upiPayment = new UPIPayment();
        
        this.initializeBot();
    }

    initializeBot() {
        console.log(`🤖 ${this.botName} bot is starting...`);
        
        // Handle /start command
        this.bot.onText(/\/start(.*)/, (msg, match) => {
            this.handleStart(msg, match[1]);
        });

        // Handle callback queries (inline button presses)
        this.bot.on('callback_query', (callbackQuery) => {
            this.handleCallbackQuery(callbackQuery);
        });

        // Handle text messages
        this.bot.on('message', (msg) => {
            if (msg.text && !msg.text.startsWith('/')) {
                this.handleTextMessage(msg);
            }
        });

        console.log(`✅ ${this.botName} bot is ready!`);
    }

    async handleStart(msg, referralCode = '') {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.username || msg.from.first_name;

        try {
            // Check if user exists in database
            let user = await this.db.getUser(userId);
            
            if (!user) {
                // Create new user
                user = await this.db.createUser({
                    telegramId: userId,
                    username: username,
                    messagesLeft: parseInt(process.env.STARTING_MESSAGES),
                    imagesLeft: parseInt(process.env.STARTING_IMAGES),
                    referralCode: referralCode.trim(),
                    joinedAt: new Date()
                });

                // Process referral if exists
                if (referralCode.trim()) {
                    await this.referral.processReferral(referralCode.trim(), userId);
                }
            }

            // Check channel subscription
            const isSubscribed = await this.checkChannelSubscription(userId);
            
            if (!isSubscribed) {
                await this.sendChannelSubscriptionPrompt(chatId);
                return;
            }

            // Send main menu
            await this.sendMainMenu(chatId, user);

        } catch (error) {
            console.error('Error in handleStart:', error);
            await this.bot.sendMessage(chatId, '❌ Something went wrong. Please try again later.');
        }
    }

    async checkChannelSubscription(userId) {
        try {
            const member = await this.bot.getChatMember(this.channelId, userId);
            return ['member', 'administrator', 'creator'].includes(member.status);
        } catch (error) {
            console.error('Error checking channel subscription:', error);
            return false;
        }
    }

    async sendChannelSubscriptionPrompt(chatId) {
        const message = `🌸 Welcome to ${this.botName}! 💕

To unlock all features, please join our channel first:

${this.channelName}

After joining, click the button below to verify your subscription! ✨`;

        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '📢 Join Channel',
                        url: `https://t.me/${this.channelId.replace('@', '')}`
                    }
                ],
                [
                    {
                        text: '✅ I Joined - Verify',
                        callback_data: 'verify_subscription'
                    }
                ]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    async sendMainMenu(chatId, user) {
        const message = `💕 Welcome back, darling! I'm ${this.botName}, your AI girlfriend! 

💌 Messages left: ${user.messagesLeft}
🖼️ Images left: ${user.imagesLeft}
👥 Referrals: ${user.referrals || 0}

What would you like to do today? 💖`;

        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '💬 Chat with Waifu',
                        callback_data: 'chat_waifu'
                    },
                    {
                        text: '📸 Send Me Picture',
                        callback_data: 'send_picture'
                    }
                ],
                [
                    {
                        text: '🔗 Get Referral Link',
                        callback_data: 'get_referral'
                    },
                    {
                        text: '💰 Waifu Wallet',
                        callback_data: 'show_wallet'
                    }
                ]
            ]
        };

        await this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    async handleCallbackQuery(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const data = callbackQuery.data;

        try {
            // Answer the callback query to remove loading state
            await this.bot.answerCallbackQuery(callbackQuery.id);

            switch (data) {
                case 'verify_subscription':
                    await this.handleSubscriptionVerification(chatId, userId);
                    break;
                
                case 'chat_waifu':
                    await this.handleChatWaifu(chatId, userId);
                    break;
                
                case 'send_picture':
                    await this.handleSendPicture(chatId, userId);
                    break;
                
                case 'get_referral':
                    await this.handleGetReferral(chatId, userId);
                    break;
                
                case 'show_wallet':
                    await this.handleShowWallet(chatId, userId);
                    break;
                
                case 'upgrade_tier1':
                    await this.handleUpgradePlan(chatId, userId, 'tier1');
                    break;
                
                case 'upgrade_tier2':
                    await this.handleUpgradePlan(chatId, userId, 'tier2');
                    break;
                
                case 'back_to_menu':
                    const user = await this.db.getUser(userId);
                    await this.sendMainMenu(chatId, user);
                    break;
                
                default:
                    await this.bot.sendMessage(chatId, '❌ Unknown command.');
            }

        } catch (error) {
            console.error('Error in handleCallbackQuery:', error);
            await this.bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
        }
    }

    async handleSubscriptionVerification(chatId, userId) {
        const isSubscribed = await this.checkChannelSubscription(userId);
        
        if (isSubscribed) {
            const user = await this.db.getUser(userId);
            await this.bot.sendMessage(chatId, '✅ Great! You have successfully joined the channel. Welcome to the family! 💕');
            // Show menu immediately after verification
            setTimeout(async () => {
                await this.sendMainMenu(chatId, user);
            }, 1000);
        } else {
            await this.bot.sendMessage(chatId, '❌ You haven\'t joined the channel yet. Please join first and then verify again.');
        }
    }

    async handleChatWaifu(chatId, userId) {
        const user = await this.db.getUser(userId);
        
        if (user.messagesLeft <= 0) {
            await this.bot.sendMessage(chatId, '💔 You\'ve run out of messages! Get more through referrals or upgrade your plan.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 Get Referral Link', callback_data: 'get_referral' }],
                        [{ text: '💰 Upgrade Plan', callback_data: 'show_wallet' }],
                        [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            return;
        }

        await this.bot.sendMessage(chatId, `💕 I'm here for you, darling! Send me a message and I'll respond with all my love! 

💌 Messages left: ${user.messagesLeft}

Type anything to start our conversation! 💖`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }

    async handleSendPicture(chatId, userId) {
        const user = await this.db.getUser(userId);
        
        if (user.imagesLeft <= 0) {
            await this.bot.sendMessage(chatId, '💔 You\'ve run out of image credits! Get more through referrals or upgrade your plan.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 Get Referral Link', callback_data: 'get_referral' }],
                        [{ text: '💰 Upgrade Plan', callback_data: 'show_wallet' }],
                        [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            return;
        }

        await this.bot.sendMessage(chatId, '🎨 Generating a special picture just for you, darling! Please wait... 💕');
        
        try {
            const imagePrompt = "Suzune Horikita, from Classroom of the Elite, hot anime girl, seductive pose, detailed, high quality, NSFW, beautiful red eyes, long black hair, perfect body, intricate school uniform, vibrant colors, dynamic lighting, masterpiece, best quality";
            const imageUrl = await this.imageGen.generateImage(imagePrompt);
            
            if (imageUrl) {
                await this.bot.sendPhoto(chatId, imageUrl, {
                    caption: `💖 Here's a special picture just for you, my love! 

🖼️ Images left: ${user.imagesLeft - 1}`,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                        ]
                    }
                });
                
                // Decrease image count
                await this.db.updateUser(userId, { 
                    imagesLeft: user.imagesLeft - 1 
                });
            } else {
                await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t generate an image right now. Please try again later.');
            }
        } catch (error) {
            console.error('Error generating image:', error);
            await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t generate an image right now. Please try again later.');
        }
    }

    async handleGetReferral(chatId, userId) {
        const referralLink = await this.referral.generateReferralLink(userId);
        
        const message = `🔗 Your Personal Referral Link:

${referralLink}

💰 Earn rewards for each friend who joins:
• 12 bonus messages 💌
• 2 bonus images 🖼️

Share this link with your friends and earn together! 💕`;

        await this.bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }

    async handleShowWallet(chatId, userId) {
        const user = await this.db.getUser(userId);
        
        const message = `💰 Your Waifu Wallet:

💌 Messages left: ${user.messagesLeft}
🖼️ Images left: ${user.imagesLeft}
👥 Successful referrals: ${user.referrals || 0}

💎 Upgrade Plans:
• ₹${process.env.TIER_1_PRICE || 50} → ${process.env.TIER_1_MESSAGES || 100} messages + ${process.env.TIER_1_IMAGES || 25} images
• ₹${process.env.TIER_2_PRICE || 100} → ${process.env.TIER_2_MESSAGES || 210} messages + ${process.env.TIER_2_IMAGES || 32} images

Choose a plan to upgrade! 💕`;

        await this.bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: `💎 ₹${process.env.TIER_1_PRICE || 50} Plan`, callback_data: 'upgrade_tier1' },
                        { text: `💎 ₹${process.env.TIER_2_PRICE || 100} Plan`, callback_data: 'upgrade_tier2' }
                    ],
                    [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }

    async handleUpgradePlan(chatId, userId, plan) {
        try {
            const paymentMessage = this.upiPayment.generatePaymentMessage(plan);
            if (!paymentMessage) {
                await this.bot.sendMessage(chatId, '❌ Invalid plan selected.');
                return;
            }

            await this.bot.sendMessage(chatId, paymentMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back to Wallet', callback_data: 'show_wallet' }]
                    ]
                }
            });

            // Log the payment request
            const reference = this.upiPayment.generateUTRReference(userId, plan);
            await this.upiPayment.logPaymentRequest(userId, plan, reference);

        } catch (error) {
            console.error('Error in handleUpgradePlan:', error);
            await this.bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
        }
    }

    async handleTextMessage(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        try {
            const user = await this.db.getUser(userId);
            
            if (!user) {
                await this.bot.sendMessage(chatId, 'Please start the bot first by typing /start');
                return;
            }

            // Check if the message looks like a UTR ID (12 digits)
            if (this.upiPayment.validateUTRFormat(text)) {
                const result = await this.upiPayment.processUTRSubmission(userId, text, 'unknown');
                await this.bot.sendMessage(chatId, result.message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                        ]
                    }
                });
                return;
            }

            if (user.messagesLeft <= 0) {
                await this.bot.sendMessage(chatId, '💔 You\'ve run out of messages! Use /start to see your options.');
                return;
            }

            // Generate AI response
            const response = await this.deepseek.generateResponse(text, userId);
            
            await this.bot.sendMessage(chatId, response, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });

            // Decrease message count
            await this.db.updateUser(userId, { 
                messagesLeft: user.messagesLeft - 1 
            });

        } catch (error) {
            console.error('Error handling text message:', error);
            await this.bot.sendMessage(chatId, '❌ Sorry, I couldn\'t process your message. Please try again.');
        }
    }
}

// Start the bot
const bot = new AIWaifuBot();

module.exports = AIWaifuBot;

