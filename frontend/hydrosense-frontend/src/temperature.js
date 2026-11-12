export const TEMPERATURE_KEY = 'hydrosense-temperature-unit';
export const isTemperatureUnit = (value) => value === 'C' || value === 'F';

export function readTemperatureUnit() {
  try {
    const saved = localStorage.getItem(TEMPERATURE_KEY);
    if (isTemperatureUnit(saved)) return saved;
  } catch {}
  return 'C';
}

// Convert only at render time; sensor state and history retain their source units.
export function displayTemperature(value, sourceUnit, targetUnit) {
  if (!Number.isFinite(value) || sourceUnit === targetUnit) return value;
  return targetUnit === 'F' ? value * 9 / 5 + 32 : (value - 32) * 5 / 9;
}
