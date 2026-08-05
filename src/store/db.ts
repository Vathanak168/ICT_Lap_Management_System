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
  status: string;
  password?: string;
  pcNumber?: string;
  isShiftSwitching?: boolean;
  alternateClassId?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  classId?: string;
  class?: string;
  shift?: string;
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
}

export interface SeatingPlan {
  id: string;
  classId: string;
  shift: string;
  gridLayout: string[][]; // Array of rows, each containing student IDs or null
  createdAt: string;
}

export interface LessonLog {
  id: string;
  date: string;
  classId?: string;
  shift?: string;
  topic: string;
  teacherName?: string;
  class?: string;
  exercises?: string;
  notes?: string;
}

export interface GradeRecord {
  id: string;
  month: string; // e.g., '2023-10'
  classId: string;
  shift: string;
  type: 'Monthly' | 'Midterm' | 'Final';
  scores: Record<string, Record<string, number>>; // studentId -> subject -> score
}

class SupabaseDBAdapter {
  private getTableName(storeName: string) {
    return tableMap[storeName] || storeName;
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

  async getAllFromIndex(storeName: string, indexName: string, key: string) {
    const table = this.getTableName(storeName);
    // map common index names to supabase column names
    const dbIndexName = indexName === 'class' ? 'class_id' : indexName;
    const { data, error } = await supabase.from(table).select('*').eq(dbIndexName, key);
    if (error) {
      console.error(`Error fetching index ${indexName} from ${table}:`, error);
      return [];
    }
    return data.map(this.mapToCamelCase.bind(this, storeName));
  }

  async getAll(storeName: string) {
    const table = this.getTableName(storeName);
    const { data, error } = await supabase.from(table).select('*');
    
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      return [];
    }
    
    // Map snake_case back to camelCase for the frontend
    return data.map(this.mapToCamelCase.bind(this, storeName));
  }

  async get(storeName: string, id: string) {
    const table = this.getTableName(storeName);
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    
    if (error || !data) {
      return null;
    }
    
    return this.mapToCamelCase(storeName, data);
  }

  async put(storeName: string, value: any) {
    const table = this.getTableName(storeName);
    const mappedValue = this.mapToSnakeCase(storeName, value);
    
    const { error } = await supabase
      .from(table)
      .upsert(mappedValue)
      .select();
      
    if (error) {
      console.error(`Error putting ${table}:`, error);
      throw error;
    }
  }

  async add(storeName: string, value: any) {
    return this.put(storeName, value);
  }

  async delete(storeName: string, id: string) {
    const table = this.getTableName(storeName);
    const { error } = await supabase.from(table).delete().eq('id', id);
    
    if (error) {
      console.error(`Error deleting ${table}:`, error);
      throw error;
    }
  }

  async clear(storeName: string) {
    // Dangerous, but keeping for compatibility if used
    const table = this.getTableName(storeName);
    const { error } = await supabase.from(table).delete().neq('id', '0'); // deletes all
    if (error) console.error(`Error clearing ${table}:`, error);
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
          status: data.status,
          password: data.password,
          pcNumber: data.pc_number,
          isShiftSwitching: data.is_shift_switching,
          alternateClassId: data.alternate_class_id
        };
      case 'attendance':
        return {
          id: data.id,
          date: data.date,
          classId: data.class_id,
          shift: data.shift,
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
          dateFound: data.date_found,
          dateResolved: data.date_resolved,
          resolution: data.resolution,
          notes: data.notes,
          currentIssue: data.current_issue
        };
      case 'seatingPlans':
        return {
          id: data.id,
          classId: data.class_id,
          shift: data.shift,
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
          type: data.type,
          scores: data.scores_json
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
          status: value.status,
          password: value.password,
          pc_number: value.pcNumber,
          is_shift_switching: value.isShiftSwitching || false,
          alternate_class_id: value.alternateClassId || null
        };
      case 'attendance':
        return {
          id: value.id,
          date: value.date,
          class_id: value.classId,
          shift: value.shift,
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
          reported_date: value.reportedDate,
          resolved_date: value.resolvedDate,
          date_found: value.dateFound,
          date_resolved: value.dateResolved,
          resolution: value.resolution,
          notes: value.notes,
          current_issue: value.currentIssue
        };
      case 'seatingPlans':
        return {
          id: value.id,
          class_id: value.classId,
          shift: value.shift,
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
          type: value.type,
          scores_json: value.scores
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
