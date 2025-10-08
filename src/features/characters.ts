import { ALL_SKILLS, Character, ImportedCharacterJSON, SelectionKey, Skill } from "../types.js";
import { loadDB, saveDB, loadSelections, saveSelections } from "../store.js";
import { d100, judgeBand, evalLabel } from "../utils/dice.js";
import crypto from "crypto";

function keyOf(sel: SelectionKey) {
  return `${sel.channelId}:${sel.userId}`;
}

export async function importCharacter(ownerId: string, jsonStr: string): Promise<Character> {
  let data: ImportedCharacterJSON;
  try { data = JSON.parse(jsonStr); } catch { throw new Error("JSONのパースに失敗しました。```で囲って正しいJSONを貼ってね。"); }
  if (!data.基本情報 || !data.能力値 || !data.技能) throw new Error("必須キー（基本情報/能力値/技能）が不足しています。");

  // 能力値チェック（各1..6）※ 合計≤21の制限は撤廃
  const abilities = data.能力値;
  for (const v of Object.values(abilities)) {
    if (v < 1 || v > 6) throw new Error("能力値は各1〜6です。");
  }

  // 技能キーと範囲チェック
  const skills = data.技能 as Record<Skill, number>;
  for (const k of ALL_SKILLS) {
    if (!(k in skills)) throw new Error(`技能キーが不足しています：${k}`);
    const v = Number(skills[k]);
    if (v < 0 || v > 10) throw new Error(`技能「${k}」は0〜10で指定してください（現在=${v}）。`);
  }

  const c: Character = {
    id: crypto.randomUUID(),
    ownerId,
    name: data.基本情報.名前?.toString() ?? "NO NAME",
    gender: data.基本情報.性別?.toString(),
    age: data.基本情報.年齢?.toString(),
    abilities: abilities as any,
    skills: skills,
    createdAt: Date.now(),
  };

  const db = await loadDB();
  db.characters.push(c);
  await saveDB(db);
  return c;
}

export async function listCharacters(ownerId: string): Promise<Character[]> {
  const db = await loadDB();
  return db.characters.filter(c => c.ownerId === ownerId).sort((a,b)=>a.createdAt-b.createdAt);
}

export async function deleteCharacter(ownerId: string, idOrName: string): Promise<boolean> {
  const db = await loadDB();
  const before = db.characters.length;
  db.characters = db.characters.filter(c => !(c.ownerId === ownerId && (c.id === idOrName || c.name === idOrName)));
  const changed = before !== db.characters.length;
  if (changed) await saveDB(db);
  return changed;
}

export async function selectCharacter(sel: SelectionKey, idOrName: string): Promise<Character | null> {
  const db = await loadDB();
  const found = db.characters.find(c => c.ownerId === sel.userId && (c.id === idOrName || c.name === idOrName));
  if (!found) return null;
  const s = await loadSelections();
  s.char[keyOf(sel)] = found.id;        // ← 修正
  await saveSelections(s);
  return found;
}

export async function currentCharacter(sel: SelectionKey): Promise<Character | null> {
  const s = await loadSelections();
  const id = s.char[keyOf(sel)];        // ← 修正
  if (!id) return null;
  const db = await loadDB();
  return db.characters.find(c => c.id === id) ?? null;
}

export function formatSheet(c: Character): string {
  const lines: string[] = [];
  lines.push("─=≡CHARACTER：SHEET≡=─");
  lines.push(`名前：${c.name}`);
  lines.push(`性別：${c.gender ?? ""}`);
  lines.push(`年齢：${c.age ?? ""}`);
  lines.push(`身体：${c.abilities["身体"]}`);
  lines.push(`精神：${c.abilities["精神"]}`);
  lines.push(`器用：${c.abilities["器用"]}`);
  lines.push(`知性：${c.abilities["知性"]}`);
  lines.push(`五感：${c.abilities["五感"]}`);
  lines.push(`外見：${c.abilities["外見"]}`);
  lines.push("``````");
  lines.push("─=≡操縦技能≡=─");
  lines.push(`【機動制御】：Lv.${c.skills["機動制御"]}`);
  lines.push(`【近接剣術】：Lv.${c.skills["近接剣術"]}`);
  lines.push(`【精密射撃】：Lv.${c.skills["精密射撃"]}`);
  lines.push(`【危機感知】：Lv.${c.skills["危機感知"]}`);
  lines.push("``````");
  lines.push("─=≡技術技能≡=─");
  lines.push(`【整備】　　：Lv.${c.skills["整備"]}`);
  lines.push(`【機械操作】：Lv.${c.skills["機械操作"]}`);
  lines.push(`【応急処置】：Lv.${c.skills["応急処置"]}`);
  lines.push(`【索敵】　　：Lv.${c.skills["索敵"]}`);
  lines.push(`【通信管制】：Lv.${c.skills["通信管制"]}`);
  lines.push(`【白兵戦】　：Lv.${c.skills["白兵戦"]}`);
  lines.push("``````");
  lines.push("─=≡精神技能≡=─");
  lines.push(`【戦場耐性】：Lv.${c.skills["戦場耐性"]}`);
  lines.push(`【冷静沈着】：Lv.${c.skills["冷静沈着"]}`);
  lines.push(`【精神分析】：Lv.${c.skills["精神分析"]}`);
  lines.push("``````");
  lines.push("─=≡交渉技能≡=─");
  lines.push(`【説得】　　：Lv.${c.skills["説得"]}`);
  lines.push(`【威圧】　　：Lv.${c.skills["威圧"]}`);
  lines.push(`【魅了】　　：Lv.${c.skills["魅了"]}`);
  lines.push(`【洞察】　　：Lv.${c.skills["洞察"]}`);
  lines.push(`【欺瞞】　　：Lv.${c.skills["欺瞞"]}`);
  lines.push(`【演説】　　：Lv.${c.skills["演説"]}`);
  return lines.join("\n");
}

// ---- メッセージでの技能ロール ----
const SKILL_REGEX = new RegExp(`^(${ALL_SKILLS.join("|")})(\\s*[+-]\\s*\\d+)?$`);
export async function trySkillRoll(messageContent: string, sel: SelectionKey) {
  const text = messageContent.trim();
  const m = text.match(SKILL_REGEX);
  if (!m) return null; // 反応しない

  const skill = m[1] as Skill;
  const modText = m[2] ?? "";
  const mod = modText ? parseInt(modText.replace(/\s+/g, ""), 10) : 0;

  const c = await currentCharacter(sel);
  if (!c) {
    return { error: "選択中のキャラがいません。`/pc select` で選んでね（`/pc list`で一覧）。" };
  }

  const base = c.skills[skill] ?? 0;
  const rollRaw = d100();
  let effectiveRoll = rollRaw + mod;
  effectiveRoll = Math.max(1, Math.min(100, effectiveRoll));

  const band = judgeBand(effectiveRoll);
  const resultLv = Math.max(0, base + band.delta);

  const lines: string[] = [];
  lines.push(`【${skill}】Lv.${base}`);
  if (mod !== 0) {
    lines.push(`出目: ${rollRaw}（修正 ${mod >= 0 ? "+" : ""}${mod} → 実効 ${effectiveRoll}）→ 区分 ${band.label}`);
  } else {
    lines.push(`出目:${rollRaw} → Lv.${band.label}`);
  }
  lines.push(`行使技能Lv.${resultLv} 〔評価:${evalLabel(resultLv)}〕`);
  if (band.tag === "REV") lines.push("★革命的成功：追加良効果フラグ");
  if (band.tag === "FUM") lines.push("★致命的失態：追加悪効果フラグ");

  return { text: lines.join("\n") };
}
