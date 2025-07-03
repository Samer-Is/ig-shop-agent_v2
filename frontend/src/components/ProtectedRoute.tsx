import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Bot } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, initializeAuth } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // Initialize auth on component mount
    if (!isAuthenticated && !loading) {
      initializeAuth();
    }
  }, [isAuthenticated, loading, initializeAuth]);

  // Show loading screen while authenticating
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-white" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Instagram AI Agent
            </h2>
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <p className="text-gray-600">Verifying authentication...</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Render protected content
  return <>{children}</>;
};

export default ProtectedRoute; 