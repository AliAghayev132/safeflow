/**
 * Simulated city model for central Baku.
 *
 * The road network is a synthetic grid laid over real Baku coordinates — it
 * is NOT the real street map. It gives the routing engine a deterministic
 * graph to work with until a real routing API is plugged in.
 */

const CITY_BOUNDS = {
  latMin: 40.372,
  latMax: 40.428,
  lngMin: 49.8,
  lngMax: 49.9,
};

const ROWS = 8;
const COLS = 11;

// Street names for the simulated grid (rows = east-west, cols = north-south)
const ROW_STREETS = [
  "Neftçilər pr.",
  "Bülbül pr.",
  "R. Behbudov küç.",
  "Azadlıq pr.",
  "Tbilisi pr.",
  "Z. Bünyadov pr.",
  "Babək pr.",
  "H. Əliyev pr.",
];
const COL_STREETS = [
  "Şərifzadə küç.",
  "Mətbuat pr.",
  "İnşaatçılar pr.",
  "H. Cavid pr.",
  "Füzuli küç.",
  "Nizami küç.",
  "S. Vurğun küç.",
  "Təbriz küç.",
  "Nobel pr.",
  "Xətai pr.",
  "Yusif Səfərov küç.",
];

const ZONES = [
  // South row (coast)
  { code: "YAS", name: "Yasamal", col: 0, row: 0, population: 252000 },
  { code: "SEB", name: "Səbail", col: 1, row: 0, population: 98000 },
  { code: "XET", name: "Xətai", col: 2, row: 0, population: 290000 },
  // North row
  { code: "BIN", name: "Binəqədi", col: 0, row: 1, population: 268000 },
  { code: "NES", name: "Nəsimi", col: 1, row: 1, population: 225000 },
  { code: "NER", name: "Nərimanov", col: 2, row: 1, population: 172000 },
];

// [row, col] grid positions
const SHELTERS = [
  { code: "SH-01", name: "Respublika Stadionu", type: "stadium", at: [6, 8], capacity: 5000, rate: 0.55, address: "Təbriz küç. / Babək pr." },
  { code: "SH-02", name: "Dənizkənarı Milli Park", type: "park", at: [0, 5], capacity: 4000, rate: 0.42, address: "Neftçilər pr." },
  { code: "SH-03", name: "Nəriman Nərimanov Parkı", type: "park", at: [5, 9], capacity: 2500, rate: 0.61, address: "Z. Bünyadov pr." },
  { code: "SH-04", name: "Mülki Müdafiə Sığınacağı №1", type: "shelter", at: [2, 4], capacity: 800, rate: 0.74, address: "R. Behbudov küç. 14" },
  { code: "SH-05", name: "Mülki Müdafiə Sığınacağı №2", type: "shelter", at: [5, 4], capacity: 600, rate: 0.86, address: "Z. Bünyadov pr. 22" },
  { code: "SH-06", name: "Yasamal Mərkəzi Parkı", type: "park", at: [2, 1], capacity: 2000, rate: 0.37, address: "Mətbuat pr." },
  { code: "SH-07", name: "Atatürk Parkı", type: "park", at: [4, 7], capacity: 1800, rate: 0.48, address: "Tbilisi pr." },
  { code: "SH-08", name: "Binəqədi İdman Kompleksi", type: "stadium", at: [7, 1], capacity: 3000, rate: 0.29, address: "H. Əliyev pr." },
  { code: "SH-09", name: "Mülki Müdafiə Sığınacağı №3", type: "shelter", at: [1, 8], capacity: 700, rate: 0.66, address: "Bülbül pr. 41" },
  { code: "SH-10", name: "Xətai İdman Arenası", type: "stadium", at: [2, 9], capacity: 3500, rate: 0.52, address: "Xətai pr." },
  { code: "SH-11", name: "Mülki Müdafiə Sığınacağı №4", type: "shelter", at: [3, 2], capacity: 900, rate: 0.58, address: "Azadlıq pr. 7" },
  { code: "SH-12", name: "Sahil Parkı", type: "park", at: [0, 8], capacity: 1500, rate: 0.44, address: "Neftçilər pr. 120" },
  // Reserve points — opened only by an approved alert
  { code: "RS-01", name: "Ehtiyat Məntəqə — Ekspo Mərkəzi", type: "stadium", at: [6, 10], capacity: 4000, rate: 0, reserve: true, address: "Babək pr." },
  { code: "RS-02", name: "Ehtiyat Məntəqə — Məktəb №189", type: "shelter", at: [4, 3], capacity: 1200, rate: 0, reserve: true, address: "Tbilisi pr. 55" },
  { code: "RS-03", name: "Ehtiyat Məntəqə — Xətai Ticarət Mərkəzi", type: "shelter", at: [1, 10], capacity: 2000, rate: 0, reserve: true, address: "Bülbül pr." },
  { code: "RS-04", name: "Ehtiyat Məntəqə — Gənclər Mərkəzi", type: "shelter", at: [6, 2], capacity: 1500, rate: 0, reserve: true, address: "Babək pr. 3" },
  { code: "RS-05", name: "Ehtiyat Məntəqə — Universitet Kampusu", type: "park", at: [4, 5], capacity: 2500, rate: 0, reserve: true, address: "Tbilisi pr. 90" },
];

