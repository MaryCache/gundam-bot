module.exports = {
  apps: [
    {
      name: "gundam-bot",
      cwd: "D:/aaaaaaaaaaa/gundam-bot",
      script: "dist/bot.js", // ← ビルド済みのJSを実行！
      interpreter: "C:/Program Files/nodejs/node.exe",
      node_args: ["-r", "dotenv/config"],
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
