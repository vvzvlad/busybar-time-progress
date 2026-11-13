import { generateXpm2 } from "@busy-app/busy-lib";
import { createScreen, type Element } from "./screen";
import { loadValues } from "./settings";
import manifest from "./appmeta/manifest.json";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** Percents change slowly: the screen is redrawn on every minute of the bar's clock. */
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** What the second line under the year measures. */
type Line = "month" | "week" | "day" | "custom" | "life";
/** Every pixel of the display as one unit: a day of the year, or a month of the life. */
type Pixels = "year_days" | "life_months";
/** What the wheel steps through. */
type View = Line | Pixels;

const WHITE = "#FFFFFFFF";
const TRACK = "#303030FF";
const YEAR_BAR = "#FF8000FF";
const PART_BAR = "#00A0FFFF";
/** A comet that runs along the year's bar when its whole percent changes: a gradient SPARK_WIDTH px long, SPARK_STEPS frames SPARK_MS apart. */
const SPARK_COLORS = ["#FFFFFF00", "#FFFFFFFF"];
const SPARK_WIDTH = 8;
const SPARK_STEPS = 12;
const SPARK_MS = 120;

type Settings = {
  /** The day the year starts on: month 0..11 and day of the month. */
  yearStart: { month: number; day: number };
  yearLabel: string;
  /** The day of the month the month starts on, 1..31. */
  monthStart: number;
  monthLabel: string;
  custom: { label: string; start: Date; end: Date } | null;
  life: { birth: Date; years: number } | null;
};

/** Days in month `m` of year `y`; a month out of 0..11 rolls into the year before or after. */
function daysIn(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** "2026-05-20" → that day's local midnight; null for other text or a day that does not exist. */
function parseDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const date = new Date(Number(match[1]), m, d);
  return date.getMonth() === m && date.getDate() === d ? date : null;
}

/** "05-20" → month 4, day 20; null for other text or a day no year has. Checked against a leap year, so "02-29" passes. */
function parseMonthDay(text: string): { month: number; day: number } | null {
  const match = /^(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  return month >= 0 && month < 12 && day >= 1 && day <= daysIn(2000, month) ? { month, day } : null;
}

/** Reads the settings of src/appmeta/settings.json; the defaults there for a bar that returns none. */
async function loadSettings(): Promise<Settings> {
  const values = (await loadValues()) ?? {};
  const text = (key: string): string => (typeof values[key] === "string" ? (values[key] as string) : "");
  const int = (key: string, fallback: number): number => (typeof values[key] === "number" ? (values[key] as number) : fallback);
  const customStart = parseDate(text("custom_start"));
  const customEnd = parseDate(text("custom_end"));
  const birth = parseDate(text("birth_date"));
  return {
    yearStart: parseMonthDay(text("year_start")) ?? { month: 0, day: 1 },
    yearLabel: text("year_label"),
    monthStart: int("month_start", 1),
    monthLabel: text("month_label"),
    custom:
      customStart && customEnd && customStart.getTime() < customEnd.getTime()
        ? { label: text("custom_label"), start: customStart, end: customEnd }
        : null,
    life: birth ? { birth, years: int("life_years", 80) } : null,
  };
}

/** The wheel's views: the custom span and the life ones only when their dates are set. */
function views(s: Settings): View[] {
  const out: View[] = ["month", "week", "day"];
  if (s.custom) out.push("custom");
  if (s.life) out.push("life");
  out.push("year_days");
  if (s.life) out.push("life_months");
  return out;
}

/** The share of [start, end) that has passed at `now`, 0..1. */
function part(start: Date, end: Date, now: Date): number {
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
}

/** The year: from the latest year start, 00:00 local, to the next one. A year that starts on February 29 starts on the 28th in other years. */
function yearPeriod(s: Settings, now: Date): { start: Date; end: Date } {
  const { month, day } = s.yearStart;
  const at = (y: number) => new Date(y, month, Math.min(day, daysIn(y, month)));
  const start = now.getTime() >= at(now.getFullYear()).getTime() ? at(now.getFullYear()) : at(now.getFullYear() - 1);
  return { start, end: at(start.getFullYear() + 1) };
}

/** The month: from the latest start day, 00:00 local, to the next one. In a month shorter than the start day, its last day. */
function monthPeriod(s: Settings, now: Date): { start: Date; end: Date } {
  const at = (y: number, m: number) => new Date(y, m, Math.min(s.monthStart, daysIn(y, m)));
  const y = now.getFullYear();
  const m = now.getMonth();
  return now.getTime() >= at(y, m).getTime() ? { start: at(y, m), end: at(y, m + 1) } : { start: at(y, m - 1), end: at(y, m) };
}

/** The end of the life: the birthday `years` after the birth. */
function lifeEnd(life: { birth: Date; years: number }): Date {
  return new Date(life.birth.getFullYear() + life.years, life.birth.getMonth(), life.birth.getDate());
}

/** The second line's label and share, in the bar's local time. Weeks start on Monday. */
function period(view: Line, s: Settings, now: Date): { label: string; share: number } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (view === "month") {
    const month = monthPeriod(s, now);
    return { label: s.monthLabel || MONTHS[month.start.getMonth()], share: part(month.start, month.end, now) };
  }
  if (view === "week") {
    const monday = d - ((now.getDay() + 6) % 7);
    return { label: "WEEK", share: part(new Date(y, m, monday), new Date(y, m, monday + 7), now) };
  }
  if (view === "custom" && s.custom) return { label: s.custom.label, share: part(s.custom.start, s.custom.end, now) };
  if (view === "life" && s.life) return { label: "LIFE", share: part(s.life.birth, lifeEnd(s.life), now) };
  return { label: "DAY", share: part(new Date(y, m, d), new Date(y, m, d + 1), now) };
}

