import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const { data: bData, error: bError } = await supabase.from('students').select('branch').limit(1);
  console.log('Branch error:', bError);
}

test();
