module.exports = {
  apps: [
    {
      name: "shift-happens-api",
      // Run from the repo root so the root .env (DATABASE_URL etc.) is loaded
      // by the server on every spawn.
      cwd: __dirname,
      script: "server/dist/index.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 1000,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 4000,
      },
    },
  ],
};
