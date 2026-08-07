# របាយការណ៍កំហុសសម្រាប់ ChatGPT (Error Report)

បន្ទាប់ពីបានធ្វើតេស្តសាកល្បងទៅលើ Code និង Database ផ្ទាល់ នេះគឺជាបញ្ជីកំហុសពិតប្រាកដដែលអ្នកត្រូវយកទៅឱ្យ ChatGPT ជួយជួសជុល៖

## 1. កំហុស TypeScript (Type Error) នៅក្នុង `SeatingPlan.tsx`
*   **ទីតាំងកូដ:** `src/pages/SeatingPlan.tsx` ត្រង់បន្ទាត់ទី 142
*   **Error Message:** `TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.`
*   **មូលហេតុ:** Function `loadData` ត្រូវការ `activeYear` ជាប្រភេទ `string` ប៉ុន្តែ `activeYear` ដែលបានមកពី Context អាចមានតម្លៃ `null` ពេលបើកកម្មវិធីដំបូង។
*   **ដំណោះស្រាយសម្រាប់ ChatGPT:** ត្រូវដាក់លក្ខខណ្ឌ `if (activeYear)` មុននឹងហៅ `loadData(activeYear, selectedClass);`។

## 2. កំហុស Logic ក្នុងការបង្កើតលេខសម្ងាត់សិស្ស (Password Generation Bug)
*   **ទីតាំងកូដ:** `src/pages/SeatingPlan.tsx` ត្រង់ `generatePasswordForStudent`
*   **មូលហេតុ:** កូដ `const existingPasswords = new Set(students.map(s => s.password)...)` ព្យាយាមទាញយកលេខសម្ងាត់ចាស់ដើម្បីការពារកុំឱ្យជាន់គ្នា។ **ប៉ុន្តែ**, នៅក្នុង `src/store/db.ts` Field `password` ត្រូវបានកំណត់ `omitFromSelect: true`។ មានន័យថា `students` state នឹងមិនមានផ្ទុកទិន្នន័យ `password` ទេ ធ្វើឱ្យ `existingPasswords` ទទេជានិច្ច ហើយអាចបង្កើតលេខសម្ងាត់ជាន់គ្នាច្រើនដង។
*   **ដំណោះស្រាយសម្រាប់ ChatGPT:** សួរ ChatGPT ពីរបៀបឆែកលេខសម្ងាត់ជាន់គ្នាឱ្យបានត្រឹមត្រូវ ដោយមិនបាច់ទាញយកលេខសម្ងាត់ទាំងអស់មកកាន់ Client (អាចឱ្យ ChatGPT សរសេរ RPC Function នៅក្នុង Supabase ឬរកវិធីផ្សេង)។

## 3. ឯកសារ `supabase_schema.sql` មិន Update តាម Database ពិតប្រាកដ
*   **មូលហេតុ:** ខ្ញុំបានតេស្តតភ្ជាប់ទៅកាន់ Database ពិតប្រាកដរបស់ Supabase (តាមរយៈ `.env`) ឃើញថា Table `students` ពិតជាមាន Columns (`password`, `pc_number`, `points_balance` ជាដើម)។ ប៉ុន្តែឯកសារ `supabase_schema.sql` ដែលមាននៅក្នុង Project មិនមាន Columns ទាំងនេះទេ។
*   **ដំណោះស្រាយសម្រាប់ ChatGPT:** ឱ្យ ChatGPT ជួយ Update ឯកសារ `supabase_schema.sql` ឱ្យស្របតាម Database ពិតប្រាកដវិញ ដើម្បីស្រួលពេល Developer ថ្មីចង់ Setup Project។

## 4. ឯកសារ Backup ចាស់ៗបង្កជា Error និង Unused Variables
*   **បញ្ហាទី ១:** ឯកសារ `SeatingPlan.bak.tsx` និង `SeatingPlan_old.tsx` មានផ្ទុកកំហុស Typescript `TS2741: Property 'academicYear' is missing...`។ ឯកសារទាំងនេះមិនប្រើប្រាស់ទេ គួរតែត្រូវលុបចោល។
*   **បញ្ហាទី ២:** មានអថេរ (Variables) មួយចំនួនត្រូវបានប្រកាស តែមិនប្រើប្រាស់ (Unused variables `TS6133`) នៅក្នុងឯកសារដូចជា `Topbar.tsx`, `Gradebook.tsx`, `MiniApps.tsx`, `PCIssues.tsx`, និង `Profile.tsx`។
*   **ដំណោះស្រាយសម្រាប់ ChatGPT:** ប្រាប់វាឱ្យជួយលុបឯកសារចាស់ៗ និងជម្រះអថេរដែលមិនប្រើចោល។
