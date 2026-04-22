const fs = require('fs');
const path = 'src/pages/SongView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace settings.isDarkMode with isDarkMode everywhere in SongView.tsx
content = content.replace(/settings\.isDarkMode/g, 'isDarkMode');

// Update the main div class
content = content.replace(/className={`min-h-screen bg-background text-foreground font-sans transition-colors duration-300 \$\{!isDarkMode \? 'light-theme' : ''\}`}/g, 'className={`min-h-screen bg-background text-foreground font-sans transition-colors duration-300 ${isDarkMode ? "dark" : "light"}`}');

// Update updateSetting function logic
const updateSettingOld = `  const updateSetting = (element: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [element]: typeof prev[element as keyof typeof prev] === 'object' 
        ? { ...(prev[element as keyof typeof prev] as any), [key]: value }
        : value
    }));
  };`;

const updateSettingNew = `  const updateSetting = (element: string, key: string, value: any) => {
    if (element === 'isDarkMode') {
      if (value !== isDarkMode) toggleTheme();
      return;
    }
    setSettings(prev => ({
      ...prev,
      [element]: typeof prev[element as keyof typeof prev] === 'object' 
        ? { ...(prev[element as keyof typeof prev] as any), [key]: value }
        : value
    }));
  };`;

// Try to replace the function if it matches exactly, or just do a simpler replace
if (content.includes('const updateSetting = (element: string, key: string, value: any) => {')) {
    content = content.replace(/const updateSetting = \(element: string, key: string, value: any\) =\> \{[^}]*setSettings\(prev =\> \(\{[^}]*\}\)\);[^}]*\};/s, updateSettingNew);
}

fs.writeFileSync(path, content);
console.log('Global theme sync applied to SongView.tsx');
