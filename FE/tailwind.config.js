/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'sans-serif'], // 이제 모든 텍스트가 프리텐다드로 나와!
      },
      keyframes: {
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-100px) rotate(360deg)', opacity: '0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.35)' },
        },
        pulseGlowRed: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.35)' },
        },
      },
      animation: {
        shake: 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
        confetti: 'confetti 1s ease-out forwards',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite',
        pulseGlowRed: 'pulseGlowRed 3s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
