import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
  log("Starting Core Management (Point 2) Tests...", "INFO");

  const timestamp = Date.now();
  const testBranch = `TestBranch_${timestamp}`;
  const testYear = "2026-2027";
  
  // 1. Setup Test User
  const email = `core_test_${timestamp}@example.com`;
  const { data: auth, error: authErr } = await supabaseAnon.auth.signUp({ email, password: "testpassword" });
  if (authErr) {
     log(`Failed to create test user: ${authErr.message}`, "FAIL");
     return;
  }
  
  const client = createClient(supabaseUrl, supabaseKey);
  // Re-authenticate explicitly or just sign in
  await client.auth.signInWithPassword({ email, password: "testpassword" });
  
  const { error: profErr } = await client.from('profiles').insert({
     id: auth.user.id,
     name: "Core Tester",
     email: email,
     role: "teacher",
     branch: testBranch
  });
  
  if (profErr) {
     log(`Setup Profile failed: ${profErr.message}`, "FAIL");
     return;
  }
  
  log(`Test User created in branch '${testBranch}'`, "PASS");

  // ==========================================
  // 1. TEST CLASSES (CRUD)
  // ==========================================
  log("\n--- Testing Classes CRUD ---");
  const classId = `CLASS-${timestamp}`;
  try {
     // Create
     const { error: cErr } = await client.from('classes').insert({
        id: classId,
        name: "Test Class 101",
        shift: "Morning",
        academic_year: testYear,
        branch: testBranch
     });
     if (cErr) throw cErr;
     log(`Class created successfully`, "PASS");
     
     // Update
     const { error: cUpdErr } = await client.from('classes').update({ name: "Updated Class 101" }).eq('id', classId);
     if (cUpdErr) throw cUpdErr;
     log(`Class updated successfully`, "PASS");
     
     // Read
     const { data: cData, error: cReadErr } = await client.from('classes').select('*').eq('id', classId);
     if (cReadErr) throw cReadErr;
     if (cData && cData.length > 0 && cData[0].name === "Updated Class 101") {
        log(`Class read successfully and matches update`, "PASS");
     } else {
        log(`Class read failed or data mismatch`, "FAIL");
     }
  } catch(e) {
     log(`Class CRUD Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 2. TEST STUDENTS (CRUD)
  // ==========================================
  log("\n--- Testing Students CRUD ---");
  const studentId = `ST-${timestamp}`;
  try {
     // Create
     const { error: sErr } = await client.from('students').insert({
        student_id: studentId,
        name: "Core Test Student",
        gender: "F",
        class: classId,
        shift: "Morning",
        status: "Active",
        academic_year: testYear,
        branch: testBranch
     });
     if (sErr) throw sErr;
     log(`Student created successfully`, "PASS");
     
     // Update
     const { error: sUpdErr } = await client.from('students').update({ status: "Dropped" }).eq('student_id', studentId);
     if (sUpdErr) throw sUpdErr;
     log(`Student updated successfully (Status changed)`, "PASS");
     
  } catch(e) {
     log(`Student CRUD Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 3. TEST SHIFT SWITCHING
  // ==========================================
  log("\n--- Testing Shift Switching ---");
  const altClassId = `CLASS-ALT-${timestamp}`;
  try {
     // Create an alternate class
     await client.from('classes').insert({
        id: altClassId,
        name: "Alternate Class 102",
        shift: "Afternoon",
        academic_year: testYear,
        branch: testBranch
     });
     
     // Switch student shift
     const { error: swErr } = await client.from('students').update({
        is_shift_switching: true,
        alternate_class_id: altClassId
     }).eq('student_id', studentId);
     
     if (swErr) throw swErr;
     
     // Verify
     const { data: swData } = await client.from('students').select('is_shift_switching, alternate_class_id').eq('student_id', studentId).single();
     if (swData && swData.is_shift_switching === true && swData.alternate_class_id === altClassId) {
        log(`Student shift switching updated successfully`, "PASS");
     } else {
        log(`Student shift switching data mismatch`, "FAIL");
     }
     
  } catch(e) {
     log(`Shift Switching Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // CLEANUP (Test Delete operations)
  // ==========================================
  log("\n--- Testing Delete Operations (Cleanup) ---");
  try {
     const { error: sDelErr } = await client.from('students').delete().eq('student_id', studentId);
     if (sDelErr) throw sDelErr;
     log(`Student deleted successfully`, "PASS");
     
     const { error: cDelErr } = await client.from('classes').delete().in('id', [classId, altClassId]);
     if (cDelErr) throw cDelErr;
     log(`Classes deleted successfully`, "PASS");
  } catch(e) {
     log(`Delete Operations Error: ${e.message}`, "FAIL");
  }

  // Write results
  fs.writeFileSync('core_test_results.json', JSON.stringify(results, null, 2));
  console.log("\nDone! Results written to core_test_results.json");
}

runTests();
