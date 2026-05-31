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
  X
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:block">
      
      {/* Mobile Top Navbar */}
      <div className="lg:hidden bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sticky top-0 z-40 shadow-sm flex-shrink-0">
        <div className="flex items-center">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 rounded text-gray-600 hover:bg-gray-100 focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="ml-3 text-lg font-bold text-gray-900">Email Outreach</span>
        </div>
        
        {/* User avatar badge */}
        <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
          <span className="text-sm font-medium text-white">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
        </div>
      </div>

      {/* Mobile Drawer (Sidebar) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sliding drawer content */}
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-2xl flex flex-col z-50 animate-slide-in">
            <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
              <span className="text-xl font-bold text-gray-900">Email Outreach</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
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
                          className="flex items-center px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Icon className="mr-3 h-5 w-5 text-indigo-500" />
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
                            ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-700'
                            : 'text-gray-700 hover:bg-gray-100'
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

            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (Fixed) */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-64 lg:bg-white lg:shadow-lg lg:flex-col">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-900">Email Outreach</h1>
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
                      className="flex items-center px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Icon className="mr-3 h-5 w-5 text-indigo-500" />
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
                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
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
        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-gray-400 hover:text-gray-600"
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
    </div>
  );
};

export default Layout;