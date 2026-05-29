import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Mailboxes from './pages/Mailboxes';
import Contacts from './pages/Contacts';
import Campaigns from './pages/Campaigns';
import Analytics from './pages/Analytics';
import DnsSettings from './pages/DnsSettings';
import Settings from './pages/Settings';
import Templates from './pages/Templates';
import EmailHistory from './pages/EmailHistory';
import Replies from './pages/Replies';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />
              <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/mailboxes" element={<ProtectedRoute><Layout><Mailboxes /></Layout></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><Layout><Contacts /></Layout></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><Layout><Templates /></Layout></ProtectedRoute>} />
              <Route path="/campaigns" element={<ProtectedRoute><Layout><Campaigns /></Layout></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
              <Route path="/dns" element={<ProtectedRoute><Layout><DnsSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
              <Route path="/email-history" element={<ProtectedRoute><Layout><EmailHistory /></Layout></ProtectedRoute>} />
              <Route path="/replies" element={<ProtectedRoute><Layout><Replies /></Layout></ProtectedRoute>} />
            </Routes>
            <Toaster position="top-right" />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;