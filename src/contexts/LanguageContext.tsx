import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

type Language = 'KH' | 'EN';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider.');
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'KH';
    const saved = localStorage.getItem('appLanguage');
    return saved === 'EN' ? 'EN' : 'KH';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('appLanguage', lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState(previous => {
      const next = previous === 'KH' ? 'EN' : 'KH';
      localStorage.setItem('appLanguage', next);
      return next;
    });
  }, []);

  const contextValue = useMemo(() => ({
    language,
    toggleLanguage,
    setLanguage
  }), [language, toggleLanguage, setLanguage]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};
