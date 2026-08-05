import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env file manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

const studentsData = [
  // Page 1
  { name: 'ផល្លា ឈុនឃាង', gender: 'M' },
  { name: 'ញ៉ឹក រដ្ឋា', gender: 'M' },
  { name: 'ធារី សិរីល័ក្ខ', gender: 'F' },
  { name: 'ហេង លាងម៉េង', gender: 'M' },
  { name: 'ទួន វឌ្ឍនៈ', gender: 'M' },
  { name: 'សុគន្ធ ធានី', gender: 'F' },
  { name: 'លន់ ស៊ីឈាងពូ', gender: 'M' },
  { name: 'លី ម៉ានី', gender: 'F' },
  { name: 'ស្រេង រ៉ូហ្សា', gender: 'F' },
  { name: 'ត្ថា ឬទ្ធី', gender: 'M' },
  { name: 'ឌីណន ខេមរាបុត្រ', gender: 'M' },
  { name: 'ហ៊ា ភក្តី', gender: 'M' },
  { name: 'ប៊ុនរិទ្ធ សិទ្ធិការ្យ', gender: 'M' },
  { name: 'សៅ សាមីរ៉ូណាត', gender: 'F' },
  { name: 'សុខ ចាន់ធា', gender: 'F' },
  { name: 'ស្រេង ឆាយលី', gender: 'F' },
  { name: 'ហ៊ាង លាងជី', gender: 'M' },
  { name: 'គៀន បញ្ញាបុត្រ', gender: 'M' },
  { name: 'សុខខា ស្រីកា', gender: 'F' },
  { name: 'អ៊ាន ច័ន្ទសុវណ្ណារាជ', gender: 'M' },
  { name: 'ឯក ប៊ុនយ៉ារិទ្ធ', gender: 'M' },
  { name: 'ប៉ាន់ រ៉ាស៊ីណា', gender: 'M' },
  { name: 'សុភ័ណ្ឌ សូឡារ៉ា', gender: 'F' },
  { name: 'រិត លីសា', gender: 'F' },
  // Page 2
  { name: 'ចាន់ជា សុធីស័ក្ត', gender: 'M' },
  { name: 'ជាវ ហាងស្រ៊ុន', gender: 'M' },
  { name: 'ហ៊ឹម ម៉េងគីម', gender: 'M' },
  { name: 'សុគន្ធ វីរៈបុត្រ', gender: 'M' },
  { name: 'យ៉ា ច័ន្ទថា', gender: 'M' },
  { name: 'តាំង មង្គលឧត្តម', gender: 'M' },
  { name: 'ស៊ា សុម៉ានី', gender: 'F' },
  { name: 'ខលជា រ៉ូសប៊ី', gender: 'F' },
  { name: 'លីម ស៊ីវវ័យ', gender: 'M' },
  { name: 'យឿនសាវ មុនិន្ទ', gender: 'F' },
  { name: 'សុង ដានិច្ច', gender: 'F' },
  { name: 'ធារ៉ា មុន្នីមករា', gender: 'F' },
  { name: 'ឌី បញ្ញាសិទ្ធ', gender: 'M' },
  { name: 'ឃឹម គីមហេង', gender: 'F' },
  { name: 'ធឿន លីអ៊ឹង', gender: 'F' },
  { name: 'ជាវ គីមជូ', gender: 'F' },
  { name: 'ទូច ម៉ីឡាក់', gender: 'F' },
];

async function insertData() {
  const classId = '8A1_8A2_Morning';
  const shift = 'Morning';

  // 1. Insert Class
  console.log('Inserting Class...');
  const { error: classError } = await supabase
    .from('classes')
    .upsert({
      id: classId,
      name: '8A1 & 8A2',
      shift: shift,
      academic_year: '2025-2026',
      notes: 'Combined class',
      linked_class_ids: []
    });

  if (classError) {
    console.error('Error inserting class:', classError);
    return;
  }
  console.log('Class inserted successfully!');

  // 2. Insert Students
  console.log(`Inserting ${studentsData.length} students...`);
  
  const studentsToInsert = studentsData.map((s, index) => {
    // Generate a simple student ID
    const studentId = `STU-8A-${String(index + 1).padStart(3, '0')}`;
    return {
      student_id: studentId,
      name: s.name,
      english_name: '',
      gender: s.gender,
      class: classId,
      shift: shift,
      status: 'Active'
    };
  });

  const { error: studentsError } = await supabase
    .from('students')
    .insert(studentsToInsert);

  if (studentsError) {
    console.error('Error inserting students:', studentsError);
  } else {
    console.log('Students inserted successfully!');
  }
}

insertData();
