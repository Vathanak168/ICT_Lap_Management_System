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
  log("Starting Auth & Security Tests...", "INFO");

  // Generate unique identifiers
  const timestamp = Date.now();
  const nameCollision = `Admin Collision ${timestamp}`;
  
  const userA = { email: `usera_${timestamp}@test.com`, password: "password123", name: nameCollision, branch: "Test Branch 1" };
  const userB = { email: `userb_${timestamp}@test.com`, password: "password123", name: `Admin B ${timestamp}`, branch: "Test Branch 2" };
  const userC = { email: `userc_${timestamp}@test.com`, password: "password123", name: nameCollision, branch: "Test Branch 2" };

  const clientA = createClient(supabaseUrl, supabaseKey);
  const clientB = createClient(supabaseUrl, supabaseKey);
  const clientC = createClient(supabaseUrl, supabaseKey);

  let idA, idB, idC;

  // ==========================================
  // 1. TEST REGISTER & PROFILE INSERT (RLS)
  // ==========================================
  try {
    const { data: authA, error: errA } = await clientA.auth.signUp({ email: userA.email, password: userA.password });
    if (errA) throw errA; idA = authA.user.id;
    
    const { error: profErrA } = await clientA.from('profiles').insert({ id: idA, name: userA.name, email: userA.email, role: 'teacher', branch: userA.branch });
    if (profErrA) throw profErrA;
    log(`User A registered and inserted profile successfully (Branch 1)`, "PASS");

    const { data: authB, error: errB } = await clientB.auth.signUp({ email: userB.email, password: userB.password });
    if (errB) throw errB; idB = authB.user.id;
    await clientB.from('profiles').insert({ id: idB, name: userB.name, email: userB.email, role: 'teacher', branch: userB.branch });

    const { data: authC, error: errC } = await clientC.auth.signUp({ email: userC.email, password: userC.password });
    if (errC) throw errC; idC = authC.user.id;
    await clientC.from('profiles').insert({ id: idC, name: userC.name, email: userC.email, role: 'teacher', branch: userC.branch });
    
    log(`User B and C registered successfully (Branch 2)`, "PASS");
  } catch (e) {
    log(`Registration failed: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 2. TEST PROFILE UPDATE RLS
  // ==========================================
  try {
    // User A tries to update own profile
    const { error: updateOwn } = await clientA.from('profiles').update({ name: userA.name + " updated" }).eq('id', idA);
    if (updateOwn) {
      log(`User A could not update own profile: ${updateOwn.message}`, "FAIL");
    } else {
      log(`User A can update own profile (RLS check passed)`, "PASS");
    }

    // User A tries to update User B's profile
    const { error: updateOther, data: otherData } = await clientA.from('profiles').update({ name: "Hacked!" }).eq('id', idB).select();
    if (updateOther) {
       log(`User A cannot update User B's profile (${updateOther.message})`, "PASS");
    } else {
       // Supabase might return empty data if RLS blocked it silently without throwing an error
       if (otherData && otherData.length === 0) {
         log(`User A update on User B profile was silently blocked by RLS`, "PASS");
       } else {
         log(`User A WAS ABLE to update User B's profile! (RLS FAIL)`, "FAIL");
       }
    }
  } catch(e) {
    log(`Profile update test error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 3. TEST LOGIN NAME COLLISION
  // ==========================================
  try {
    // Attempt to lookup by name "Admin Collision XYZ"
    const { data: matches, error } = await supabaseAnon.from('profiles').select('email, name').ilike('name', nameCollision);
    if (error) throw error;
    
    if (matches && matches.length >= 2) {
      log(`Login collision detected successfully. Found ${matches.length} users with name '${nameCollision}'. System will ask for email.`, "PASS");
    } else {
      log(`Login collision failed. Expected >=2, found ${matches?.length || 0}`, "FAIL");
    }
  } catch(e) {
    log(`Login collision test error: ${e.message}`, "FAIL");
  }

  // ==========================================
  // 4. TEST RLS DATA ISOLATION (BRANCH LEVEL)
  // ==========================================
  const studentId = `ST-${timestamp}`;
  try {
    // User A creates a student in Branch 1
    const { error: insErr } = await clientA.from('students').insert({
      student_id: studentId,
      name: "Secret Student",
      gender: "M", class: "T1", shift: "Morning", academic_year: "2026-2027",
      status: "Active", branch: userA.branch
    });
    
    if (insErr) {
      log(`User A could not insert student: ${insErr.message}`, "FAIL");
    } else {
      // User B tries to read it
      const { data: readB, error: readBErr } = await clientB.from('students').select('*').eq('student_id', studentId);
      
      if (readBErr) {
         log(`Error reading student: ${readBErr.message}`, "FAIL");
      } else if (readB && readB.length > 0) {
         log(`RLS Data Isolation FAILED! User B CAN see User A's student! (Did you deploy the SQL?)`, "FAIL");
      } else {
         log(`RLS Data Isolation PASSED! User B cannot see User A's student across branches.`, "PASS");
      }
    }
  } catch(e) {
     log(`RLS Isolation test error: ${e.message}`, "FAIL");
  }

  // Cleanup
  await clientA.from('students').delete().eq('student_id', studentId);

  // Write results to a JSON file for the AI to parse and report
  fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
  console.log("\nDone! Results written to test_results.json");
}

runTests();
