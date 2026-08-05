import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'KH' | 'EN';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'KH',
  toggleLanguage: () => {},
  setLanguage: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('KH');

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('appLanguage') as Language;
    if (saved === 'KH' || saved === 'EN') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('appLanguage', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'KH' ? 'EN' : 'KH');
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
