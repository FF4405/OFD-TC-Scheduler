// PM2 process configuration
// Usage:
//   pm2 start ecosystem.config.js          # start production
//   pm2 start ecosystem.config.js --env dev # start dev (hot reload)
//   pm2 save                               # persist restart list
//   pm2 startup                            # register as Windows service

module.exports = {
  apps: [
    {
      name: 'ofd-scheduler',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      interpreter: 'none',       // next is a JS binary, no extra interpreter
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_dev: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      // Restart policy
      max_memory_restart: '500M',
      restart_delay: 3000,
      max_restarts: 10,
      // Logging (paths relative to cwd)
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
