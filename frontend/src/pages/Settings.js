import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { settingsAPI, mailboxAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { User, Mail, Globe, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settingsResponse, isLoading } = useQuery('settings', settingsAPI.getAll, {
    refetchOnWindowFocus: true,
    refetchInterval: 5000 // Refresh every 5 seconds
  });
  const settings = settingsResponse?.data?.data || {};
  
  console.log('Settings response:', settingsResponse);
  console.log('Settings data:', settings);

  const updateProfileMutation = useMutation(settingsAPI.updateProfile, {
    onSuccess: () => {
      queryClient.invalidateQueries('settings');
      queryClient.invalidateQueries('mailboxes'); // Also refresh mailboxes
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  });

  const updatePreferencesMutation = useMutation(settingsAPI.updatePreferences, {
    onSuccess: () => {
      queryClient.invalidateQueries('settings');
      toast.success('Preferences updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    }
  });

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'mailboxes', name: 'Mailboxes', icon: Mail },
    { id: 'dns', name: 'DNS Settings', icon: Globe },
    { id: 'preferences', name: 'Preferences', icon: SettingsIcon },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="flex space-x-8">
        {/* Sidebar */}
        <div className="w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <ProfileSettings
              user={settings?.user}
              onUpdate={updateProfileMutation.mutate}
              loading={updateProfileMutation.isLoading}
            />
          )}

          {activeTab === 'mailboxes' && (
            <MailboxesOverview mailboxes={settings?.mailboxes} />
          )}

          {activeTab === 'dns' && (
            <DnsOverview dnsSettings={settings?.dnsSettings} />
          )}

          {activeTab === 'preferences' && (
            <PreferencesSettings
              preferences={settings?.preferences}
              onUpdate={updatePreferencesMutation.mutate}
              loading={updatePreferencesMutation.isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileSettings = ({ user, onUpdate, loading }) => {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    company: user?.company || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="input-field"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={user?.email || ''}
            className="input-field bg-gray-50"
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company
          </label>
          <input
            type="text"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            className="input-field"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

const MailboxesOverview = ({ mailboxes }) => {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ displayName: '', password: '' });
  const queryClient = useQueryClient();
  
  const updateMutation = useMutation(mailboxAPI.update, {
    onSuccess: () => {
      queryClient.invalidateQueries('settings');
      setEditingId(null);
      toast.success('Mailbox updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update mailbox');
    }
  });
  
  const startEdit = (mailbox) => {
    setEditingId(mailbox._id);
    setEditForm({ displayName: mailbox.displayName, password: '' });
  };
  
  const saveEdit = () => {
    updateMutation.mutate([editingId, editForm]);
  };
  
  console.log('MailboxesOverview received:', mailboxes);
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Connected Mailboxes</h2>
      {Array.isArray(mailboxes) && mailboxes.length > 0 ? (
        <div className="space-y-3">
          {mailboxes.map((mailbox) => (
            <div key={mailbox._id} className="p-3 border rounded-lg">
              {editingId === mailbox._id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                    className="input-field"
                    placeholder="Display Name"
                  />
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                    className="input-field"
                    placeholder="New Password (optional)"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={updateMutation.isLoading}
                      className="btn-primary text-sm"
                    >
                      {updateMutation.isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      mailbox.isVerified ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="font-medium flex items-center">
                        {mailbox.displayName}
                        <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                          mailbox.isVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {mailbox.isVerified ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">{mailbox.email}</div>
                      <div className="text-xs text-gray-400 capitalize">{mailbox.provider}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEdit(mailbox)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      mailbox.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {mailbox.isVerified ? 'Verified' : 'Not Verified'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No mailboxes connected yet</p>
          <button
            onClick={() => window.location.href = '/mailboxes'}
            className="btn-primary text-sm"
          >
            Add Mailbox
          </button>
        </div>
      )}
    </div>
  );
};

const DnsOverview = ({ dnsSettings }) => {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">DNS Configuration</h2>
      {dnsSettings?.length > 0 ? (
        <div className="space-y-3">
          {dnsSettings.map((dns) => (
            <div key={dns._id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">{dns.domain}</div>
                <div className="text-sm text-gray-500">
                  {dns.lastVerified ? `Last verified: ${new Date(dns.lastVerified).toLocaleDateString()}` : 'Never verified'}
                </div>
              </div>
              <div className="flex items-center">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  dns.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {dns.isVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No DNS settings configured yet</p>
      )}
    </div>
  );
};

const PreferencesSettings = ({ preferences, onUpdate, loading }) => {
  const [formData, setFormData] = useState({
    timezone: preferences?.timezone || 'UTC',
    defaultSendingLimits: {
      perHour: preferences?.defaultSendingLimits?.perHour || 50,
      perDay: preferences?.defaultSendingLimits?.perDay || 200
    },
    trackingEnabled: preferences?.trackingEnabled !== false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Preferences</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="input-field"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
          </select>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Default Sending Limits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Per Hour</label>
              <input
                type="number"
                value={formData.defaultSendingLimits.perHour}
                onChange={(e) => setFormData({
                  ...formData,
                  defaultSendingLimits: {
                    ...formData.defaultSendingLimits,
                    perHour: parseInt(e.target.value)
                  }
                })}
                className="input-field"
                min="1"
                max="1000"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Per Day</label>
              <input
                type="number"
                value={formData.defaultSendingLimits.perDay}
                onChange={(e) => setFormData({
                  ...formData,
                  defaultSendingLimits: {
                    ...formData.defaultSendingLimits,
                    perDay: parseInt(e.target.value)
                  }
                })}
                className="input-field"
                min="1"
                max="10000"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.trackingEnabled}
              onChange={(e) => setFormData({ ...formData, trackingEnabled: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Enable email tracking</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">Track opens, clicks, and other engagement metrics</p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;