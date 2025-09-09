import { fetch } from "undici";
const BASE = "https://opendata.rijksoverheid.nl/v1/sources/rijksoverheid/infotypes/schoolholidays";
async function fetchWithRetry(url, retries = 3) {
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
            console.log('Response data:', data);
            if (!Array.isArray(data)) {
                throw new Error(`Invalid response format: expected array, got ${typeof data}`);
            }
            return data;
        }
        catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === retries - 1)
                throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000)); // exponential backoff
        }
    }
    throw new Error("Failed after retries");
}
export async function fetchSchoolHolidays(schoolyear) {
    const url = schoolyear
        ? `${BASE}/schoolyear/${schoolyear}?output=json`
        : `${BASE}?output=json`;
    try {
        const data = await fetchWithRetry(url);
        return data.map((d) => ({
            id: String(d.id),
            schoolyear: d.schoolyear,
            type: d.type,
            region: d.region,
            startdate: d.startdate,
            enddate: d.enddate,
            notice: d.notice,
        }));
    }
    catch (error) {
        console.error('Failed to fetch school holidays:', error);
        throw error;
    }
}
