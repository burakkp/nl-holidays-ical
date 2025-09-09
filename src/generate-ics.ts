import { createEvents, DateArray } from "ics";

export type IcsEvent = {
  title: string;
  start: Date;
  end: Date; // non-inclusive (ics kütüphanesi DateArray bekler)
  description?: string;
  location?: string;
  uid: string;
  allDay?: boolean;
};

function toDateArrayUTC(d: Date): DateArray {
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0];
}

export function eventsToIcs(name: string, events: IcsEvent[]): string {
  if (!Array.isArray(events)) {
    throw new Error('Expected events to be an array');
  }
  
  try {
    const eventData = events.map((e) => {
      if (!(e.start instanceof Date) || !(e.end instanceof Date)) {
        console.error('Invalid event:', JSON.stringify(e, null, 2));
        throw new Error('Invalid date format in event');
      }
      return {
        title: e.title,
        start: toDateArrayUTC(e.start),
        end: toDateArrayUTC(e.end),
        description: e.description,
        location: e.location,
        calName: name,
        productId: "-//nl-holidays-ical//burakkp/nl-holidays-ical//EN",
        uid: e.uid,
      };
    });

    const { error, value } = createEvents(eventData);
    
    if (error) {
      console.error('Failed to create events:', error, '\nEvent data:', JSON.stringify(eventData, null, 2));
      throw new Error(`Failed to create events: ${error.message || error}`);
    }
    if (!value) {
      throw new Error("Failed to create events: no value returned");
    }

    // ek başlıklar
    return [
      `BEGIN:VCALENDAR`,
      `PRODID:-//nl-holidays-ical//github.com/ORG/REPO//EN`,
      `CALSCALE:GREGORIAN`,
      `METHOD:PUBLISH`,
      `NAME:${name}`,
      `X-WR-CALNAME:${name}`,
      `REFRESH-INTERVAL;VALUE=DURATION:PT24H`,
      `X-PUBLISHED-TTL:PT24H`,
      value.replace(/^BEGIN:VCALENDAR\n|END:VCALENDAR\n?$/g, ""),
      `END:VCALENDAR`,
    ].join("\n");
  } catch (error) {
    console.error('Failed to generate ICS:', error);
    if (error instanceof Error) {
      throw new Error(`ICS generation failed: ${error.message}`);
    }
    throw new Error(`ICS generation failed: ${error}`);
  }
}
