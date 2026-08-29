import fs from 'fs';

const supabaseSchema = {
	"academic_years": [
		"id",
		"created_at",
		"is_active",
		"year"
	],
	"attendance": [
		"branch",
		"academic_year",
		"id",
		"date",
		"class_id",
		"records_json",
		"shift"
	],
	"classes": [
		"id",
		"name",
		"shift",
		"academic_year",
		"notes",
		"branch",
		"linked_class_ids"
	],
	"grades": [
		"id",
		"branch",
		"academic_year",
		"type",
		"shift",
		"class_id",
		"month",
		"scores_json"
	],
	"lesson_logs": [
		"date",
		"shift",
		"topic",
		"id",
		"academic_year",
		"class_id",
		"teacher_name",
		"branch"
	],
	"lesson_plans": [
		"class_id",
		"completed_date",
		"status",
		"branch",
		"exercises",
		"academic_year",
		"topics",
		"lesson_title",
		"week",
		"month",
		"id"
	],
	"mini_apps": [
		"id",
		"created_at",
		"name",
		"url",
		"icon_url",
		"branch"
	],
	"pc_issues": [
		"pc_number",
		"id",
		"description",
		"status",
		"reported_by",
		"reported_date",
		"resolved_date",
		"academic_year",
		"seat_number",
		"resolution",
		"notes",
		"branch"
	],
	"profiles": [
		"created_at",
		"role",
		"profile_image_url",
		"branch",
		"phone_number",
		"email",
		"name",
		"id"
	],
	"seating_plans": [
		"academic_year",
		"shift",
		"created_at",
		"class_id",
		"id",
		"grid_layout_json",
		"branch"
	],
	"students": [
		"academic_year",
		"pc_number",
		"alternate_class_id",
		"status",
		"shift",
		"class",
		"gender",
		"english_name",
		"name",
		"student_id",
		"points_balance",
		"id",
		"is_shift_switching",
		"branch",
		"points_note",
		"password"
	]
};

// Parse db.ts schema to get tables and fields
const dbTs = fs.readFileSync('./src/store/db.ts', 'utf8');
const tableMatches = [...dbTs.matchAll(/(\w+):\s*{\s*table:\s*'([^']+)'/g)];
const dbTsTables = {};

for (const match of tableMatches) {
  const storeName = match[1];
  const tableName = match[2];
  
  const storeBlockRegex = new RegExp(`${storeName}:\\s*{[\\s\\S]*?fields:\\s*{([\\s\\S]*?)},[\\s\\S]*?indexColumns:`, 'm');
  const storeMatch = dbTs.match(storeBlockRegex);
  
  if (storeMatch) {
    const fieldsBlock = storeMatch[1];
    const correctFieldMatches = [...fieldsBlock.matchAll(/field\('([^']+)'/g)];
    dbTsTables[tableName] = correctFieldMatches.map(m => m[1]);
  }
}

for (const [tableName, tsFields] of Object.entries(dbTsTables)) {
  const sbFields = supabaseSchema[tableName];
  if (!sbFields) {
    console.log(`❌ Table '${tableName}' is in db.ts but NOT in Supabase!`);
    continue;
  }
  
  for (const field of tsFields) {
    if (field !== 'branch' && !sbFields.includes(field)) {
      console.log(`⚠️ Table '${tableName}': db.ts has field '${field}', but MISSING in Supabase!`);
    }
  }
  
  for (const field of sbFields) {
    if (field !== 'branch' && !tsFields.includes(field)) {
      console.log(`💡 Table '${tableName}': Supabase has field '${field}', but NOT linked in db.ts!`);
    }
  }
}
