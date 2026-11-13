import { createScreen, type Element } from "./screen";
import manifest from "./appmeta/manifest.json";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** Percents change slowly: the screen is redrawn on every minute of the bar's clock. */
const MINUTE_MS = 60 * 1000;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** What the second line measures; the wheel steps through them. */
const MODES = ["month", "week", "day"] as const;
type Mode = (typeof MODES)[number];

const WHITE = "#FFFFFFFF";
const TRACK = "#303030FF";
const YEAR_BAR = "#FF8000FF";
const PART_BAR = "#00A0FFFF";

/** The share of [start, end) that has passed at `now`, 0..1. */
function part(start: Date, end: Date, now: Date): number {
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
}

/** The second line's label and share for a mode, in the bar's local time. Weeks start on Monday. */
function period(mode: Mode, now: Date): { label: string; share: number } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (mode === "month") return { label: MONTHS[m], share: part(new Date(y, m, 1), new Date(y, m + 1, 1), now) };
  if (mode === "week") {
    const monday = d - ((now.getDay() + 6) % 7);
    return { label: "WEEK", share: part(new Date(y, m, monday), new Date(y, m, monday + 7), now) };
  }
  return { label: "DAY", share: part(new Date(y, m, d), new Date(y, m, d + 1), now) };
}

/** One line: the label with its percent, and a 1 px bar under it across the display. */
function line(n: number, label: string, share: number, color: string): Element[] {
  const top = n * 8;
  const out: Element[] = [
    { id: `text${n}`, type: "text", text: `${label} ${Math.floor(share * 100)}%`, font: "small", color: WHITE, x: 0, y: top - 2, align: "top_left" },
    { id: `track${n}`, type: "rectangle", x: 0, y: top + 6, width: 72, height: 1, fill: "solid", fill_colors: [TRACK], border_width: 0, z_index: 1 },
  ];
  const width = Math.round(share * 72);
  if (width > 0) {
    out.push({ id: `bar${n}`, type: "rectangle", x: 0, y: top + 6, width, height: 1, fill: "solid", fill_colors: [color], border_width: 0, z_index: 2 });
  }
  return out;
}

/** The front display: the year on top, the month, week or day under it. */
function frame(mode: Mode, now: Date): Element[] {
  const y = now.getFullYear();
  const second = period(mode, now);
  return [...line(0, String(y), part(new Date(y, 0, 1), new Date(y + 1, 0, 1), now), YEAR_BAR), ...line(1, second.label, second.share, PART_BAR)];
}

/**
 * Entry point, called at the end of the file: the device runs this script from top to bottom and starts nothing by itself.
 */
function main(): void {
  const report = (err: unknown) => console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
  const screen = createScreen(APP, report);

  let mode = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const draw = () => {
    if (!stopped) screen.draw(frame(MODES[mode], new Date()));
  };

  /** Redraws now and again just after the next minute begins. */
  function tick(): void {
    draw();
    timer = setTimeout(tick, MINUTE_MS - (Date.now() % MINUTE_MS) + 50);
  }

  // The listener keeps the app alive; a long Back is handled by the firmware and quits it.
  const unbind = listen("input", (event) => {
    if (stopped) return;
    if (event.key === "encoder") {
      mode = (mode + event.delta + MODES.length) % MODES.length;
      draw();
    } else if (event.key === "back" && event.action === "short") {
      // Back leaves the app: with the timer cleared and the handler detached, nothing keeps it alive.
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      // Not detached from inside the handler itself: the unbind would stop the app while this handler still runs.
      setTimeout(unbind, 0);
    }
  });

  tick();
}

main();
