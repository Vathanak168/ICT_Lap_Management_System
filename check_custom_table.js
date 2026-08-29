import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qyaxgthiyxezlugwwmhf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DkQwJ8J6f9bfMBVvuEmNxA_Zm3DXsmn';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log("Checking seating_plans...");
  const { data: plans, error: planError } = await supabase.from('seating_plans').select('*');
  if (planError) {
    console.error("Error fetching seating_plans:", planError.message);
  } else {
    console.log(`Found ${plans.length} seating plans.`);
    if (plans.length > 0) {
      console.log(JSON.stringify(plans[0], null, 2));
    }
  }

  console.log("\nChecking settings (for desk rotations)...");
  const { data: settings, error: settingError } = await supabase.from('settings').select('*');
  if (settingError) {
    console.error("Error fetching settings:", settingError.message);
  } else {
    console.log(`Found ${settings.length} settings.`);
    if (settings.length > 0) {
      console.log(JSON.stringify(settings[0], null, 2));
    }
  }
}

checkData();
