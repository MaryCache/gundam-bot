// src/features/mechs.ts
import crypto from "crypto";
import { loadDB, saveDB, loadSelections, saveSelections } from "../store.js";
// ---- 基本CRUD ----
export async function importMech(ownerId, jsonStr) {
    let data;
    try {
        data = JSON.parse(jsonStr);
    }
    catch {
        throw new Error("JSONのパースに失敗。```で囲って正しいJSONを貼ってね。");
    }
    if (!data.機体)
        throw new Error("キー『機体』がないよ。");
    const src = data.機体;
    const typeRaw = (src.Type ?? "").toString().toUpperCase();
    if (!["F", "S", "E"].includes(typeRaw))
        throw new Error("Type は F/S/E のいずれかにしてね。");
    const type = typeRaw;
    const m = {
        id: crypto.randomUUID(),
        ownerId,
        name: src.名前 ?? "NO NAME",
        type,
        TLv: Number(src.TLv ?? 0),
        mobility: Number(src.機動 ?? 0),
        armorMax: Number(src.装甲 ?? 0),
        armorCurrent: Number(src.装甲 ?? 0),
        load: Number(src.積載 ?? 0),
        createdAt: Date.now(),
    };
    const db = await loadDB();
    db.mechs.push(m);
    await saveDB(db);
    return m;
}
export async function listMechs(ownerId) {
    const db = await loadDB();
    return db.mechs
        .filter(m => m.ownerId === ownerId)
        .sort((a, b) => a.createdAt - b.createdAt);
}
export async function deleteMech(ownerId, idOrName) {
    const db = await loadDB();
    const before = db.mechs.length;
    db.mechs = db.mechs.filter(m => !(m.ownerId === ownerId && (m.id === idOrName || m.name === idOrName)));
    const changed = before !== db.mechs.length;
    if (changed)
        await saveDB(db);
    return changed;
}
function keyOf(sel) {
    return `${sel.channelId}:${sel.userId}`;
}
export async function selectMech(sel, idOrName) {
    const db = await loadDB();
    const found = db.mechs.find(m => m.ownerId === sel.userId && (m.id === idOrName || m.name === idOrName));
    if (!found)
        return null;
    const s = await loadSelections();
    s.mech[keyOf(sel)] = found.id;
    await saveSelections(s);
    return found;
}
export async function currentMech(sel) {
    const s = await loadSelections();
    const id = s.mech[keyOf(sel)];
    if (!id)
        return null;
    const db = await loadDB();
    return db.mechs.find(m => m.id === id) ?? null;
}
// ---- 表示 ----
export function formatMechSheet(m) {
    return [
        `## ${m.name}`,
        "```",
        " ─=≡STATUS≡=─",
        `Type：${m.type}`,
        `TLv：${m.TLv}`,
        `機動：${m.mobility}`,
        `装甲：${m.armorCurrent}／${m.armorMax}`,
        `積載：${m.load}`,
        "```",
    ].join("\n");
}
// ---- 装甲変更 ----
// /ms armor add|sub|set <value> に対応
export async function mutateArmor(sel, mode, value) {
    const mech = await currentMech(sel);
    if (!mech)
        return null;
    if (mode === "add") {
        mech.armorCurrent += value;
    }
    else if (mode === "sub") {
        mech.armorCurrent -= value;
    }
    else if (mode === "set") {
        mech.armorCurrent = value;
    }
    const db = await loadDB();
    const idx = db.mechs.findIndex(x => x.id === mech.id);
    if (idx >= 0)
        db.mechs[idx] = mech;
    await saveDB(db);
    return mech;
}
// ---- プロパティ質問応答 ----
export function matchMechPropQuery(text) {
    const normalized = text.trim();
    const props = ["Type", "TLv", "機動", "装甲", "積載"];
    return props.find(p => normalized === p) ?? null;
}
export async function answerMechProp(sel, prop) {
    const mech = await currentMech(sel);
    if (!mech)
        return "選択中の機体がないよ！";
    switch (prop) {
        case "Type": return `Type：${mech.type}`;
        case "TLv": return `TLv：${mech.TLv}`;
        case "機動": return `機動：${mech.mobility}`;
        case "装甲": return `装甲：${mech.armorCurrent}／${mech.armorMax}`;
        case "積載": return `積載：${mech.load}`;
        default: return "未知のプロパティだよ";
    }
}
