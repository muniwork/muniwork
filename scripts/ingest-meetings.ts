import crypto from 'node:crypto';
import { getSupabaseServerClient } from '../src/lib/supabase.js';

type MeetingSourceRow = {
  id: string;
  organization_id: string;
  source_type: string;
  provider: string;
  source_url: string;
  last_feed_hash: string | null;
};

type ParsedEvent = {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  publicUrl: string | null;
  status: 'scheduled' | 'canceled' | 'unknown';
  sourceUpdatedAt: string | null;
  payload: Record<string, unknown>;
};

type ExistingMeetingRow = {
  external_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  location: string | null;
  public_url: string | null;
  status: string;
  source_updated_at: string | null;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const sourceIdArg = process.argv.find((arg) => arg.startsWith('--source-id='));
const sourceId = sourceIdArg?.split('=')[1];

function unfoldIcs(value: string): string {
  return value.replace(/\r?\n[ \t]/g, '');
}

function parseIcsProperties(block: string) {
  const properties: Record<string, { value: string; params: Record<string, string> }[]> = {};

  for (const line of unfoldIcs(block).split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex === -1) {
      continue;
    }

    const rawName = line.slice(0, separatorIndex);
    const value = unescapeIcsText(line.slice(separatorIndex + 1));
    const [name, ...paramParts] = rawName.split(';');
    const params = Object.fromEntries(
      paramParts.map((part) => {
        const [key, ...rest] = part.split('=');
        return [key.toUpperCase(), rest.join('=')];
      })
    );
    const propertyName = name.toUpperCase();
    properties[propertyName] ??= [];
    properties[propertyName].push({ value, params });
  }

  return properties;
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function getFirstProperty(
  properties: Record<string, { value: string; params: Record<string, string> }[]>,
  name: string
) {
  return properties[name]?.[0] ?? null;
}

function parseIcsDate(
  property: { value: string; params: Record<string, string> } | null
): { iso: string | null; timezone: string | null } {
  if (!property?.value) {
    return { iso: null, timezone: null };
  }

  const timezone = property.params.TZID ?? null;

  if (/^\d{8}$/.test(property.value)) {
    const year = Number(property.value.slice(0, 4));
    const month = Number(property.value.slice(4, 6));
    const day = Number(property.value.slice(6, 8));
    return { iso: new Date(Date.UTC(year, month - 1, day)).toISOString(), timezone };
  }

  const match = property.value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/
  );

  if (!match) {
    return { iso: null, timezone };
  }

  const [, year, month, day, hour, minute, second, utcSuffix] = match;
  const utcDate = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );

  if (utcSuffix === 'Z' || !timezone) {
    return { iso: utcDate.toISOString(), timezone };
  }

  return { iso: zonedTimeToUtcIso(utcDate, timezone), timezone };
}

function zonedTimeToUtcIso(localTimeAsUtc: Date, timezone: string): string {
  const offsetMinutes = getTimeZoneOffsetMinutes(localTimeAsUtc, timezone);
  return new Date(localTimeAsUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

function getTimeZoneOffsetMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return (asUtc - date.getTime()) / 60_000;
}

function eventPageFromDescription(description: string | null): string | null {
  const match = description?.match(/https?:\/\/[^\s]+/);
  return match?.[0] ?? null;
}

function parseEvents(feedText: string): ParsedEvent[] {
  return [...feedText.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)]
    .map((match) => parseEvent(match[1]))
    .filter((event): event is ParsedEvent => Boolean(event));
}

function parseEvent(block: string): ParsedEvent | null {
  const properties = parseIcsProperties(block);
  const uid = getFirstProperty(properties, 'UID')?.value;
  const title = getFirstProperty(properties, 'SUMMARY')?.value;
  const starts = parseIcsDate(getFirstProperty(properties, 'DTSTART'));
  const ends = parseIcsDate(getFirstProperty(properties, 'DTEND'));
  const sourceUpdated = parseIcsDate(
    getFirstProperty(properties, 'LAST-MODIFIED') ?? getFirstProperty(properties, 'DTSTAMP')
  );
  const description = getFirstProperty(properties, 'DESCRIPTION')?.value ?? null;
  const location = stripHtml(getFirstProperty(properties, 'LOCATION')?.value);

  if (!uid || !title || !starts.iso) {
    return null;
  }

  return {
    externalId: uid,
    title: title.replace(/\s+/g, ' ').trim(),
    startsAt: starts.iso,
    endsAt: ends.iso,
    timezone: starts.timezone,
    location,
    publicUrl: eventPageFromDescription(description),
    status: /^(\*+)?\s*canceled\b|^(\*+)?\s*cancelled\b/i.test(title)
      ? 'canceled'
      : 'scheduled',
    sourceUpdatedAt: sourceUpdated.iso,
    payload: {
      description,
      rawLocation: getFirstProperty(properties, 'LOCATION')?.value ?? null,
      sequence: getFirstProperty(properties, 'SEQUENCE')?.value ?? null,
    },
  };
}

function hasMeetingChanged(existing: ExistingMeetingRow | undefined, event: ParsedEvent): boolean {
  if (!existing) {
    return true;
  }

  return (
    existing.title !== event.title ||
    existing.starts_at !== event.startsAt ||
    existing.ends_at !== event.endsAt ||
    existing.timezone !== event.timezone ||
    existing.location !== event.location ||
    existing.public_url !== event.publicUrl ||
    existing.status !== event.status ||
    existing.source_updated_at !== event.sourceUpdatedAt
  );
}

