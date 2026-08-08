import { supabase } from '../lib/supabase';

export type Shift = 'Morning' | 'Afternoon' | 'Evening';
export type AttendanceStatus = 'P' | 'A' | 'L' | 'E';
export type GradeType = 'Monthly' | 'Midterm' | 'Final';
export type LessonPlanStatus = 'Planned' | 'Completed';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ClassRecord {
  id: string;
  name: string;
  shift: Shift;
  academicYear: string;
  notes?: string;
  linkedClassIds?: string[];
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  englishName?: string;
  gender: 'M' | 'F';
  class: string;
  shift: string;
  academicYear: string;
  status: string;

  /**
   * @deprecated Kept only for migration compatibility. Do not expose reusable
   * passwords to the browser. This adapter excludes the column from SELECTs.
   */
  password?: string;

  pcNumber?: string;
  isShiftSwitching?: boolean;
  alternateClassId?: string;
  pointsBalance?: number;
  pointsNote?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  classId?: string;

  /** @deprecated Use classId. */
  class?: string;

  shift?: string;
  academicYear: string;
  records: Record<string, AttendanceStatus>;
}

export interface PCIssue {
  id: string;
  pcNumber: string;
  seatNumber?: string;
  description?: string;
  status: string;
  reportedBy?: string;
  reportedDate?: string;
  resolvedDate?: string;

  /** @deprecated Use reportedDate. */
  dateFound?: string;

  /** @deprecated Use resolvedDate. */
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
  gridLayout: Array<Array<string | null>>;
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
  status: LessonPlanStatus;
  academicYear: string;
  completedDate?: string | null;
}

export interface GradeRecord {
  id: string;
  month: string;
  classId: string;
  shift: string;
  academicYear: string;
  type: GradeType;
  scores: Record<string, Record<string, number>>;
}

export interface SettingRecord {
  id: string;
  config: JsonValue;
}

export interface AiHistoryRecord {
  id: string;
  messages: JsonValue;
  title?: string;
  updatedAt?: string;
}

const tableMap = {
  classes: 'classes',
  students: 'students',
  attendance: 'attendance',
  pcIssues: 'pc_issues',
  seatingPlans: 'seating_plans',
  lessonLogs: 'lesson_logs',
  grades: 'grades',
  lessonPlans: 'lesson_plans',
  settings: 'settings',
  aiHistory: 'ai_history',
} as const;

export type StoreName = keyof typeof tableMap;
type TableName = (typeof tableMap)[StoreName];

export interface StoreRecordMap {
  classes: ClassRecord;
  students: Student;
  attendance: AttendanceRecord;
  pcIssues: PCIssue;
  seatingPlans: SeatingPlan;
  lessonLogs: LessonLog;
  grades: GradeRecord;
  lessonPlans: LessonPlanTrack;
  settings: SettingRecord;
  aiHistory: AiHistoryRecord;
}

export type StoreRecord<K extends StoreName> = StoreRecordMap[K];
export type StorePatch<K extends StoreName> = Partial<{
  [P in keyof StoreRecord<K>]: StoreRecord<K>[P] | null;
}>;
type DatabaseRow = Record<string, unknown>;

type FieldKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'stringArray'
  | 'attendanceRecords'
  | 'gridLayout'
  | 'scores'
  | 'json';

interface FieldSchema {
  db: string;
  kind: FieldKind;
  requiredRead?: boolean;
  requiredWrite?: boolean;
  nullable?: boolean;
  allowed?: readonly string[];
  defaultValue?: unknown;
  omitFromSelect?: boolean;
  omitWhenUndefined?: boolean;
}

interface StoreSchema {
  table: TableName;
  branchScoped: boolean;
  academicYear: boolean;
  fields: Record<string, FieldSchema>;
  indexColumns: ReadonlySet<string>;
  selectAll?: boolean;
}

const field = (
  db: string,
  kind: FieldKind,
  options: Omit<FieldSchema, 'db' | 'kind'> = {},
): FieldSchema => ({ db, kind, ...options });

