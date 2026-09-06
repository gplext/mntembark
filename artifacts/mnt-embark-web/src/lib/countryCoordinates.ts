/**
 * Shared geographic coordinate helpers and default centroids for countries.
 */

export const MAP_W = 1200;
export const MAP_H = 580;

/**
 * Projects (lat, lng) to (x, y) on the equirectangular 1200 × 580 map.
 */
export function proj(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * MAP_W;
  const y = ((90 - lat) / 180) * MAP_H;
  return [
    Math.max(0, Math.min(MAP_W, Number(x.toFixed(1)))),
    Math.max(0, Math.min(MAP_H, Number(y.toFixed(1)))),
  ];
}

/**
 * Inverts (x, y) back into (lat, lng).
 */
export function unproj(x: number, y: number): [number, number] {
  const lng = (x / MAP_W) * 360 - 180;
  const lat = 90 - (y / MAP_H) * 180;
  return [
    Math.max(-90, Math.min(90, Number(lat.toFixed(4)))),
    Math.max(-180, Math.min(180, Number(lng.toFixed(4)))),
  ];
}

export const COUNTRY_DEFAULT_COORDINATES: Record<string, [number, number]> = {
  // Common MNT Embark Destinations & Countries
  JP: [36.2048, 138.2529],
  japan: [36.2048, 138.2529],

  MA: [31.7917, -7.0926],
  morocco: [31.7917, -7.0926],

  IS: [64.9631, -19.0208],
  iceland: [64.9631, -19.0208],

  TH: [15.87, 100.9925],
  thailand: [15.87, 100.9925],

  MV: [3.2028, 73.2207],
  maldives: [3.2028, 73.2207],
  "the-maldives": [3.2028, 73.2207],

  KE: [-0.0236, 37.9062],
  kenya: [-0.0236, 37.9062],

  TZ: [-6.369, 34.8888],
  tanzania: [-6.369, 34.8888],

  CL: [-35.6751, -71.543],
  chile: [-35.6751, -71.543],

  AR: [-38.4161, -63.6167],
  argentina: [-38.4161, -63.6167],

  IT: [41.8719, 12.5674],
  italy: [41.8719, 12.5674],

  FR: [46.2276, 2.2137],
  france: [46.2276, 2.2137],

  ES: [40.4637, -3.7492],
  spain: [40.4637, -3.7492],

  PT: [39.3999, -8.2245],
  portugal: [39.3999, -8.2245],

  GR: [39.0742, 21.8243],
  greece: [39.0742, 21.8243],

  CH: [46.8182, 8.2275],
  switzerland: [46.8182, 8.2275],

  NO: [60.472, 8.4689],
  norway: [60.472, 8.4689],

  SE: [60.1282, 18.6435],
  sweden: [60.1282, 18.6435],

  FI: [61.9241, 25.7482],
  finland: [61.9241, 25.7482],

  GB: [55.3781, -3.436],
  uk: [55.3781, -3.436],
  "united-kingdom": [55.3781, -3.436],

  US: [37.0902, -95.7129],
  usa: [37.0902, -95.7129],
  "united-states": [37.0902, -95.7129],

  CA: [56.1304, -106.3468],
  canada: [56.1304, -106.3468],

  AU: [-25.2744, 133.7751],
  australia: [-25.2744, 133.7751],

  NZ: [-40.9006, 174.886],
  "new-zealand": [-40.9006, 174.886],

  ZA: [-30.5595, 22.9375],
  "south-africa": [-30.5595, 22.9375],

  EG: [26.8206, 30.8025],
  egypt: [26.8206, 30.8025],

  AE: [23.4241, 53.8478],
  uae: [23.4241, 53.8478],
  "united-arab-emirates": [23.4241, 53.8478],

  IN: [20.5937, 78.9629],
  india: [20.5937, 78.9629],

  NP: [28.3949, 84.124],
  nepal: [28.3949, 84.124],

  BT: [27.5142, 90.4336],
  bhutan: [27.5142, 90.4336],

  VN: [14.0583, 108.2772],
  vietnam: [14.0583, 108.2772],

  ID: [-0.7893, 113.9213],
  indonesia: [-0.7893, 113.9213],

  PE: [-9.19, -75.0152],
  peru: [-9.19, -75.0152],

  BR: [-14.235, -51.9253],
  brazil: [-14.235, -51.9253],

  MX: [23.6345, -102.5528],
  mexico: [23.6345, -102.5528],

  CR: [9.7489, -83.7534],
  "costa-rica": [9.7489, -83.7534],

  EC: [-1.8312, -78.1834],
  ecuador: [-1.8312, -78.1834],

  TR: [38.9637, 35.2433],
  turkey: [38.9637, 35.2433],

  CN: [35.8617, 104.1954],
  china: [35.8617, 104.1954],

  KR: [35.9078, 127.7669],
  "south-korea": [35.9078, 127.7669],

  NA: [-22.9576, 18.4904],
  namibia: [-22.9576, 18.4904],

  BW: [-22.3285, 24.6849],
  botswana: [-22.3285, 24.6849],

  RW: [-1.9403, 29.8739],
  rwanda: [-1.9403, 29.8739],

  UG: [1.3733, 32.2903],
  uganda: [1.3733, 32.2903],

  FJ: [-17.7134, 178.065],
  fiji: [-17.7134, 178.065],

  PF: [-17.6797, -149.4068],
  "french-polynesia": [-17.6797, -149.4068],
  "bora-bora": [-16.5004, -151.7415],

  OM: [21.4735, 55.9754],
  oman: [21.4735, 55.9754],

  JO: [30.5852, 36.2384],
  jordan: [30.5852, 36.2384],

  AT: [47.5162, 14.5501],
  austria: [47.5162, 14.5501],

  DE: [51.1657, 10.4515],
  germany: [51.1657, 10.4515],

  IE: [53.1424, -7.6921],
  ireland: [53.1424, -7.6921],

  GL: [71.7069, -42.6043],
  greenland: [71.7069, -42.6043],

  AQ: [-82.8628, 135.0],
  antarctica: [-82.8628, 135.0],
};

export function resolveDefaultCountryCoords(
  name?: string | null,
  code?: string | null,
  slug?: string | null,
): [number, number] | null {
  if (code) {
    const upperCode = code.trim().toUpperCase();
    if (COUNTRY_DEFAULT_COORDINATES[upperCode]) {
      return COUNTRY_DEFAULT_COORDINATES[upperCode];
    }
  }

  const clean = (val?: string | null) =>
    val
      ?.toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const slugCandidate = clean(slug);
  if (slugCandidate && COUNTRY_DEFAULT_COORDINATES[slugCandidate]) {
    return COUNTRY_DEFAULT_COORDINATES[slugCandidate];
  }

  const nameCandidate = clean(name);
  if (nameCandidate && COUNTRY_DEFAULT_COORDINATES[nameCandidate]) {
    return COUNTRY_DEFAULT_COORDINATES[nameCandidate];
  }

  return null;
}
