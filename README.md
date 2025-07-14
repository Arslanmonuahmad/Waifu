# AI Waifu Telegram Bot

A complete Telegram bot with AI girlfriend functionality, featuring DeepSeek API integration for chat, Stable Horde API for NSFW image generation, referral system, and admin panel.

## Features

### 🤖 Bot Features
- **Channel Subscription Verification** - Users must join a specified channel before accessing features
- **AI Chat with Waifu** - Realistic girlfriend roleplay using DeepSeek API
- **NSFW Image Generation** - Consistent anime-style character images via Stable Horde API
- **Referral System** - Users earn credits by referring friends
- **Credit System** - Message and image limits with upgrade options

### 💰 Monetization
- **Referral Rewards**: 12 messages + 2 images per successful referral
- **Upgrade Tiers**:
  - ₹50 → 36 messages + 10 images
  - ₹100 → 80 messages + 25 images

### 🔧 Admin Panel
- **User Management** - View, edit, and delete users
- **Statistics Dashboard** - Total users, daily active, usage stats
- **Referral Monitoring** - Track referrals and detect abuse
- **System Logs** - Complete activity logging
- **Credit Management** - Manually add/subtract user credits

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Telegram Bot Token
- DeepSeek API Key
- Stable Horde API Key (optional, has free tier)

### Quick Setup

1. **Extract Files**
   ```bash
   unzip ai-waifu-bot.zip
   cd ai-waifu-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Edit `.env` file with your credentials:
   ```env
   # Telegram Bot Configuration
   TELEGRAM_BOT_TOKEN=8196758558:AAEXm6nEDt92JHfELoFc8mOc0WRKhJ6xTAI
   TELEGRAM_CHANNEL_ID=@your_channel_here
   TELEGRAM_CHANNEL_NAME=Your Channel Name
   
   # DeepSeek API Configuration
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   
   # Stable Horde API Configuration (optional)
   STABLE_HORDE_API_KEY=your_stable_horde_api_key_here
   
   # Admin Panel Configuration
   ADMIN_USERNAME=monkeyspeed
   ADMIN_PASSWORD=monkeyspeed
   ADMIN_PORT=3000
   ```

4. **Start the Bot**
   ```bash
   npm start
   ```

5. **Start Admin Panel** (in separate terminal)
   ```bash
   npm run admin
   ```

## cPanel Deployment

### Method 1: Direct Upload

1. **Prepare Files**
   - Upload all files to your cPanel File Manager
   - Extract in your domain's public_html directory

2. **Install Dependencies**
   - Use cPanel Terminal or SSH:
   ```bash
   cd public_html/ai-waifu-bot
   npm install
   ```

3. **Configure Environment**
   - Edit `.env` file through cPanel File Manager
   - Set your API keys and bot token

4. **Start Services**
   ```bash
   # Start bot
   node src/bot.js &
   
   # Start admin panel
   node admin/server.js &
   ```

### Method 2: Using PM2 (Recommended)

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   ```

3. **Save PM2 Configuration**
   ```bash
   pm2 save
   pm2 startup
   ```

## Configuration

### Bot Settings

Edit `.env` file to configure:

- **TELEGRAM_BOT_TOKEN**: Your bot token from @BotFather
- **TELEGRAM_CHANNEL_ID**: Channel users must join (e.g., @yourchannel)
- **DEEPSEEK_API_KEY**: API key from DeepSeek
- **STABLE_HORDE_API_KEY**: API key from Stable Horde (optional)

### Character Customization

Edit `src/deepseek.js` to customize:
- Bot personality
- Response style
- Character traits

Edit `src/stablehorde.js` to customize:
- Character appearance
- Image generation prompts
- Art style

### Credit System

Edit `.env` to adjust:
- Starting credits (STARTING_MESSAGES, STARTING_IMAGES)
- Referral bonuses (REFERRAL_BONUS_MESSAGES, REFERRAL_BONUS_IMAGES)
- Upgrade tiers (TIER_1_PRICE, TIER_1_MESSAGES, etc.)

## API Keys Setup

### 1. Telegram Bot Token
1. Message @BotFather on Telegram
2. Create new bot with `/newbot`
3. Copy the token to `.env`

### 2. DeepSeek API Key
1. Visit [DeepSeek API](https://api.deepseek.com)
2. Sign up and get API key
3. Add to `.env` file

### 3. Stable Horde API Key
1. Visit [Stable Horde](https://stablehorde.net)
2. Register account
3. Get API key from profile
4. Add to `.env` file (or use "0000000000" for anonymous)

## Usage

### Bot Commands
- `/start` - Initialize bot and show main menu
- `/start REFERRAL_CODE` - Join with referral code

### Admin Panel
1. Access: `http://your-domain.com:3000`
2. Login: monkeyspeed / monkeyspeed
3. Manage users, view stats, monitor referrals

### User Flow
1. User starts bot
2. Bot checks channel subscription
3. User joins channel and verifies
4. Main menu appears with 4 options:
   - Chat with Waifu
   - Send Me Picture
   - Get Referral Link
   - Waifu Wallet

## File Structure

```
ai-waifu-bot/
├── src/
│   ├── bot.js              # Main bot logic
│   ├── database.js         # JSON database management
│   ├── deepseek.js         # DeepSeek API integration
│   ├── stablehorde.js      # Stable Horde API integration
│   └── referral.js         # Referral system
├── admin/
│   ├── server.js           # Admin panel server
│   └── public/
│       ├── login.html      # Admin login page
│       └── dashboard.html  # Admin dashboard
├── data/                   # Database files (auto-created)
├── public/                 # Static files
├── config/                 # Configuration files
├── .env                    # Environment variables
├── package.json            # Dependencies
└── README.md              # This file
```

## Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check bot token in `.env`
   - Verify bot is started with `npm start`
   - Check console for errors

2. **Channel verification failing**
   - Ensure channel ID is correct (with @)
   - Bot must be admin in the channel
   - Channel must be public or bot must have access

3. **AI responses not working**
   - Verify DeepSeek API key
   - Check API quota/limits
   - Review console logs for API errors

4. **Images not generating**
   - Check Stable Horde API key
   - Verify internet connection
   - Check API status at stablehorde.net

5. **Admin panel not accessible**
   - Check if admin server is running
   - Verify port 3000 is open
   - Check firewall settings

### Logs and Debugging

- Bot logs: Check console output when running `npm start`
- Admin logs: Check console output when running `npm run admin`
- Database logs: Check `data/logs.json`
- Error logs: Check cPanel Error Logs

## Security

### Important Security Notes

1. **Change Default Credentials**
   - Update admin username/password in `.env`
   - Use strong passwords

2. **Protect API Keys**
   - Never commit `.env` to version control
   - Use environment variables in production

3. **Database Security**
   - JSON files contain user data
   - Ensure proper file permissions
   - Regular backups recommended

4. **Admin Panel Security**
   - Use HTTPS in production
   - Consider IP restrictions
   - Enable session security

## Support

### Getting Help

1. **Check Logs**: Always check console output and error logs first
2. **Verify Configuration**: Ensure all API keys and settings are correct
3. **Test Components**: Test bot, admin panel, and APIs separately
4. **Documentation**: Review this README and inline code comments

### Contact

For technical support or customization requests, contact the developer.

## License

This project is for educational and commercial use. Please respect API terms of service for DeepSeek and Stable Horde.

---

**Note**: This bot includes NSFW content generation. Ensure compliance with local laws and platform policies.

