import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { analyticsAPI, campaignAPI } from '../utils/api';
import axios from 'axios';
import { Mail, Users, Send, TrendingUp, Eye, MousePointer, Reply, MessageSquare, CheckCircle } from 'lucide-react';

const Dashboard = () => {
  const [viewingReplies, setViewingReplies] = useState(false);
  const { data: analytics, isLoading } = useQuery('dashboard', analyticsAPI.getDashboard);
  const { data: campaigns } = useQuery('campaigns', campaignAPI.getAll);
  const { data: repliesData } = useQuery('replied-emails', async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      'http://localhost:5001/api/email-history?status=replied&limit=100',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = analytics?.data?.overview || {};
  const recentActivity = analytics?.data?.recentActivity || [];

  const statCards = [
    {
      name: 'Total Campaigns',
      value: stats.totalCampaigns || 0,
      icon: Send,
      color: 'bg-blue-500',
    },
    {
      name: 'Active Campaigns',
      value: stats.activeCampaigns || 0,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      name: 'Emails Sent',
      value: stats.totalSent || 0,
      icon: Mail,
      color: 'bg-purple-500',
    },
    {
      name: 'Open Rate',
      value: `${stats.openRate || 0}%`,
      icon: Eye,
      color: 'bg-yellow-500',
    },
    {
      name: 'Click Rate',
      value: `${stats.clickRate || 0}%`,
      icon: MousePointer,
      color: 'bg-indigo-500',
    },
    {
      name: 'Reply Rate',
      value: `${stats.replyRate || 0}%`,
      icon: Reply,
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your email outreach performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="card">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Campaign Performance */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Opened</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Clicked</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Replied</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns?.data?.slice(0, 5).map((campaign) => (
                <tr key={campaign._id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{campaign.name}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900">{campaign.stats.totalSent}</td>
                  <td className="px-4 py-3 text-center text-sm text-green-600">{campaign.stats.totalOpened}</td>
                  <td className="px-4 py-3 text-center text-sm text-purple-600">{campaign.stats.totalClicked}</td>
                  <td className="px-4 py-3 text-center text-sm text-yellow-600 font-bold">{campaign.stats.totalReplied}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                      campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replies Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-yellow-600" />
            Recent Replies ({repliesData?.total || 0})
          </h2>
          <button
            onClick={() => setViewingReplies(!viewingReplies)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {viewingReplies ? 'Hide' : 'View All'}
          </button>
        </div>
        
        {viewingReplies && repliesData?.emails?.length > 0 ? (
          <div className="space-y-4">
            {repliesData.emails.map((email) => (
              <div key={email._id} className="border rounded-lg p-4 bg-yellow-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-gray-900">
                        {email.contactId?.firstName} {email.contactId?.lastName}
                      </span>
                      <span className="text-sm text-gray-500">({email.contactId?.email})</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Subject:</strong> {email.subject}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Campaign:</strong> {email.campaignId?.name || 'N/A'}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Sent: {new Date(email.sentAt).toLocaleString()}</span>
                      {email.repliedAt && (
                        <span className="text-green-600 font-semibold">
                          Replied: {new Date(email.repliedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                      REPLIED
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-yellow-200">
                  <p className="text-xs text-gray-600 mb-1">Note: Check your email inbox to read the reply content</p>
                  <a
                    href={`mailto:${email.contactId?.email}`}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply to this email
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : !viewingReplies ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Click "View All" to see replied emails</p>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No replies yet</p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {recentActivity.length > 0 ? (
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-3 ${
                    activity.status === 'sent' ? 'bg-blue-500' :
                    activity.status === 'opened' ? 'bg-green-500' :
                    activity.status === 'clicked' ? 'bg-purple-500' :
                    activity.status === 'replied' ? 'bg-pink-500' :
                    'bg-gray-500'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Email {activity.status} to {activity.contactId?.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Campaign: {activity.campaignId?.name}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(activity.sentAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;