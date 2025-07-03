import React from 'react';
import { motion } from 'framer-motion';
import { Instagram, Bot, MessageCircle, Sparkles, Shield, Zap } from 'lucide-react';
import { initiateInstagramAuth } from '../lib/auth';

const Login: React.FC = () => {
  const handleInstagramLogin = () => {
    initiateInstagramAuth();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Hero Content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Instagram AI Agent
              </h1>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              Transform Your
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Instagram DMs
              </span>
              Into Sales
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Automate customer support, showcase your products, and increase sales with AI-powered conversations in both English and Arabic.
            </p>
          </div>

          {/* Features */}
          <div className="grid sm:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-start space-x-3"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">24/7 Customer Support</h3>
                <p className="text-sm text-gray-600">Instant responses to customer inquiries</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-start space-x-3"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Smart Product Recommendations</h3>
                <p className="text-sm text-gray-600">AI suggests relevant products to customers</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex items-start space-x-3"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Bilingual Support</h3>
                <p className="text-sm text-gray-600">English and Jordanian Arabic</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex items-start space-x-3"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Easy Setup</h3>
                <p className="text-sm text-gray-600">Connect your Instagram in minutes</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Right Side - Login Card */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                <Instagram className="w-8 h-8 text-white" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  Connect Your Instagram
                </h3>
                <p className="text-gray-600">
                  Get started with your AI-powered Instagram assistant
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleInstagramLogin}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-3"
              >
                <Instagram className="w-5 h-5" />
                <span>Continue with Instagram</span>
              </motion.button>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                  By continuing, you agree to our Terms of Service and Privacy Policy. 
                  We'll only access your business Instagram account to provide our AI services.
                </p>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-8 text-center space-y-4"
          >
            <p className="text-sm font-medium text-gray-700">Trusted by businesses across Jordan</p>
            <div className="flex justify-center items-center space-x-6 opacity-60">
              <div className="text-xs text-gray-500">🔒 Secure</div>
              <div className="text-xs text-gray-500">⚡ Fast Setup</div>
              <div className="text-xs text-gray-500">🌟 Easy to Use</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login; 