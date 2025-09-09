function easterSunday(year) {
    // Meeus/Jones/Butcher algorithm (Gregorian)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March,4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}
function addDaysUTC(d, days) {
    const cp = new Date(d.getTime());
    cp.setUTCDate(cp.getUTCDate() + days);
    return cp;
}
export function generateNlPublicHolidays(year) {
    const es = easterSunday(year);
    const easterMon = addDaysUTC(es, 1);
    const goodFri = addDaysUTC(es, -2);
    const ascension = addDaysUTC(es, 39);
    const whitSun = addDaysUTC(es, 49);
    const whitMon = addDaysUTC(es, 50);
    const kingsDayDate = new Date(Date.UTC(year, 3, 27)); // 27 Apr
    const kingsDayObserved = kingsDayDate.getUTCDay() === 0
        ? new Date(Date.UTC(year, 3, 26)) : kingsDayDate;
    const items = [
        { uid: `nl-newyear-${year}`, title: "Nieuwjaarsdag", start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 0, 2)), allDay: true },
        { uid: `nl-goodfriday-${year}`, title: "Goede Vrijdag", start: goodFri, end: addDaysUTC(goodFri, 1), allDay: true },
        { uid: `nl-easter-${year}`, title: "Eerste Paasdag", start: es, end: addDaysUTC(es, 1), allDay: true },
        { uid: `nl-eastermonday-${year}`, title: "Tweede Paasdag", start: easterMon, end: addDaysUTC(easterMon, 1), allDay: true },
        { uid: `nl-kingsday-${year}`, title: "Koningsdag", start: kingsDayObserved, end: addDaysUTC(kingsDayObserved, 1), allDay: true },
        { uid: `nl-liberation-${year}`, title: "Bevrijdingsdag", start: new Date(Date.UTC(year, 4, 5)), end: new Date(Date.UTC(year, 4, 6)), allDay: true },
        { uid: `nl-ascension-${year}`, title: "Hemelvaartsdag", start: ascension, end: addDaysUTC(ascension, 1), allDay: true },
        { uid: `nl-whitsun-${year}`, title: "Eerste Pinksterdag", start: whitSun, end: addDaysUTC(whitSun, 1), allDay: true },
        { uid: `nl-whitmonday-${year}`, title: "Tweede Pinksterdag", start: whitMon, end: addDaysUTC(whitMon, 1), allDay: true },
        { uid: `nl-christmas1-${year}`, title: "Eerste Kerstdag", start: new Date(Date.UTC(year, 11, 25)), end: new Date(Date.UTC(year, 11, 26)), allDay: true },
        { uid: `nl-christmas2-${year}`, title: "Tweede Kerstdag", start: new Date(Date.UTC(year, 11, 26)), end: new Date(Date.UTC(year, 11, 27)), allDay: true },
    ];
    return items;
}
