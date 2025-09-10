import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { eventsToIcs, IcsEvent } from "./generate-ics.js";
import { fetchSchoolHolidays } from "./fetch-schoolholidays.js";
import { generateNlPublicHolidays } from "./public-holidays.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
      start: new Date(r.startdate),
      end: new Date(r.enddate),
      allDay: true,
      description: r.notice || undefined,
      created: new Date(),
      lastModified: new Date(),
    }));
}

async function main() {
  try {
    console.log('Creating output directory...');
    ensureOut();

    console.log('Fetching school holidays...');
    const school = await fetchSchoolHolidays();
    
    if (!school || !Array.isArray(school) || school.length === 0) {
      console.error('School holidays response:', school);
      throw new Error('No school holidays data received');
    }
    
    console.log(`Processing ${school.length} school holidays...`);

    // Map school holidays to events with error handling
    let evAll, evNorth, evCentral, evSouth;
    try {
      evAll = mapSchoolToEvents(school);
      evNorth = mapSchoolToEvents(school, "noord");
      evCentral = mapSchoolToEvents(school, "midden");
      evSouth = mapSchoolToEvents(school, "zuid");
    } catch (error) {
      console.error('Failed to map school holidays to events:', error);
      console.error('School holidays data:', JSON.stringify(school.slice(0, 2), null, 2));
      throw new Error(`Failed to process school holidays: ${error instanceof Error ? error.message : error}`);
    }

    console.log('Generating school holiday ICS files...');
    try {
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
    } catch (error) {
      console.error('Failed to generate school holiday ICS files:', error);
      throw new Error(`ICS generation failed for school holidays: ${error instanceof Error ? error.message : error}`);
    }

    console.log('Generating public holidays...');
    let pubEvents;
    try {
      const nowY = new Date().getUTCFullYear();
      // Generate holidays for previous year, current year, and next 2 years
      const pub = [nowY - 1, nowY, nowY + 1, nowY + 2].flatMap((y) =>
        generateNlPublicHolidays(y)
      );
      pubEvents = pub.map((p) => ({
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
    } catch (error) {
      console.error('Failed to generate public holidays:', error);
      throw new Error(`Public holidays generation failed: ${error instanceof Error ? error.message : error}`);
    }

    console.log('Generating combined calendar...');
    try {
      const allInOne = [...pubEvents, ...evAll].sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );
      writeFileSync(
        join(OUT, "nl-all-in-one.ics"),
        eventsToIcs("NL — Resmi + Okul Tatilleri", allInOne)
      );

      // Create index.ics that redirects to all-in-one calendar
      writeFileSync(
        join(OUT, "index.ics"),
        eventsToIcs("NL — Resmi + Okul Tatilleri", allInOne)
      );

      // Copy index.html to output directory
      copyFileSync(
        join(__dirname, "index.html"),
        join(OUT, "index.html")
      );
    } catch (error) {
      console.error('Failed to generate combined calendar:', error);
      throw new Error(`Combined calendar generation failed: ${error instanceof Error ? error.message : error}`);
    }

    console.log('Successfully generated all calendar files');
  } catch (error) {
    console.error('Build failed:', error instanceof Error ? error.stack : error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.stack : error);
  process.exit(1);
});
