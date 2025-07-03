import React from 'react';
import { Download } from 'lucide-react';

const ExportData: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export Data</h1>
        <p className="text-gray-600">Download your business data as CSV files</p>
      </div>

      <div className="text-center py-12">
        <Download className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Export Data</h3>
        <p className="text-gray-500 mb-4">Coming in Task 3.3 implementation</p>
      </div>
    </div>
  );
};

export default ExportData; 