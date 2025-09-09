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
  try {
    console.log('Creating output directory...');
    ensureOut();

    console.log('Fetching school holidays...');
    const school = await fetchSchoolHolidays();
    
    if (!school || !Array.isArray(school) || school.length === 0) {
      throw new Error('No school holidays data received');
    }
    
    console.log(`Processing ${school.length} school holidays...`);

    const evAll = mapSchoolToEvents(school);
    const evNorth = mapSchoolToEvents(school, "noord");
    const evCentral = mapSchoolToEvents(school, "midden");
    const evSouth = mapSchoolToEvents(school, "zuid");

    console.log('Generating school holiday ICS files...');
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

    console.log('Generating public holidays...');
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

    console.log('Generating combined calendar...');
    const allInOne = [...pubEvents, ...evAll].sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
    writeFileSync(
      join(OUT, "nl-all-in-one.ics"),
      eventsToIcs("NL — Resmi + Okul Tatilleri", allInOne)
    );

    console.log('Successfully generated all calendar files');
  } catch (error) {
    console.error('Build failed:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
