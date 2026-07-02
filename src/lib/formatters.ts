const STATE_NAMES_BY_CODE: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};

const TITLE_SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

const TITLE_ACRONYMS = new Set([
  'ADA',
  'BCIRP',
  'CCTV',
  'CO2',
  'EMS',
  'FY',
  'GIS',
  'HVAC',
  'IT',
  'ITB',
  'ITN',
  'ITQ',
  'RFB',
  'RFP',
  'RFQ',
]);

export function formatStateName(stateCode: string | null | undefined): string {
  if (!stateCode) {
    return 'Unknown';
  }

  const normalizedCode = stateCode.trim().toUpperCase();

  return STATE_NAMES_BY_CODE[normalizedCode] ?? stateCode;
}

export function formatCountyName(countyName: string | null | undefined): string {
  if (!countyName) {
    return 'Unknown';
  }

  return countyName
    .trim()
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === '-') {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

export function formatWebsiteHost(url: string | null | undefined): string {
  if (!url) {
    return 'Not listed';
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }
}

export function formatListingTitle(title: string | null | undefined): string {
  if (!title) {
    return '';
  }

  const normalizedTitle = title.trim().replace(/\s+/g, ' ');
  const letters = normalizedTitle.match(/[A-Za-z]/g) ?? [];
  const hasLowercase = /[a-z]/.test(normalizedTitle);

  if (letters.length === 0 || hasLowercase) {
    return normalizedTitle;
  }

  const words = normalizedTitle.split(' ');

  return words
    .map((word, index) => formatTitleWord(word, index, words.length))
    .join(' ');
}

function formatTitleWord(word: string, index: number, wordCount: number): string {
  if (shouldPreserveTitleWord(word)) {
    return word;
  }

  return word
    .split('-')
    .map((part) => formatTitlePart(part, index, wordCount))
    .join('-');
}

function formatTitlePart(part: string, index: number, wordCount: number): string {
  if (!part) {
    return part;
  }

  const match = part.match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+)([^A-Za-z0-9]*)$/);

  if (!match) {
    return part;
  }

  const [, prefix, core, suffix] = match;

  if (shouldPreserveTitleWord(core)) {
    return part;
  }

  const lowerCore = core.toLowerCase();

  if (index > 0 && index < wordCount - 1 && TITLE_SMALL_WORDS.has(lowerCore)) {
    return `${prefix}${lowerCore}${suffix}`;
  }

  return `${prefix}${lowerCore.charAt(0).toUpperCase()}${lowerCore.slice(1)}${suffix}`;
}

function shouldPreserveTitleWord(word: string): boolean {
  const normalizedWord = word.replace(/[^A-Za-z0-9]/g, '');

  if (!normalizedWord) {
    return false;
  }

  return (
    TITLE_ACRONYMS.has(normalizedWord) ||
    /\d/.test(normalizedWord) ||
    /^[IVXLCDM]+(?:\/[IVXLCDM]+)+$/.test(word)
  );
}
