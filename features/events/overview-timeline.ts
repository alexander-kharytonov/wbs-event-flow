import { Temporal } from "@js-temporal/polyfill";

export type ArrivalBucket = {
  start: string;
  end: string;
  count: number;
  incomplete: boolean;
};

export function timelinePlan(startsAt: Date, endsAt: Date, timezone: string) {
  const origin = Temporal.Instant.from(startsAt.toISOString())
    .toZonedDateTimeISO(timezone)
    .startOfDay().epochMilliseconds;
  let stepMs = 30 * 60 * 1000;
  const first = () => Math.floor((startsAt.getTime() - origin) / stepMs);
  const end = () => Math.ceil((endsAt.getTime() - origin) / stepMs);

  while (end() - first() > 192) {
    stepMs *= 2;
  }

  return { origin, stepMs, first: first(), end: end() };
}

export function arrivalBuckets(
  plan: ReturnType<typeof timelinePlan>,
  endsAt: Date,
  now: Date,
  rows: { bucket: number; count: number }[],
): ArrivalBucket[] {
  const counts = new Map(rows.map((row) => [row.bucket, row.count]));
  const buckets: ArrivalBucket[] = [];

  for (let k = plan.first; k < plan.end; k += 1) {
    const start = plan.origin + k * plan.stepMs;
    const end = start + plan.stepMs;

    if (start > now.getTime()) {
      break;
    }

    buckets.push({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      count: counts.get(k) ?? 0,
      incomplete: now < endsAt && end > now.getTime(),
    });
  }

  return buckets;
}

export function peakArrival(buckets: ArrivalBucket[]) {
  let peak: ArrivalBucket | null = null;

  for (const bucket of buckets) {
    if (bucket.count > (peak?.count ?? 0)) {
      peak = bucket;
    }
  }

  return peak;
}
