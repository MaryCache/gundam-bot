import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChatInputCommandInteraction, SlashCommandBuilder,
  ComponentType, ButtonInteraction, EmbedBuilder, PermissionFlagsBits
} from "discord.js";

import {
  importCharacter, listCharacters, deleteCharacter, selectCharacter,
  currentCharacter, formatSheet
} from "../features/characters.js"; // ★ここを .js で

import { SelectionKey, Character } from "../types.js";
import { loadSelections, saveSelections } from "../store.js";

export const pcCommand = new SlashCommandBuilder()
  .setName("pc")
  .setDescription("キャラクター管理")
  .addSubcommand((s) =>
    s.setName("import").setDescription("JSONでキャラ登録")
      .addStringOption((o) =>
        o.setName("json").setDescription("キャラJSON（```不要）").setRequired(true)
      )
  )
  .addSubcommand((s) => s.setName("list").setDescription("自分のキャラ一覧（ボタン操作）"))
  .addSubcommand((s) =>
    s.setName("select").setDescription("選択キャラ切替")
      .addStringOption((o) => o.setName("id_or_name").setDescription("キャラIDまたは名前").setRequired(true))
  )
  .addSubcommand((s) => s.setName("whoami").setDescription("このチャンネルの選択キャラ表示"))
  .addSubcommand((s) =>
    s.setName("delete").setDescription("自分のキャラを削除")
      .addStringOption((o) => o.setName("id_or_name").setDescription("キャラIDまたは名前").setRequired(true))
  )
  .addSubcommand((s) => s.setName("sheet").setDescription("選択キャラのシートを公開"));

export async function handlePc(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

if (sub === "import") {
  const json = interaction.options.getString("json", true);
  try {
    await interaction.deferReply({ ephemeral: true });
    const c = await importCharacter(userId, json);
    await interaction.editReply(`登録完了！ ID: \`${c.id}\` / 名前: **${c.name}**`);
  } catch (e: any) {
    const msg = e?.message ?? "不明なエラー";
    // 失敗してもプロセスを落とさず、ユーザーにだけ知らせる
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`エラー：${msg}`);
    } else {
      await interaction.reply({ content: `エラー：${msg}`, ephemeral: true });
    }
  }
  return;
}

  if (sub === "list") {
    const chars = await listCharacters(userId);
    if (chars.length === 0) {
      await interaction.reply({ content: "キャラがありません。まず `/pc import` で登録してね。", ephemeral: true });
      return;
    }
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(chars.length / pageSize));
    const view = buildListMessage(chars, userId, 0, totalPages, pageSize);
    await interaction.reply({ ...view, ephemeral: true });
    return;
  }

  if (sub === "select") {
    const key = interaction.options.getString("id_or_name", true);
    const found = await selectCharacter({ userId, channelId }, key);
    await interaction.reply({
      content: found ? `このチャンネルの選択キャラを **${found.name}** に変更したよ。` : "見つからなかったよ。`/pc list` で確認してね。",
      ephemeral: true,
    });
    return;
  }

  if (sub === "whoami") {
    const c = await currentCharacter({ userId, channelId });
    await interaction.reply({ content: c ? `選択中：**${c.name}**` : "選択キャラなし。`/pc select` で選んでね。", ephemeral: true });
    return;
  }

  if (sub === "delete") {
    const key = interaction.options.getString("id_or_name", true);
    const ok = await deleteCharacter(userId, key);
    await interaction.reply({ content: ok ? "削除したよ。" : "削除できなかった（見つからない）。", ephemeral: true });
    return;
  }

  if (sub === "sheet") {
    const c = await currentCharacter({ userId, channelId });
    if (!c) {
      await interaction.reply({ content: "選択キャラなし。`/pc select` で選んでね。", ephemeral: true });
    } else {
      await interaction.reply({ content: "```\n" + formatSheet(c) + "\n```" });
    }
    return;
  }
}

// ====== 一覧メッセージ with ボタン ======
function buildListMessage(chars: Character[], ownerId: string, page: number, totalPages: number, pageSize: number) {
  const start = page * pageSize;
  const slice = chars.slice(start, start + pageSize);

  const lines: string[] = [];
  lines.push(`あなたのキャラ一覧（${chars.length}件）`);
  lines.push(`ページ ${page + 1}/${totalPages}`);
  lines.push("");
  slice.forEach((c, i) => lines.push(`${start + i + 1}. **${c.name}**  (ID:\`${c.id}\`)`));

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (const c of slice) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`pc:sel:${ownerId}:${c.id}`)
          .setLabel(`選択：${c.name}`.slice(0, 80))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`pc:delAsk:${ownerId}:${c.id}`)
          .setLabel("削除")
          .setStyle(ButtonStyle.Danger),
      )
    );
  }

  // custom_id 重複回避のため prev/next を別IDに
  const prevPage = Math.max(0, page - 1);
  const nextPage = Math.min(totalPages - 1, page + 1);
  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pc:pagePrev:${ownerId}:${prevPage}`)
      .setLabel("◀ 前へ")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`pc:pageNext:${ownerId}:${nextPage}`)
      .setLabel("次へ ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`pc:refresh:${ownerId}:${page}`)
      .setLabel("更新")
      .setStyle(ButtonStyle.Secondary),
  );

  if (rows.length < 5) rows.push(nav);
  else rows.splice(4, 0, nav);

  return { content: lines.join("\n"), components: rows };
}

// ====== ボタン操作 ======
export async function handlePcButton(i: ButtonInteraction) {
  const [ns, action, ownerId, payload] = i.customId.split(":");
  if (ns !== "pc") return false;

  if (ownerId !== i.user.id) {
    await i.reply({ content: "これはあなたの一覧じゃないみたい。`/pc list` を自分で実行してね。", ephemeral: true });
    return true;
  }

  if (action === "sel") {
    const found = await selectCharacter({ userId: i.user.id, channelId: i.channelId }, payload);
    await i.reply({ content: found ? `このチャンネルの選択キャラを **${found.name}** に変更したよ。` : "見つからなかったよ。", ephemeral: true });
    return true;
  }

  if (action === "delAsk") {
    await i.reply({
      content: "本当に削除しますか？（この操作は取り消せません）",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`pc:del:${ownerId}:${payload}`).setLabel("削除する").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`pc:cancel:${ownerId}:${payload}`).setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
        ),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (action === "del") {
    const ok = await deleteCharacter(i.user.id, payload);
    await i.update({ content: ok ? "削除しました。" : "削除できませんでした。", components: [] });
    return true;
  }

  if (action === "cancel") {
    await i.update({ content: "キャンセルしました。", components: [] });
    return true;
  }

  if (action === "pagePrev" || action === "pageNext" || action === "refresh") {
    const page = parseInt(payload, 10) || 0;
    const chars = await listCharacters(i.user.id);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(chars.length / pageSize));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const view = buildListMessage(chars, i.user.id, safePage, totalPages, pageSize);
    await i.update(view);
    return true;
  }

  return false;
}
