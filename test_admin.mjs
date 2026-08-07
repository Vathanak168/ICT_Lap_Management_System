import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabaseAnon = createClient(supabaseUrl, supabaseKey);

const results = [];
function log(msg, status = 'INFO') {
  console.log(`[${status}] ${msg}`);
  results.push({ status, msg });
}

async function runTests() {
  log("Starting Point 4 & 5 (Tools & Admin Panel) Tests...", "INFO");

  const timestamp = Date.now();
  const branchA = `Branch_A_${timestamp}`;
  const branchB = `Branch_B_${timestamp}`;
  
  // Setup Teacher A
  const emailA = `teacherA_${timestamp}@example.com`;
  const { data: authA } = await supabaseAnon.auth.signUp({ email: emailA, password: "testpassword" });
  const clientA = createClient(supabaseUrl, supabaseKey);
  await clientA.auth.signInWithPassword({ email: emailA, password: "testpassword" });
  await clientA.from('profiles').insert({ id: authA.user.id, name: "Teacher A", role: "teacher", branch: branchA });
  
  // Setup Super Admin
  const emailAdmin = `admin_${timestamp}@example.com`;
  const { data: authAdmin } = await supabaseAnon.auth.signUp({ email: emailAdmin, password: "testpassword" });
  const clientAdmin = createClient(supabaseUrl, supabaseKey);
  await clientAdmin.auth.signInWithPassword({ email: emailAdmin, password: "testpassword" });
  await clientAdmin.from('profiles').insert({ id: authAdmin.user.id, name: "Super Admin", role: "admin", branch: "Headquarters" });

  // ==========================================
  // POINT 4: MINI APPS (No RLS branch restriction by default)
  // ==========================================
  log("\n--- Testing Mini Apps (Point 4) ---");
  try {
     const appId = crypto.randomUUID();
     // Teacher A creates an app for Branch A
     const { error: appErr } = await clientA.from('mini_apps').insert({
        id: appId,
        name: "Test App",
        url: "https://test.com",
        icon_url: "icon.png",
        branch: branchA
     });
     if (appErr) throw appErr;
     log(`Teacher A inserted a Mini App`, "PASS");
     
     // Super Admin reads it
     const { data: appData } = await clientAdmin.from('mini_apps').select('*').eq('id', appId);
     if (appData && appData.length > 0) log(`Super Admin can see the Mini App (RLS allows all)`, "PASS");
     else throw new Error("Could not read Mini App");
     
     await clientA.from('mini_apps').delete().eq('id', appId);
  } catch(e) {
     log(`Mini Apps Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // POINT 5: ADMIN GLOBAL ACCESS (The RLS Challenge)
  // ==========================================
  log("\n--- Testing Admin Global Access (Point 5) ---");
  const studentId = `ST-ADMIN-${timestamp}`;
  const classId = `CLASS-ADMIN-${timestamp}`;
  try {
     // Teacher A creates a class and student in Branch A
     await clientA.from('classes').insert({ id: classId, name: "Class A", shift: "Morning", academic_year: "2026-2027", branch: branchA });
     await clientA.from('students').insert({ student_id: studentId, name: "Student A", gender: "M", class: classId, shift: "Morning", academic_year: "2026-2027", branch: branchA });
     
     // Super Admin tries to read the student from Branch A
     const { data: adminRead, error: adminErr } = await clientAdmin.from('students').select('*').eq('student_id', studentId);
     
     if (adminErr) {
        log(`Admin read error: ${adminErr.message}`, "FAIL");
     } else if (adminRead && adminRead.length > 0) {
        log(`Super Admin CAN see data from Branch A`, "PASS");
     } else {
        log(`Super Admin CANNOT see data from Branch A! The new RLS blocked the Admin because Admin's branch ('Headquarters') != Student's branch ('${branchA}').`, "FAIL");
     }
     
     // Cleanup
     await clientA.from('students').delete().eq('student_id', studentId);
     await clientA.from('classes').delete().eq('id', classId);
  } catch(e) {
     log(`Admin Access Error: ${e.message}`, "FAIL");
  }

  fs.writeFileSync('admin_test_results.json', JSON.stringify(results, null, 2));
  console.log("\nDone! Results written to admin_test_results.json");
}

runTests();
