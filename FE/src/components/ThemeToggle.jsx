import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="테마 전환"
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-[99999] group rounded-full p-2.5 border transition-all duration-300
        bg-white/70 border-slate-200/70 text-slate-700 shadow-md backdrop-blur-md
        hover:scale-110 active:scale-95
        dark:bg-black/40 dark:border-white/10 dark:text-slate-200 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]
      "
    >
      <span className="block transition-all duration-300 group-active:rotate-12">
        {isDarkMode ? (
          <Sun className="h-5 w-5 text-yellow-400 transition-all duration-300 group-hover:rotate-12" />
        ) : (
          <Moon className="h-5 w-5 text-slate-700 transition-all duration-300 group-hover:-rotate-12" />
        )}
      </span>
    </button>
  );
}