async function createRun(source: MeetingSourceRow) {
  if (dryRun) {
    return null;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('meeting_ingestion_runs')
    .insert({
      meeting_source_id: source.id,
      provider: source.provider,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create meeting ingestion run: ${error.message}`);
  }

  return data.id as string;
}

async function finishRun(
  runId: string | null,
  status: 'succeeded' | 'failed' | 'dry_run' | 'skipped',
  values: Record<string, unknown>
) {
  if (!runId) {
    return;
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('meeting_ingestion_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      ...values,
    })
    .eq('id', runId);

  if (error) {
    throw new Error(`Failed to finish meeting ingestion run ${runId}: ${error.message}`);
  }
}

async function loadSources(): Promise<MeetingSourceRow[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from('meeting_sources')
    .select('id, organization_id, source_type, provider, source_url, last_feed_hash')
    .eq('is_active', true)
    .eq('source_type', 'civicplus_ical')
    .order('created_at', { ascending: true });

  if (sourceId) {
    query = query.eq('id', sourceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load meeting sources: ${error.message}`);
  }

  return (data ?? []) as MeetingSourceRow[];
}

async function ingestSource(source: MeetingSourceRow) {
  const supabase = getSupabaseServerClient();
  const runId = await createRun(source);
  const startedAt = new Date();

  try {
    const response = await fetch(source.source_url, {
      headers: {
        accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.8',
        'user-agent': 'Muniwork meetings ingestion (contact: https://muniwork.org)',
      },
    });

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }

    const feedText = await response.text();
    const feedHash = crypto.createHash('sha256').update(feedText).digest('hex');

    if (feedHash === source.last_feed_hash) {
      if (!dryRun) {
        await supabase
          .from('meeting_sources')
          .update({ last_checked_at: startedAt.toISOString() })
          .eq('id', source.id);
      }
      await finishRun(runId, 'skipped', {
        meetings_seen: 0,
        metadata: { reason: 'feed_unchanged', feed_hash: feedHash },
      });
      return {
        sourceId: source.id,
        status: 'skipped',
        meetingsSeen: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
      };
    }

    const events = parseEvents(feedText);
    const externalIds = events.map((event) => event.externalId);
    const { data: existingRows, error: existingError } = await supabase
      .from('meetings')
      .select(
        'external_id, title, starts_at, ends_at, timezone, location, public_url, status, source_updated_at'
      )
      .eq('meeting_source_id', source.id)
      .in('external_id', externalIds.length > 0 ? externalIds : ['']);

    if (existingError) {
      throw new Error(`Failed to load existing meetings: ${existingError.message}`);
    }

    const existingByExternalId = new Map(
      ((existingRows ?? []) as ExistingMeetingRow[]).map((row) => [row.external_id, row])
    );
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const event of events) {
      const existing = existingByExternalId.get(event.externalId);

      if (!hasMeetingChanged(existing, event)) {
        unchanged += 1;
        continue;
      }

      if (existing) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    if (!dryRun && events.length > 0) {
      const { error: upsertError } = await supabase.from('meetings').upsert(
        events.map((event) => ({
          organization_id: source.organization_id,
          meeting_source_id: source.id,
          external_id: event.externalId,
          title: event.title,
          starts_at: event.startsAt,
          ends_at: event.endsAt,
          timezone: event.timezone,
          location: event.location,
          public_url: event.publicUrl,
          status: event.status,
          source_updated_at: event.sourceUpdatedAt,
          last_seen_at: startedAt.toISOString(),
          source_payload: event.payload,
        })),
        { onConflict: 'organization_id,meeting_source_id,external_id' }
      );

      if (upsertError) {
        throw new Error(`Failed to upsert meetings: ${upsertError.message}`);
      }

      const { error: missingError } = await supabase
        .from('meetings')
        .update({ status: 'unknown', last_seen_at: startedAt.toISOString() })
        .eq('meeting_source_id', source.id)
        .eq('status', 'scheduled')
        .gte('starts_at', startedAt.toISOString())
        .not('external_id', 'in', `(${externalIds.map((id) => `"${id}"`).join(',')})`);

      if (missingError) {
        throw new Error(`Failed to mark missing meetings: ${missingError.message}`);
      }

      const { error: sourceUpdateError } = await supabase
        .from('meeting_sources')
        .update({
          last_checked_at: startedAt.toISOString(),
          last_successful_check_at: startedAt.toISOString(),
          last_feed_hash: feedHash,
        })
        .eq('id', source.id);

      if (sourceUpdateError) {
        throw new Error(`Failed to update meeting source: ${sourceUpdateError.message}`);
      }
    }

    await finishRun(runId, dryRun ? 'dry_run' : 'succeeded', {
      meetings_seen: events.length,
      meetings_inserted: inserted,
      meetings_updated: updated,
      meetings_unchanged: unchanged,
      metadata: { feed_hash: feedHash },
    });

    return {
      sourceId: source.id,
      status: dryRun ? 'dry_run' : 'succeeded',
      meetingsSeen: events.length,
      inserted,
      updated,
      unchanged,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(runId, 'failed', { error_message: message });
    throw error;
  }
}

const sources = await loadSources();

if (sources.length === 0) {
  console.log('No active meeting sources found.');
  process.exit(0);
}

const results = [];

for (const source of sources) {
  results.push(await ingestSource(source));
}

console.table(results);