const storeSchemas: Record<StoreName, StoreSchema> = {
  classes: {
    table: 'classes',
    branchScoped: true,
    academicYear: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      name: field('name', 'string', { requiredRead: true, requiredWrite: true }),
      shift: field('shift', 'string', {
        requiredRead: true,
        requiredWrite: true,
        allowed: ['Morning', 'Afternoon', 'Evening'],
      }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
      notes: field('notes', 'string', { nullable: true }),
      linkedClassIds: field('linked_class_ids', 'stringArray', { nullable: true }),
    },
    indexColumns: new Set(['id', 'name', 'shift', 'academic_year']),
  },
  students: {
    table: 'students',
    branchScoped: true,
    academicYear: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      studentId: field('student_id', 'string', { requiredRead: true, requiredWrite: true }),
      name: field('name', 'string', { requiredRead: true, requiredWrite: true }),
      englishName: field('english_name', 'string', { nullable: true }),
      gender: field('gender', 'string', {
        requiredRead: true,
        requiredWrite: true,
        allowed: ['M', 'F'],
      }),
      class: field('class', 'string', { requiredRead: true, requiredWrite: true }),
      shift: field('shift', 'string', { requiredRead: true, requiredWrite: true }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
      status: field('status', 'string', { requiredRead: true, requiredWrite: true }),
      password: field('password', 'string', {
        nullable: true,
        omitFromSelect: true,
        omitWhenUndefined: true,
      }),
      pcNumber: field('pc_number', 'string', { nullable: true }),
      isShiftSwitching: field('is_shift_switching', 'boolean', { defaultValue: false }),
      alternateClassId: field('alternate_class_id', 'string', { nullable: true }),
      pointsBalance: field('points_balance', 'number', { nullable: true }),
      pointsNote: field('points_note', 'string', { nullable: true }),
    },
    indexColumns: new Set([
      'id',
      'student_id',
      'class',
      'shift',
      'academic_year',
      'status',
      'gender',
      'pc_number',
    ]),
  },
  attendance: {
    table: 'attendance',
    branchScoped: true,
    academicYear: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      date: field('date', 'string', { requiredRead: true, requiredWrite: true }),
      classId: field('class_id', 'string', { nullable: true }),
      shift: field('shift', 'string', { nullable: true }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
      records: field('records_json', 'attendanceRecords', {
        requiredRead: true,
        requiredWrite: true,
      }),
    },
    indexColumns: new Set(['id', 'date', 'class_id', 'shift', 'academic_year']),
  },
  pcIssues: {
    table: 'pc_issues',
    branchScoped: true,
    academicYear: true,
    selectAll: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      pcNumber: field('pc_number', 'string', { requiredRead: true, requiredWrite: true }),
      seatNumber: field('seat_number', 'string', { nullable: true }),
      description: field('description', 'string', { nullable: true }),
      status: field('status', 'string', { requiredRead: true, requiredWrite: true }),
      reportedBy: field('reported_by', 'string', { nullable: true }),
      reportedDate: field('reported_date', 'string', { nullable: true }),
      resolvedDate: field('resolved_date', 'string', { nullable: true }),
      resolution: field('resolution', 'string', { nullable: true }),
      notes: field('notes', 'string', { nullable: true }),
      currentIssue: field('current_issue', 'string', {
        nullable: true,
        omitWhenUndefined: true,
      }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
    },
    indexColumns: new Set([
      'id',
      'pc_number',
      'seat_number',
      'status',
      'academic_year',
      'reported_date',
      'resolved_date',
    ]),
  },
  seatingPlans: {
    table: 'seating_plans',
    branchScoped: true,
    academicYear: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      classId: field('class_id', 'string', { requiredRead: true, requiredWrite: true }),
      shift: field('shift', 'string', { requiredRead: true, requiredWrite: true }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
      gridLayout: field('grid_layout_json', 'gridLayout', {
        requiredRead: true,
        requiredWrite: true,
      }),
      createdAt: field('created_at', 'string', {
        requiredRead: true,
        omitWhenUndefined: true,
      }),
    },
    indexColumns: new Set(['id', 'class_id', 'shift', 'academic_year', 'created_at']),
  },
  lessonLogs: {
    table: 'lesson_logs',
    branchScoped: true,
    academicYear: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      date: field('date', 'string', { requiredRead: true, requiredWrite: true }),
      classId: field('class_id', 'string', { nullable: true }),
      class: field('class', 'string', { nullable: true }),
      shift: field('shift', 'string', { nullable: true }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
      topic: field('topic', 'string', { requiredRead: true, requiredWrite: true }),
      teacherName: field('teacher_name', 'string', { nullable: true }),
      exercises: field('exercises', 'string', { nullable: true }),
      notes: field('notes', 'string', { nullable: true }),
    },
    indexColumns: new Set([
      'id',
      'date',
      'class_id',
      'class',
      'shift',
      'academic_year',
      'teacher_name',
      'topic',
    ]),
  },
  grades: {
    table: 'grades',
    branchScoped: true,
    academicYear: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      month: field('month', 'string', { requiredRead: true, requiredWrite: true }),
      classId: field('class_id', 'string', { requiredRead: true, requiredWrite: true }),
      shift: field('shift', 'string', { requiredRead: true, requiredWrite: true }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
      type: field('type', 'string', {
        requiredRead: true,
        requiredWrite: true,
        allowed: ['Monthly', 'Midterm', 'Final'],
      }),
      scores: field('scores_json', 'scores', {
        requiredRead: true,
        requiredWrite: true,
      }),
    },
    indexColumns: new Set(['id', 'month', 'class_id', 'shift', 'academic_year', 'type']),
  },
  lessonPlans: {
    table: 'lesson_plans',
    branchScoped: true,
    academicYear: true,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      classId: field('class_id', 'string', { requiredRead: true, requiredWrite: true }),
      month: field('month', 'string', { requiredRead: true, requiredWrite: true }),
      week: field('week', 'string', { requiredRead: true, requiredWrite: true }),
      lessonTitle: field('lesson_title', 'string', { requiredRead: true, requiredWrite: true }),
      topics: field('topics', 'string', { requiredRead: true, requiredWrite: true }),
      exercises: field('exercises', 'string', { requiredRead: true, requiredWrite: true }),
      status: field('status', 'string', {
        requiredRead: true,
        requiredWrite: true,
        allowed: ['Planned', 'Completed'],
      }),
      academicYear: field('academic_year', 'string', {
        requiredRead: true,
        requiredWrite: true,
      }),
      completedDate: field('completed_date', 'string', { nullable: true }),
    },
    indexColumns: new Set([
      'id',
      'class_id',
      'month',
      'week',
      'status',
      'academic_year',
      'completed_date',
    ]),
  },
  settings: {
    table: 'settings',
    branchScoped: false,
    academicYear: false,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      config: field('config_json', 'json', { requiredRead: true, requiredWrite: true }),
    },
    indexColumns: new Set(['id']),
  },
  aiHistory: {
    table: 'ai_history',
    branchScoped: true,
    academicYear: false,
    fields: {
      id: field('id', 'string', { requiredRead: true, requiredWrite: true }),
      messages: field('messages', 'json', { requiredRead: true, requiredWrite: true }),
      title: field('title', 'string', { nullable: true }),
      updatedAt: field('updated_at', 'string', { nullable: true }),
    },
    indexColumns: new Set(['id']),
  },
};

