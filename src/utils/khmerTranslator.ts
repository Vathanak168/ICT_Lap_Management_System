/**
 * Advanced Khmer to English Transliteration Engine
 * Handles Consonant Series (1 & 2), Subscripts, and common name overrides.
 */

// Common Khmer name parts that have standard romanizations
const commonNamesDict: Record<string, string> = {
  'សុខ': 'Sok',
  'ចាន់': 'Chan',
  'សិទ្ធ': 'Seth',
  'កែវ': 'Keo',
  'មាស': 'Meas',
  'រិទ្ធ': 'Rith',
  'ពេជ្រ': 'Pich',
  'លី': 'Ly',
  'សេង': 'Seng',
  'ហេង': 'Heng',
  'វណ្ណ': 'Vann',
  'វណ្ណៈ': 'Vannak',
  'ស្រី': 'Srey',
  'ពៅ': 'Pov',
  'រ័ត្ន': 'Rath',
  'រតនា': 'Ratana',
  'មុន្នី': 'Mony',
  'សីហា': 'Seiha',
  'ដារ៉ា': 'Dara',
  'បញ្ញា': 'Panha',
  'វិសាល': 'Visal',
  'រាជ': 'Reach',
  'សុធា': 'Sothea',
  'អ៊ុន': 'Oun',
  'ឯម': 'Em',
  'ឱក': 'Ok',
  'ឌី': 'Dy',
  'ឈិត': 'Chhit',
  'កង': 'Kang',
  'ផាន់': 'Phan',
  'នួន': 'Nuon',
  'ប៉ែន': 'Pen',
  'ធឿន': 'Thoeun',
  'ដួង': 'Duong',
  'ជួន': 'Chuon',
  'ឡុង': 'Long',
  'លឹម': 'Lim',
  'វ៉ាន់': 'Van',
  'មួង': 'Muong',
  'សួន': 'Suon',
  'អ៊ុក': 'Ouk',
  'រ៉េត': 'Ret',
  'ទី': 'Ty',
  'នី': 'Ny',
  'ម៉ាន': 'Man',
  'សុខា': 'Sokha',
  'ផានិត': 'Phanit',
  'សុជាតា': 'Socheata',
  'សុវណ្ណ': 'Sovann',
  'សុវណ្ណារាជ': 'Sovannareach',
  'ច័ន្ទរិទ្ធី': 'Chanrithy',
  'ស្រីនិច': 'Sreynich',
  'សុខឃីម': 'SokKhim',
  'ស្រីរ័ត្ន': 'Sreyrath',
  'ហួរ': 'Hour',
  'ស្រីល័ក្ខ': 'Sreyleak',
  'សុធារិទ្ធ': 'Sothearith',
  'ស្រីពៅ': 'Sreypov',
  'ចាន់ដារ៉ា': 'Chandara',
  'ស្រីនាង': 'Sreyniang',
};

// Consonant mapping with their Series (1 or 2)
interface ConsonantMap {
  latin: string;
  series: 1 | 2;
}

const consonants: Record<string, ConsonantMap> = {
  'ក': { latin: 'k', series: 1 },
  'ខ': { latin: 'kh', series: 1 },
  'គ': { latin: 'k', series: 2 },
  'ឃ': { latin: 'kh', series: 2 },
  'ង': { latin: 'ng', series: 2 },
  'ច': { latin: 'ch', series: 1 },
  'ឆ': { latin: 'chh', series: 1 },
  'ជ': { latin: 'ch', series: 2 },
  'ឈ': { latin: 'chh', series: 2 },
  'ញ': { latin: 'nh', series: 2 },
  'ដ': { latin: 'd', series: 1 },
  'ឋ': { latin: 'th', series: 1 },
  'ឌ': { latin: 'd', series: 2 },
  'ឍ': { latin: 'th', series: 2 },
  'ណ': { latin: 'n', series: 1 },
  'ត': { latin: 't', series: 1 },
  'ថ': { latin: 'th', series: 1 },
  'ទ': { latin: 't', series: 2 },
  'ធ': { latin: 'th', series: 2 },
  'ន': { latin: 'n', series: 2 },
  'ប': { latin: 'b', series: 1 },
  'ផ': { latin: 'ph', series: 1 },
  'ព': { latin: 'p', series: 2 },
  'ភ': { latin: 'ph', series: 2 },
  'ម': { latin: 'm', series: 2 },
  'យ': { latin: 'y', series: 2 },
  'រ': { latin: 'r', series: 2 },
  'ល': { latin: 'l', series: 2 },
  'វ': { latin: 'v', series: 2 },
  'ស': { latin: 's', series: 1 },
  'ហ': { latin: 'h', series: 1 },
  'ឡ': { latin: 'l', series: 1 },
  'អ': { latin: 'a', series: 1 },
};

