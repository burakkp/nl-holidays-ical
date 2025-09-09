import { fetch } from "undici";

export interface SchoolHoliday {
  id: string;
  schoolyear: string; // "2025-2026"
  type: string; // kerstvakantie, meivakantie, zomervakantie, etc.
  region?: "noord" | "midden" | "zuid" | "heel Nederland"; // bazıları bölgesiz (kerst, meivakantie: zorunlu/ülke geneli)
  startdate: string; // ISO (UTC 00:00:00 varsayımı)
  enddate: string; // ISO (bitiş dahil)
  notice?: string;
}

interface Region {
  region: "noord" | "midden" | "zuid" | "heel Nederland";
  startdate: string;
  enddate: string;
}

interface Vacation {
  type: string;
  compulsorydates: string;
  regions: Region[];
}

interface YearContent {
  title: string;
  schoolyear: string;
  vacations: Vacation[];
}

interface YearData {
  id: string;
  type: string;
  content: YearContent[];
  notice: string;
}

const BASE = "https://opendata.rijksoverheid.nl/v1/sources/rijksoverheid/infotypes/schoolholidays";

async function fetchWithRetry(url: string, retries = 3): Promise<YearData[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; nl-holidays-ical/0.1.0)'
        }
      });

      clearTimeout(timeout);
      
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!Array.isArray(data)) {
        throw new Error(`Invalid response format: expected array, got ${typeof data}`);
      }

      // Validate data structure
      for (const year of data) {
        if (!year.id || !year.content || !Array.isArray(year.content)) {
          throw new Error(`Invalid year data structure: ${JSON.stringify(year)}`);
        }

        for (const content of year.content) {
          if (!content.schoolyear || !content.vacations || !Array.isArray(content.vacations)) {
            throw new Error(`Invalid content structure: ${JSON.stringify(content)}`);
          }
        }
      }
      
      return data as YearData[];
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000)); // exponential backoff
    }
  }
  throw new Error("Failed after retries");
}

export async function fetchSchoolHolidays(
  schoolyear?: string
): Promise<SchoolHoliday[]> {
  const url = schoolyear
    ? `${BASE}/schoolyear/${schoolyear}?output=json`
    : `${BASE}?output=json`;

  try {
    const yearData = await fetchWithRetry(url);
    const holidays: SchoolHoliday[] = [];

    for (const year of yearData) {
      for (const content of year.content) {
        const cleanSchoolYear = content.schoolyear.trim();
        for (const vacation of content.vacations) {
          const cleanType = vacation.type.trim();
          for (const region of vacation.regions) {
            holidays.push({
              id: `${year.id}-${cleanSchoolYear}-${cleanType}-${region.region}`,
              schoolyear: cleanSchoolYear,
              type: cleanType,
              region: region.region,
              startdate: region.startdate,
              enddate: region.enddate,
              notice: year.notice
            });
          }
        }
      }
    }

    return holidays;
  } catch (error) {
    console.error('Failed to fetch school holidays:', error);
    throw error;
  }
}
