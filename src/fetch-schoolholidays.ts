import { fetch } from "undici";

export type Language = "nl" | "tr" | "en";

export const translations = {
  holidayTypes: {
    kerstvakantie: {
      nl: "Kerstvakantie",
      tr: "Noel Tatili",
      en: "Christmas Holiday"
    },
    meivakantie: {
      nl: "Meivakantie",
      tr: "Mayıs Tatili",
      en: "May Holiday"
    },
    zomervakantie: {
      nl: "Zomervakantie",
      tr: "Yaz Tatili",
      en: "Summer Holiday"
    },
    herfstvakantie: {
      nl: "Herfstvakantie",
      tr: "Sonbahar Tatili",
      en: "Autumn Holiday"
    },
    voorjaarsvakantie: {
      nl: "Voorjaarsvakantie",
      tr: "İlkbahar Tatili",
      en: "Spring Holiday"
    }
  },
  regions: {
    noord: {
      nl: "Noord",
      tr: "Kuzey",
      en: "North"
    },
    midden: {
      nl: "Midden",
      tr: "Orta",
      en: "Central"
    },
    zuid: {
      nl: "Zuid",
      tr: "Güney",
      en: "South"
    },
    "heel Nederland": {
      nl: "Heel Nederland",
      tr: "Tüm Hollanda",
      en: "All Netherlands"
    }
  },
  titles: {
    schoolHolidays: {
      nl: "Schoolvakanties",
      tr: "Okul Tatilleri",
      en: "School Holidays"
    },
    publicHolidays: {
      nl: "Officiële Feestdagen",
      tr: "Resmi Tatiller",
      en: "Public Holidays"
    },
    combined: {
      nl: "Schoolvakanties + Officiële Feestdagen",
      tr: "Okul + Resmi Tatiller",
      en: "School + Public Holidays"
    }
  }
} as const;

export interface SchoolHoliday {
  id: string;
  schoolyear: string; // "2025-2026"
  type: string; // kerstvakantie, meivakantie, zomervakantie, etc.
  region?: "noord" | "midden" | "zuid" | "heel Nederland";
  startdate: string; // ISO (UTC 00:00:00 assumption)
  enddate: string; // ISO (end inclusive)
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

interface VacationInfo {
  type: string;
  compulsorydates: string;
  regions: Region[];
}

interface YearContent {
  title: string;
  schoolyear: string;
  vacations: VacationInfo[];
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
      
      const data = await res.json() as YearData | YearData[];

      // Handle both array and single object responses
      const yearDataArray = Array.isArray(data) ? data : [data];

      // Log the first item for debugging
      if (yearDataArray.length > 0) {
        console.log('First year data:', JSON.stringify(yearDataArray[0].content?.[0]?.vacations?.[0], null, 2));
      }

      // Validate data structure with detailed logging
      for (const year of yearDataArray) {
        if (!year.id || !year.content || !Array.isArray(year.content)) {
          console.log('Invalid year structure:', JSON.stringify(year, null, 2));
          throw new Error(`Invalid year data structure: missing required fields`);
        }

        for (const content of year.content) {
          if (!content.schoolyear || !content.vacations || !Array.isArray(content.vacations)) {
            console.log('Invalid content structure:', JSON.stringify(content, null, 2));
            throw new Error(`Invalid content structure: missing required fields`);
          }

          for (const vacation of content.vacations) {
            if (!vacation.type || !vacation.regions || !Array.isArray(vacation.regions)) {
              console.log('Invalid vacation structure:', JSON.stringify(vacation, null, 2));
              throw new Error(`Invalid vacation structure: missing required fields`);
            }

            for (const region of vacation.regions) {
              if (!region.region || !region.startdate || !region.enddate) {
                console.log('Invalid region structure:', JSON.stringify(region, null, 2));
                throw new Error(`Invalid region structure: missing required fields`);
              }
            }
          }
        }
      }
      
      return yearDataArray;
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
    console.log('Fetching from URL:', url);
    const yearData = await fetchWithRetry(url);
    console.log(`Processing ${yearData.length} year entries...`);
    
    const holidays: SchoolHoliday[] = [];

    for (const year of yearData) {
      for (const content of year.content) {
        const cleanSchoolYear = content.schoolyear.replace(/\s+/g, '');
        
        for (const vacation of content.vacations) {
          const cleanType = vacation.type.replace(/\s+/g, '').toLowerCase();
          
          for (const region of vacation.regions) {
            holidays.push({
              id: `${cleanSchoolYear}-${cleanType}-${region.region}`,
              schoolyear: cleanSchoolYear,
              type: cleanType,
              region: region.region,
              startdate: region.startdate.split('T')[0], // Remove time part
              enddate: region.enddate.split('T')[0], // Remove time part
              notice: year.notice?.trim()
            });
          }
        }
      }
    }

    console.log(`Generated ${holidays.length} individual holiday records`);
    return holidays;
  } catch (error) {
    console.error('Failed to fetch school holidays:', error);
    throw error;
  }
}
