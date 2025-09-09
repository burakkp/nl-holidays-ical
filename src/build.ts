import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eventsToIcs, IcsEvent } from "./generate-ics.js";
import { fetchSchoolHolidays } from "./fetch-schoolholidays.js";
import { generateNlPublicHolidays } from "./public-holidays.js";

const OUT = "dist";

function ensureOut() {
  mkdirSync(OUT, { recursive: true });
}

function mapSchoolToEvents(rows: any[], region?: string): IcsEvent[] {
  return rows
    .filter((r) => !region || r.region === region)
    .map((r) => ({
      uid: `nl-school-${r.id}`,
      title: `Schoolvakantie — ${r.type}${r.region ? ` (${r.region})` : ""}`,
      start: new Date(r.startdate + "T00:00:00Z"),
      end: new Date(
        new Date(r.enddate + "T00:00:00Z").getTime() + 24 * 3600 * 1000
      ), // dahil -> non-inclusive
      allDay: true,
      description: r.notice || undefined,
    }));
}

async function main() {
  ensureOut();

  // School holidays (last 3 ve next 3 schoolyears gibi geniş bir aralık alınabilir)
  const school = await fetchSchoolHolidays();

  const evAll = mapSchoolToEvents(school);
  const evNorth = mapSchoolToEvents(school, "noord");
  const evCentral = mapSchoolToEvents(school, "midden");
  const evSouth = mapSchoolToEvents(school, "zuid");

  writeFileSync(
    join(OUT, "nl-school-all.ics"),
    eventsToIcs("NL — Schoolvakanties (Tümü)", evAll)
  );
  writeFileSync(
    join(OUT, "nl-school-north.ics"),
    eventsToIcs("NL — Schoolvakanties (Noord)", evNorth)
  );
  writeFileSync(
    join(OUT, "nl-school-central.ics"),
    eventsToIcs("NL — Schoolvakanties (Midden)", evCentral)
  );
  writeFileSync(
    join(OUT, "nl-school-south.ics"),
    eventsToIcs("NL — Schoolvakanties (Zuid)", evSouth)
  );

  // Public holidays — üretim: mevcut yıl ±1 (abone olanlar için yeterli)
  const nowY = new Date().getUTCFullYear();
  const pub = [nowY - 1, nowY, nowY + 1].flatMap((y) =>
    generateNlPublicHolidays(y)
  );
  const pubEvents: IcsEvent[] = pub.map((p) => ({
    uid: p.uid,
    title: p.title,
    start: p.start,
    end: p.end,
    allDay: true,
  }));
  writeFileSync(
    join(OUT, "nl-public-holidays.ics"),
    eventsToIcs("NL — Officiële Feestdagen", pubEvents)
  );

  // Hepsi bir arada
  const allInOne = [...pubEvents, ...evAll].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  writeFileSync(
    join(OUT, "nl-all-in-one.ics"),
    eventsToIcs("NL — Resmi + Okul Tatilleri", allInOne)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
