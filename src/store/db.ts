import { supabase } from '../lib/supabase';

// Map IndexedDB store names to Supabase table names
const tableMap: Record<string, string> = {
  'classes': 'classes',
  'students': 'students',
  'attendance': 'attendance',
  'pcIssues': 'pc_issues',
  'seatingPlans': 'seating_plans',
  'lessonLogs': 'lesson_logs',
  'grades': 'grades',
  'lessonPlans': 'lesson_plans',
  'settings': 'settings',
};

export interface ClassRecord {
  id: string; // e.g. "12A_Morning"
  name: string; // e.g. "12A"
  shift: 'Morning' | 'Afternoon' | 'Evening';
  academicYear: string;
  notes?: string;
  linkedClassIds?: string[];
}

export interface Student {
  id: string; // Auto-generated UUID or custom
  studentId: string; // អត្តលេខសិស្ស
  name: string;
  englishName?: string;
  gender: 'M' | 'F';
  class: string;
  shift: string;
  academicYear: string;
  status: string;
  password?: string;
  pcNumber?: string;
  isShiftSwitching?: boolean;
  alternateClassId?: string;
  pointsBalance?: number;
  pointsNote?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  classId?: string;
  class?: string;
  shift?: string;
  academicYear: string;
  records: Record<string, 'P' | 'A' | 'L' | 'E'>; // studentId -> status
}

export interface PCIssue {
  id: string;
  pcNumber: string;
  seatNumber?: string;
  description?: string;
  status: string;
  reportedBy?: string;
  reportedDate?: string; // ISO string
  resolvedDate?: string; // ISO string
  dateFound?: string;
  dateResolved?: string;
  resolution?: string;
  notes?: string;
  currentIssue?: string;
  academicYear: string;
}

export interface SeatingPlan {
  id: string;
  classId: string;
  shift: string;
  academicYear: string;
  gridLayout: string[][]; // Array of rows, each containing student IDs or null
  createdAt: string;
}

export interface LessonLog {
  id: string;
  date: string;
  classId?: string;
  shift?: string;
  academicYear: string;
  topic: string;
  teacherName?: string;
  class?: string;
  exercises?: string;
  notes?: string;
}

export interface LessonPlanTrack {
  id: string;
  classId: string;
  month: string;
  week: string;
  lessonTitle: string;
  topics: string;
  exercises: string;
  status: 'Planned' | 'Completed';
  academicYear: string;
  completedDate?: string | null;
}

export interface GradeRecord {
  id: string;
  month: string; // e.g., '2023-10'
  classId: string;
  shift: string;
  academicYear: string;
  type: 'Monthly' | 'Midterm' | 'Final';
  scores: Record<string, Record<string, number>>; // studentId -> subject -> score
}

export interface SettingRecord {
  id: string; // e.g. 'gradeConfig'
  config: any;
}

class SupabaseDBAdapter {
  private getTableName(storeName: string) {
    const table = tableMap[storeName];
    if (!table) throw new Error(`Unknown store: ${storeName}`);
    return table;
  }

  // Convert CamelCase DB keys to Snake_Case Supabase keys (basic)
  // For now we will store the raw objects by manually mapping or storing as JSON in Supabase.
  // Since we created the tables with specific columns, let's map them.

  // map common index names to supabase column names
  objectStoreNames = Object.assign(Object.keys(tableMap), {
    contains: (name: string) => Object.keys(tableMap).includes(name)
  });

  transaction(storeNames: string | string[], _mode?: string) {
    const primaryStore = Array.isArray(storeNames) ? storeNames[0] : storeNames;
    const storeObj = (storeName: string) => {
      return {
        get: async (id: string) => this.get(storeName, id),
        put: async (val: any) => this.put(storeName, val),
        add: async (val: any) => this.add(storeName, val),
        delete: async (id: string) => this.delete(storeName, id),
        clear: async () => this.clear(storeName)
      };
    };
    return {
      objectStore: storeObj,
      store: storeObj(primaryStore),
      done: Promise.resolve()
    };
  }

