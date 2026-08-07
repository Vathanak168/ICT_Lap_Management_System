import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log("Checking database records...");

  // Create a temporary admin to bypass branch RLS
  const adminEmail = `admin_check_${Date.now()}@example.com`;
  const { data: auth } = await supabase.auth.signUp({ email: adminEmail, password: "password" });
  await supabase.from('profiles').insert({ id: auth.user.id, name: "System Checker", role: "admin", branch: "System" });
  
  // Login as admin
  await supabase.auth.signInWithPassword({ email: adminEmail, password: "password" });

  // 1. Fetch Users
  const { data: profiles } = await supabase.from('profiles').select('id, name, email, role, branch');
  
  // 2. Fetch Classes
  const { data: classes } = await supabase.from('classes').select('id, name, branch');
  
  // 3. Fetch Students
  const { data: students } = await supabase.from('students').select('student_id, name, branch');
  
  // 4. Fetch Seating Plans
  const { data: seatingPlans } = await supabase.from('seating_plans').select('class_id, branch');

  console.log("\n=================================");
  console.log("👥 USERS (PROFILES):");
  console.log("=================================");
  profiles.forEach(p => console.log(`- ${p.name} (${p.email}) | Role: ${p.role} | Branch: ${p.branch}`));

  console.log("\n=================================");
  console.log("🏫 CLASSES:");
  console.log("=================================");
  if (classes.length === 0) console.log("No classes found.");
  classes.forEach(c => console.log(`- Class: ${c.name} | Branch: ${c.branch}`));

  console.log("\n=================================");
  console.log("👨‍🎓 STUDENTS:");
  console.log("=================================");
  if (students.length === 0) console.log("No students found.");
  students.forEach(s => console.log(`- Student: ${s.name} (${s.student_id}) | Branch: ${s.branch}`));

  console.log("\n=================================");
  console.log("🪑 SEATING PLANS:");
  console.log("=================================");
  if (seatingPlans.length === 0) console.log("No seating plans found.");
  seatingPlans.forEach(sp => console.log(`- Class ID: ${sp.class_id} | Branch: ${sp.branch}`));
  
  // Cleanup temp admin
  await supabase.from('profiles').delete().eq('id', auth.user.id);
}

checkData();