const BRIGADES = [
  { code: "YSD-01", name: "Yanğınsöndürmə dəstəsi №1", type: "fire", at: [1, 3], members: 6 },
  { code: "YSD-02", name: "Yanğınsöndürmə dəstəsi №2", type: "fire", at: [5, 7], members: 6 },
  { code: "YSD-03", name: "Yanğınsöndürmə dəstəsi №3", type: "fire", at: [3, 9], members: 6 },
  { code: "TTY-01", name: "Təcili Tibbi Yardım №1", type: "medical", at: [2, 5], members: 3 },
  { code: "TTY-02", name: "Təcili Tibbi Yardım №2", type: "medical", at: [6, 4], members: 3 },
  { code: "TTY-03", name: "Təcili Tibbi Yardım №3", type: "medical", at: [1, 9], members: 3 },
  { code: "XRX-01", name: "Xilasetmə dəstəsi №1", type: "rescue", at: [4, 1], members: 8 },
  { code: "XRX-02", name: "Xilasetmə dəstəsi №2", type: "rescue", at: [3, 6], members: 8 },
  { code: "XRX-03", name: "Xilasetmə dəstəsi №3", type: "rescue", at: [7, 8], members: 8 },
];

// Deterministic small jitter so the grid doesn't look perfectly rectangular
const jitter = (r, c, axis) =>
  Math.sin(r * 12.9898 + c * 78.233 + axis * 3.17) * 0.0009;

const toRad = (deg) => (deg * Math.PI) / 180;
const distanceMeters = (a, b) => {
  const R = 6378100;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const nodeId = (r, c) => `N${r}-${c}`;

const buildCityData = () => {
  const { latMin, latMax, lngMin, lngMax } = CITY_BOUNDS;
  const latStep = (latMax - latMin) / (ROWS - 1);
  const lngStep = (lngMax - lngMin) / (COLS - 1);

  // ----- Nodes -----
  const nodeIndex = new Map();
  const nodes = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const lat = latMin + r * latStep + jitter(r, c, 0);
      const lng = lngMin + c * lngStep + jitter(r, c, 1);
      const id = nodeId(r, c);
      nodeIndex.set(id, { lat, lng });
      nodes.push({ nodeId: id, location: { type: "Point", coordinates: [lng, lat] } });
    }
  }

  // ----- Edges (grid, undirected) -----
  const edges = [];
  const addEdge = (a, b, name) => {
    edges.push({
      edgeId: `E-${a}_${b}`,
      from: a,
      to: b,
      name,
      lengthMeters: Math.round(distanceMeters(nodeIndex.get(a), nodeIndex.get(b))),
      status: "open",
      congestion: 0,
    });
  };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) addEdge(nodeId(r, c), nodeId(r, c + 1), ROW_STREETS[r]);
      if (r + 1 < ROWS) addEdge(nodeId(r, c), nodeId(r + 1, c), COL_STREETS[c]);
    }
  }

  // ----- Zones (3 x 2 rectangles) -----
  const zoneLng = (lngMax - lngMin) / 3;
  const zoneLat = (latMax - latMin) / 2;
  const pad = 0.004; // extend outer edges a little past the grid
  const zones = ZONES.map((z) => {
    const west = lngMin + z.col * zoneLng - (z.col === 0 ? pad : 0);
    const east = lngMin + (z.col + 1) * zoneLng + (z.col === 2 ? pad : 0);
    const south = latMin + z.row * zoneLat - (z.row === 0 ? pad : 0);
    const north = latMin + (z.row + 1) * zoneLat + (z.row === 1 ? pad : 0);
    return {
      code: z.code,
      name: z.name,
      population: z.population,
      center: {
        type: "Point",
        coordinates: [(west + east) / 2, (south + north) / 2],
      },
      area: {
        type: "Polygon",
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
    };
  });

  const zoneCodeFor = ({ lat, lng }) => {
    const col = Math.min(2, Math.max(0, Math.floor((lng - lngMin) / zoneLng)));
    const row = Math.min(1, Math.max(0, Math.floor((lat - latMin) / zoneLat)));
    return ZONES.find((z) => z.col === col && z.row === row).code;
  };

  // ----- Shelters -----
  const shelters = SHELTERS.map((s) => {
    const id = nodeId(s.at[0], s.at[1]);
    const pos = nodeIndex.get(id);
    return {
      code: s.code,
      name: s.name,
      type: s.type,
      zoneCode: zoneCodeFor(pos),
      location: { type: "Point", coordinates: [pos.lng, pos.lat] },
      nodeId: id,
      address: s.address,
      capacity: s.capacity,
      occupancy: Math.round(s.capacity * s.rate),
      isActive: !s.reserve,
      isReserve: Boolean(s.reserve),
    };
  });

  // ----- Brigades -----
  const brigades = BRIGADES.map((b) => {
    const pos = nodeIndex.get(nodeId(b.at[0], b.at[1]));
    const point = { type: "Point", coordinates: [pos.lng, pos.lat] };
    return {
      code: b.code,
      name: b.name,
      type: b.type,
      members: b.members,
      status: "available",
      location: point,
      base: point,
    };
  });

  return { zones, nodes, edges, shelters, brigades };
};

export { buildCityData, CITY_BOUNDS };
