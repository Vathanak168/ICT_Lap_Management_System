import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { initDB } from '../store/db';

interface AcademicYear {
  id: string;
  year: string;
  is_active: boolean;
}

interface AcademicYearContextType {
  activeYear: string | null;
  academicYears: AcademicYear[];
  isLoading: boolean;
  changeYear: (year: string, skipValidation?: boolean) => void;
  createYear: (year: string) => Promise<boolean>;
  deleteYear: (year: string) => Promise<boolean>;
  refreshYears: () => Promise<void>;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export const AcademicYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchRequestRef = useRef(0);

  const fetchYears = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, year, is_active')
        .order('year', { ascending: false });

      if (requestId !== fetchRequestRef.current) return;
      if (error) throw error;

      const years = data ?? [];
      setAcademicYears(years);

      if (years.length === 0) {
        setActiveYear(null);
        localStorage.removeItem('active_academic_year');
        return;
      }

      const storedYear = localStorage.getItem('active_academic_year');
      const activeYearItem = years.find(item => item.is_active);
      const storedYearItem = years.find(item => item.year === storedYear);
      const explicitSessionSwitch = sessionStorage.getItem('user_switched_academic_year') === 'true';

      // Prioritize active academic year on load so users are never stranded on obsolete years with no data
      let selectedYear: string;
      if (explicitSessionSwitch && storedYearItem) {
        selectedYear = storedYearItem.year;
      } else if (activeYearItem) {
        selectedYear = activeYearItem.year;
      } else if (storedYearItem) {
        selectedYear = storedYearItem.year;
      } else {
        selectedYear = years[0].year;
      }

      setActiveYear(selectedYear);
      localStorage.setItem('active_academic_year', selectedYear);
    } catch (error: any) {
      if (requestId === fetchRequestRef.current) {
        console.error('Error fetching academic years:', error);
        // Auto-logout if JWT is expired (401 / PGRST303)
        if (error?.code === 'PGRST303' || error?.message?.includes('JWT')) {
          void supabase.auth.signOut();
        }
      }
    } finally {
      if (requestId === fetchRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchYears();
  }, [fetchYears]);

  const changeYear = useCallback((year: string, skipValidation = false) => {
    if (!skipValidation) {
      const exists = academicYears.some(item => item.year === year);
      if (!exists) {
        console.error(`Unknown academic year: ${year}`);
        return;
      }
    }
    sessionStorage.setItem('user_switched_academic_year', 'true');
    setActiveYear(year);
    localStorage.setItem('active_academic_year', year);
  }, [academicYears]);

  const createYear = useCallback(async (year: string) => {
    const normalizedYear = year.trim();
    if (!/^\d{4}-\d{4}$/.test(normalizedYear)) {
      return false;
    }

    try {
      // Local check for responsiveness
      const exists = academicYears.some(y => y.year === normalizedYear);
      if (exists) return false;

      const { error } = await supabase
        .from('academic_years')
        .insert([{ year: normalizedYear, is_active: false }]);

      if (error) throw error;
      
      await fetchYears();
      changeYear(normalizedYear, true);
      return true;
    } catch (error) {
      console.error('Error creating academic year:', error);
      return false;
    }
  }, [academicYears, fetchYears, changeYear]);

  const deleteYear = useCallback(async (yearToDelete: string) => {
    try {
      const exists = academicYears.some(y => y.year === yearToDelete);
      if (!exists) return false;

      // Manual cascade delete for all records in this academic year across all stores
      const db = await initDB();
      const stores = [
        'students',
        'attendance',
        'grades',
        'seatingPlans',
        'lessonLogs',
        'lessonPlans',
        'teachingSchedules',
        'teachingLogs',
        'classCurriculums',
        'curriculumLessons',
        'subjects',
        'pcIssues',
        'pcSyncTasks',
        'classes' // Delete classes last
      ] as const;

      const deletePromises: Promise<void>[] = [];
      
      for (const store of stores) {
        // Fetch all items for this year in the store
        // DB uses the academicYear parameter directly
        const items = await db.getAll(store as any, yearToDelete);
        const ids = items.map(item => item.id);
        if (ids.length > 0) {
          deletePromises.push(db.deleteMany(store as any, ids));
        }
      }

      await Promise.all(deletePromises);

      // Now it is safe to delete the year itself from academic_years
      const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('year', yearToDelete);

      if (error) throw error;
      
      await fetchYears();
      return true;
    } catch (error) {
      console.error('Error deleting academic year:', error);
      return false;
    }
  }, [academicYears, fetchYears]);

  const contextValue = useMemo(() => ({
    activeYear,
    academicYears,
    isLoading,
    changeYear,
    createYear,
    deleteYear,
    refreshYears: fetchYears
  }), [activeYear, academicYears, isLoading, changeYear, createYear, deleteYear, fetchYears]);

  return (
    <AcademicYearContext.Provider value={contextValue}>
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = () => {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error('useAcademicYear must be used inside AcademicYearProvider.');
  }
  return context;
};
