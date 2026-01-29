// 라우팅용 App.jsx
import MatchCollection from './pages/MatchCollection'
import ThemeToggle from './components/ThemeToggle'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <div className="App w-full min-h-screen">
        <ThemeToggle />
        <MatchCollection />
      </div>
    </ThemeProvider>
  )
}

export default App