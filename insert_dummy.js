import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse db.ts schema to get tables and fields
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
  for (const [tableName, fields] of Object.entries(dbTsTables)) {
    // Generate a dummy record
    const dummyRecord = {};
    for (const field of fields) {
      dummyRecord[field] = null; // or empty string, we just want to trigger column existence check
    }

    // Try to insert
    const { error } = await supabase.from(tableName).insert(dummyRecord);
    
    if (error) {
      if (error.message.includes('Could not find the column')) {
        console.log(`Table '${tableName}' missing column:`, error.message);
      } else if (error.message.includes('Could not find the table')) {
        console.log(`Table '${tableName}' is missing ENTIRELY from Supabase!`);
      } else {
        // Other errors like RLS or null constraints are fine, it means the table and columns exist!
        // console.log(`Table '${tableName}' insert error (expected):`, error.message);
      }
    } else {
      console.log(`Table '${tableName}' insert succeeded (unexpected for dummy data)`);
    }
  }
}

runAudit();
