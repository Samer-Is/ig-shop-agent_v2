import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { configureApiDefaults } from './lib/auth';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

// Pages
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import ProductCatalog from './pages/ProductCatalog';
import BusinessSettings from './pages/BusinessSettings';
import ChatPlayground from './pages/ChatPlayground';
import ExportData from './pages/ExportData';
import OrderManagement from './pages/OrderManagement';
import LiveConversations from './pages/LiveConversations';
import KnowledgeBase from './pages/KnowledgeBase';

// Dashboard Pages (placeholder components for now)
const DashboardOverview = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
      <p className="text-gray-600">Welcome to your Instagram AI Agent dashboard</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900">Messages Today</h3>
        <p className="text-3xl font-bold text-purple-600">42</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900">AI Responses</h3>
        <p className="text-3xl font-bold text-blue-600">38</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900">Response Rate</h3>
        <p className="text-3xl font-bold text-green-600">90%</p>
      </div>
    </div>
  </div>
);

// Dashboard page components are imported from their respective files

const Profile = () => (
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
    <p className="text-gray-600">Manage your account profile</p>
  </div>
);

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    // Configure API defaults and initialize auth on app start
    configureApiDefaults();
    initializeAuth();
  }, [initializeAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard Sub-routes */}
              <Route index element={<DashboardOverview />} />
              <Route path="products" element={<ProductCatalog />} />
              <Route path="orders" element={<OrderManagement />} />
              <Route path="conversations" element={<LiveConversations />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="settings" element={<BusinessSettings />} />
              <Route path="playground" element={<ChatPlayground />} />
              <Route path="export" element={<ExportData />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
};

export default App; 