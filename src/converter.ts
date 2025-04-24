import { FLOAT, ISO_DATE, MAX_FLOAT, MIN_FLOAT } from './constants';

function testFloat(s: string) {
  if (FLOAT.test(s)) {
    const floatValue = Number.parseFloat(s);
    if (floatValue > MIN_FLOAT && floatValue < MAX_FLOAT) {
      return true;
    }
  }
  return false;
}

export function parseDynamicValue(value: string) {
  if (value === 'true' || value === 'TRUE') return true;
  if (value === 'false' || value === 'FALSE') return false;
  if (testFloat(value)) return Number.parseFloat(value);
  if (ISO_DATE.test(value)) return new Date(value);
  return value === '' ? null : value;
}