/** One line: the label with its percent, and a 1 px bar under it across the display. */
function line(n: number, label: string, share: number, color: string): Element[] {
  const top = n * 8;
  const percent = `${Math.floor(share * 100)}%`;
  const out: Element[] = [
    { id: `text${n}`, type: "text", text: label ? `${label} ${percent}` : percent, font: "small", color: WHITE, x: 0, y: top - 2, align: "top_left" },
    { id: `track${n}`, type: "rectangle", x: 0, y: top + 6, width: 72, height: 1, fill: "solid", fill_colors: [TRACK], border_width: 0, z_index: 1 },
  ];
  const width = Math.round(share * 72);
  if (width > 0) {
    out.push({ id: `bar${n}`, type: "rectangle", x: 0, y: top + 6, width, height: 1, fill: "solid", fill_colors: [color], border_width: 0, z_index: 2 });
  }
  return out;
}

/** The year's share that has passed, in whole percent. */
function yearPercent(s: Settings, now: Date): number {
  const year = yearPeriod(s, now);
  return Math.floor(part(year.start, year.end, now) * 100);
}

/** The whole display as one picture, a pixel per unit row by row from the top left: the units passed in `color`, the current one white, the rest of the `total` dim. */
function pixels(total: number, passed: number, color: string): Element {
  const grid: string[] = [];
  for (let row = 0; row < 16; row++) {
    let cells = "";
    for (let x = 0; x < 72; x++) {
      const i = row * 72 + x;
      cells += i < passed ? "p" : i >= total ? "." : i === passed ? "n" : "f";
    }
    grid.push(cells);
  }
  const data = generateXpm2({ palette: { ".": "none", p: color, n: WHITE, f: TRACK }, grid });
  return { id: "pixels", type: "xpmbitmap", data, x: 0, y: 0, align: "top_left" };
}

/**
 * The front display: the year on top and the chosen line under it, or one of the pixel views. `spark` is the frame of
 * the comet on the year's bar, null when none runs.
 */
