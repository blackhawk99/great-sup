// Simple seasonal adjustment of wind and wave directions.
// Values roughly follow prevailing Greek wind patterns.

const prevailingByMonth = [
  320, 320, 330, 330, // Jan-Apr: NW
  0,   20,  30,  30,  // May-Aug: NNE/E (Meltemi)
  0,   320, 310, 310  // Sep-Dec: N/NW
];

export function adjustDirectionForSeason(direction, date = new Date()) {
  const month = date.getMonth(); // 0-11
  const prevailing = prevailingByMonth[month] ?? direction;
  // Shift 30% toward prevailing direction
  const shifted = (direction + ((prevailing - direction) * 0.3)) % 360;
  return shifted < 0 ? shifted + 360 : shifted;
}
