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
  log("Starting Operations (Point 3) Tests...", "INFO");

  const timestamp = Date.now();
  const testBranch = `OpBranch_${timestamp}`;
  const testYear = "2026-2027";
  
  // Setup Test User
  const email = `op_test_${timestamp}@example.com`;
  const { data: auth, error: authErr } = await supabaseAnon.auth.signUp({ email, password: "testpassword" });
  if (authErr) {
     log(`Failed to create test user: ${authErr.message}`, "FAIL");
     return;
  }
  
  const client = createClient(supabaseUrl, supabaseKey);
  await client.auth.signInWithPassword({ email, password: "testpassword" });
  
  await client.from('profiles').insert({
     id: auth.user.id,
     name: "Ops Tester",
     email: email,
     role: "teacher",
     branch: testBranch
  });
  
  // Create dependencies (Class and Student)
  const classId = `CLASS-OP-${timestamp}`;
  const studentId = `ST-OP-${timestamp}`;
  
  await client.from('classes').insert({ id: classId, name: "Ops Class", shift: "Morning", academic_year: testYear, branch: testBranch });
  await client.from('students').insert({ student_id: studentId, name: "Ops Student", gender: "M", class: classId, shift: "Morning", status: "Active", academic_year: testYear, branch: testBranch });

  // ==========================================
  // 1. TEST SEATING PLANS (CRUD)
  // ==========================================
  log("\n--- Testing Seating Plans ---");
  const pcNumber = "PC-01";
  try {
     const { error: insErr } = await client.from('seating_plans').insert({
        class_id: classId,
        shift: "Morning",
        grid_layout_json: {},
        academic_year: testYear,
        branch: testBranch
     });
     if (insErr) throw insErr;
     log(`Seating plan assigned successfully`, "PASS");
     
     const { data: readData } = await client.from('seating_plans').select('*').eq('class_id', classId);
     if (readData && readData.length > 0) log(`Seating plan read successfully`, "PASS");
     else throw new Error("Could not read seating plan");
  } catch(e) {
     log(`Seating Plan Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 2. TEST ATTENDANCE (CRUD)
  // ==========================================
  log("\n--- Testing Attendance ---");
  const attDate = new Date().toISOString().split('T')[0];
  try {
     const { error: attErr } = await client.from('attendance').insert({
        id: crypto.randomUUID(),
        date: attDate,
        class_id: classId,
        shift: "Morning",
        academic_year: testYear,
        branch: testBranch,
        records_json: { [studentId]: "Present" }
     });
     if (attErr) throw attErr;
     log(`Attendance marked successfully`, "PASS");
  } catch(e) {
     log(`Attendance Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 3. TEST GRADEBOOK (CRUD)
  // ==========================================
  log("\n--- Testing Gradebook ---");
  try {
     const { error: grErr } = await client.from('grades').insert({
        id: crypto.randomUUID(),
        month: "January",
        class_id: classId,
        shift: "Morning",
        type: "Monthly",
        academic_year: testYear,
        branch: testBranch,
        scores_json: { [studentId]: { total: 100 } }
     });
     if (grErr) throw grErr;
     log(`Grades inserted successfully`, "PASS");
  } catch(e) {
     log(`Gradebook Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 4. TEST LESSON LOG (CRUD)
  // ==========================================
  log("\n--- Testing Lesson Log ---");
  try {
     const { error: llErr } = await client.from('lesson_logs').insert({
        date: attDate,
        class_id: classId,
        shift: "Morning",
        topic: "Word Intro",
        teacher_name: "Ops Tester",
        academic_year: testYear,
        branch: testBranch
     });
     if (llErr) throw llErr;
     log(`Lesson log created successfully`, "PASS");
  } catch(e) {
     log(`Lesson Log Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 5. TEST PC ISSUES (CRUD)
  // ==========================================
  log("\n--- Testing PC Issues ---");
  try {
     const { error: pcErr } = await client.from('pc_issues').insert({
        pc_number: pcNumber,
        description: "Mouse not working",
        reported_by: "Ops Tester",
        reported_date: attDate,
        status: "Pending",
        academic_year: testYear,
        branch: testBranch
     });
     if (pcErr) throw pcErr;
     log(`PC Issue reported successfully`, "PASS");
  } catch(e) {
     log(`PC Issues Error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // CLEANUP
  // ==========================================
  log("\n--- Cleanup ---");
  await client.from('pc_issues').delete().eq('pc_number', pcNumber);
  await client.from('lesson_logs').delete().eq('class_id', classId);
  await client.from('grades').delete().eq('class_id', classId);
  await client.from('attendance').delete().eq('class_id', classId);
  await client.from('seating_plans').delete().eq('class_id', classId);
  await client.from('students').delete().eq('student_id', studentId);
  await client.from('classes').delete().eq('id', classId);
  log(`Cleanup finished`, "INFO");

  fs.writeFileSync('ops_test_results.json', JSON.stringify(results, null, 2));
  console.log("\nDone! Results written to ops_test_results.json");
}

runTests();
