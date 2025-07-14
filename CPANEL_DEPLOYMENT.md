# cPanel Deployment Guide

This guide will help you deploy the AI Waifu Bot on cPanel hosting.

## Prerequisites

- cPanel hosting with Node.js support
- SSH access (recommended) or Terminal access in cPanel
- Domain or subdomain for the admin panel

## Step-by-Step Deployment

### 1. Upload Files

**Option A: File Manager**
1. Login to cPanel
2. Open File Manager
3. Navigate to `public_html` (or your domain folder)
4. Upload `ai-waifu-bot.zip`
5. Extract the ZIP file
6. Delete the ZIP file after extraction

**Option B: SSH/Terminal**
```bash
cd public_html
wget [your-zip-file-url]
unzip ai-waifu-bot.zip
rm ai-waifu-bot.zip
```

### 2. Install Dependencies

**Using cPanel Terminal:**
1. Go to cPanel → Terminal
2. Navigate to bot directory:
   ```bash
   cd public_html/ai-waifu-bot
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

**Using SSH:**
```bash
cd /home/[username]/public_html/ai-waifu-bot
npm install
```

### 3. Configure Environment

1. Open File Manager
2. Navigate to `ai-waifu-bot` folder
3. Edit `.env` file
4. Update the following variables:

```env
# Required: Your Telegram Bot Token
TELEGRAM_BOT_TOKEN=8196758558:AAEXm6nEDt92JHfELoFc8mOc0WRKhJ6xTAI

# Required: Your channel information
TELEGRAM_CHANNEL_ID=@your_channel_username
TELEGRAM_CHANNEL_NAME=Your Channel Display Name

# Required: DeepSeek API Key
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional: Stable Horde API Key (use 0000000000 for anonymous)
STABLE_HORDE_API_KEY=your_stable_horde_api_key_here

# Admin Panel Settings
ADMIN_USERNAME=monkeyspeed
ADMIN_PASSWORD=monkeyspeed
ADMIN_PORT=3000

# Bot Settings
BOT_NAME=Lily
STARTING_MESSAGES=12
STARTING_IMAGES=2
```

### 4. Set Up Node.js Application

**If your cPanel supports Node.js Apps:**

1. Go to cPanel → Node.js Apps
2. Click "Create Application"
3. Set:
   - Node.js Version: 16+ (latest available)
   - Application Mode: Production
   - Application Root: `ai-waifu-bot`
   - Application URL: Your domain/subdomain
   - Application Startup File: `src/bot.js`

4. Click "Create"

### 5. Start the Bot

**Method 1: Using Node.js App Manager**
1. In Node.js Apps, click "Start" for your application

**Method 2: Using Terminal/SSH**
```bash
cd public_html/ai-waifu-bot

# Start bot in background
nohup node src/bot.js > logs/bot.log 2>&1 &

# Start admin panel in background
nohup node admin/server.js > logs/admin.log 2>&1 &
```

**Method 3: Using PM2 (if available)**
```bash
# Install PM2 globally
npm install -g pm2

# Start applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### 6. Configure Subdomain for Admin Panel

1. Go to cPanel → Subdomains
2. Create subdomain: `admin.yourdomain.com`
3. Point it to `public_html/ai-waifu-bot/admin/public`

Or access directly via: `yourdomain.com:3000`

### 7. Set Up SSL (Recommended)

1. Go to cPanel → SSL/TLS
2. Enable SSL for your domain/subdomain
3. Force HTTPS redirects

### 8. Configure Firewall (if needed)

Ensure port 3000 is open for admin panel access:
1. Contact hosting provider if port is blocked
2. Or use reverse proxy to serve admin panel on port 80/443

## Troubleshooting

### Common Issues

**1. "npm: command not found"**
- Contact hosting provider to enable Node.js
- Some hosts require enabling Node.js in cPanel

**2. "Permission denied" errors**
```bash
chmod +x setup.sh
chmod 755 data logs public
```

**3. Bot not responding**
- Check if Node.js process is running:
  ```bash
  ps aux | grep node
  ```
- Check logs:
  ```bash
  tail -f logs/bot.log
  ```

**4. Admin panel not accessible**
- Verify port 3000 is open
- Check if admin server is running
- Try accessing via IP:3000

**5. Database errors**
- Ensure data directory has write permissions:
  ```bash
  chmod 755 data
  ```

### Monitoring

**Check running processes:**
```bash
ps aux | grep node
```

**View logs:**
```bash
# Bot logs
tail -f logs/bot.log

# Admin logs  
tail -f logs/admin.log

# PM2 logs (if using PM2)
pm2 logs
```

**Restart services:**
```bash
# Kill existing processes
pkill -f "node src/bot.js"
pkill -f "node admin/server.js"

# Restart
nohup node src/bot.js > logs/bot.log 2>&1 &
nohup node admin/server.js > logs/admin.log 2>&1 &
```

## Security Considerations

1. **Change default admin credentials** in `.env`
2. **Restrict admin panel access** by IP if possible
3. **Use HTTPS** for admin panel
4. **Regular backups** of data directory
5. **Monitor logs** for suspicious activity

## Performance Optimization

1. **Use PM2** for process management
2. **Enable gzip compression** in cPanel
3. **Set up caching** for static files
4. **Monitor resource usage** in cPanel

## Support

If you encounter issues:

1. Check the main README.md file
2. Review console logs and error messages
3. Verify all API keys are correct
4. Test bot functionality step by step
5. Contact hosting provider for server-specific issues

---

**Note**: Some shared hosting providers may have restrictions on long-running Node.js processes. Consider VPS hosting for better performance and reliability.

