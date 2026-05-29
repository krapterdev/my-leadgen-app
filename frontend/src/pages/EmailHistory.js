import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Trash2, RefreshCw, Filter, Mail, MailOpen, MousePointer, Reply, Clock } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';

const EmailHistory = () => {
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingEmail, setEditingEmail] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [syncedStats, setSyncedStats] = useState(null);
  const queryClient = useQueryClient();
  const { isConnected } = useRealtime();
  
  const { data, isLoading, refetch } = useQuery(
    ['email-history', statusFilter],
    async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5001/api/email-history?status=${statusFilter}&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    },
    {
      refetchInterval: 5000 // Auto-refresh every 5 seconds
    }
  );

  // Show stats summary
  const stats = {
    total: data?.total || 0,
    sent: data?.emails?.filter(e => e.status === 'sent').length || 0,
    opened: data?.emails?.filter(e => e.status === 'opened').length || 0,
    clicked: data?.emails?.filter(e => e.status === 'clicked').length || 0,
    replied: data?.emails?.filter(e => e.status === 'replied').length || 0
  };

  const updateMutation = useMutation(
    async ({ id, status }) => {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5001/api/email-history/${id}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('email-history');
        setEditingEmail(null);
        toast.success('Email status updated');
      }
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5001/api/email-history/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('email-history');
        toast.success('Email deleted');
      }
    }
  );

  const bulkDeleteMutation = useMutation(
    async (ids) => {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5001/api/email-history/bulk-delete',
        { ids },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('email-history');
        setSelectedEmails([]);
        toast.success('Emails deleted');
      }
    }
  );

  const clearAllMutation = useMutation(
    async () => {
      const token = localStorage.getItem('token');
      await axios.delete('http://localhost:5001/api/email-history/clear-all', {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('email-history');
        toast.success('All emails cleared');
      }
    }
  );

  const syncStatusMutation = useMutation(
    async () => {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5001/api/email-status/sync-status',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    },
    {
      onSuccess: (data) => {
        setSyncedStats(data.stats);
        setShowStatsModal(true);
        toast.success('Status synced successfully!');
      },
      onError: () => {
        toast.error('Failed to sync status');
      }
    }
  );

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedEmails(data?.emails?.map(email => email._id) || []);
    } else {
      setSelectedEmails([]);
    }
  };

  const handleSelectEmail = (id) => {
    if (selectedEmails.includes(id)) {
      setSelectedEmails(selectedEmails.filter(emailId => emailId !== id));
    } else {
      setSelectedEmails([...selectedEmails, id]);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900">Email History</h1>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} title={isConnected ? 'Live updates' : 'Offline'}></div>
          </div>
          <p className="text-gray-600">Manage all sent emails • {isConnected ? 'Live updates' : 'Offline'}</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => syncStatusMutation.mutate()} 
            className="btn-primary flex items-center"
            disabled={syncStatusMutation.isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncStatusMutation.isLoading ? 'animate-spin' : ''}`} />
            {syncStatusMutation.isLoading ? 'Syncing...' : 'Sync Status'}
          </button>
          <button onClick={() => refetch()} className="btn-secondary flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          {selectedEmails.length > 0 && (
            <button
              onClick={() => bulkDeleteMutation.mutate(selectedEmails)}
              className="btn-danger flex items-center"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedEmails.length})
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm('Clear all email history?')) {
                clearAllMutation.mutate();
              }
            }}
            className="btn-danger flex items-center"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
          <div className="text-sm text-gray-500">Sent</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{stats.opened}</div>
          <div className="text-sm text-gray-500">Opened</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.clicked}</div>
          <div className="text-sm text-gray-500">Clicked</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.replied}</div>
          <div className="text-sm text-gray-500">Replied</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Status ({stats.total})</option>
            <option value="sent">Sent ({stats.sent})</option>
            <option value="opened">Opened ({stats.opened})</option>
            <option value="clicked">Clicked ({stats.clicked})</option>
            <option value="replied">Replied ({stats.replied})</option>
            <option value="failed">Failed</option>
          </select>
          <div className="text-sm text-gray-600">
            Auto-refresh: <span className="text-green-600 font-semibold">ON</span> (every 5s)
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedEmails.length === data?.emails?.length && data?.emails?.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timeline</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.emails?.map((email) => (
              <tr key={email._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedEmails.includes(email._id)}
                    onChange={() => handleSelectEmail(email._id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">
                    {email.contactId?.firstName} {email.contactId?.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{email.contactId?.email}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{email.subject}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{email.campaignId?.name || 'N/A'}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {email.status === 'replied' && <Reply className="h-4 w-4 text-green-600" />}
                      {email.status === 'opened' && <MailOpen className="h-4 w-4 text-blue-600" />}
                      {email.status === 'clicked' && <MousePointer className="h-4 w-4 text-purple-600" />}
                      {email.status === 'sent' && <Mail className="h-4 w-4 text-gray-600" />}
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        email.status === 'replied' ? 'bg-green-100 text-green-800' :
                        email.status === 'opened' ? 'bg-blue-100 text-blue-800' :
                        email.status === 'clicked' ? 'bg-purple-100 text-purple-800' :
                        email.status === 'sent' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {email.status.toUpperCase()}
                      </span>
                    </div>
                    {email.openedAt && (
                      <div className="flex items-center text-xs text-blue-600">
                        <MailOpen className="h-3 w-3 mr-1" />
                        <span>Opened ✓</span>
                      </div>
                    )}
                    {!email.openedAt && email.status === 'sent' && (
                      <div className="flex items-center text-xs text-gray-400">
                        <Mail className="h-3 w-3 mr-1" />
                        <span>Not opened yet</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center text-gray-600">
                      <Mail className="h-3 w-3 mr-1" />
                      <span>Sent: {new Date(email.sentAt).toLocaleString()}</span>
                    </div>
                    {email.openedAt && (
                      <div className="flex items-center text-blue-600">
                        <MailOpen className="h-3 w-3 mr-1" />
                        <span>Opened: {new Date(email.openedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {email.clickedAt && (
                      <div className="flex items-center text-purple-600">
                        <MousePointer className="h-3 w-3 mr-1" />
                        <span>Clicked: {new Date(email.clickedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {email.repliedAt && (
                      <div className="flex items-center text-green-600">
                        <Reply className="h-3 w-3 mr-1" />
                        <span>Replied: {new Date(email.repliedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => setEditingEmail(email)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit Status"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this email?')) {
                          deleteMutation.mutate(email._id);
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data?.emails?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No emails found
          </div>
        )}
      </div>

      {/* Edit Status Modal */}
      {/* Stats Modal */}
      {showStatsModal && syncedStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">📊 Email Status Report</h2>
              <button onClick={() => setShowStatsModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="card text-center bg-blue-50">
                <div className="text-3xl font-bold text-blue-600">{syncedStats.total}</div>
                <div className="text-sm text-gray-600">Total Emails</div>
              </div>
              <div className="card text-center bg-green-50">
                <div className="text-3xl font-bold text-green-600">{syncedStats.opened}</div>
                <div className="text-sm text-gray-600">Opened</div>
                <div className="text-xs text-green-600 font-semibold">{syncedStats.openRate}%</div>
              </div>
              <div className="card text-center bg-gray-50">
                <div className="text-3xl font-bold text-gray-600">{syncedStats.notOpened}</div>
                <div className="text-sm text-gray-600">Not Opened</div>
              </div>
              <div className="card text-center bg-yellow-50">
                <div className="text-3xl font-bold text-yellow-600">{syncedStats.replied}</div>
                <div className="text-sm text-gray-600">Replied</div>
                <div className="text-xs text-yellow-600 font-semibold">{syncedStats.replyRate}%</div>
              </div>
            </div>

            {/* By Status */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Status Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(syncedStats.byStatus).map(([status, count]) => (
                  <div key={status} className="card text-center">
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-xs text-gray-500 uppercase">{status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Campaign */}
            {Object.keys(syncedStats.byCampaign).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">By Campaign</h3>
                <div className="space-y-2">
                  {Object.entries(syncedStats.byCampaign).map(([campaign, stats]) => (
                    <div key={campaign} className="card">
                      <div className="flex justify-between items-center">
                        <div className="font-semibold">{campaign}</div>
                        <div className="flex space-x-4 text-sm">
                          <span className="text-blue-600">Total: {stats.total}</span>
                          <span className="text-green-600">Opened: {stats.opened}</span>
                          <span className="text-gray-600">Not Opened: {stats.notOpened}</span>
                          <span className="text-yellow-600">Replied: {stats.replied}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="grid md:grid-cols-2 gap-4">
              {syncedStats.recentOpens.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Recent Opens (24h)</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {syncedStats.recentOpens.slice(0, 5).map((item, i) => (
                      <div key={i} className="card text-sm">
                        <div className="font-semibold">{item.name || item.email}</div>
                        <div className="text-xs text-gray-500">{new Date(item.openedAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syncedStats.recentReplies.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Recent Replies (24h)</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {syncedStats.recentReplies.slice(0, 5).map((item, i) => (
                      <div key={i} className="card text-sm">
                        <div className="font-semibold">{item.name || item.email}</div>
                        <div className="text-xs text-gray-500">{new Date(item.repliedAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowStatsModal(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {editingEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Edit Email Status</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Contact:</strong> {editingEmail.contactId?.firstName} {editingEmail.contactId?.lastName}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Email:</strong> {editingEmail.contactId?.email}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Subject:</strong> {editingEmail.subject}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Change Status:
              </label>
              <select
                defaultValue={editingEmail.status}
                onChange={(e) => {
                  updateMutation.mutate({
                    id: editingEmail._id,
                    status: e.target.value
                  });
                }}
                className="input-field"
                disabled={updateMutation.isLoading}
              >
                <option value="sent">Sent</option>
                <option value="opened">Opened</option>
                <option value="clicked">Clicked</option>
                <option value="replied">Replied</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingEmail(null)}
                className="btn-secondary"
                disabled={updateMutation.isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailHistory;