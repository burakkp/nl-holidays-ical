import { createEvents, DateArray } from "ics";

export type IcsEvent = {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  uid: string;
  allDay?: boolean;
  created?: Date;
  lastModified?: Date;
};

type DateTimeType = 'local' | 'utc';

function toDateArray(d: Date): DateArray {
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function sanitizeText(text: string): string {
  return text.replace(/[\n\r\t]/g, ' ').replace(/[,;]/g, '\\$&');
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

      // For all-day events, end date should be the next day (exclusive)
      const endDate = new Date(e.end);
      if (e.allDay) {
        endDate.setUTCDate(endDate.getUTCDate() + 1);
      }

      const dateTimeType: DateTimeType = e.allDay ? 'local' : 'utc';

      return {
        title: sanitizeText(e.title),
        description: e.description ? sanitizeText(e.description) : undefined,
        location: e.location ? sanitizeText(e.location) : undefined,
        start: toDateArray(e.start),
        end: toDateArray(endDate),
        startInputType: dateTimeType,
        endInputType: dateTimeType,
        startOutputType: dateTimeType,
        endOutputType: dateTimeType,
        productId: "-//nl-holidays-ical//burakkp/nl-holidays-ical//EN",
        uid: e.uid,
        created: e.created ? toDateArray(e.created) : undefined,
        lastModified: e.lastModified ? toDateArray(e.lastModified) : undefined,
        status: 'CONFIRMED' as const,
        busyStatus: 'FREE' as const,
        classification: 'PUBLIC' as const,
        transp: 'TRANSPARENT' as const,
        calName: sanitizeText(name),
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

    // Format ICS file with proper headers and properties
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//nl-holidays-ical//burakkp/nl-holidays-ical//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${sanitizeText(name)}`,
      'X-WR-CALDESC:Dutch School Holidays Calendar',
      'X-PUBLISHED-TTL:PT24H',
      'REFRESH-INTERVAL;VALUE=DURATION:PT24H',
      value.replace(/^BEGIN:VCALENDAR\r?\n|END:VCALENDAR\r?\n?$/g, '').trim(),
      'END:VCALENDAR'
    ];

    // Ensure CRLF line endings as per RFC 5545
    return lines.join('\r\n');
  } catch (error) {
    console.error('Failed to generate ICS:', error);
    if (error instanceof Error) {
      throw new Error(`ICS generation failed: ${error.message}`);
    }
    throw new Error(`ICS generation failed: ${error}`);
  }
}
