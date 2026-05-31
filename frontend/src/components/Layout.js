import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Mail, 
  Users, 
  Send, 
  BarChart3, 
  Settings, 
  LogOut,
  Globe,
  FileText,
  History,
  MessageSquare,
  Database,
  Menu,
  X,
  Sun,
  Moon,
  Check
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Customizer States
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [accentColor, setAccentColor] = useState('#4edea3'); // Cyber Green default
  const [fontFamily, setFontFamily] = useState("'Geist', sans-serif"); // Geist default

  // Load customizations on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('theme-mode') || 'dark';
    const savedColor = localStorage.getItem('theme-color') || '#4edea3';
    const savedFont = localStorage.getItem('theme-font') || "'Geist', sans-serif";

    setIsDark(savedMode === 'dark');
    setAccentColor(savedColor);
    setFontFamily(savedFont);

    // Apply initially
    if (savedMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.style.setProperty('--color-primary', savedColor);
    document.documentElement.style.setProperty('--font-family', savedFont);
  }, []);

  // Update theme configurations
  const handleToggleMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem('theme-mode', newMode ? 'dark' : 'light');
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSelectColor = (color) => {
    setAccentColor(color);
    localStorage.setItem('theme-color', color);
    document.documentElement.style.setProperty('--color-primary', color);
  };

  const handleSelectFont = (font) => {
    setFontFamily(font);
    localStorage.setItem('theme-font', font);
    document.documentElement.style.setProperty('--font-family', font);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Mailboxes', href: '/mailboxes', icon: Mail },
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Templates', href: '/templates', icon: FileText },
    { name: 'Campaigns', href: '/campaigns', icon: Send },
    { name: 'Replies', href: '/replies', icon: MessageSquare },
    { name: 'Email History', href: '/email-history', icon: History },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'DNS Settings', href: '/dns', icon: Globe },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Database (Mongo)', href: 'http://localhost:8081', icon: Database, external: true },
  ];

  // Active section tracking effect
  useEffect(() => {
    let section = 'other';
    const path = location.pathname;
    if (path === '/') section = 'dashboard';
    else if (path === '/mailboxes') section = 'mailboxes';
    else if (path === '/contacts') section = 'contacts';
    else if (path === '/templates') section = 'templates';
    else if (path === '/campaigns') section = 'campaigns';
    else if (path === '/replies') section = 'replies';
    else if (path === '/email-history') section = 'email-history';
    else if (path === '/analytics') section = 'analytics';
    else if (path === '/dns') section = 'dns';
    else if (path === '/settings') section = 'settings';

    const token = localStorage.getItem('token');
    if (token) {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      fetch(`${apiUrl}/settings/active-section`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ section })
      }).catch(err => console.error('Error updating active section:', err));
    }
  }, [location.pathname]);

  const colorsList = [
    { name: 'Cyber Green', value: '#4edea3' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Cyber Blue', value: '#3b82f6' },
    { name: 'Neon Pink', value: '#ec4899' },
    { name: 'Solar Orange', value: '#f97316' },
    { name: 'Cyber Purple', value: '#a855f7' },
  ];

  const fontsList = [
    { name: 'Modern Sans (Geist)', value: "'Geist', sans-serif" },
    { name: 'Code Mono (JetBrains)', value: "'JetBrains Mono', monospace" },
    { name: 'Clean Sans (Inter)', value: "'Inter', sans-serif" },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col lg:block scanline relative">
      
      {/* Mobile Top Navbar */}
      <div className="lg:hidden bg-surface-container border-b border-outline-variant h-16 flex items-center justify-between px-4 sticky top-0 z-40 shadow-sm flex-shrink-0">
        <div className="flex items-center">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 rounded text-on-surface hover:bg-surface-container-high focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="ml-3 text-lg font-bold text-primary">HackerPortal</span>
        </div>
        
        {/* User avatar badge */}
        <div className="h-8 w-8 bg-primary text-black font-bold rounded-full flex items-center justify-center">
          <span className="text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
        </div>
      </div>

      {/* Mobile Drawer (Sidebar) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sliding drawer content */}
          <div className="fixed inset-y-0 left-0 w-64 bg-surface-container border-r border-outline-variant shadow-2xl flex flex-col z-50 animate-slide-in">
            <div className="flex h-16 items-center justify-between px-6 border-b border-outline-variant">
              <span className="text-xl font-bold text-primary">HackerPortal</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-on-surface-variant hover:text-on-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <nav className="mt-4 px-4 flex-1 overflow-y-auto pb-4">
              <ul className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  
                  if (item.external) {
                    return (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
                        >
                          <Icon className="mr-3 h-5 w-5 text-primary" />
                          {item.name}
                        </a>
                      </li>
                    );
                  }

                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary border-r-2 border-primary font-semibold'
                            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary'
                        }`}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="p-4 border-t border-outline-variant bg-surface-container">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-primary text-black font-bold rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-on-surface truncate max-w-[120px]">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate max-w-[120px]">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 text-on-surface-variant hover:text-on-surface"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (Fixed) */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-64 lg:bg-surface-container-low lg:border-r lg:border-outline-variant lg:flex-col">
        <div className="flex h-16 items-center justify-center border-b border-outline-variant flex-shrink-0">
          <h1 className="text-xl font-bold text-primary">HackerPortal</h1>
        </div>
        
        <nav className="mt-8 px-4 flex-1 overflow-y-auto pb-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              if (item.external) {
                return (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-4 py-2 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
                    >
                      <Icon className="mr-3 h-5 w-5 text-primary" />
                      {item.name}
                    </a>
                  </li>
                );
              }

              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary border-r-2 border-primary font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-outline-variant flex-shrink-0 bg-surface-container-low">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-primary text-black font-bold rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-on-surface">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-on-surface-variant">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-on-surface-variant hover:text-on-surface"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content wrapper */}
      <div className="lg:pl-64 flex-1 flex flex-col">
        <main className="py-6 px-4 sm:px-6 lg:py-8 lg:px-8 flex-1">
          {children}
        </main>
      </div>

      {/* Dynamic Theme Customizer Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowCustomizer(!showCustomizer)}
          className="bg-primary text-black p-3.5 rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center cta-glow"
        >
          <Settings className={`h-6 w-6 ${showCustomizer ? 'rotate-90' : ''} transition-transform duration-300`} />
        </button>

        {/* Customizer Dropdown Panel */}
        {showCustomizer && (
          <div className="absolute bottom-16 right-0 w-80 bg-surface-container-highest border border-outline-variant shadow-2xl rounded-xl p-5 space-y-4 animate-slide-in text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="font-semibold text-primary uppercase tracking-wider text-sm flex items-center">
                <Settings className="h-4 w-4 mr-2 animate-spin" style={{ animationDuration: '4s' }} />
                Customization Panel
              </h3>
              <button onClick={() => setShowCustomizer(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Dark/Light mode toggle */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Theme Mode</label>
              <button
                onClick={handleToggleMode}
                className="w-full flex items-center justify-between p-2.5 rounded bg-surface-container border border-outline-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="text-sm font-medium">
                  {isDark ? 'Dark / Hacker Mode' : 'Light / Clean Mode'}
                </span>
                {isDark ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-amber-500" />}
              </button>
            </div>

            {/* Accent Color Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Accent Color</label>
              <div className="grid grid-cols-6 gap-2">
                {colorsList.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => handleSelectColor(color.value)}
                    style={{ backgroundColor: color.value }}
                    className="w-10 h-10 rounded-full border border-black/20 relative flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    title={color.name}
                  >
                    {accentColor === color.value && (
                      <Check className="h-4 w-4 text-black font-extrabold stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family Selection */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Typography</label>
              <div className="space-y-1.5">
                {fontsList.map((font) => (
                  <button
                    key={font.name}
                    onClick={() => handleSelectFont(font.value)}
                    className={`w-full text-left p-2 rounded text-xs border transition-colors flex items-center justify-between ${
                      fontFamily === font.value
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface'
                    }`}
                  >
                    <span>{font.name}</span>
                    {fontFamily === font.value && <Check className="h-3 w-3 text-primary stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Layout;