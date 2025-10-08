import { promises as fs } from "fs";
import path from "path";
import { Character, Mech, BoardState } from "./types.js";

/** データ保存先 */
const DATA_DIR = path.resolve("data");

// 既存ファイル…
const CHAR_FILE = path.join(DATA_DIR, "characters.json");
const SEL_FILE  = path.join(DATA_DIR, "selections.json");
const MECH_FILE = path.join(DATA_DIR, "mechs.json");
const UI_FILE   = path.join(DATA_DIR, "ui.json");

// 新規：Board一括DB（チャンネルID→BoardState）
const BOARD_FILE = path.join(DATA_DIR, "boards.json");

// 既存型…
type DB = { characters: Character[], mechs: Mech[] };
export type Selections = { char: { [k:string]: string }, mech: { [k:string]: string } };
type UiState = {
  lastMechSheetMessageId: { [k:string]: string };
};

// 新規：BoardsDB
type BoardsDB = { [channelId: string]: BoardState };

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // 既存
  try { await fs.access(CHAR_FILE); } catch { await fs.writeFile(CHAR_FILE, JSON.stringify({ characters: [] }, null, 2)); }
  try { await fs.access(MECH_FILE); } catch { await fs.writeFile(MECH_FILE, JSON.stringify({ mechs: [] }, null, 2)); }
  try { await fs.access(SEL_FILE); } catch { await fs.writeFile(SEL_FILE, JSON.stringify({ char:{}, mech:{} }, null, 2)); }
  try { await fs.access(UI_FILE ); } catch { await fs.writeFile(UI_FILE , JSON.stringify({ lastMechSheetMessageId:{} }, null, 2)); }
  // 新規
  try { await fs.access(BOARD_FILE); } catch { await fs.writeFile(BOARD_FILE, JSON.stringify({}, null, 2)); }
}

// ===== 既存（省略せずそのまま維持） =====
export async function loadDB(): Promise<DB> {
  await ensureFiles();
  return JSON.parse(await fs.readFile(CHAR_FILE, "utf8")) as DB;
}
export async function saveDB(db: DB) {
  await ensureFiles();
  await fs.writeFile(CHAR_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function loadSelections(): Promise<Selections> {
  await ensureFiles();
  return JSON.parse(await fs.readFile(SEL_FILE, "utf8")) as Selections;
}
export async function saveSelections(s: Selections) {
  await ensureFiles();
  await fs.writeFile(SEL_FILE, JSON.stringify(s, null, 2), "utf8");
}

export async function loadMechDB(): Promise<DB> {
  await ensureFiles();
  return JSON.parse(await fs.readFile(MECH_FILE, "utf8")) as DB;
}
export async function saveMechDB(db: DB) {
  await ensureFiles();
  await fs.writeFile(MECH_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function loadUiState(): Promise<UiState> {
  await ensureFiles();
  return JSON.parse(await fs.readFile(UI_FILE, "utf8")) as UiState;
}
export async function saveUiState(u: UiState) {
  await ensureFiles();
  await fs.writeFile(UI_FILE, JSON.stringify(u, null, 2), "utf8");
}

// ===== 新規 Board DB =====
export async function loadBoards(): Promise<BoardsDB> {
  await ensureFiles();
  return JSON.parse(await fs.readFile(BOARD_FILE, "utf8")) as BoardsDB;
}
export async function saveBoards(b: BoardsDB) {
  await ensureFiles();
  await fs.writeFile(BOARD_FILE, JSON.stringify(b, null, 2), "utf8");
}
