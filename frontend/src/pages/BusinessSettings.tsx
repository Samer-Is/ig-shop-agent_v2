import React from 'react';
import { Building, Bot } from 'lucide-react';

const BusinessSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
        <p className="text-gray-600">Configure your business information and AI assistant</p>
      </div>

      <div className="text-center py-12">
        <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Business Settings</h3>
        <p className="text-gray-500 mb-4">Coming in Task 3.2 implementation</p>
      </div>
    </div>
  );
};

export default BusinessSettings; 