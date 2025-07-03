import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { 
  BuildingStorefrontIcon, 
  UserGroupIcon, 
  ChartBarIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

interface WhitelistEntry {
  id: string;
  businessName: string;
  email: string;
  instagramHandle: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  requestReason?: string;
}

interface Merchant {
  id: string;
  businessName: string;
  email: string;
  instagramPageId: string;
  subscriptionTier: 'basic' | 'pro' | 'enterprise';
  messageCount: number;
  lastActivity: string;
  joinedAt: string;
  isActive: boolean;
}

interface PlatformStats {
  totalMerchants: number;
  activeMerchants: number;
  totalMessages: number;
  averageResponseTime: number;
  topPerformingMerchants: Array<{
    name: string;
    messageCount: number;
    responseRate: number;
  }>;
}

const VendorDashboard: React.FC = () => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'whitelist' | 'merchants' | 'analytics'>('dashboard');
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddWhitelistModal, setShowAddWhitelistModal] = useState(false);
  const [newWhitelistEntry, setNewWhitelistEntry] = useState({
    businessName: '',
    email: '',
    instagramHandle: '',
    requestReason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [whitelistRes, merchantsRes, statsRes] = await Promise.all([
        fetch('/api/vendor/whitelist', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/vendor/merchants', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/vendor/analytics/platform', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (whitelistRes.ok) {
        const whitelistData = await whitelistRes.json();
        setWhitelist(whitelistData.data || []);
      }

      if (merchantsRes.ok) {
        const merchantsData = await merchantsRes.json();
        setMerchants(merchantsData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateWhitelistStatus = async (entryId: string, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`/api/vendor/whitelist/${entryId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error updating whitelist status:', error);
    }
  };

  const addWhitelistEntry = async () => {
    try {
      const response = await fetch('/api/vendor/whitelist', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newWhitelistEntry)
      });

      if (response.ok) {
        setShowAddWhitelistModal(false);
        setNewWhitelistEntry({
          businessName: '',
          email: '',
          instagramHandle: '',
          requestReason: ''
        });
        await fetchData();
      }
    } catch (error) {
      console.error('Error adding whitelist entry:', error);
    }
  };

  const toggleMerchantStatus = async (merchantId: string) => {
    try {
      const response = await fetch(`/api/vendor/merchants/${merchantId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error toggling merchant status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
          <p className="text-gray-600 mt-2">Platform administration and management</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', name: 'Overview', icon: ChartBarIcon },
            { id: 'whitelist', name: 'Whitelist', icon: CheckCircleIcon },
            { id: 'merchants', name: 'Merchants', icon: BuildingStorefrontIcon },
            { id: 'analytics', name: 'Analytics', icon: UserGroupIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Overview */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <BuildingStorefrontIcon className="w-8 h-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Merchants</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalMerchants || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <UserGroupIcon className="w-8 h-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Merchants</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.activeMerchants || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <ChartBarIcon className="w-8 h-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Messages</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalMessages || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <ClockIcon className="w-8 h-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.averageResponseTime || 0}s</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {merchants.slice(0, 5).map((merchant) => (
                  <div key={merchant.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{merchant.businessName}</p>
                        <p className="text-sm text-gray-500">Last active: {formatDate(merchant.lastActivity)}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {merchant.messageCount} messages
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Whitelist Management */}
      {activeTab === 'whitelist' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Whitelist Management</h2>
            <button
              onClick={() => setShowAddWhitelistModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Entry
            </button>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Instagram
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {whitelist.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{entry.businessName}</div>
                          <div className="text-sm text-gray-500">{formatDate(entry.requestedAt)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        @{entry.instagramHandle}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(entry.status)}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {entry.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateWhitelistStatus(entry.id, 'approved')}
                              className="text-green-600 hover:text-green-800"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateWhitelistStatus(entry.id, 'rejected')}
                              className="text-red-600 hover:text-red-800"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Merchant Management */}
      {activeTab === 'merchants' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Merchant Management</h2>

          <div className="bg-white shadow rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Messages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {merchants.map((merchant) => (
                    <tr key={merchant.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{merchant.businessName}</div>
                          <div className="text-sm text-gray-500">{merchant.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {merchant.subscriptionTier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {merchant.messageCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(merchant.lastActivity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          merchant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {merchant.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleMerchantStatus(merchant.id)}
                          className={`${
                            merchant.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                          }`}
                        >
                          {merchant.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Platform Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Platform Analytics</h2>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Merchants</h3>
            <div className="space-y-4">
              {stats?.topPerformingMerchants?.map((merchant, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{merchant.name}</p>
                      <p className="text-sm text-gray-500">{merchant.messageCount} messages</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-900 font-medium">
                    {merchant.responseRate}% response rate
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Whitelist Entry Modal */}
      {showAddWhitelistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Whitelist Entry</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={newWhitelistEntry.businessName}
                  onChange={(e) => setNewWhitelistEntry(prev => ({ ...prev, businessName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newWhitelistEntry.email}
                  onChange={(e) => setNewWhitelistEntry(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram Handle
                </label>
                <input
                  type="text"
                  value={newWhitelistEntry.instagramHandle}
                  onChange={(e) => setNewWhitelistEntry(prev => ({ ...prev, instagramHandle: e.target.value }))}
                  placeholder="without @"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Request Reason
                </label>
                <textarea
                  value={newWhitelistEntry.requestReason}
                  onChange={(e) => setNewWhitelistEntry(prev => ({ ...prev, requestReason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddWhitelistModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addWhitelistEntry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDashboard; 