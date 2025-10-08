import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ButtonInteraction,
  TextChannel,
} from "discord.js";
import {
  createBoard,
  loadBoard,
  saveBoard,
  addParticipant,
  removeParticipant,
  setMove,
  commitAll,
  renderBoard,
} from "../features/board.js";
import { BoardMode } from "../types.js";

/* ===== 選択状態（チャンネル×ユーザー）を一時保持 ===== */
type SelectState = { memberId?: string; pos?: number };
const selections = new Map<string, SelectState>();
const keyOf = (channelId: string, userId: string) => `${channelId}:${userId}`;

/* 盤面メッセージを更新（なければ作る） */
async function upsertBoardMessage(
  channel: TextChannel,
  st: Awaited<ReturnType<typeof loadBoard>>
) {
  if (!st) return;
  const ui = renderBoard(st);
  if (st.lastMessageId) {
    try {
      const msg = await channel.messages.fetch(st.lastMessageId);
      await msg.edit({ embeds: [ui.embed], components: ui.components });
      return;
    } catch {
      /* 取得できなければ新規送信へフォールバック */
    }
  }
  const sent = await channel.send({ embeds: [ui.embed], components: ui.components });
  st.lastMessageId = sent.id;
  await saveBoard(st);
}

/* ========== スラッシュコマンド定義 ========== */
export const boardCommand = new SlashCommandBuilder()
  .setName("board")
  .setDescription("座標盤面の作成/操作")
  .addSubcommand((sc) =>
    sc
      .setName("create")
      .setDescription("盤面を作成（1チャンネルに1つ）")
      .addIntegerOption((o) =>
        o
          .setName("size")
          .setDescription("マス数（1～25）")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(25)
      )
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("モード（free/battle）")
          .addChoices({ name: "free", value: "free" }, { name: "battle", value: "battle" })
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("add")
      .setDescription("参加者を追加")
      .addStringOption((o) => o.setName("name").setDescription("名前").setRequired(true))
  )
  .addSubcommand((sc) =>
    sc
      .setName("remove")
      .setDescription("参加者を削除（IDまたは名前）")
      .addStringOption((o) =>
        o.setName("id_or_name").setDescription("ID または 名前").setRequired(true)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("mode")
      .setDescription("モードを切り替え")
      .addStringOption((o) =>
        o
          .setName("value")
          .setDescription("free/battle")
          .setRequired(true)
          .addChoices({ name: "free", value: "free" }, { name: "battle", value: "battle" })
      )
  )
  .addSubcommand((sc) => sc.setName("sheet").setDescription("盤面を表示/更新"))
  .toJSON();

/* ========== /board 実行 ========== */
export async function handleBoard(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand(true);
  const channelId = i.channelId;
  const channel = i.channel as TextChannel;

  if (sub === "create") {
    const size = Math.max(1, Math.min(25, i.options.getInteger("size", true)));
    const mode = (i.options.getString("mode") as BoardMode | null) ?? "free";
    const st = await createBoard(channelId, i.user.id, size, mode);

    // 返信を盤面本体にし、IDを保存
    const ui = renderBoard(st);
    await i.reply({ embeds: [ui.embed], components: ui.components, withResponse: true });
    const sent = await i.fetchReply();
    st.lastMessageId = (sent as any).id;
    await saveBoard(st);
    return;
  }

  const st0 = await loadBoard(channelId);
  if (!st0) {
    await i.reply({ content: "まだ盤面がありません。`/board create` から。", flags: 64 });
    return;
  }

  if (sub === "add") {
    const name = i.options.getString("name", true);
    await addParticipant(channelId, name);
    const st = await loadBoard(channelId);
    await i.reply({ content: `追加: **${name}**`, flags: 64 });
    await upsertBoardMessage(channel, st);
    return;
  }

  if (sub === "remove") {
    const q = i.options.getString("id_or_name", true);
    const ok = await removeParticipant(channelId, q);
    await i.reply({ content: ok ? "削除しました。" : "削除対象が見つかりません。", flags: 64 });
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return;
  }

  if (sub === "mode") {
    const value = i.options.getString("value", true) as BoardMode;
    st0.mode = value;
    await saveBoard(st0);
    await i.reply({ content: `モードを **${value}** にしました。`, flags: 64 });
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return;
  }

  if (sub === "sheet") {
    // 既存があれば編集。なければ新規保存。
    await i.reply({ content: "盤面を更新しました。", flags: 64 });
    await upsertBoardMessage(channel, st0);
    return;
  }
}

/* ========== ボタン/セレクトのハンドリング ========== */
export async function handleBoardComponent(i: ButtonInteraction | any) {
  const channelId = i.channelId;
  const channel = i.channel as TextChannel;
  const st = await loadBoard(channelId);
  if (!st) {
    await i.reply({ content: "盤面がありません。`/board create` から。", flags: 64 });
    return true;
  }
  const k = keyOf(channelId, i.user.id);
  const sel = selections.get(k) ?? {};
  selections.set(k, sel);

  // セレクト：参加者（通知しない）
  if (i.isStringSelectMenu() && i.customId === "board:select-member") {
    sel.memberId = i.values[0];
    selections.set(k, sel);
    await i.deferUpdate(); // 何も出さない
    return true;
  }

  // セレクト：座標（通知しない）
  if (i.isStringSelectMenu() && i.customId === "board:select-pos") {
    sel.pos = parseInt(i.values[0], 10);
    selections.set(k, sel);
    await i.deferUpdate();
    return true;
  }

  // ボタン：確定（free/battle）
  if (i.isButton() && i.customId === "board:confirm") {
    if (!sel.memberId || typeof sel.pos !== "number") {
      await i.reply({ content: "キャラと座標を選んでから押してね。", flags: 64 });
      return true;
    }
    await setMove(channelId, sel.memberId, sel.pos);

    if (st.mode === "battle") {
      // 本人だけに入力完了を通知（キャラ名と座標）
      const latest = (await loadBoard(channelId))!;
      const name =
        latest.members.find((m: any) => m.id === sel.memberId)?.name ?? "(不明)";
      await i.reply({
        content: `入力を受け付けました：**${name}** → 座標 **${sel.pos}**`,
        flags: 64, // ephemeral
      });

      // 全員が tmp 入力済みなら一括反映して盤面を更新
      const allReady =
        latest.members.length > 0 && latest.members.every((m: any) => m.tmp != null);
      if (allReady) {
        await commitAll(channelId);
        await upsertBoardMessage(channel, await loadBoard(channelId));
      }
    } else {
      // free：静かに即時反映
      await i.deferUpdate();
      await upsertBoardMessage(channel, await loadBoard(channelId));
    }
    return true;
  }

  // ボタン：表示/更新（既存を上書き）
  if (i.isButton() && i.customId === "board:publish") {
    await i.deferUpdate();
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return true;
  }

  // ボタン：削除（選択キャラ連動、既存を上書き）
  if (i.isButton() && i.customId === "board:delete") {
    if (!sel.memberId) {
      await i.reply({ content: "削除するキャラを選んでね。", flags: 64 });
      return true;
    }
    const ok = await removeParticipant(channelId, sel.memberId);
    await i.reply({ content: ok ? "削除しました。" : "削除対象が見つかりません。", flags: 64 });
    selections.set(k, { pos: sel.pos }); // 選択解除
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return true;
  }

  return false;
}
