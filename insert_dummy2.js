import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const dbTs = fs.readFileSync('./src/store/db.ts', 'utf8');
const tableMatches = [...dbTs.matchAll(/(\w+):\s*{\s*table:\s*'([^']+)'/g)];
const dbTsTables = {};

for (const match of tableMatches) {
  const storeName = match[1];
  const tableName = match[2];
  const storeBlockRegex = new RegExp(`${storeName}:\\s*{[\\s\\S]*?fields:\\s*{([\\s\\S]*?)},[\\s\\S]*?indexColumns:`, 'm');
  const storeMatch = dbTs.match(storeBlockRegex);
  if (storeMatch) {
    const fieldsBlock = storeMatch[1];
    const correctFieldMatches = [...fieldsBlock.matchAll(/field\('([^']+)'/g)];
    dbTsTables[tableName] = correctFieldMatches.map(m => m[1]);
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qyaxgthiyxezlugwwmhf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DkQwJ8J6f9bfMBVvuEmNxA_Zm3DXsmn';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAudit() {
  for (const [tableName, fields] of Object.entries(dbTsTables)) {
    const dummyRecord = {};
    for (const field of fields) {
      dummyRecord[field] = null;
    }
    dummyRecord['fake_column_123'] = 'test'; // This should trigger the error if validation works

    const { error } = await supabase.from(tableName).insert(dummyRecord);
    if (error) {
      if (error.message.includes('Could not find the column')) {
        console.log(`Table '${tableName}' missing column:`, error.message);
      } else if (error.message.includes('Could not find the table')) {
        console.log(`Table '${tableName}' is missing ENTIRELY from Supabase!`);
      } else {
        console.log(`Table '${tableName}' insert error (expected):`, error.message);
      }
    }
  }
}

runAudit();
