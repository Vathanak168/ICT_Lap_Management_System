import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("Running DB insert test...");
  const payload = {
    student_id: "TEST-002",
    name: "Test User 2",
    gender: "M",
    class: "Test Class",
    shift: "Morning",
    academic_year: "2025-2026",
    status: "Active",
    pc_number: "PC-01", 
    password: "123"     
  };

  try {
    const { data, error } = await supabase
      .from('students')
      .upsert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      console.log("SUPABASE ERROR:", JSON.stringify(error, null, 2));
    } else {
      console.log("SUCCESS:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("CATCH ERROR:", err);
  }
}

runTest();
