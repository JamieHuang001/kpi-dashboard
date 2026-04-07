import { useState, useEffect, createContext, useContext } from 'react';
import { STORAGE_KEYS } from '../config/storageKeys';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.THEME);
        return saved === 'dark';
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggleTheme = () => setIsDark(p => !p);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
