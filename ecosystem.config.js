module.exports = {
  apps: [
    {
      name: 'ai-waifu-bot',
      script: 'src/bot.js',
      cwd: '/home/ubuntu/ai-waifu-bot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_file: './logs/bot-combined.log',
      time: true
    },
    {
      name: 'ai-waifu-admin',
      script: 'admin/server.js',
      cwd: '/home/ubuntu/ai-waifu-bot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_file: './logs/admin-combined.log',
      time: true
    }
  ]
};

