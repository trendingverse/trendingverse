'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark') // default dark

  useEffect(() => {
    const saved = localStorage.getItem('tv-theme') as Theme | null
    const t = saved ?? 'dark' // default to dark like OneAds
    setTheme(t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('tv-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}
