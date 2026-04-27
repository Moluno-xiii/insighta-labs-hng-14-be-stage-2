import { NAME_TO_ISO } from './countries';
import { ParsedSearchFilters } from './profiles.types';

const BOTH_GENDERS =
  /\b(male and female|female and male|males and females|females and males|men and women|women and men|both genders)\b/;

const MALE = /\b(males?|men|man|boys?|gentlemen)\b/;
const FEMALE = /\b(females?|women|woman|girls?|ladies)\b/;

const YOUNG_MIN = 16;
const YOUNG_MAX = 24;

const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseNaturalQuery = (raw: string): ParsedSearchFilters | null => {
  const text = ` ${raw.toLowerCase().trim()} `.replace(/\s+/g, ' ');
  const filters: ParsedSearchFilters = {};
  let working = text;

  const hasBothGenders = BOTH_GENDERS.test(working);
  if (hasBothGenders) {
    working = working.replace(BOTH_GENDERS, ' ');
  } else if (MALE.test(working)) {
    filters.gender = 'male';
  } else if (FEMALE.test(working)) {
    filters.gender = 'female';
  }

  if (/\b(children|child|kids?)\b/.test(working)) {
    filters.age_group = 'child';
  } else if (/\b(teenagers?|teens?)\b/.test(working)) {
    filters.age_group = 'teenager';
  } else if (/\b(adults?)\b/.test(working)) {
    filters.age_group = 'adult';
  } else if (/\b(seniors?|elderly|old people)\b/.test(working)) {
    filters.age_group = 'senior';
  }

  if (/\byoung\b/.test(working)) {
    filters.min_age = YOUNG_MIN;
    filters.max_age = YOUNG_MAX;
  }

  const between = working.match(
    /\b(?:between|aged)\s+(\d{1,3})\s+(?:and|to|-)\s+(\d{1,3})\b/,
  );
  if (between) {
    const a = parseInt(between[1], 10);
    const b = parseInt(between[2], 10);
    filters.min_age = Math.min(a, b);
    filters.max_age = Math.max(a, b);
  }

  const above = working.match(
    /\b(?:above|over|older than|greater than|more than|aged over|aged above)\s+(\d{1,3})\b/,
  );
  if (above) {
    const n = parseInt(above[1], 10);
    filters.min_age = Math.max(filters.min_age ?? 0, n);
  }

  const below = working.match(
    /\b(?:below|under|younger than|less than|aged under|aged below)\s+(\d{1,3})\b/,
  );
  if (below) {
    const n = parseInt(below[1], 10);
    filters.max_age =
      filters.max_age === undefined ? n : Math.min(filters.max_age, n);
  }

  for (const [name, code] of NAME_TO_ISO) {
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
    if (pattern.test(working)) {
      filters.country_id = code;
      break;
    }
  }

  if (Object.keys(filters).length === 0) return null;
  return filters;
};

export { parseNaturalQuery };
