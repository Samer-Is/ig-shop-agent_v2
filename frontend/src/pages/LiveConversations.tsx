import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface LiveConversation {
  id: string;
  customerId: string;
  status: 'ai_active' | 'handover_pending' | 'human_active' | 'resolved';
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  isAiPaused: boolean;
  handoverRequest?: {
    id: string;
    reason: string;
    priority: string;
    requestedAt: string;
  };
  humanAgent?: {
    agentName: string;
    takenOverAt: string;
  };
}

interface HandoverRequest {
  id: string;
  customerId: string;
  reason: string;
  triggerMessage: string;
  requestedAt: string;
  status: string;
  priority: string;
}

const LiveConversations: React.FC = () => {
  const { token } = useAuthStore();
  const [conversations, setConversations] = useState<LiveConversation[]>([]);
  const [handovers, setHandovers] = useState<HandoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<LiveConversation | null>(null);
  const [manualMessage, setManualMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    fetchData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [conversationsRes, handoversRes] = await Promise.all([
        fetch('/api/conversations/live', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/conversations/handovers', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (conversationsRes.ok) {
        const conversationsData = await conversationsRes.json();
        setConversations(conversationsData.data || []);
      }

      if (handoversRes.ok) {
        const handoversData = await handoversRes.json();
        setHandovers(handoversData.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptHandover = async (handoverId: string) => {
    try {
      const response = await fetch(`/api/conversations/handover/${handoverId}/accept`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentName: 'Merchant' }),
      });

      if (response.ok) {
        await fetchData();
      } else {
        console.error('Failed to accept handover');
      }
    } catch (error) {
      console.error('Error accepting handover:', error);
    }
  };

  const sendManualMessage = async (handoverId: string) => {
    if (!manualMessage.trim()) return;

    try {
      setSendingMessage(true);
      const response = await fetch(`/api/conversations/handover/${handoverId}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: manualMessage.trim() }),
      });

      if (response.ok) {
        setManualMessage('');
        await fetchData();
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const resolveHandover = async (handoverId: string) => {
    try {
      const response = await fetch(`/api/conversations/handover/${handoverId}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolution: 'Resolved by merchant' }),
      });

      if (response.ok) {
        setSelectedConversation(null);
        await fetchData();
      } else {
        console.error('Failed to resolve handover');
      }
    } catch (error) {
      console.error('Error resolving handover:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ai_active':
        return 'bg-green-100 text-green-800';
      case 'handover_pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'human_active':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Live Conversations</h1>
        <button
          onClick={fetchData}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">AI</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">AI Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {conversations.filter(c => c.status === 'ai_active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">!</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Handover</p>
              <p className="text-2xl font-bold text-gray-900">
                {handovers.filter(h => h.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">H</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Human Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {conversations.filter(c => c.status === 'human_active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">#</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Conversations</p>
              <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Handovers */}
      {handovers.filter(h => h.status === 'pending').length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Pending Handover Requests</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {handovers.filter(h => h.status === 'pending').map((handover) => (
              <div key={handover.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(handover.priority)}`}>
                        {handover.priority.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        Customer: {handover.customerId}
                      </span>
                      <span className="text-sm text-gray-500">
                        Reason: {handover.reason.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 truncate">
                      {handover.triggerMessage}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Requested {new Date(handover.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => acceptHandover(handover.id)}
                    className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Take Over
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Conversations */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Live Conversations</h3>
        </div>
        
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-600">No active conversations</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(conversation.status)}`}>
                        {conversation.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        Customer: {conversation.customerId}
                      </span>
                      <span className="text-sm text-gray-500">
                        Messages: {conversation.messageCount}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 truncate">
                      Last: {conversation.lastMessage}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(conversation.lastMessageAt).toLocaleString()}
                    </p>
                    {conversation.humanAgent && (
                      <p className="mt-1 text-xs text-blue-600">
                        Handled by: {conversation.humanAgent.agentName}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {conversation.status === 'human_active' && (
                      <button
                        onClick={() => setSelectedConversation(conversation)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversation Management Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Managing Conversation - {selectedConversation.customerId}
                </h3>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">Status</p>
                  <p className="text-sm text-gray-600">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedConversation.status)}`}>
                      {selectedConversation.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </p>
                  {selectedConversation.humanAgent && (
                    <p className="mt-2 text-sm text-gray-600">
                      Taken over by: {selectedConversation.humanAgent.agentName} at{' '}
                      {new Date(selectedConversation.humanAgent.takenOverAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Send Manual Message
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={manualMessage}
                      onChange={(e) => setManualMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && selectedConversation.handoverRequest) {
                          sendManualMessage(selectedConversation.handoverRequest.id);
                        }
                      }}
                    />
                    <button
                      onClick={() => selectedConversation.handoverRequest && sendManualMessage(selectedConversation.handoverRequest.id)}
                      disabled={sendingMessage || !manualMessage.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingMessage ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
                {selectedConversation.handoverRequest && (
                  <button
                    onClick={() => resolveHandover(selectedConversation.handoverRequest!.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                  >
                    Return to AI
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveConversations; 