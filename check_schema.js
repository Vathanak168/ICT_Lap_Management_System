import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse db.ts schema to get tables
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

// Connect to Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qyaxgthiyxezlugwwmhf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DkQwJ8J6f9bfMBVvuEmNxA_Zm3DXsmn';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAudit() {
  const supabaseTables = {};
  
  for (const tableName of Object.keys(dbTsTables)) {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    
    if (error) {
      console.error(`Error fetching table ${tableName}:`, error.message);
      continue;
    }
    
    if (data && data.length > 0) {
      supabaseTables[tableName] = Object.keys(data[0]);
    } else {
      console.log(`Table ${tableName} is empty, cannot easily determine schema using anon key without data.`);
    }
  }

  const missingInSupabase = [];
  const missingInDbTs = [];

  for (const [tableName, tsFields] of Object.entries(dbTsTables)) {
    const sbFields = supabaseTables[tableName];
    if (!sbFields) {
      continue;
    }
    
    for (const field of tsFields) {
      if (!sbFields.includes(field)) {
        missingInSupabase.push(`Table '${tableName}' has field '${field}' in db.ts, but MISSING in Supabase!`);
      }
    }
    
    for (const field of sbFields) {
      if (!tsFields.includes(field)) {
        missingInDbTs.push(`Table '${tableName}' has field '${field}' in Supabase, but NOT linked in db.ts.`);
      }
    }
  }

  console.log('\n--- Missing in Supabase DB (Frontend expects these, might crash) ---');
  missingInSupabase.forEach(msg => console.log(msg));

  console.log('\n--- Missing in Frontend db.ts (Supabase has these, might be unused) ---');
  missingInDbTs.forEach(msg => console.log(msg));
}

runAudit();
