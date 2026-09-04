/**
 * Advanced Khmer to English Transliteration & Romanization Engine for Admin
 * Compliant with Cambodian National ID, Passport (UNGEGN/MoI), and School Standards.
 */

const khmerDict: Record<string, string> = {
  'កែវ': 'Keo',
  'គង់': 'Kong',
  'កង': 'Kang',
  'កាង': 'Kang',
  'កាំង': 'Kang',
  'កើត': 'Koeut',
  'កុយ': 'Koy',
  'ខៀវ': 'Khiev',
  'ខាន់': 'Khan',
  'ខឹម': 'Khim',
  'ខែម': 'Khem',
  'គឹម': 'Kim',
  'ឃីម': 'Khim',
  'ឃួន': 'Khuon',
  'ឃុត': 'Khut',
  'ង៉ែត': 'Nget',
  'ង៉ែច': 'Ngech',
  'ង៉ូវ': 'Ngouv',
  'ចាន់': 'Chan',
  'ចន្ទ': 'Chan',
  'ចាប': 'Chap',
  'ជា': 'Chea',
  'ឈាង': 'Chheang',
  'ឈិត': 'Chhit',
  'ឈុន': 'Chhun',
  'ឈុំ': 'Chhum',
  'ឈ័រ': 'Chhor',
  'ជួន': 'Chuon',
  'ជ័យ': 'Chey',
  'ជិន': 'Chin',
  'ជាំង': 'Cheang',
  'ញ៉ែម': 'Nhem',
  'ញ៉ាញ់': 'Nhanh',
  'ញ៉េប': 'Nheb',
  'ដួង': 'Duong',
  'ដារ៉ា': 'Dara',
  'ឌី': 'Dy',
  'ឌីន': 'Din',
  'ឌីណន': 'Dynon',
  'ឌៀប': 'Diep',
  'ឌុល': 'Dul',
  'តាំង': 'Taing',
  'តែ': 'Tae',
  'តូច': 'Touch',
  'ទូច': 'Touch',
  'ទិត្យ': 'Tith',
  'ទី': 'Ty',
  'ថន': 'Thorn',
  'ថោង': 'Thaong',
  'ថៃ': 'Thai',
  'ទេព': 'Tep',
  'នួន': 'Nuon',
  'នាង': 'Neang',
  'នេត្រ': 'Neth',
  'នី': 'Ny',
  'នុត': 'Nut',
  'ប៉ែន': 'Pen',
  'ប៉ុក': 'Pok',
  'ប៉ាល់': 'Pal',
  'ប៉េវ៉ារ៉ា': 'Bevara',
  'ផាន់': 'Phan',
  'ផល': 'Phal',
  'ផាត': 'Phat',
  'ផាន': 'Phan',
  'ភួង': 'Phuong',
  'ភិន': 'Phin',
  'ភោគ': 'Phoak',
  'មាស': 'Meas',
  'ម៉េង': 'Meng',
  'ម៉ៅ': 'Mao',
  'ម៉ក': 'Mok',
  'ម៉ាន់': 'Man',
  'មួង': 'Muong',
  'មុយ': 'Muy',
  'ម្ដង': 'Mdorng',
  'យិន': 'Yin',
  'យឹម': 'Yim',
  'យន់': 'Yon',
  'យូ': 'You',
  'រស់': 'Ros',
  'រ័ត្ន': 'Rath',
  'រ៉េត': 'Ret',
  'រុច': 'Ruch',
  'លី': 'Ly',
  'លឹម': 'Lim',
  'ឡុង': 'Long',
  'ឡាយ': 'Lay',
  'ឡាច': 'Lach',
  'ឡេង': 'Leng',
  'វណ្ណ': 'Vann',
  'វណ្ណៈ': 'Vannak',
  'វ៉ាន់': 'Van',
  'វ៉ា': 'Va',
  'វុន': 'Vun',
  'សេង': 'Seng',
  'ស៊ឹម': 'Sim',
  'សុខ': 'Sok',
  'សួន': 'Suon',
  'ស៊ូ': 'Sou',
  'សោម': 'Som',
  'ស៊ិន': 'Sin',
  'សាន': 'San',
  'សយ': 'Say',
  'ហេង': 'Heng',
  'ហុង': 'Hong',
  'ហួត': 'Huot',
  'ហួរ': 'Hour',
  'ហុក': 'Hok',
  'ឡាំ': 'Lam',
  'អ៊ុក': 'Ouk',
  'អ៊ុង': 'Ung',
  'អ៊ឹម': 'Im',
  'អ៊ុន': 'Oun',
  'អ៊ុំ': 'Oum',
  'ឯម': 'Em',
  'ឱក': 'Ok',
  'ព្រំ': 'Prom',
  'ដាវ': 'Dav',

  'សុវណ្ណ': 'Sovann',
  'សុវណ្ណា': 'Sovanna',
  'ភូមិ': 'Phum',
  'ភូមិន្ទ': 'Phumin',
  'រតនា': 'Ratana',
  'រតនៈ': 'Ratanak',
  'រតន៍': 'Rath',
  'រត្នារី': 'Rothneary',
  'ពេញ': 'Penh',
  'ពេជ្រ': 'Pich',
  'ប៊ូលីកា': 'Bolika',
  'ប៊ុនធាន': 'Bunthean',
  'ប៊ុនធានំពរ័ត្ន': 'Buntheanport',
  'រស្មី': 'Reasmey',
  'វណ្ណរាជ': 'Vannreach',
  'រាជ': 'Reach',
  'វ៉ាយុទ្ធ': 'Vayuth',
  'រ៉ាយុទ្ធ': 'Rayuth',
  'ពេជ្រសុវណ្ណរាជ': 'Pich Sovannreach',
  'គន្ធា': 'Kunthea',
  'គន្ធារី': 'Kuntheary',
  'សិរិទ្ធ': 'Sirith',
  'សិលា': 'Seyla',
  'សិរិទ្ធសិលា': 'Sirithseyla',
  'សុខហួយ': 'Sokhuoy',
  'ហួយ': 'Huoy',
  'ចាន់ដារ៉ា': 'Chandara',
  'វិសាល': 'Visal',
  'គីមសេង': 'Kimseng',
  'សុភ័ក្ត្រ': 'Sopheaktra',
  'សុភ័ក្រ': 'Sopheak',
  'ពិសិដ្ឋ': 'Piseth',
  'សិទ្ធ': 'Seth',
  'សិទ្ធិ': 'Sethy',
  'វ៉ាន់នី': 'Vanny',
  'រដ្ឋា': 'Ratha',
  'រដ្ឋ': 'Rath',
  'វឌ្ឍនៈ': 'Vathanak',
  'វឌ្ឍនា': 'Vathana',
  'វិច្ឆិកា': 'Vicheka',
  'សុភា': 'Sophea',
  'សុភាព': 'Sopheap',
  'សុផល': 'Sophal',
  'សុខា': 'Sokha',
  'សុខុម': 'Sokhum',
  'សុធា': 'Sothea',
  'សុធារិទ្ធ': 'Sothearith',
  'សិរី': 'Serey',
  'សេរី': 'Serey',
  'មុន្នី': 'Mony',
  'មុនី': 'Mony',
  'មុន្នីរ័ត្ន': 'Monyrath',
  'បញ្ញា': 'Panha',
  'សីហា': 'Seiha',
  'ស្រី': 'Srey',
  'ពៅ': 'Pov',
  'ស្រីពៅ': 'Sreypov',
  'ស្រីនាង': 'Sreyniang',
  'ស្រីនិច': 'Sreynich',
  'ស្រីល័ក្ខ': 'Sreyleak',
  'ស្រីរ័ត្ន': 'Sreyrath',
  'ស្រីមុំ': 'Sreymom',
  'ស្រីណុច': 'Sreynoch',
  'ស្រីកា': 'Sreyka',
  'ស្រីស្រស់': 'Sreysros',
  'ច័ន្ទរិទ្ធី': 'Chanrithy',
  'ច័ន្ទបូរមី': 'Chanbormey',
  'ច័ន្ទចំនើន': 'Chanchomneun',
  'ចិន្តា': 'Chenda',
  'ចរិយា': 'Chariya',
  'ធីតា': 'Thida',
  'ធីរ៉ា': 'Thira',
  'ធារ៉ា': 'Theara',
  'ធារី': 'Theary',
  'ធារិទ្ធ': 'Thearith',
  'បុប្ផា': 'Bopha',
  'បុទុម': 'Botum',
  'ផល្លា': 'Phalla',
  'ភារម្យ': 'Phearom',
  'ភក្តី': 'Pheakdey',
  'ម៉ានិត': 'Manit',
  'យុទ្ធនា': 'Yuthana',
  'វិចិត្រ': 'Vichet',
  'វិបុល': 'Vibol',
  'វីរៈ': 'Virak',
  'វីរៈបុត្រ': 'Virakboth',
  'វុទ្ធី': 'Vuthy',
  'សម្បត្តិ': 'Sambath',
  'សាវីន': 'Savin',
  'ស៊ីណា': 'Sina',
  'សុចិត្រា': 'Sochitra',
  'សុជាតា': 'Socheata',
  'សុជាតិ': 'Socheat',
  'ឧត្តម': 'Oudom',
  'កុសល': 'Kosal',
  'កល្យាណ': 'Kalyan',
  'កញ្ញា': 'Kanya',
  'កក្កដា': 'Kakada',
  'កុលាប': 'Kolap',
  'ឆោម': 'Chhom',
  'ដានី': 'Dany',
  'ណារិទ្ធ': 'Narith',
  'ណារី': 'Nary',
  'ណារ៉ុង': 'Narong',
  'អាទិត្យ': 'Athit',
  'អានន្ទ': 'Anand',
  'ឥន្ទ្រ': 'Indra',
  'លីហេង': 'Lyheng',
  'ទេវីនីញ': 'Tevininh',
  'ទេវី': 'Devi',
  'មង្គល': 'Mongkul',
  'សុវណ្ណឡោមហេង': 'Sovannloemheng',
  'យាងស្រន': 'Yeangsron',
  'ហុងឃុន': 'Hongkhun',
  'ហេងសេដ្ឋីតា': 'Hengsetthita',
  'ម៉ាកាវីតាហ៊ូ': 'Makavitahu',
  'អេនជឺឡូ': 'Aencheulou',
  'ហ្វឺមាន': 'Hveumean',
};

