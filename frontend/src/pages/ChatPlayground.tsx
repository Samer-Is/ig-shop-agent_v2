import React from 'react';
import { MessageSquare } from 'lucide-react';

const ChatPlayground: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chat Playground</h1>
        <p className="text-gray-600">Test your AI responses in real-time</p>
      </div>

      <div className="text-center py-12">
        <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Chat Playground</h3>
        <p className="text-gray-500 mb-4">Coming in Task 3.4 implementation</p>
      </div>
    </div>
  );
};

export default ChatPlayground; 