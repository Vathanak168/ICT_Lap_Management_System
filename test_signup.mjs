import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
  const email = `test_${Date.now()}@example.com`;
  const password = "testpassword123";

  console.log(`Trying to sign up: ${email}`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    console.error("SignUp Error:", error);
  } else {
    console.log("SignUp Success! Session exists?", !!data.session);
    if (!data.session) {
      console.log("Email confirmation is probably required on this project.");
    }
  }
}

testSignup();
