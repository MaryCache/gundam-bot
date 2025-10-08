import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, } from "discord.js";
/* 盤面の保存先: data/boards/<channelId>.json */
const DATA_DIR = path.resolve("data", "boards");
async function ensureDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
}
function boardPath(channelId) {
    return path.join(DATA_DIR, `${channelId}.json`);
}
/** 現在の盤面を読み込み（なければ null） */
export async function loadBoard(channelId) {
    await ensureDir();
    try {
        const raw = await fs.readFile(boardPath(channelId), "utf8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** 盤面を保存 */
export async function saveBoard(state) {
    await ensureDir();
    await fs.writeFile(boardPath(state.channelId), JSON.stringify(state, null, 2), "utf8");
}
/** 新規作成（上書き作成） */
export async function createBoard(channelId, ownerId, size, mode) {
    const st = {
        channelId,
        ownerId,
        size,
        mode,
        members: [],
        createdAt: Date.now(),
    };
    await saveBoard(st);
    return st;
}
/** 参加者追加 */
export async function addParticipant(channelId, name) {
    const st = (await loadBoard(channelId));
    const exists = st.members.find((m) => m.name === name);
    if (exists)
        return exists;
    const p = {
        id: crypto.randomUUID(),
        name,
        pos: null,
        tmp: null,
    };
    st.members.push(p);
    await saveBoard(st);
    return p;
}
/** 参加者削除（id または name） */
export async function removeParticipant(channelId, idOrName) {
    const st = (await loadBoard(channelId));
    const before = st.members.length;
    st.members = st.members.filter((m) => !(m.id === idOrName || m.name === idOrName));
    const changed = st.members.length !== before;
    if (changed)
        await saveBoard(st);
    return changed;
}
/** 一時移動（battle: tmp, free: 即 pos 反映） */
export async function setMove(channelId, participantId, targetPos) {
    const st = (await loadBoard(channelId));
    const m = st.members.find((x) => x.id === participantId);
    if (!m)
        throw new Error("参加者が見つかりません。");
    if (st.mode === "free") {
        m.pos = targetPos;
    }
    else {
        m.tmp = targetPos;
    }
    await saveBoard(st);
    return st;
}
/** battle モードで一斉確定（全員 tmp を pos に反映） */
export async function commitAll(channelId) {
    const st = (await loadBoard(channelId));
    for (const m of st.members) {
        if (typeof m.tmp === "number")
            m.pos = m.tmp;
        m.tmp = null;
    }
    await saveBoard(st);
    return st;
}
/** 盤面のEmbed/Componentsを生成（ビルダーそのまま返す） */
export function renderBoard(state) {
    const lines = [];
    lines.push("座標盤面");
    lines.push("");
    for (let i = 1; i <= state.size; i++) {
        const onCell = state.members.filter((m) => m.pos === i).map((m) => m.name);
        lines.push(`${i}: ${onCell.join(", ")}`);
    }
    lines.push("");
    lines.push(`size: ${state.size} | mode: ${state.mode}`);
    // --- battleモードの入力状況を表示 ---
    if (state.mode === "battle") {
        const total = state.members.length;
        const ready = state.members.filter((m) => typeof m.tmp === "number").length;
        const note = ready === total && total > 0 ? "全員入力済み" : "入力待機中…";
        lines.push(`(${ready}/${total}) ${note}`);
    }
    const embed = new EmbedBuilder()
        .setDescription("```\n" + lines.join("\n") + "\n```")
        .setColor(0x2b90d9);
    // --- Discord制約対応 ---
    // メンバーセレクト：options は 1〜25 件必須。0件のときはダミー1件＋無効化
    const memberSelect = new StringSelectMenuBuilder()
        .setCustomId("board:select-member")
        .setPlaceholder("キャラを選択");
    if (state.members.length > 0) {
        memberSelect.addOptions(state.members.slice(0, 25).map((m) => ({
            label: m.name,
            value: m.id,
        })));
    }
    else {
        memberSelect
            .addOptions([{ label: "（参加者なし）", value: "none" }])
            .setDisabled(true);
    }
    // 座標セレクト：options 最大25件（UI制約）。盤面サイズの表示自体はそのまま。
    const cappedSize = Math.max(1, Math.min(25, state.size));
    const posSelect = new StringSelectMenuBuilder()
        .setCustomId("board:select-pos")
        .setPlaceholder(`座標を選択（1～${state.size}）`)
        .addOptions(Array.from({ length: cappedSize }, (_, i) => {
        const v = (i + 1).toString();
        return { label: v, value: v };
    }));
    const rows = [
        new ActionRowBuilder().addComponents(memberSelect),
        new ActionRowBuilder().addComponents(posSelect),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("board:confirm").setLabel("確定").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("board:publish").setLabel("表示/更新").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("board:delete").setLabel("削除").setStyle(ButtonStyle.Danger)),
    ];
    return { embed, components: rows };
}