const STORE_NAMES = Object.freeze(Object.keys(tableMap) as StoreName[]);
const READ_PAGE_SIZE = 500;
const BULK_WRITE_SIZE = 500;
const BRANCH_CACHE_TTL_MS = 60_000;

export type DatabaseAdapterErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_CONTEXT_CHANGED'
  | 'BRANCH_NOT_FOUND'
  | 'INVALID_STORE'
  | 'INVALID_INDEX'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND_OR_FORBIDDEN'
  | 'SUPABASE_ERROR';

export class DatabaseAdapterError extends Error {
  readonly code: DatabaseAdapterErrorCode;
  readonly operation: string;
  readonly storeName?: string;
  readonly supabaseCode?: string;
  readonly details?: string;
  readonly hint?: string;
  readonly originalError?: unknown;

  constructor(options: {
    code: DatabaseAdapterErrorCode;
    message: string;
    operation: string;
    storeName?: string;
    supabaseCode?: string;
    details?: string;
    hint?: string;
    originalError?: unknown;
  }) {
    super(options.message);
    this.name = 'DatabaseAdapterError';
    this.code = options.code;
    this.operation = options.operation;
    this.storeName = options.storeName;
    this.supabaseCode = options.supabaseCode;
    this.details = options.details;
    this.hint = options.hint;
    this.originalError = options.originalError;
  }
}

interface SupabaseErrorLike {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface AccessContext {
  userId: string;
  branch: string | null;
}

interface BranchCache {
  userId: string;
  branch: string;
  fetchedAt: number;
}

interface BranchFetchState {
  userId: string;
  promise: Promise<string>;
}

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is DatabaseRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failValidation = (message: string, operation: string, storeName?: string): never => {
  throw new DatabaseAdapterError({
    code: 'VALIDATION_ERROR',
    message,
    operation,
    storeName,
  });
};

const asRecord = (value: unknown, label: string, storeName?: string): DatabaseRow => {
  if (!isRecord(value)) {
    return failValidation(`${label} must be a non-null object.`, 'validate', storeName);
  }
  return value;
};

const parseString = (
  value: unknown,
  label: string,
  options: { nullable?: boolean; required?: boolean; allowed?: readonly string[] } = {},
  storeName?: string,
): string | null | undefined => {
  if (value === undefined) {
    if (options.required) {
      return failValidation(`${label} is required.`, 'validate', storeName);
    }
    return undefined;
  }

  if (value === null) {
    if (options.nullable) return null;
    return failValidation(`${label} cannot be null.`, 'validate', storeName);
  }

  if (typeof value !== 'string') {
    return failValidation(`${label} must be a valid string.`, 'validate', storeName);
  }

  const trimmedValue = value.trim();

  if (options.required && trimmedValue.length === 0) {
    return failValidation(`${label} is required and cannot be empty.`, 'validate', storeName);
  }

  if (options.allowed && !options.allowed.includes(trimmedValue)) {
    return failValidation(
      `${label} must be one of: ${options.allowed.join(', ')}.`,
      'validate',
      storeName,
    );
  }

  return trimmedValue;
};

const parseAttendanceRecords = (
  value: unknown,
  label: string,
  storeName?: string,
): Record<string, AttendanceStatus> => {
  const source = asRecord(value, label, storeName);
  const allowed: readonly AttendanceStatus[] = ['P', 'A', 'L', 'E'];
  const result: Record<string, AttendanceStatus> = {};

  for (const [studentId, status] of Object.entries(source)) {
    if (typeof status !== 'string' || !allowed.includes(status as AttendanceStatus)) {
      return failValidation(
        `${label}.${studentId} must be one of: ${allowed.join(', ')}.`,
        'validate',
        storeName,
      );
    }
    result[studentId] = status as AttendanceStatus;
  }

  return result;
};

const parseGridLayout = (
  value: unknown,
  label: string,
  storeName?: string,
): Array<Array<string | null>> => {
  if (!Array.isArray(value)) {
    return failValidation(`${label} must be a two-dimensional array.`, 'validate', storeName);
  }

  return value.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      return failValidation(`${label}[${rowIndex}] must be an array.`, 'validate', storeName);
    }

