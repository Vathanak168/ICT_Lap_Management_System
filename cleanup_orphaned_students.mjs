import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  // 1. Get all classes
  const { data: classes, error: classError } = await supabase.from('classes').select('name');
  if (classError) throw classError;
  
  const classNames = classes.map(c => c.name);

  // 2. Get all students
  const { data: students, error: studentError } = await supabase.from('students').select('id, class');
  if (studentError) throw studentError;

  // 3. Find students whose class name is not in the classNames array
  const orphanedStudents = students.filter(s => !classNames.includes(s.class));

  console.log(`Found ${orphanedStudents.length} orphaned students.`);

  // 4. Delete them
  if (orphanedStudents.length > 0) {
    const idsToDelete = orphanedStudents.map(s => s.id);
    // Delete in chunks if there are many, but since it's a small app, we can just do one query
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .in('id', idsToDelete);
      
    if (deleteError) {
      console.error('Error deleting orphaned students:', deleteError);
    } else {
      console.log(`Successfully deleted ${orphanedStudents.length} orphaned students.`);
    }
  }
}

cleanup();
