import { useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      // Check legacy theme key first
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme;
      
      // Check musicbox_settings
      const settings = localStorage.getItem('musicbox_settings');
      if (settings) {
        try {
          const parsed = JSON.parse(settings);
          return parsed.isDarkMode ? 'dark' : 'light';
        } catch (e) {}
      }
      return 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);

    // Sync with musicbox_settings if it exists
    const savedSettings = localStorage.getItem('musicbox_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        parsed.isDarkMode = theme === 'dark';
        localStorage.setItem('musicbox_settings', JSON.stringify(parsed));
      } catch (e) {}
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme, isDarkMode: theme === 'dark' };
}
