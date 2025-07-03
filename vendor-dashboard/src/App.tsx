import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVendorAuthStore } from './stores/vendorAuthStore';

// Components
import VendorLogin from './pages/VendorLogin';
import Dashboard from './pages/Dashboard';
import WhitelistManagement from './pages/WhitelistManagement';
import MerchantManagement from './pages/MerchantManagement';
import PlatformAnalytics from './pages/PlatformAnalytics';
import VendorLayout from './components/VendorLayout';

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
  const { isAuthenticated, checkAuth } = useVendorAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<VendorLogin />} />

            {/* Protected Vendor Routes */}
            {isAuthenticated ? (
              <Route path="/" element={<VendorLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="whitelist" element={<WhitelistManagement />} />
                <Route path="merchants" element={<MerchantManagement />} />
                <Route path="analytics" element={<PlatformAnalytics />} />
              </Route>
            ) : (
              <Route path="*" element={<Navigate to="/login" replace />} />
            )}

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
};

export default App; 