  async getAllFromIndex<T = any>(storeName: string, indexName: string, key: string, academicYear?: string): Promise<T[]> {
    const table = this.getTableName(storeName);
    
    let dbIndexName = indexName;
    if (indexName === 'by-class') {
      dbIndexName = 'class';
    } else if (indexName === 'class' && storeName !== 'students') {
      dbIndexName = 'class_id';
    }
    
    let query = supabase.from(table).select('*').eq(dbIndexName, key);
    if (academicYear && storeName !== 'profiles') {
      query = query.eq('academic_year', academicYear);
    }
    
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch index ${indexName} from ${table}: ${error.message}`);
    }
    return data.map((d: any) => this.mapToCamelCase(storeName, d) as unknown as T);
  }

  async getAll<T = any>(storeName: string, academicYear?: string): Promise<T[]> {
    const table = this.getTableName(storeName);
    
    let query = supabase.from(table).select('*');
    if (academicYear && storeName !== 'profiles') {
      query = query.eq('academic_year', academicYear);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }
    
    // Map snake_case back to camelCase for the frontend
    return data.map((d: any) => this.mapToCamelCase(storeName, d) as unknown as T);
  }

  async get<T = any>(storeName: string, id: string): Promise<T | null> {
    const table = this.getTableName(storeName);
    const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch ${table}/${id}: ${error.message}`);
    }
    
    return data ? (this.mapToCamelCase(storeName, data) as unknown as T) : null;
  }

  async put(storeName: string, value: any) {
    const table = this.getTableName(storeName);
    const mappedValue = this.mapToSnakeCase(storeName, value);
    
    const { error } = await supabase
      .from(table)
      .upsert(mappedValue);
      
    if (error) throw new Error(`Failed to put ${table}: ${error.message}`);
  }

  async putMany(storeName: string, values: any[]) {
    if (values.length === 0) return;
    const table = this.getTableName(storeName);
    const mappedValues = values.map(v => this.mapToSnakeCase(storeName, v));
    
    const { error } = await supabase
      .from(table)
      .upsert(mappedValues);
      
    if (error) throw new Error(`Failed to putMany ${table}: ${error.message}`);
  }

  async update(storeName: string, id: string, updates: any) {
    const table = this.getTableName(storeName);
    
    // Fetch existing record first to prevent overwriting missing fields with defaults in mapToSnakeCase
    const existing = await this.get(storeName, id);
    if (!existing) throw new Error(`Record ${id} not found in ${storeName}`);
    
    const merged = { ...existing, ...updates };
    const mappedUpdates = this.mapToSnakeCase(storeName, merged);
    
    delete mappedUpdates.id; // Prevent updating primary key
    
    const { error } = await supabase
      .from(table)
      .update(mappedUpdates)
      .eq('id', id);
      
    if (error) throw new Error(`Failed to update ${table}/${id}: ${error.message}`);
  }

  async add(storeName: string, value: any) {
    const table = this.getTableName(storeName);
    const mappedValue = this.mapToSnakeCase(storeName, value);
    
    const { error } = await supabase
      .from(table)
      .insert(mappedValue);
      
    if (error) throw new Error(`Failed to insert ${table}: ${error.message}`);
  }

  async delete(storeName: string, id: string) {
    const table = this.getTableName(storeName);
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(`Failed to delete ${table}/${id}: ${error.message}`);
  }

  async deleteMany(storeName: string, ids: string[]) {
    if (ids.length === 0) return;
    const table = this.getTableName(storeName);
    const { error } = await supabase.from(table).delete().in('id', ids);
    if (error) throw new Error(`Failed to deleteMany ${table}: ${error.message}`);
  }

  async clear(storeName: string) {
    throw new Error('clear() is disabled for safety. Use specific deletion methods.');
  }

  // Helper to map DB records
  private mapToCamelCase(storeName: string, data: any) {
    switch (storeName) {
      case 'classes':
        return {
          id: data.id,
          name: data.name,
          shift: data.shift,
          academicYear: data.academic_year,
          notes: data.notes,
          linkedClassIds: data.linked_class_ids
        };
      case 'students':
        return {
          id: data.id,
          studentId: data.student_id,
          name: data.name,
          englishName: data.english_name,
          gender: data.gender,
          class: data.class,
          shift: data.shift,
          academicYear: data.academic_year,
          status: data.status,
          password: data.password,
          pcNumber: data.pc_number,
          isShiftSwitching: data.is_shift_switching,
          alternateClassId: data.alternate_class_id,
          pointsBalance: data.points_balance,
          pointsNote: data.points_note
        };
      case 'attendance':
        return {
          id: data.id,
          date: data.date,
          classId: data.class_id,
          shift: data.shift,
          academicYear: data.academic_year,
          records: data.records_json
        };
      case 'pcIssues':
        return {
          id: data.id,
          pcNumber: data.pc_number,
          seatNumber: data.seat_number,
          description: data.description,
          status: data.status,
          reportedBy: data.reported_by,
          reportedDate: data.reported_date,
          resolvedDate: data.resolved_date,
          dateFound: data.reported_date,
          dateResolved: data.resolved_date,
          resolution: data.resolution,
          notes: data.notes,
          academicYear: data.academic_year
        };
      case 'seatingPlans':
        return {
          id: data.id,
          classId: data.class_id,
          shift: data.shift,
          academicYear: data.academic_year,
          gridLayout: data.grid_layout_json,
          createdAt: data.created_at
        };
      case 'lessonLogs':
        return {
          id: data.id,
          date: data.date,
          classId: data.class_id,
          class: data.class,
          shift: data.shift,
          academicYear: data.academic_year,
          topic: data.topic,
          teacherName: data.teacher_name,
          exercises: data.exercises,
          notes: data.notes
        };
      case 'grades':
        return {
          id: data.id,
          month: data.month,
          classId: data.class_id,
          shift: data.shift,
          academicYear: data.academic_year,
          type: data.type,
          scores: data.scores_json
        };
      case 'lessonPlans':
        return {
          id: data.id,
          classId: data.class_id,
          month: data.month,
          week: data.week,
          lessonTitle: data.lesson_title,
          topics: data.topics,
          exercises: data.exercises,
          status: data.status,
          academicYear: data.academic_year,
          completedDate: data.completed_date
        };
      case 'settings':
        return {
          id: data.id,
          config: data.config_json
        };
      default:
        return data;
    }
  }

  private mapToSnakeCase(storeName: string, value: any) {
    switch (storeName) {
      case 'classes':
        return {
          id: value.id,
          name: value.name,
          shift: value.shift,
          academic_year: value.academicYear,
          notes: value.notes,
          linked_class_ids: value.linkedClassIds
        };
      case 'students':
        return {
          id: value.id,
          student_id: value.studentId,
          name: value.name,
          english_name: value.englishName,
          gender: value.gender,
          class: value.class,
          shift: value.shift,
          academic_year: value.academicYear,
          status: value.status,
          password: value.password === undefined ? null : value.password,
          pc_number: value.pcNumber === undefined ? null : value.pcNumber,
          is_shift_switching: value.isShiftSwitching || false,
          alternate_class_id: value.alternateClassId || null,
          points_balance: value.pointsBalance === undefined ? null : value.pointsBalance,
          points_note: value.pointsNote === undefined ? null : value.pointsNote
        };
      case 'attendance':
        return {
          id: value.id,
          date: value.date,
          class_id: value.classId,
          shift: value.shift,
          academic_year: value.academicYear,
          records_json: value.records
        };
      case 'pcIssues':
        return {
          id: value.id,
          pc_number: value.pcNumber,
          seat_number: value.seatNumber,
          description: value.description,
          status: value.status,
          reported_by: value.reportedBy,
          reported_date: value.reportedDate || value.dateFound,
          resolved_date: value.resolvedDate || value.dateResolved,
          resolution: value.resolution,
          notes: value.notes,
          ...(value.academicYear ? { academic_year: value.academicYear } : {})
        };
      case 'seatingPlans':
        return {
          id: value.id,
          class_id: value.classId,
          shift: value.shift,
          academic_year: value.academicYear,
          grid_layout_json: value.gridLayout,
          // Handle optional createdAt which might be set by DB
          ...(value.createdAt ? { created_at: value.createdAt } : {})
        };
      case 'lessonLogs':
        return {
          id: value.id,
          date: value.date,
          class_id: value.classId || value.class,
          class: value.class,
          shift: value.shift,
          academic_year: value.academicYear,
          topic: value.topic,
          teacher_name: value.teacherName,
          exercises: value.exercises,
          notes: value.notes
        };
      case 'grades':
        return {
          id: value.id,
          month: value.month,
          class_id: value.classId,
          shift: value.shift,
          academic_year: value.academicYear,
          type: value.type,
          scores_json: value.scores
        };
      case 'lessonPlans':
        return {
          id: value.id,
          class_id: value.classId,
          month: value.month,
          week: value.week,
          lesson_title: value.lessonTitle,
          topics: value.topics,
          exercises: value.exercises,
          status: value.status,
          academic_year: value.academicYear,
          completed_date: value.completedDate ?? null
        };
      case 'settings':
        return {
          id: value.id,
          config_json: value.config
        };
      default:
        return value;
    }
  }
}

// Singleton instance
const dbInstance = new SupabaseDBAdapter();

export async function initDB() {
  return dbInstance;
}
