import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { MessageSquare, Mail, Calendar, User, RefreshCw, ExternalLink } from 'lucide-react';

const Replies = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, refetch } = useQuery(
    'all-replies',
    async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        'http://localhost:5001/api/email-history?status=replied&limit=500',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    },
    {
      refetchInterval: 10000 // Auto-refresh every 10 seconds
    }
  );

  const replies = data?.emails || [];
  const filteredReplies = replies.filter(email => {
    const searchLower = searchTerm.toLowerCase();
    return (
      email.contactId?.firstName?.toLowerCase().includes(searchLower) ||
      email.contactId?.lastName?.toLowerCase().includes(searchLower) ||
      email.contactId?.email?.toLowerCase().includes(searchLower) ||
      email.subject?.toLowerCase().includes(searchLower) ||
      email.campaignId?.name?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-7 w-7 mr-2 text-yellow-600" />
            Email Replies
          </h1>
          <p className="text-gray-600">All contacts who replied to your campaigns</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-yellow-600">{replies.length}</div>
          <div className="text-sm text-gray-500">Total Replies</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">
            {replies.filter(r => new Date(r.repliedAt) > new Date(Date.now() - 24*60*60*1000)).length}
          </div>
          <div className="text-sm text-gray-500">Last 24 Hours</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600">
            {new Set(replies.map(r => r.campaignId?._id)).size}
          </div>
          <div className="text-sm text-gray-500">Campaigns</div>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <input
          type="text"
          placeholder="Search by name, email, subject, or campaign..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field"
        />
      </div>

      {/* Replies List */}
      <div className="space-y-4">
        {filteredReplies.length > 0 ? (
          filteredReplies.map((email) => (
            <div key={email._id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Contact Info */}
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {email.contactId?.firstName} {email.contactId?.lastName}
                      </h3>
                      <a
                        href={`mailto:${email.contactId?.email}`}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        {email.contactId?.email}
                      </a>
                    </div>
                  </div>

                  {/* Email Details */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start">
                      <span className="text-sm font-medium text-gray-600 w-24">Subject:</span>
                      <span className="text-sm text-gray-900">{email.subject}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-sm font-medium text-gray-600 w-24">Campaign:</span>
                      <span className="text-sm text-gray-900">{email.campaignId?.name || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center space-x-6 text-xs text-gray-500 mb-3">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>Sent: {new Date(email.sentAt).toLocaleString()}</span>
                    </div>
                    {email.openedAt && (
                      <div className="flex items-center text-blue-600">
                        <span>Opened: {new Date(email.openedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {email.repliedAt && (
                      <div className="flex items-center text-green-600 font-semibold">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        <span>Replied: {new Date(email.repliedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3 pt-3 border-t border-gray-200">
                    <a
                      href={`mailto:${email.contactId?.email}`}
                      className="btn-primary text-sm flex items-center"
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      Reply via Email
                    </a>
                    <a
                      href={`https://mail.google.com/mail/u/0/#search/from:${email.contactId?.email}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-sm flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View in Gmail
                    </a>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="ml-4">
                  <span className="px-4 py-2 bg-green-100 text-green-800 text-sm font-semibold rounded-full flex items-center">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    REPLIED
                  </span>
                </div>
              </div>

              {/* Note */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> To read the actual reply content, check your email inbox or click "View in Gmail" above.
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="card text-center py-12">
            <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Replies Yet</h3>
            <p className="text-gray-500">
              {searchTerm ? 'No replies match your search' : 'Replies will appear here when contacts respond to your emails'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Replies;
