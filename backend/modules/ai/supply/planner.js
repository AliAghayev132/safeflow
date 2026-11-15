/**
 * Supply distribution planner (pure, unit-tested).
 *
 * Inputs per shelter: people now and forecast, stock per kind, quantities
 * already requested; drone fleet (payload, speed, base, when free).
 * Output: per-shelter deficits, priority, and a delivery schedule where every
 * trip is assigned to the drone that can arrive earliest (greedy list
 * scheduling, highest priority first).
 */
const KINDS = ["water", "food", "medicine", "first_aid"];
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
export const distanceKm = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / 1000;
};

/** Daily ratio → quantity needed for `hours` for `people`. */
export const needFor = (people, ratios, hours) => {
  const day = hours / 24;
  return {
    water: Math.ceil(people * ratios.waterLitersPerPerson * day),
    food: Math.ceil(people * ratios.foodRationsPerPerson * day),
    medicine: Math.ceil((people / ratios.medicineKitPerPeople) * day),
    first_aid: Math.ceil((people / ratios.firstAidKitPerPeople) * day),
  };
};

/** Hours of the most constrained kind the current stock covers. */
export const coverageHours = (people, stock, ratios) => {
  if (!people) return Infinity;
  // exact hourly consumption (no rounding)
  const perHour = {
    water: (people * ratios.waterLitersPerPerson) / 24,
    food: (people * ratios.foodRationsPerPerson) / 24,
    medicine: people / ratios.medicineKitPerPeople / 24,
    first_aid: people / ratios.firstAidKitPerPeople / 24,
  };
  return Math.min(...KINDS.map((k) => (perHour[k] > 0 ? (stock[k] ?? 0) / perHour[k] : Infinity)));
};

/**
 * @param shelters [{ id, name, lat, lng, people, forecastPeople, stock{}, outstanding{} }]
 * @param fleet    [{ id, code, payloadKg, speedKmh, base{lat,lng}, freeInSec }]
 * @param opts     { ratios, unitWeightKg, targetHours, criticalHours, loadingSec, now }
 */
export const planDistribution = (shelters, fleet, opts) => {
  const { ratios, unitWeightKg, targetHours, criticalHours, loadingSec = 60, now = Date.now(), maxTrips = 60 } = opts;

  const rows = shelters.map((s) => {
    const people = Math.max(s.people, s.forecastPeople ?? s.people);
    const need = needFor(people, ratios, targetHours);
    const deficit = Object.fromEntries(
      KINDS.map((k) => [k, Math.max(0, need[k] - (s.stock?.[k] ?? 0) - (s.outstanding?.[k] ?? 0))]),
    );
    const deficitKg = Math.round(KINDS.reduce((sum, k) => sum + deficit[k] * (unitWeightKg[k] ?? 1), 0) * 10) / 10;
    const coverage = coverageHours(people, { ...s.stock }, ratios);
    const growth = s.people ? (s.forecastPeople ?? s.people) / s.people : 1;
    // Priority: lack of coverage dominates, then volume and crowd growth
    const urgency = coverage <= criticalHours ? 3 : coverage <= targetHours / 2 ? 2 : 1;
    const priority = Math.round((urgency * 100 + Math.min(100, deficitKg / 10)) * Math.max(1, growth) * 10) / 10;
    return {
      shelterId: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      people: s.people,
      forecastPeople: s.forecastPeople ?? s.people,
      coverageHours: Number.isFinite(coverage) ? Math.round(coverage * 10) / 10 : null,
      critical: coverage <= criticalHours,
      need,
      deficit,
      deficitKg,
      priority,
      trips: [],
    };
  });

  const ordered = rows.filter((r) => r.deficitKg > 0).sort((a, b) => b.priority - a.priority);

  // Drone timelines (seconds from now when each drone is back at base and free)
  const drones = fleet.map((d) => ({ ...d, freeAt: Math.max(0, d.freeInSec ?? 0) }));
  const trips = [];

  for (const row of ordered) {
    // Split the deficit into loads that fit the largest payload, kind by kind
    let remaining = KINDS.map((k) => ({ kind: k, qty: row.deficit[k] })).filter((x) => x.qty > 0);
    let guard = 0;
    // Planning window: at most `maxTrips` trips in total (the rest is reported
    // as unscheduled and planned in the next cycle)
    while (remaining.length && drones.length && trips.length < maxTrips && guard++ < 50) {
      // Earliest arrival wins
      const options = drones.map((d) => {
        const km = distanceKm(d.base, row);
        const flySec = (km / Math.max(1, d.speedKmh)) * 3600;
        return { d, km, departSec: d.freeAt + loadingSec, arriveSec: d.freeAt + loadingSec + flySec, backSec: d.freeAt + loadingSec + 2 * flySec };
      });
      const best = options.sort((a, b) => a.arriveSec - b.arriveSec)[0];
      let capacity = best.d.payloadKg;
      const items = [];
      for (const item of remaining) {
        const w = unitWeightKg[item.kind] ?? 1;
        const fit = Math.min(item.qty, Math.floor(capacity / w));
        if (fit > 0) {
          items.push({ kind: item.kind, quantity: fit });
          item.qty -= fit;
          capacity -= fit * w;
        }
      }
      if (!items.length) break; // a single unit heavier than any payload
      remaining = remaining.filter((x) => x.qty > 0);
      const loadKg = Math.round((best.d.payloadKg - capacity) * 10) / 10;
      best.d.freeAt = best.backSec;
      const trip = {
        shelterId: row.shelterId,
        shelter: row.name,
        droneId: best.d.id,
        drone: best.d.code,
        items,
        loadKg,
        distanceKm: Math.round(best.km * 100) / 100,
        departAt: new Date(now + best.departSec * 1000),
        etaAt: new Date(now + best.arriveSec * 1000),
        etaMin: Math.round(best.arriveSec / 60),
      };
      row.trips.push(trip);
      trips.push(trip);
    }
    row.unscheduledKg = Math.round(remaining.reduce((s, x) => s + x.qty * (unitWeightKg[x.kind] ?? 1), 0) * 10) / 10;
  }

  trips.sort((a, b) => a.etaAt - b.etaAt);
  // Rows carry a compact trip summary; the full list is `schedule`
  for (const r of rows) {
    r.tripCount = r.trips.length;
    r.firstEtaMin = r.trips.length ? Math.min(...r.trips.map((t) => t.etaMin)) : null;
    r.unscheduledKg ??= 0;
    delete r.trips;
  }
  return {
    shelters: rows.sort((a, b) => b.priority - a.priority),
    schedule: trips,
    totals: {
      deficitKg: Math.round(rows.reduce((s, r) => s + r.deficitKg, 0) * 10) / 10,
      trips: trips.length,
      critical: rows.filter((r) => r.critical).length,
      lastEtaMin: trips.length ? Math.max(...trips.map((t) => t.etaMin)) : 0,
      unscheduledKg: Math.round(rows.reduce((s, r) => s + (r.unscheduledKg ?? 0), 0) * 10) / 10,
    },
  };
};
