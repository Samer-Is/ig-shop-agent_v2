import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot,
  Package,
  Settings,
  MessageSquare,
  BarChart3,
  Download,
  Menu,
  X,
  LogOut,
  User,
  Instagram,
  ShoppingCart,
  Users,
  Home,
  ShoppingBag,
  DocumentText,
  ChatBubbleLeftRight,
  BookOpen,
  Cog,
  ChatBubbleBottomCenterText,
  ArrowDownTray,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { NavLink } from 'react-router-dom';

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: BarChart3,
      current: location.pathname === '/dashboard',
    },
    {
      name: 'Product Catalog',
      href: '/dashboard/products',
      icon: Package,
      current: location.pathname === '/dashboard/products',
    },
    {
      name: 'Order Management',
      href: '/dashboard/orders',
      icon: ShoppingCart,
      current: location.pathname === '/dashboard/orders',
    },
    {
      name: 'Live Conversations',
      href: '/dashboard/conversations',
      icon: Users,
      current: location.pathname === '/dashboard/conversations',
    },
    {
      name: 'Knowledge Base',
      href: '/dashboard/knowledge-base',
      icon: BookOpen,
      current: location.pathname === '/dashboard/knowledge-base',
    },
    {
      name: 'Business Settings',
      href: '/dashboard/settings',
      icon: Settings,
      current: location.pathname === '/dashboard/settings',
    },
    {
      name: 'Chat Playground',
      href: '/dashboard/chat',
      icon: ChatBubbleBottomCenterText,
      current: location.pathname === '/dashboard/chat',
    },
    {
      name: 'Export Data',
      href: '/dashboard/export',
      icon: ArrowDownTray,
      current: location.pathname === '/dashboard/export',
    },
  ];

  const handleLogout = () => {
    logout();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu backdrop */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{
          x: isMobileMenuOpen ? 0 : '-100%',
        }}
        className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">AI Agent</h1>
            </div>
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.pageName || 'Instagram Page'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.subscriptionTier || 'Basic'} Plan
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-2">
            <NavLink to="/dashboard" className={navLinkClass}>
              <Home className="w-5 h-5" />
              Overview
            </NavLink>
            <NavLink to="/dashboard/products" className={navLinkClass}>
              <ShoppingBag className="w-5 h-5" />
              Product Catalog
            </NavLink>
            <NavLink to="/dashboard/orders" className={navLinkClass}>
              <DocumentText className="w-5 h-5" />
              Orders
            </NavLink>
            <NavLink to="/dashboard/conversations" className={navLinkClass}>
              <ChatBubbleLeftRight className="w-5 h-5" />
              Live Conversations
            </NavLink>
            <NavLink to="/dashboard/knowledge-base" className={navLinkClass}>
              <BookOpen className="w-5 h-5" />
              Knowledge Base
            </NavLink>
            <NavLink to="/dashboard/settings" className={navLinkClass}>
              <Cog className="w-5 h-5" />
              Business Settings
            </NavLink>
            <NavLink to="/dashboard/chat" className={navLinkClass}>
              <ChatBubbleBottomCenterText className="w-5 h-5" />
              Chat Playground
            </NavLink>
            <NavLink to="/dashboard/export" className={navLinkClass}>
              <ArrowDownTray className="w-5 h-5" />
              Export Data
            </NavLink>
          </nav>

          {/* User Menu */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="space-y-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/dashboard/profile')}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <User className="mr-3 w-5 h-5" />
                Profile
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="mr-3 w-5 h-5" />
                Sign Out
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 bg-white border-b border-gray-200 shadow-sm">
          <button
            onClick={toggleMobileMenu}
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1 px-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {navigationItems.find(item => item.current)?.name || 'Dashboard'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-gray-500">AI Active</span>
              </div>
              
              {/* User Avatar - Mobile */}
              <div className="lg:hidden">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 