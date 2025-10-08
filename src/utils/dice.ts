export function d100(): number {
  // 1..100（100は“00”扱い）
  return Math.floor(Math.random() * 100) + 1;
}

export type RollBand = { delta: number; label: string; tag?: "REV" | "FUM" };

export function judgeBand(rollEffective: number): RollBand {
  // 01–05:+5 / 06–23:+2 / 24–41:+1 / 42–59:0 / 60–77:-1 / 78–95:-2 / 96–00:-5
  const r = rollEffective;
  if (r >= 96 || r === 100) return { delta: -5, label: "致命的失態", tag: "FUM" };
  if (r <= 5) return { delta: +5, label: "革命的成功", tag: "REV" };
  if (r <= 23) return { delta: +2, label: "+2" };
  if (r <= 41) return { delta: +1, label: "+1" };
  if (r <= 59) return { delta: 0, label: "±0" };
  if (r <= 77) return { delta: -1, label: "-1" };
  return { delta: -2, label: "-2" };
}

export function evalLabel(lv: number): string {
  if (lv <= 0) return "致命的失敗";
  const table = ["","稚拙","未熟","拙巧","平凡","優良","洗練","卓越","超越","至高","神業"];
  if (lv >= 11) return "革命的成功";
  return table[lv] ?? `${lv}`;
}
