import { fetch } from "undici";

export interface SchoolHoliday {
  id: string;
  schoolyear: string; // "2025-2026"
  type: string; // kerstvakantie, meivakantie, zomervakantie, etc.
  region?: "noord" | "midden" | "zuid"; // bazıları bölgesiz (kerst, meivakantie: zorunlu/ülke geneli)
  startdate: string; // ISO (UTC 00:00:00 varsayımı)
  enddate: string; // ISO (bitiş dahil)
  notice?: string;
}

interface RawSchoolHoliday {
  id: number | string;
  schoolyear: string;
  type: string;
  region?: "noord" | "midden" | "zuid";
  startdate: string;
  enddate: string;
  notice?: string;
}

const BASE = "https://opendata.rijksoverheid.nl/v1/sources/rijksoverheid/infotypes/schoolholidays";

async function fetchWithRetry(url: string, retries = 3): Promise<RawSchoolHoliday[]> {
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
      if (!data.every(item => 
        typeof item === 'object' && item !== null &&
        'id' in item && 'schoolyear' in item && 'type' in item &&
        'startdate' in item && 'enddate' in item
      )) {
        throw new Error('Invalid data structure in response');
      }
      
      return data as RawSchoolHoliday[];
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
    const data = await fetchWithRetry(url);
    return data.map((d: RawSchoolHoliday): SchoolHoliday => ({
      id: String(d.id),
      schoolyear: d.schoolyear,
      type: d.type,
      region: d.region,
      startdate: d.startdate,
      enddate: d.enddate,
      notice: d.notice,
    }));
  } catch (error) {
    console.error('Failed to fetch school holidays:', error);
    throw error;
  }
}
