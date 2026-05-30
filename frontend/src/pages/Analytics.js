import React from 'react';
import { useQuery } from 'react-query';
import { analyticsAPI } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const Analytics = () => {
  const { data: analytics, isLoading } = useQuery('dashboard', analyticsAPI.getDashboard);

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  const stats = analytics?.data?.overview || {};
  const techStackStats = analytics?.data?.techStackStats || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">Detailed performance metrics</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.totalSent || 0}</div>
          <div className="text-sm text-gray-500">Total Sent</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">{stats.openRate || 0}%</div>
          <div className="text-sm text-gray-500">Open Rate</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600">{stats.clickRate || 0}%</div>
          <div className="text-sm text-gray-500">Click Rate</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-pink-600">{stats.replyRate || 0}%</div>
          <div className="text-sm text-gray-500">Reply Rate</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Email Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { name: 'Sent', value: stats.totalSent || 0 },
              { name: 'Opened', value: stats.totalOpened || 0 },
              { name: 'Clicked', value: stats.totalClicked || 0 },
              { name: 'Replied', value: stats.totalReplied || 0 }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Engagement Rates</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[
              { name: 'Open Rate', value: stats.openRate || 0 },
              { name: 'Click Rate', value: stats.clickRate || 0 },
              { name: 'Reply Rate', value: stats.replyRate || 0 }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tech Stack Distribution */}
        {techStackStats.length > 0 && (
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Target Lead Technologies (Tech Stack Breakdown)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={techStackStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: 'Leads', angle: -90, position: 'insideLeft' }} />
                <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed Stats */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Detailed Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalCampaigns || 0}</div>
            <div className="text-sm text-gray-500">Total Campaigns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.activeCampaigns || 0}</div>
            <div className="text-sm text-gray-500">Active Campaigns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.totalBounced || 0}</div>
            <div className="text-sm text-gray-500">Bounced</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.totalSent > 0 ? ((stats.totalBounced || 0) / stats.totalSent * 100).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-gray-500">Bounce Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;