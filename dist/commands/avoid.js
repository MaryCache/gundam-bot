import { SlashCommandBuilder } from "discord.js";
/** /avoid コマンド定義 */
export const avoidCommand = new SlashCommandBuilder()
    .setName("avoid")
    .setDescription("機動値・精度値・技能Lvから回避率・回避指数・命中指数を計算します。")
    .addNumberOption(o => o.setName("mobility")
    .setDescription("機動値（整数でも小数でもOK）")
    .setRequired(true))
    .addNumberOption(o => o.setName("accuracy")
    .setDescription("精度値（整数でも小数でもOK）")
    .setRequired(true))
    .addIntegerOption(o => o.setName("level")
    .setDescription("機動制御Lv（任意、デフォルト10）")
    .setRequired(false))
    .toJSON();
/** /avoid 実行処理 */
export async function handleAvoid(i) {
    const mobility = i.options.getNumber("mobility", true);
    const accuracy = i.options.getNumber("accuracy", true);
    const level = i.options.getInteger("level") ?? 10;
    // 回避率計算（誤差対策つき）
    let diff = mobility - accuracy;
    diff = Math.round(diff * 100) / 100;
    const avoidRate = 100 + 10 * diff;
    const avoidIndex = level * (avoidRate / 100);
    // 命中指数 = 精度指数 - 回避指数
    const hitIndex = accuracy - avoidIndex;
    const sign = diff >= 0 ? "+" : "-";
    const absDiff = Math.abs(diff);
    const result = "```\n" +
        `【機動制御】Lv：${level}\n` +
        `機動： ${mobility}\n` +
        `精度指数： ${accuracy}\n` +
        `(回避率) ＝ 100％ ${sign} (10％×${absDiff.toFixed(1)}) ＝ ${avoidRate.toFixed(1)}％\n` +
        `(回避指数) ＝ ${level} (${avoidRate.toFixed(1)}％) ＝ ${avoidIndex.toFixed(1)}\n` +
        `(命中指数) ＝ ${accuracy} − ${avoidIndex.toFixed(1)} ＝ ${hitIndex.toFixed(1)}` +
        "\n```";
    await i.reply({ content: result });
}
