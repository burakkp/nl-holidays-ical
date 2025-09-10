import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { eventsToIcs, IcsEvent } from "./generate-ics.js";
import { fetchSchoolHolidays, Language, translations } from "./fetch-schoolholidays.js";
import { generateNlPublicHolidays } from "./public-holidays.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT = "dist";

function ensureOut() {
  mkdirSync(OUT, { recursive: true });
}

function getHolidayTitle(type: string, region: string | undefined, lang: Language): string {
  const holidayType = translations.holidayTypes[type as keyof typeof translations.holidayTypes]?.[lang] || type;
  const regionText = region ? ` (${translations.regions[region as keyof typeof translations.regions]?.[lang] || region})` : "";
  return `${holidayType}${regionText}`;
}

function mapSchoolToEvents(rows: any[], region?: string, lang: Language = "nl"): IcsEvent[] {
  return rows
    .filter((r) => !region || r.region === region)
    .map((r) => ({
      uid: `nl-school-${r.id}`,
      title: getHolidayTitle(r.type, r.region, lang),
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
    // Fetch both current and next school year
    const currentYear = new Date().getFullYear();
    const schoolCurrentYear = `${currentYear}-${currentYear + 1}`;
    const schoolNextYear = `${currentYear + 1}-${currentYear + 2}`;
    
    const [currentSchool, nextSchool] = await Promise.all([
      fetchSchoolHolidays(schoolCurrentYear),
      fetchSchoolHolidays(schoolNextYear)
    ]);
    
    const school = [...(currentSchool || []), ...(nextSchool || [])];
    
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
    const languages: Language[] = ["nl", "en", "tr"];
    try {
      for (const lang of languages) {
        const langPrefix = `${lang}/`;
        mkdirSync(join(OUT, lang), { recursive: true });

        // School holidays for each region
        writeFileSync(
          join(OUT, langPrefix, "school-all.ics"),
          eventsToIcs(`${translations.titles.schoolHolidays[lang]}`, mapSchoolToEvents(school, undefined, lang))
        );
        writeFileSync(
          join(OUT, langPrefix, "school-north.ics"),
          eventsToIcs(`${translations.titles.schoolHolidays[lang]} - ${translations.regions.noord[lang]}`, mapSchoolToEvents(school, "noord", lang))
        );
        writeFileSync(
          join(OUT, langPrefix, "school-central.ics"),
          eventsToIcs(`${translations.titles.schoolHolidays[lang]} - ${translations.regions.midden[lang]}`, mapSchoolToEvents(school, "midden", lang))
        );
        writeFileSync(
          join(OUT, langPrefix, "school-south.ics"),
          eventsToIcs(`${translations.titles.schoolHolidays[lang]} - ${translations.regions.zuid[lang]}`, mapSchoolToEvents(school, "zuid", lang))
        );
    } }catch (error) {
      console.error('Failed to generate school holiday ICS files:', error);
      throw new Error(`ICS generation failed for school holidays: ${error instanceof Error ? error.message : error}`);
    }

    console.log('Generating public holidays...');
    let pubEvents;
    try {
      const nowY = new Date().getUTCFullYear();
      // Generate holidays for current year and next 2 years
      const pub = [nowY, nowY + 1, nowY + 2].flatMap((y) =>
        generateNlPublicHolidays(y)
      );
      pubEvents = pub.map((p) => ({
        uid: p.uid,
        title: p.title,
        start: p.start,
        end: p.end,
        allDay: true,
      }));
      for (const lang of languages) {
        const langPrefix = `${lang}/`;
        writeFileSync(
          join(OUT, langPrefix, "public-holidays.ics"),
          eventsToIcs(translations.titles.publicHolidays[lang], pubEvents)
        );
      }
    } catch (error) {
      console.error('Failed to generate public holidays:', error);
      throw new Error(`Public holidays generation failed: ${error instanceof Error ? error.message : error}`);
    }

    console.log('Generating combined calendar...');
    try {
      const allInOne = [...pubEvents, ...evAll].sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );
      for (const lang of languages) {
        const langPrefix = `${lang}/`;
        // All-in-one calendar for each language
        const allInOneLang = [...pubEvents, ...mapSchoolToEvents(school, undefined, lang)].sort(
          (a, b) => a.start.getTime() - b.start.getTime()
        );

        writeFileSync(
          join(OUT, langPrefix, "all-in-one.ics"),
          eventsToIcs(translations.titles.combined[lang], allInOneLang)
        );

        // Create index.ics in each language directory
        writeFileSync(
          join(OUT, langPrefix, "index.ics"),
          eventsToIcs(translations.titles.combined[lang], allInOneLang)
        );
      }

      // Create root index.ics (default to English)
      writeFileSync(
        join(OUT, "index.ics"),
        eventsToIcs(translations.titles.combined.en, [...pubEvents, ...mapSchoolToEvents(school, undefined, "en")].sort(
          (a, b) => a.start.getTime() - b.start.getTime()
        ))
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
