import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";
const token = process.env.DISCORD_TOKEN;
const appId = process.env.APP_ID;
const guildId = process.env.GUILD_ID;
if (!token || !appId || !guildId) {
    console.error("❌ .env に DISCORD_TOKEN / APP_ID / GUILD_ID がありません");
    process.exit(1);
}
const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Ping-Pongする！")
].map((c) => c.toJSON());
const rest = new REST({ version: "10" }).setToken(token);
(async () => {
    try {
        console.log("⏫ コマンド登録中…");
        await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
        console.log("✨ 登録完了！");
    }
    catch (err) {
        console.error(err);
    }
})();