const sortedDictKeys = Object.keys(khmerDict).sort((a, b) => b.length - a.length);

interface ConsonantInfo {
  latin: string;
  series: 1 | 2;
  inherent: string;
}

const consonantsMap: Record<string, ConsonantInfo> = {
  'ក': { latin: 'k', series: 1, inherent: 'a' },
  'ខ': { latin: 'kh', series: 1, inherent: 'a' },
  'គ': { latin: 'k', series: 2, inherent: 'o' },
  'ឃ': { latin: 'kh', series: 2, inherent: 'o' },
  'ង': { latin: 'ng', series: 2, inherent: 'o' },
  'ច': { latin: 'ch', series: 1, inherent: 'a' },
  'ឆ': { latin: 'chh', series: 1, inherent: 'a' },
  'ជ': { latin: 'ch', series: 2, inherent: 'o' },
  'ឈ': { latin: 'chh', series: 2, inherent: 'o' },
  'ញ': { latin: 'nh', series: 2, inherent: 'o' },
  'ដ': { latin: 'd', series: 1, inherent: 'a' },
  'ឋ': { latin: 'th', series: 1, inherent: 'a' },
  'ឌ': { latin: 'd', series: 2, inherent: 'o' },
  'ឍ': { latin: 'th', series: 2, inherent: 'o' },
  'ណ': { latin: 'n', series: 1, inherent: 'a' },
  'ត': { latin: 't', series: 1, inherent: 'a' },
  'ថ': { latin: 'th', series: 1, inherent: 'a' },
  'ទ': { latin: 't', series: 2, inherent: 'o' },
  'ធ': { latin: 'th', series: 2, inherent: 'o' },
  'ន': { latin: 'n', series: 2, inherent: 'o' },
  'ប': { latin: 'b', series: 1, inherent: 'a' },
  'ផ': { latin: 'ph', series: 1, inherent: 'a' },
  'ព': { latin: 'p', series: 2, inherent: 'o' },
  'ភ': { latin: 'ph', series: 2, inherent: 'o' },
  'ម': { latin: 'm', series: 2, inherent: 'o' },
  'យ': { latin: 'y', series: 2, inherent: 'o' },
  'រ': { latin: 'r', series: 2, inherent: 'o' },
  'ល': { latin: 'l', series: 2, inherent: 'o' },
  'វ': { latin: 'v', series: 2, inherent: 'o' },
  'ស': { latin: 's', series: 1, inherent: 'a' },
  'ហ': { latin: 'h', series: 1, inherent: 'a' },
  'ឡ': { latin: 'l', series: 1, inherent: 'a' },
  'អ': { latin: '', series: 1, inherent: 'a' },
};

