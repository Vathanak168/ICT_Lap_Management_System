import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log("Checking columns of 'students' table...");
  const { data, error } = await supabase.rpc('get_students_columns');
  // Or we can just fetch a row and look at the keys
  const { data: row } = await supabase.from('students').select('*').limit(1);
  if (row && row.length > 0) {
    console.log("Columns in a row:", Object.keys(row[0]));
  } else {
    console.log("No rows returned or error");
  }
}

checkSchema();
