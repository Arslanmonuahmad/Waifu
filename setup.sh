#!/bin/bash

echo "🤖 AI Waifu Bot Setup Script"
echo "=============================="

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data
mkdir -p logs
mkdir -p public/images

# Set permissions
echo "🔒 Setting permissions..."
chmod 755 data
chmod 755 logs
chmod 755 public
chmod 755 public/images

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Please copy .env.example to .env and configure your API keys"
    exit 1
fi

# Create initial database files
echo "🗄️  Initializing database..."
node -e "
const Database = require('./src/database');
const db = new Database();
console.log('Database initialized successfully');
"

echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Configure your .env file with API keys"
echo "2. Start the bot: npm start"
echo "3. Start admin panel: npm run admin"
echo ""
echo "Or use PM2 for production:"
echo "pm2 start ecosystem.config.js"

