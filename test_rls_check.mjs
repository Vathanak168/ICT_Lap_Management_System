import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  // Sign in as any user to get authenticated access
  const email = `check_${Date.now()}@example.com`;
  await supabase.auth.signUp({ email, password: "testpassword123" });

  // Query pg_policies to see what RLS policies exist on students table
  const { data, error } = await supabase.rpc('get_policies_info').select('*');

  if (error) {
    console.log("Cannot call RPC (expected). Trying alternative...");
    
    // Try querying students table directly to test RLS
    // First, check if students table has branch column
    const { data: cols, error: colErr } = await supabase
      .from('students')
      .select('*')
      .limit(1);
    
    if (colErr) {
      console.log("Error querying students:", colErr.message);
    } else {
      console.log("Students columns:", cols && cols.length > 0 ? Object.keys(cols[0]) : "No data");
    }
  } else {
    console.log("Policies:", JSON.stringify(data, null, 2));
  }

  // The real test: does branch filtering work?
  // Create two users in different branches and test isolation
  const supabaseA = createClient(supabaseUrl, supabaseKey);
  const emailA = `policyA_${Date.now()}@example.com`;
  const { data: authA } = await supabaseA.auth.signUp({ email: emailA, password: "testpassword123" });
  
  // Insert profile for User A with Branch 1
  const { error: profileErr } = await supabaseA.from('profiles').insert({
    id: authA.user.id,
    name: "Policy Test A",
    email: emailA,
    role: "teacher",
    branch: "PolicyTestBranch1"
  });
  console.log("Profile A insert:", profileErr ? "ERROR: " + profileErr.message : "OK");

  // Insert a student as User A
  const testId = "POLICY-TEST-" + Date.now();
  const { error: studentErr } = await supabaseA.from('students').insert({
    student_id: testId,
    name: "Policy Test Student",
    gender: "M",
    class: "TestClass",
    shift: "Morning",
    academic_year: "2026-2027",
    status: "Active",
    branch: "PolicyTestBranch1"
  });
  console.log("Student insert (Branch 1):", studentErr ? "ERROR: " + studentErr.message : "OK");

  // Try inserting a student with WRONG branch (should fail if RLS works)
  const { error: wrongBranchErr } = await supabaseA.from('students').insert({
    student_id: testId + "-wrong",
    name: "Wrong Branch Student",
    gender: "F",
    class: "TestClass",
    shift: "Morning",
    academic_year: "2026-2027",
    status: "Active",
    branch: "PolicyTestBranch2"  // Different from user's branch!
  });
  
  if (wrongBranchErr) {
    console.log("✅ RLS WORKING: Cannot insert student with different branch. Error:", wrongBranchErr.message);
  } else {
    console.log("❌ RLS NOT WORKING: User A was able to insert a student in a different branch!");
    // Cleanup the wrong insert
    await supabaseA.from('students').delete().eq('student_id', testId + "-wrong");
  }

  // Now create User B in Branch 2
  const supabaseB = createClient(supabaseUrl, supabaseKey);
  const emailB = `policyB_${Date.now()}@example.com`;
  const { data: authB } = await supabaseB.auth.signUp({ email: emailB, password: "testpassword123" });
  
  await supabaseB.from('profiles').insert({
    id: authB.user.id,
    name: "Policy Test B",
    email: emailB,
    role: "teacher",
    branch: "PolicyTestBranch2"
  });

  // User B tries to read User A's student
  const { data: readResult } = await supabaseB.from('students').select('*').eq('student_id', testId);
  
  if (readResult && readResult.length > 0) {
    console.log("❌ RLS NOT WORKING: User B can read User A's student!");
  } else {
    console.log("✅ RLS WORKING: User B cannot read User A's student!");
  }

  // Count ALL students visible to each user
  const { data: allA } = await supabaseA.from('students').select('id', { count: 'exact' });
  const { data: allB } = await supabaseB.from('students').select('id', { count: 'exact' });
  console.log(`\nUser A sees ${allA?.length || 0} students`);
  console.log(`User B sees ${allB?.length || 0} students`);

  // Cleanup
  await supabaseA.from('students').delete().eq('student_id', testId);
  
  process.exit(0);
}

checkPolicies();
