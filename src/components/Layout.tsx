import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Home, Trophy, Calendar, TrendingUp, ArrowRightLeft, Swords, Activity, Menu, X } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/standings', label: 'Standings', icon: Trophy },
  { path: '/matchups', label: 'Matchups', icon: Calendar },
  { path: '/league-pulse', label: 'League Pulse', icon: Activity },
  { path: '/rivals', label: 'Rivals', icon: Swords },
  { path: '/power-rankings', label: 'Power Rankings', icon: TrendingUp },
  { path: '/transactions', label: 'Transactions', icon: ArrowRightLeft },
]

export function Layout() {
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary transition-all duration-300 group-hover:scale-105">
                <Trophy className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-display text-xl tracking-wide text-foreground">
                  GREASY GOOBLINS
                </h1>
                <p className="text-[10px] text-muted-foreground tracking-[0.3em] -mt-0.5">
                  LEAGUE DASHBOARD
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                const Icon = item.icon

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-gradient-to-r from-primary to-accent rounded-full" />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'md:hidden relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300',
                isMenuOpen
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              <div className="relative w-5 h-5">
                <Menu
                  className={cn(
                    'absolute inset-0 w-5 h-5 transition-all duration-300',
                    isMenuOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
                  )}
                />
                <X
                  className={cn(
                    'absolute inset-0 w-5 h-5 transition-all duration-300',
                    isMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
                  )}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <div
          className={cn(
            'md:hidden absolute left-0 right-0 top-full overflow-hidden transition-all duration-300 ease-out',
            isMenuOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <nav className="bg-background/95 backdrop-blur-xl border-b border-border/40">
            {/* Gradient accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="container mx-auto px-4 py-3">
              <div className="flex flex-col gap-1">
                {navItems.map((item, index) => {
                  const isActive = location.pathname === item.path
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200',
                        'animate-fade-up',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      )}
                      style={{
                        animationDelay: isMenuOpen ? `${index * 50}ms` : '0ms',
                        animationFillMode: 'both'
                      }}
                    >
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200',
                          isActive
                            ? 'bg-primary/20'
                            : 'bg-secondary/50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{item.label}</span>
                        {isActive && (
                          <span className="text-[10px] text-primary/70 tracking-wider uppercase">
                            Current page
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary glow-primary" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Bottom gradient fade */}
            <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
          </nav>
        </div>
      </header>

      {/* Backdrop overlay for mobile menu */}
      <div
        className={cn(
          'fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300',
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-xs text-muted-foreground/60">
            Greasy Gooblins League Dashboard &middot; Powered by Sleeper API
          </p>
        </div>
      </footer>
    </div>
  )
}