    return row.map((cell, columnIndex) => {
      if (cell !== null && typeof cell !== 'string') {
        return failValidation(
          `${label}[${rowIndex}][${columnIndex}] must be a string or null.`,
          'validate',
          storeName,
        );
      }
      return cell;
    });
  });
};

const parseScores = (
  value: unknown,
  label: string,
  storeName?: string,
): Record<string, Record<string, number>> => {
  const students = asRecord(value, label, storeName);
  const result: Record<string, Record<string, number>> = {};

  for (const [studentId, subjectValue] of Object.entries(students)) {
    const subjects = asRecord(subjectValue, `${label}.${studentId}`, storeName);
    const parsedSubjects: Record<string, number> = {};

    for (const [subject, score] of Object.entries(subjects)) {
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        return failValidation(
          `${label}.${studentId}.${subject} must be a finite number.`,
          'validate',
          storeName,
        );
      }
      parsedSubjects[subject] = score;
    }

    result[studentId] = parsedSubjects;
  }

  return result;
};

const parseJson = (value: unknown, label: string, storeName?: string): JsonValue => {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (Array.isArray(value)) {
    return value.map((item: unknown, index: number) =>
      parseJson(item, `${label}[${index}]`, storeName),
    );
  }

  if (isRecord(value)) {
    const result: { [key: string]: JsonValue } = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = parseJson(nestedValue, `${label}.${key}`, storeName);
    }
    return result;
  }

  return failValidation(`${label} must contain valid JSON.`, 'validate', storeName);
};

const parseByKind = (
  value: unknown,
  schema: FieldSchema,
  label: string,
  storeName: StoreName,
  mode: 'read' | 'write' | 'patch',
): unknown => {
  const required = mode === 'read' ? schema.requiredRead : mode === 'write' && schema.requiredWrite;

  if ((value === undefined || value === null) && schema.defaultValue !== undefined) {
    return schema.defaultValue;
  }

  if (schema.kind === 'string') {
    return parseString(
      value,
      label,
      {
        nullable: schema.nullable,
        required,
        allowed: schema.allowed,
      },
      storeName,
    );
  }

  if (value === undefined) {
    if (required) return failValidation(`${label} is required.`, 'validate', storeName);
    return undefined;
  }

  if (value === null) {
    if (schema.nullable) return null;
    return failValidation(`${label} cannot be null.`, 'validate', storeName);
  }

  switch (schema.kind) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return failValidation(`${label} must be a finite number.`, 'validate', storeName);
      }
      return value;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return failValidation(`${label} must be a boolean.`, 'validate', storeName);
      }
      return value;

    case 'stringArray':
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        return failValidation(`${label} must be an array of strings.`, 'validate', storeName);
      }
      return [...value];

    case 'attendanceRecords':
      return parseAttendanceRecords(value, label, storeName);

    case 'gridLayout':
      return parseGridLayout(value, label, storeName);

    case 'scores':
      return parseScores(value, label, storeName);

    case 'json':
      return parseJson(value, label, storeName);
  }
};

const normalizeIndexName = (indexName: string): string => {
  const withoutPrefix = indexName.startsWith('by-') ? indexName.slice(3) : indexName;
  return withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
};