const vowelsMap: Record<string, { s1: string; s2: string }> = {
  'ា': { s1: 'a', s2: 'ea' },
  'ិ': { s1: 'e', s2: 'i' },
  'ី': { s1: 'ey', s2: 'i' },
  'ឹ': { s1: 'oe', s2: 'ue' },
  'ឺ': { s1: 'eu', s2: 'eu' },
  'ុ': { s1: 'o', s2: 'u' },
  'ូ': { s1: 'ou', s2: 'u' },
  'ួ': { s1: 'uo', s2: 'uo' },
  'ើ': { s1: 'aeu', s2: 'eu' },
  'ឿ': { s1: 'oeua', s2: 'ea' },
  'ៀ': { s1: 'ie', s2: 'ie' },
  'េ': { s1: 'e', s2: 'e' },
  'ែ': { s1: 'ae', s2: 'ea' },
  'ៃ': { s1: 'ai', s2: 'ey' },
  'ោ': { s1: 'ao', s2: 'ou' },
  'ៅ': { s1: 'ov', s2: 'ov' },
};

function phoneticRomanize(word: string): string {
  let result = '';
  let i = 0;
  let currentSeries: 1 | 2 = 1;

  while (i < word.length) {
    const char = word[i];
    const nextChar = i + 1 < word.length ? word[i + 1] : '';
    const thirdChar = i + 2 < word.length ? word[i + 2] : '';

    if (nextChar === '៊') {
      currentSeries = 2;
    } else if (nextChar === '៉') {
      currentSeries = 1;
    }

    if (char === 'ា' && nextChar === 'ំ' && thirdChar === 'ង') {
      result += 'aing';
      i += 3;
      continue;
    }

    if (char === 'ា' && nextChar === 'ំ') {
      result += 'am';
      i += 2;
      continue;
    }

    if (char === '័') {
      result += 'a';
      i++;
      continue;
    }

    if (char === '់') {
      i++;
      continue;
    }

    if (char === '៍') {
      i++;
      continue;
    }

    if (char === '្' && nextChar) {
      const sub = consonantsMap[nextChar];
      if (sub) {
        if (nextChar === 'រ') {
          result += 'r';
        } else if (nextChar === 'ដ' || nextChar === 'ត') {
          result += 't';
        } else if (nextChar === 'ឋ' || nextChar === 'ឍ') {
          result += 'th';
        } else {
          result += sub.latin;
        }
      }
      i += 2;
      continue;
    }

    if (consonantsMap[char]) {
      const cons = consonantsMap[char];
      result += cons.latin;
      currentSeries = cons.series;

      const hasFollowingVowel = vowelsMap[nextChar] || nextChar === 'ា' || nextChar === 'ិ' || nextChar === 'ី' || nextChar === 'ុ' || nextChar === 'ូ' || nextChar === 'េ';
      const isSubscriptFollow = nextChar === '្';
      const isBantok = nextChar === '់' || nextChar === '៍';
      const isEnd = i === word.length - 1;

      if (!hasFollowingVowel && !isSubscriptFollow && !isBantok && !isEnd) {
        if (consonantsMap[nextChar]) {
          const nextNextChar = i + 2 < word.length ? word[i + 2] : '';
          const nextHasVowel = vowelsMap[nextNextChar];
          if (nextHasVowel || i + 1 < word.length - 1) {
            result += cons.inherent;
          }
        }
      }
    } else if (vowelsMap[char]) {
      result += currentSeries === 1 ? vowelsMap[char].s1 : vowelsMap[char].s2;
    } else if (char === 'អ' && nextChar === '៊') {
      result += 'I';
      i += 2;
      continue;
    } else {
      if (char < '\u1780' || char > '\u17FF') {
        result += char;
      }
    }

    i++;
  }

  return result;
}

function translateWordWithSegmentation(word: string): string {
  if (!word) return '';

  if (khmerDict[word]) {
    return khmerDict[word];
  }

  let remaining = word;
  const segments: string[] = [];

  while (remaining.length > 0) {
    let matched = false;
    for (const key of sortedDictKeys) {
      if (remaining.startsWith(key)) {
        segments.push(khmerDict[key]);
        remaining = remaining.slice(key.length);
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }

  if (remaining.length === 0 && segments.length > 0) {
    return segments.join('');
  }

  return phoneticRomanize(word);
}

export const translateKhmerToEnglish = (khmerText: string): string => {
  if (!khmerText) return '';

  const words = khmerText.trim().split(/\s+/);
  return words
    .map(word => {
      const trans = translateWordWithSegmentation(word);
      return trans ? trans.charAt(0).toUpperCase() + trans.slice(1).toLowerCase() : '';
    })
    .filter(Boolean)
    .join(' ');
};
