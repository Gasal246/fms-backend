module.exports = {
  apps: [
    {
      name: 'fms-server',
      script: 'dist/main/server.js',
      cwd: '/var/www/fms/server',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3022,
      },
      max_memory_restart: '300M',
      error_file: '/var/log/pm2/fms-server-error.log',
      out_file: '/var/log/pm2/fms-server-out.log',
      time: true,
    },
  ],
};