const chunkArray = <T>(values: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const groupRowsByShape = (rows: readonly DatabaseRow[]): DatabaseRow[][] => {
  const groups = new Map<string, DatabaseRow[]>();

  for (const row of rows) {
    const signature = Object.keys(row).sort().join('|');
    const existing = groups.get(signature);
    if (existing) existing.push(row);
    else groups.set(signature, [row]);
  }

  return [...groups.values()];
};

export class SupabaseDBAdapter {
  private branchCache: BranchCache | null = null;
  private branchFetchState: BranchFetchState | null = null;

  readonly objectStoreNames = Object.assign([...STORE_NAMES], {
    contains: (name: string): name is StoreName => STORE_NAMES.includes(name as StoreName),
  });

  async ensureBranchFetched(): Promise<void> {
    const userId = await this.getAuthenticatedUserId();
    await this.resolveBranch(userId);
  }

  resetBranchCache(): void {
    this.branchCache = null;
    this.branchFetchState = null;
  }

  /**
   * IndexedDB compatibility facade. `done` waits for tracked requests, but this
   * is not an atomic PostgreSQL transaction and cannot roll back partial work.
   * Use a Postgres function called through supabase.rpc() for true atomicity.
   */
  transaction(storeNames: string | string[], _mode?: string) {
    const requestedStores = Array.isArray(storeNames) ? storeNames : [storeNames];
    if (requestedStores.length === 0) {
      return failValidation('transaction() requires at least one store.', 'transaction');
    }

    const normalizedStores = requestedStores.map((name) => this.toStoreName(name));
    const allowedStores = new Set(normalizedStores);
    const pending: Promise<unknown>[] = [];

    const track = <T>(operation: Promise<T>): Promise<T> => {
      pending.push(operation);
      return operation;
    };

    const objectStore = (name: string) => {
      const storeName = this.toStoreName(name);
      if (!allowedStores.has(storeName)) {
        throw new DatabaseAdapterError({
          code: 'INVALID_STORE',
          message: `Store "${storeName}" was not included in this transaction facade.`,
          operation: 'transaction.objectStore',
          storeName,
        });
      }

      return {
        get: (id: string) => track(this.get(storeName as StoreName, id)),
        put: (value: unknown) => track(this.put(storeName, value)),
        add: (value: unknown) => track(this.add(storeName, value)),
        delete: (id: string) => track(this.delete(storeName, id)),
        clear: () => track(this.clear(storeName)),
      };
    };

    return {
      objectStore,
      store: objectStore(normalizedStores[0]),
      get done(): Promise<void> {
        return Promise.all(pending).then(() => undefined);
      },
    };
  }

  async getAllFromIndex<K extends StoreName>(
    storeName: K,
    indexName: string,
    key: string,
    academicYear?: string,
  ): Promise<Array<StoreRecord<K>>> {
    this.validateAcademicYear(storeName, academicYear);
    const context = await this.getAccessContext(storeName);
    const indexColumn = this.resolveIndexColumn(storeName, indexName);
    const rows = await this.fetchAllPages(storeName, context, {
      academicYear,
      indexColumn,
      indexValue: key,
    });
    return rows.map((row) => this.mapToCamelCase(storeName, row));
  }

  async getAll<K extends StoreName>(
    storeName: K,
    academicYear?: string,
  ): Promise<Array<StoreRecord<K>>> {
    this.validateAcademicYear(storeName, academicYear);
    const context = await this.getAccessContext(storeName);
    const rows = await this.fetchAllPages(storeName, context, { academicYear });
    return rows.map((row) => this.mapToCamelCase(storeName, row));
  }

  async get<K extends StoreName>(storeName: K, id: string): Promise<StoreRecord<K> | null> {
    const schema = storeSchemas[storeName];
    const recordId = this.requireId(id, storeName);
    const context = await this.getAccessContext(storeName);

    let query = supabase
      .from(schema.table)
      .select(this.getSelectColumns(storeName))
      .eq('id', recordId);

    if (context.branch) query = query.eq('branch', context.branch);

    const { data, error } = await query.maybeSingle();
    if (error) throw this.supabaseError('get', storeName, error);

    return data ? this.mapToCamelCase(storeName, data) : null;
  }

  async put<K extends StoreName>(storeName: K, value: StoreRecord<K>): Promise<void>;
  async put(storeName: string, value: unknown): Promise<void>;
  async put(storeNameInput: string, value: unknown): Promise<void> {
    const storeName = this.toStoreName(storeNameInput);
    const schema = storeSchemas[storeName];
    const context = await this.getAccessContext(storeName);
    const payload = this.mapToSnakeCase(storeName, value, context.branch);
    const expectedId = this.requirePayloadId(payload, storeName);

    const { data, error } = await supabase
      .from(schema.table)
      .upsert(payload)
      .select('id')
      .maybeSingle();

    if (error) throw this.supabaseError('put', storeName, error);
    this.assertSingleResult(storeName, 'put', expectedId, data);
  }

  async putMany<K extends StoreName>(
    storeName: K,
    values: Array<StoreRecord<K>>,
  ): Promise<void>;
  async putMany(storeName: string, values: unknown[]): Promise<void>;
  async putMany(storeNameInput: string, values: unknown[]): Promise<void> {
    if (values.length === 0) return;

    const storeName = this.toStoreName(storeNameInput);
    const schema = storeSchemas[storeName];
    const context = await this.getAccessContext(storeName);
    const payloads = values.map((value) =>
      this.mapToSnakeCase(storeName, value, context.branch),
    );

    this.assertUniqueIds(payloads, storeName, 'putMany');

    for (const sameShapeRows of groupRowsByShape(payloads)) {
      for (const chunk of chunkArray(sameShapeRows, BULK_WRITE_SIZE)) {
        const expectedIds = chunk.map((row) => this.requirePayloadId(row, storeName));
        const { data, error } = await supabase
          .from(schema.table)
          .upsert(chunk)
          .select('id');

        if (error) throw this.supabaseError('putMany', storeName, error);
        this.assertBulkResults(storeName, 'putMany', expectedIds, data);
      }
    }
  }

  async update<K extends StoreName>(
    storeName: K,
    id: string,
    updates: StorePatch<K>,
  ): Promise<void>;
  async update(storeName: string, id: string, updates: unknown): Promise<void>;
  async update(storeNameInput: string, id: string, updates: unknown): Promise<void> {
    const storeName = this.toStoreName(storeNameInput);
    const schema = storeSchemas[storeName];
    const recordId = this.requireId(id, storeName);
    const context = await this.getAccessContext(storeName);
    const patch = this.mapPatchToSnakeCase(storeName, updates);

    if (Object.keys(patch).length === 0) {
      return failValidation(
        `No updateable fields were provided for ${storeName}/${recordId}.`,
        'update',
        storeName,
      );
    }

    let query = supabase.from(schema.table).update(patch).eq('id', recordId);
    if (context.branch) query = query.eq('branch', context.branch);

    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw this.supabaseError('update', storeName, error);

    this.assertSingleResult(storeName, 'update', recordId, data);
  }

  async add<K extends StoreName>(storeName: K, value: StoreRecord<K>): Promise<void>;
  async add(storeName: string, value: unknown): Promise<void>;
  async add(storeNameInput: string, value: unknown): Promise<void> {
    const storeName = this.toStoreName(storeNameInput);
    const schema = storeSchemas[storeName];
    const context = await this.getAccessContext(storeName);
    const payload = this.mapToSnakeCase(storeName, value, context.branch);
    const expectedId = this.requirePayloadId(payload, storeName);

    const { data, error } = await supabase
      .from(schema.table)
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) throw this.supabaseError('add', storeName, error);
    this.assertSingleResult(storeName, 'add', expectedId, data);
  }

  async delete(storeNameInput: string, id: string): Promise<void> {
    const storeName = this.toStoreName(storeNameInput);
    const schema = storeSchemas[storeName];
    const recordId = this.requireId(id, storeName);
    const context = await this.getAccessContext(storeName);

    let query = supabase.from(schema.table).delete().eq('id', recordId);
    if (context.branch) query = query.eq('branch', context.branch);

    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw this.supabaseError('delete', storeName, error);

    this.assertSingleResult(storeName, 'delete', recordId, data);
  }

  async deleteMany(storeNameInput: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const storeName = this.toStoreName(storeNameInput);
    const schema = storeSchemas[storeName];
    const normalizedIds = ids.map((id) => this.requireId(id, storeName));
    this.assertUniqueStrings(normalizedIds, storeName, 'deleteMany');
    const context = await this.getAccessContext(storeName);

    for (const chunk of chunkArray(normalizedIds, BULK_WRITE_SIZE)) {
      let query = supabase.from(schema.table).delete().in('id', chunk);
      if (context.branch) query = query.eq('branch', context.branch);

      const { data, error } = await query.select('id');
      if (error) throw this.supabaseError('deleteMany', storeName, error);

      this.assertBulkResults(storeName, 'deleteMany', chunk, data);
    }
  }

  async clear(storeNameInput: string): Promise<void> {
    const storeName = this.toStoreName(storeNameInput);
    return failValidation(
      'clear() is disabled for safety. Use specific deletion methods.',
      'clear',
      storeName,
    );
  }

  private toStoreName(storeName: string): StoreName {
    if (!STORE_NAMES.includes(storeName as StoreName)) {
      throw new DatabaseAdapterError({
        code: 'INVALID_STORE',
        message: `Unknown store: ${storeName}`,
        operation: 'resolve-store',
        storeName,
      });
    }
    return storeName as StoreName;
  }

  private requireId(id: string, storeName: StoreName): string {
    return parseString(id, `${storeName}.id`, { required: true }, storeName) as string;
  }

  private requirePayloadId(payload: DatabaseRow, storeName: StoreName): string {
    return parseString(payload.id, `${storeName}.id`, { required: true }, storeName) as string;
  }

  private getSelectColumns(storeName: StoreName): string {
    const schema = storeSchemas[storeName];
    if (schema.selectAll) return '*';

    return Object.values(schema.fields)
      .filter((item) => !item.omitFromSelect)
      .map((item) => item.db)
      .filter((column, index, columns) => columns.indexOf(column) === index)
      .join(',');
  }

  private validateAcademicYear(storeName: StoreName, academicYear?: string): void {
    if (academicYear === undefined) return;
    parseString(academicYear, 'academicYear', { required: true }, storeName);

    if (!storeSchemas[storeName].academicYear) {
      return failValidation(
        `Store "${storeName}" does not support academic-year filtering.`,
        'validate-academic-year',
        storeName,
      );
    }
  }

  private resolveIndexColumn(storeName: StoreName, indexName: string): string {
    const trimmed = indexName.trim();
    if (!trimmed) {
      throw new DatabaseAdapterError({
        code: 'INVALID_INDEX',
        message: 'Index name cannot be empty.',
        operation: 'resolve-index',
        storeName,
      });
    }

    const normalized = normalizeIndexName(trimmed);
    let column = normalized;

    if (normalized === 'class') {
      if (storeName === 'students') column = 'class';
      else if (storeSchemas[storeName].indexColumns.has('class_id')) column = 'class_id';
    }

    if (!storeSchemas[storeName].indexColumns.has(column)) {
      throw new DatabaseAdapterError({
        code: 'INVALID_INDEX',
        message: `Index "${indexName}" is not supported for store "${storeName}".`,
        operation: 'resolve-index',
        storeName,
      });
    }

    return column;
  }

  private async getAuthenticatedUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw this.supabaseError('get-session', undefined, error);

    const userId = data.session?.user.id;
    if (!userId) {
      this.resetBranchCache();
      throw new DatabaseAdapterError({
        code: 'AUTH_REQUIRED',
        message: 'An authenticated Supabase session is required for database access.',
        operation: 'get-session',
      });
    }

    if (this.branchCache && this.branchCache.userId !== userId) {
      this.resetBranchCache();
    }

    return userId;
  }

  private async fetchBranch(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profiles')
      .select('branch')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw this.supabaseError('fetch-branch', 'profiles', error);
    if (!data) {
      throw new DatabaseAdapterError({
        code: 'BRANCH_NOT_FOUND',
        message: `No profile was found for authenticated user ${userId}.`,
        operation: 'fetch-branch',
        storeName: 'profiles',
      });
    }

    const profile = asRecord(data, 'Profile row', 'profiles');
    const branch = parseString(profile.branch, 'profiles.branch', { required: true }, 'profiles');
    return (branch as string).trim();
  }

  private async resolveBranch(userId: string): Promise<string> {
    if (
      this.branchCache?.userId === userId &&
      Date.now() - this.branchCache.fetchedAt < BRANCH_CACHE_TTL_MS
    ) {
      return this.branchCache.branch;
    }

    if (this.branchFetchState?.userId === userId) {
      return this.branchFetchState.promise;
    }

    const promise = (async () => {
      const branch = await this.fetchBranch(userId);
      const currentUserId = await this.getAuthenticatedUserId();

      if (currentUserId !== userId) {
        throw new DatabaseAdapterError({
          code: 'AUTH_CONTEXT_CHANGED',
          message: 'The authenticated user changed while the branch was being resolved.',
          operation: 'fetch-branch',
          storeName: 'profiles',
        });
      }

      this.branchCache = { userId, branch, fetchedAt: Date.now() };
      return branch;
    })();

    this.branchFetchState = { userId, promise };

    try {
      return await promise;
    } finally {
      if (this.branchFetchState?.userId === userId) {
        this.branchFetchState = null;
      }
    }
  }

  private async getAccessContext(storeName: StoreName): Promise<AccessContext> {
    const userId = await this.getAuthenticatedUserId();
    if (!storeSchemas[storeName].branchScoped) return { userId, branch: null };
    return { userId, branch: await this.resolveBranch(userId) };
  }

  private supabaseError(
    operation: string,
    storeName: string | undefined,
    error: SupabaseErrorLike,
  ): DatabaseAdapterError {
    return new DatabaseAdapterError({
      code: 'SUPABASE_ERROR',
      message: `Supabase ${operation}${storeName ? ` for ${storeName}` : ''} failed: ${
        error.message
      }`,
      operation,
      storeName,
      supabaseCode: error.code,
      details: error.details,
      hint: error.hint,
      originalError: error,
    });
  }

  private async fetchAllPages(
    storeName: StoreName,
    context: AccessContext,
    filters: {
      academicYear?: string;
      indexColumn?: string;
      indexValue?: string;
    },
  ): Promise<unknown[]> {
    const schema = storeSchemas[storeName];
    const rows: unknown[] = [];
    let from = 0;

    while (true) {
      let query = supabase
        .from(schema.table)
        .select(this.getSelectColumns(storeName))
        .order('id', { ascending: true })
        .range(from, from + READ_PAGE_SIZE - 1);

      if (filters.indexColumn !== undefined) {
        query = query.eq(filters.indexColumn, filters.indexValue ?? '');
      }
      if (filters.academicYear !== undefined) {
        query = query.eq('academic_year', filters.academicYear);
      }
      if (context.branch) {
        query = query.eq('branch', context.branch);
      }

      const { data, error } = await query;
      if (error) throw this.supabaseError('fetch-page', storeName, error);

      const page = Array.isArray(data) ? data : [];
      if (page.length === 0) break;

      rows.push(...page);
      from += page.length;
    }

    return rows;
  }

  private preprocessInput(
    storeName: StoreName,
    value: unknown,
    mode: 'write' | 'patch',
  ): DatabaseRow {
    const input = { ...asRecord(value, `${storeName} ${mode} value`, storeName) };

    const applyAlias = (canonical: string, legacy: string): void => {
      const hasCanonical = hasOwn(input, canonical);
      const hasLegacy = hasOwn(input, legacy);
      if (!hasLegacy) return;

      if (hasCanonical && JSON.stringify(input[canonical]) !== JSON.stringify(input[legacy])) {
        return failValidation(
          `Conflicting values were provided for "${canonical}" and legacy alias "${legacy}".`,
          `map-${mode}`,
          storeName,
        );
      }

      if (!hasCanonical) input[canonical] = input[legacy];
      delete input[legacy];
    };

    if (storeName === 'attendance') applyAlias('classId', 'class');
    if (storeName === 'pcIssues') {
      applyAlias('reportedDate', 'dateFound');
      applyAlias('resolvedDate', 'dateResolved');
    }

    return input;
  }

  private mapToCamelCase<K extends StoreName>(
    storeName: K,
    value: unknown,
  ): StoreRecord<K> {
    const schema = storeSchemas[storeName];
    const row = asRecord(value, `Database row for ${storeName}`, storeName);
    const result: DatabaseRow = {};

    for (const [camelKey, fieldSchema] of Object.entries(schema.fields)) {
      if (fieldSchema.omitFromSelect) continue;
      const parsed = parseByKind(
        row[fieldSchema.db],
        fieldSchema,
        `${storeName}.${fieldSchema.db}`,
        storeName,
        'read',
      );
      if (parsed !== undefined) result[camelKey] = parsed;
    }

    if (storeName === 'attendance') {
      result.class = result.classId;
    }

    if (storeName === 'pcIssues') {
      result.dateFound = result.reportedDate;
      result.dateResolved = result.resolvedDate;
    }

    return result as unknown as StoreRecord<K>;
  }

  private mapToSnakeCase(
    storeName: StoreName,
    value: unknown,
    branch: string | null,
  ): DatabaseRow {
    const schema = storeSchemas[storeName];
    const input = this.preprocessInput(storeName, value, 'write');
    const payload: DatabaseRow = {};

    for (const key of Object.keys(input)) {
      if (key !== 'class' || storeName !== 'attendance') {
        if (!schema.fields[key] && key !== 'dateFound' && key !== 'dateResolved') {
          return failValidation(
            `Unknown field "${key}" for store "${storeName}".`,
            'map-write',
            storeName,
          );
        }
      }
    }

    for (const [camelKey, fieldSchema] of Object.entries(schema.fields)) {
      const rawValue = input[camelKey];

      if (rawValue === undefined) {
        if (fieldSchema.requiredWrite) {
          failValidation(
            `${storeName}.${camelKey} is required.`,
            'map-write',
            storeName,
          );
        }
        continue;
      }

      const parsed = parseByKind(
        rawValue,
        fieldSchema,
        `${storeName}.${camelKey}`,
        storeName,
        'write',
      );

      if (parsed !== undefined) {
        payload[fieldSchema.db] = parsed;
      }
    }

    if (schema.branchScoped) {
      payload.branch = parseString(branch, `${storeName}.branch`, { required: true }, storeName);
    }

    return payload;
  }

  private mapPatchToSnakeCase(storeName: StoreName, value: unknown): DatabaseRow {
    const schema = storeSchemas[storeName];
    const input = this.preprocessInput(storeName, value, 'patch');
    const patch: DatabaseRow = {};

    for (const [camelKey, rawValue] of Object.entries(input)) {
      if (rawValue === undefined) continue;
      if (camelKey === 'id' || camelKey === 'branch') {
        return failValidation(
          `Field "${camelKey}" cannot be updated.`,
          'map-update',
          storeName,
        );
      }

      const fieldSchema = schema.fields[camelKey];
      if (!fieldSchema) {
        return failValidation(
          `Unknown update field "${camelKey}" for store "${storeName}".`,
          'map-update',
          storeName,
        );
      }

      const parsed = parseByKind(
        rawValue,
        fieldSchema,
        `${storeName}.${camelKey}`,
        storeName,
        'patch',
      );

      if (parsed !== undefined) patch[fieldSchema.db] = parsed;
    }

    return patch;
  }

  private assertSingleResult(
    storeName: StoreName,
    operation: string,
    expectedId: string,
    data: unknown,
  ): void {
    if (!data) {
      throw new DatabaseAdapterError({
        code: 'NOT_FOUND_OR_FORBIDDEN',
        message: `${operation} did not affect ${storeName}/${expectedId}. The row may not exist or may be blocked by RLS.`,
        operation,
        storeName,
      });
    }

    const row = asRecord(data, `${operation} result`, storeName);
    const actualId = parseString(row.id, `${operation} result.id`, { required: true }, storeName);

    if (actualId !== expectedId) {
      throw new DatabaseAdapterError({
        code: 'SUPABASE_ERROR',
        message: `${operation} returned id "${String(actualId)}" instead of "${expectedId}".`,
        operation,
        storeName,
      });
    }
  }

  private assertBulkResults(
    storeName: StoreName,
    operation: string,
    expectedIds: readonly string[],
    data: unknown,
  ): void {
    if (!Array.isArray(data)) {
      throw new DatabaseAdapterError({
        code: 'NOT_FOUND_OR_FORBIDDEN',
        message: `${operation} did not return affected rows for "${storeName}".`,
        operation,
        storeName,
      });
    }

    const actualIds = new Set(
      data.map((item, index) => {
        const row = asRecord(item, `${operation} result[${index}]`, storeName);
        return parseString(
          row.id,
          `${operation} result[${index}].id`,
          { required: true },
          storeName,
        ) as string;
      }),
    );

    const missingIds = expectedIds.filter((id) => !actualIds.has(id));
    if (missingIds.length > 0) {
      throw new DatabaseAdapterError({
        code: 'NOT_FOUND_OR_FORBIDDEN',
        message: `${operation} did not affect ${missingIds.length} requested row(s): ${missingIds.join(
          ', ',
        )}.`,
        operation,
        storeName,
      });
    }
  }

  private assertUniqueIds(
    rows: readonly DatabaseRow[],
    storeName: StoreName,
    operation: string,
  ): void {
    const ids = rows.map((row) => this.requirePayloadId(row, storeName));
    this.assertUniqueStrings(ids, storeName, operation);
  }

  private assertUniqueStrings(
    values: readonly string[],
    storeName: StoreName,
    operation: string,
  ): void {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    }

    if (duplicates.size > 0) {
      return failValidation(
        `${operation} received duplicate ids: ${[...duplicates].join(', ')}.`,
        operation,
        storeName,
      );
    }
  }
}

const dbInstance = new SupabaseDBAdapter();

export async function initDB(): Promise<SupabaseDBAdapter> {
  return dbInstance;
}