import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixClass() {
  const { data, error } = await supabase
    .from('students')
    .update({ class: '10A1' })
    .eq('class', 'WEB-101');
    
  if (error) {
    console.error('Error updating students:', error);
  } else {
    console.log('Successfully updated students from WEB-101 to 10A1');
  }
}

fixClass();
