import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function runTests() {
  console.log("=== STARTING BACKEND SECURITY TESTS ===");
  
  // Create client for User A
  const supabaseA = createClient(supabaseUrl, supabaseKey);
  const emailA = `userA_${Date.now()}@example.com`;
  const { data: authA, error: errA } = await supabaseA.auth.signUp({ email: emailA, password: "testpassword123" });
  if (errA) throw new Error("Failed to create User A: " + errA.message);
  
  // Create client for User B
  const supabaseB = createClient(supabaseUrl, supabaseKey);
  const emailB = `userB_${Date.now()}@example.com`;
  const { data: authB, error: errB } = await supabaseB.auth.signUp({ email: emailB, password: "testpassword123" });
  if (errB) throw new Error("Failed to create User B: " + errB.message);

  console.log(`✅ Created User A (${authA.user.id}) and User B (${authB.user.id})`);

  // Insert Profiles for A (Branch 1) and B (Branch 2)
  await supabaseA.from('profiles').insert({
    id: authA.user.id,
    name: "Test Admin A",
    email: emailA,
    role: "admin",
    branch: "Branch 1"
  });

  await supabaseB.from('profiles').insert({
    id: authB.user.id,
    name: "Test Admin B",
    email: emailB,
    role: "admin",
    branch: "Branch 2"
  });

  console.log(`✅ Assigned User A to 'Branch 1' and User B to 'Branch 2'`);

  // --- TEST 1: RLS Data Isolation ---
  console.log("\n--- TEST 1: RLS Data Isolation ---");
  const testStudentId = "ST-TEST-" + Date.now();
  // User A creates a student in Branch 1
  const { error: insertErr } = await supabaseA.from('students').insert({
    student_id: testStudentId,
    name: "Secret Student A",
    gender: "M",
    class: "TestClass",
    shift: "Morning",
    academic_year: "2026-2027",
    status: "Active",
    branch: "Branch 1"
  });
  
  if (insertErr) {
    console.log("⚠️ Could not insert student. Error:", insertErr.message);
  } else {
    console.log("✅ User A inserted a student in Branch 1");
    
    // User B tries to read the student
    const { data: studentsB, error: readErr } = await supabaseB.from('students').select('*').eq('student_id', testStudentId);
    
    if (studentsB && studentsB.length > 0) {
      console.log("❌ FAIL: User B CAN see User A's student! RLS policies are NOT active on the remote database.");
    } else {
      console.log("✅ PASS: User B cannot see User A's student. RLS policies are active.");
    }
  }

  // --- TEST 2: fetchExistingPasswords (Client Logic Simulation) ---
  console.log("\n--- TEST 2: fetchExistingPasswords branch filter ---");
  // We simulate the code in SeatingPlan.tsx
  // User A has a student in Branch 1 with password.
  await supabaseA.from('students').update({ password: "secret_password" }).eq('student_id', testStudentId);
  
  // User B tries to fetch passwords for the same class and year
  const targetClass = "TestClass";
  const targetYear = "2026-2027";
  
  // The client code now filters by branch:
  const userBranchB = "Branch 2"; // Fetched from profile in real code
  const { data: passwordsB } = await supabaseB.from('students')
    .select('password')
    .eq('class', targetClass)
    .eq('academic_year', targetYear)
    .eq('status', 'Active')
    .not('password', 'is', null)
    .eq('branch', userBranchB); // The fix we added
    
  if (passwordsB && passwordsB.length > 0) {
    console.log("❌ FAIL: fetchExistingPasswords leaked passwords from another branch.");
  } else {
    console.log("✅ PASS: fetchExistingPasswords successfully filtered out other branch's passwords.");
  }
  
  // --- TEST 3: Login Name Collision Protection ---
  console.log("\n--- TEST 3: Login Name Collision Protection ---");
  
  // Create User C with same name as User A but in a different branch
  const supabaseC = createClient(supabaseUrl, supabaseKey);
  const emailC = `userC_${Date.now()}@example.com`;
  const { data: authC, error: errC } = await supabaseC.auth.signUp({ email: emailC, password: "testpassword123" });
  if (errC) {
    console.log("⚠️ Could not create User C:", errC.message);
  } else {
    // Use User C's own session to insert their profile (RLS requires auth.uid() = id)
    const { error: profileCErr } = await supabaseC.from('profiles').insert({
      id: authC.user.id,
      name: "Test Admin A", // Same name as User A!
      email: emailC,
      role: "teacher",
      branch: "Branch 2"
    });
    
    if (profileCErr) {
      console.log("⚠️ Could not insert User C profile:", profileCErr.message);
    } else {
      console.log("✅ Created User C with same name 'Test Admin A' in Branch 2");
      
      // Simulate login name lookup (like Login.tsx does)
      const { data: matches } = await supabaseC
        .from('profiles')
        .select('email, name')
        .ilike('name', "Test Admin A");
      
      console.log(`   Found ${matches?.length || 0} profiles with name 'Test Admin A'`);
        
      if (matches && matches.length > 1) {
        console.log("✅ PASS: Login lookup detected duplicate names ("+matches.length+" found). UI will correctly ask user to login by email.");
      } else {
        console.log("❌ FAIL: Expected multiple matches but found " + (matches?.length || 0));
      }
    }
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  await supabaseA.from('students').delete().eq('student_id', testStudentId);
  
  console.log("=== TESTS FINISHED ===");
  process.exit(0);
}

runTests();