function frame(view: View, s: Settings, now: Date, spark: number | null): Element[] {
  const year = yearPeriod(s, now);
  if (view === "year_days") {
    const total = Math.round((year.end.getTime() - year.start.getTime()) / DAY_MS);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return [pixels(total, Math.round((today.getTime() - year.start.getTime()) / DAY_MS), YEAR_BAR)];
  }
  if (view === "life_months") {
    if (!s.life) return [];
    const birth = s.life.birth;
    const lived =
      (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth() - (now.getDate() < birth.getDate() ? 1 : 0);
    // Past the years set, the picture stays full rather than spilling beyond them.
    return [pixels(s.life.years * 12, Math.min(Math.max(0, lived), s.life.years * 12), PART_BAR)];
  }
  const share = part(year.start, year.end, now);
  const second = period(view, s, now);
  const out = [...line(0, s.yearLabel || String(year.start.getFullYear()), share, YEAR_BAR), ...line(1, second.label, second.share, PART_BAR)];
  if (spark !== null) {
    const head = Math.round((Math.round(share * 72) * spark) / (SPARK_STEPS - 1));
    out.push({ id: "spark", type: "rectangle", x: head - SPARK_WIDTH, y: 6, width: SPARK_WIDTH, height: 1, fill: "gradient_h", fill_colors: SPARK_COLORS, border_width: 0, z_index: 3 });
  }
  return out;
}

/**
 * Entry point, called at the end of the file: the device runs this script from top to bottom and starts nothing by itself.
 */
function main(): void {
  const report = (err: unknown) => console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
  const screen = createScreen(APP, report);

  let settings: Settings | null = null;
  /** The wheel's views, known once the settings are read, and the one shown. */
  let list: View[] = [];
  let view = 0;
  /** The year's whole percent at the last tick; null before the first. */
  let lastPercent: number | null = null;
  /** The frame of the comet on the year's bar; null when none runs. */
  let spark: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sparkTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const draw = () => {
    if (!stopped && settings) screen.draw(frame(list[view], settings, new Date(), spark));
  };

  /** Moves the comet one frame along the year's bar; after the last frame it is gone. */
  function sparkStep(): void {
    sparkTimer = undefined;
    if (stopped || spark === null) return;
    spark = spark + 1 < SPARK_STEPS ? spark + 1 : null;
    draw();
    if (spark !== null) sparkTimer = setTimeout(sparkStep, SPARK_MS);
  }

  /** Redraws now and again just after the next minute begins. A new whole percent of the year on screen sends the comet along its bar. */
  function tick(): void {
    // Back pressed while the settings were loading leaves no timer to set.
    if (!settings || stopped) return;
    const percent = yearPercent(settings, new Date());
    const yearShown = list[view] !== "year_days" && list[view] !== "life_months";
    if (lastPercent !== null && percent !== lastPercent && yearShown && spark === null) {
      spark = 0;
      sparkTimer = setTimeout(sparkStep, SPARK_MS);
    }
    lastPercent = percent;
    draw();
    timer = setTimeout(tick, MINUTE_MS - (Date.now() % MINUTE_MS) + 50);
  }

  // The listener keeps the app alive; a long Back is handled by the firmware and quits it.
  const unbind = listen("input", (event) => {
    if (stopped) return;
    if (event.key === "encoder") {
      if (list.length === 0) return;
      view = (view + event.delta + list.length) % list.length;
      draw();
    } else if (event.key === "back" && event.action === "short") {
      // Back leaves the app: with the timers cleared and the handler detached, nothing keeps it alive.
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      if (sparkTimer !== undefined) clearTimeout(sparkTimer);
      // Not detached from inside the handler itself: the unbind would stop the app while this handler still runs.
      setTimeout(unbind, 0);
    }
  });

  void loadSettings()
    .then((loaded) => {
      settings = loaded;
      list = views(loaded);
      tick();
    })
    .catch(report);
}

main();
