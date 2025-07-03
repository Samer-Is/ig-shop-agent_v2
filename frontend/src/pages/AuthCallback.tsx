import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, Instagram } from 'lucide-react';
import { handleOAuthCallback } from '../lib/auth';
import { useAuthStore } from '../stores/authStore';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, setError, clearError } = useAuthStore();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        clearError();
        setStatus('loading');
        setMessage('Connecting to Instagram...');

        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth errors
        if (error) {
          throw new Error(errorDescription || `OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        setMessage('Verifying your Instagram account...');

        // Exchange code for tokens and get user data
        const user = await handleOAuthCallback(code, state);

        setMessage('Setting up your dashboard...');
        
        // Update auth store
        login(user);
        
        setStatus('success');
        setMessage('Successfully connected! Redirecting to dashboard...');

        // Redirect to dashboard after brief success display
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);

      } catch (error) {
        console.error('Authentication callback error:', error);
        
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        setMessage(errorMessage);
        setError(errorMessage);

        // Redirect to login after error display
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 5000);
      }
    };

    processCallback();
  }, [searchParams, login, setError, clearError, navigate]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-red-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'from-blue-50 to-purple-50';
      case 'success':
        return 'from-green-50 to-blue-50';
      case 'error':
        return 'from-red-50 to-orange-50';
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${getStatusColor()} flex items-center justify-center p-4`}>
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center"
        >
          {/* Header */}
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Instagram className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Instagram AI Agent</h1>
          </div>

          {/* Status Icon */}
          <motion.div
            key={status}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center mb-6"
          >
            {getStatusIcon()}
          </motion.div>

          {/* Status Message */}
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold text-gray-900">
              {status === 'loading' && 'Authenticating...'}
              {status === 'success' && 'Welcome aboard!'}
              {status === 'error' && 'Authentication Failed'}
            </h2>
            
            <p className="text-gray-600 leading-relaxed">
              {message}
            </p>
          </motion.div>

          {/* Loading Progress Bar */}
          {status === 'loading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6"
            >
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}

          {/* Success Animation */}
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-6 p-4 bg-green-50 rounded-lg"
            >
              <p className="text-sm text-green-700">
                Your Instagram account has been successfully connected. You can now manage your AI assistant and start automating customer conversations.
              </p>
            </motion.div>
          )}

          {/* Error Details */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-6 space-y-4"
            >
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">
                  We couldn't connect your Instagram account. This might be because:
                </p>
                <ul className="text-xs text-red-600 mt-2 space-y-1 text-left">
                  <li>• Your Instagram page is not on our whitelist</li>
                  <li>• The authentication process was cancelled</li>
                  <li>• There was a temporary network issue</li>
                </ul>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/')}
                className="w-full bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300"
              >
                Try Again
              </motion.button>
            </motion.div>
          )}
        </motion.div>

        {/* Additional Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="mt-6 text-center"
        >
          <p className="text-xs text-gray-500">
            Need help? Contact our support team for assistance with connecting your Instagram account.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthCallback; 