// Vowel mapping based on Series 1 and Series 2
const vowels: Record<string, { s1: string; s2: string }> = {
  'ា': { s1: 'a', s2: 'ea' },
  'ិ': { s1: 'e', s2: 'i' },
  'ី': { s1: 'ei', s2: 'i' },
  'ឹ': { s1: 'oe', s2: 'ue' },
  'ឺ': { s1: 'eu', s2: 'eu' },
  'ុ': { s1: 'o', s2: 'u' },
  'ូ': { s1: 'ou', s2: 'u' },
  'ួ': { s1: 'uo', s2: 'uo' },
  'ើ': { s1: 'aeu', s2: 'eu' },
  'ឿ': { s1: 'ea', s2: 'ea' },
  'ៀ': { s1: 'ie', s2: 'ie' },
  'េ': { s1: 'e', s2: 'e' },
  'ែ': { s1: 'ae', s2: 'ea' },
  'ៃ': { s1: 'ai', s2: 'ey' },
  'ោ': { s1: 'ao', s2: 'ou' },
  'ៅ': { s1: 'av', s2: 'ov' },
};

const independentVowels: Record<string, string> = {
  'ឥ': 'e', 'ឦ': 'ei', 'ឧ': 'u', 'ឩ': 'u', 'ឪ': 'ov',
  'ឫ': 'rue', 'ឬ': 'rue', 'ឭ': 'lue', 'ឮ': 'lue',
  'ឯ': 'ae', 'ឰ': 'ai', 'ឱ': 'ao', 'ឲ': 'ao', 'ឳ': 'ao',
};

const diacritics: Record<string, string> = {
  'ំ': 'm', 
  'ះ': 'h', 
  'ៈ': 'a',
  '៊': '', // Treisap (forces series 2)
  '៉': '', // Musikatnoan (forces series 1)
  '្': '', // Subscript marker (handled in code)
  '៍': '', // Bantok (silent)
  '៌': '', // Robat (silent)
  '័': 'a',
  '៎': '',
  '៏': 'ko',
};

export const translateKhmerToEnglish = (khmerText: string): string => {
  if (!khmerText) return '';

  // 1. Try dictionary lookup for whole words first
  const words = khmerText.trim().split(/\s+/);
  const translatedWords = words.map(word => {
    // Check if the whole word is in dictionary
    if (commonNamesDict[word]) {
      return commonNamesDict[word];
    }
    
    // Check if word can be split into two known parts (e.g. កែវពិសិដ្ឋ -> Keo Piseth)
    for (const key of Object.keys(commonNamesDict)) {
      if (word.startsWith(key) && word.length > key.length) {
        const remaining = word.slice(key.length);
        if (commonNamesDict[remaining]) {
          return commonNamesDict[key] + commonNamesDict[remaining].toLowerCase();
        }
      }
    }

    // 2. Fallback to algorithmic phonetic transliteration
    return phoneticTransliterate(word);
  });

  // Capitalize first letter of each word
  return translatedWords
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const phoneticTransliterate = (word: string): string => {
  let result = '';
  let currentSeries: 1 | 2 = 1;
  let i = 0;

  while (i < word.length) {
    const char = word[i];
    const nextChar = i + 1 < word.length ? word[i + 1] : '';

    // Handle Diacritic Overrides (Treisap / Musikatnoan)
    if (nextChar === '៊') {
      currentSeries = 2;
    } else if (nextChar === '៉') {
      currentSeries = 1;
    }

    // Subscript (ជើង)
    if (char === '្' && nextChar) {
      const subCons = consonants[nextChar];
      if (subCons) {
        // Subscripts generally don't change the base series unless specific rules apply,
        // we'll keep the current series but just add the latin letter.
        result += subCons.latin;
      }
      i += 2;
      continue;
    }

    // Special combinations like ាំ (aam)
    if (char === 'ា' && nextChar === 'ំ') {
      result += 'am';
      i += 2;
      continue;
    }

    // Consonants
    if (consonants[char]) {
      result += consonants[char].latin;
      // Update series based on consonant, unless overridden by diacritics
      if (word[i+1] !== '៊' && word[i+1] !== '៉') {
        currentSeries = consonants[char].series;
      }
    } 
    // Dependent Vowels
    else if (vowels[char]) {
      result += currentSeries === 1 ? vowels[char].s1 : vowels[char].s2;
    } 
    // Independent Vowels
    else if (independentVowels[char]) {
      result += independentVowels[char];
    } 
    // Diacritics
    else if (diacritics[char] !== undefined) {
      result += diacritics[char];
    } 
    // Unmapped characters (English letters, numbers)
    else {
      result += char;
    }

    i++;
  }

  return result;
};
