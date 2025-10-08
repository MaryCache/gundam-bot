// src/types.ts  — 全文

/* ===== キャラ ===== */

export type Ability = "身体" | "精神" | "器用" | "知性" | "五感" | "外見";

export type Skill =
  | "機動制御" | "近接剣術" | "精密射撃" | "危機感知"
  | "整備" | "機械操作" | "応急処置" | "索敵" | "通信管制" | "白兵戦"
  | "戦場耐性" | "冷静沈着" | "精神分析"
  | "説得" | "威圧" | "魅了" | "洞察" | "欺瞞" | "演説";

export const ALL_SKILLS: Skill[] = [
  "機動制御","近接剣術","精密射撃","危機感知",
  "整備","機械操作","応急処置","索敵","通信管制","白兵戦",
  "戦場耐性","冷静沈着","精神分析",
  "説得","威圧","魅了","洞察","欺瞞","演説"
];

export interface ImportedCharacterJSON {
  基本情報: { 名前: string; 性別?: string; 年齢?: string | number };
  能力値: Record<Ability, number>;
  技能: Record<Skill, number>;
}

export interface Character {
  id: string;           // 内部ID
  ownerId: string;      // Discord userId
  name: string;
  gender?: string;
  age?: string;
  abilities: Record<Ability, number>;
  skills: Record<Skill, number>; // 0..10
  createdAt: number;
}

export interface SelectionKey {
  userId: string;
  channelId: string;
}

/* ===== 機体 ===== */

export type MechType = "F" | "S" | "E";

export interface ImportedMechJSON {
  機体: {
    名前: string;
    Type: MechType;
    TLv: number;
    機動: number;
    装甲: number;    // 最大装甲（初期は現在装甲＝最大装甲）
    積載: number;
  };
}

export interface Mech {
  id: string;
  ownerId: string;        // Discord userId
  name: string;
  type: MechType;         // F/S/E
  TLv: number;
  mobility: number;       // 機動
  armorMax: number;       // 装甲(最大)
  armorCurrent: number;   // 装甲(現在) ※上限超え可仕様
  load: number;           // 積載
  createdAt: number;
}

/* ===== 盤面（Board） ===== */

export type BoardMode = "free" | "battle";

export interface BoardParticipant {
  id: string;            // 内部ID（uuid 等）
  name: string;          // 表示名
  /** 最終確定座標（未配置は null） */
  pos: number | null;
  /** battle モードで確定前の一時入力（未入力は null） */
  tmp: number | null;
}

export interface BoardState {
  channelId: string;     // 1ch に 1 盤面
  ownerId: string;       // /board create 実行者
  size: number;          // マス数（1..size）
  mode: BoardMode;       // free / battle
  /** 参加者一覧 */
  members: BoardParticipant[];
  /** 最新盤面メッセージID（任意） */
  lastMessageId?: string;
  createdAt: number;
}
