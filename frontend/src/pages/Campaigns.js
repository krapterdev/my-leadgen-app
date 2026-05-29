import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { campaignAPI, mailboxAPI, contactAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Play, Pause, Send, Eye, RefreshCw } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';

const Campaigns = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const queryClient = useQueryClient();
  const { isConnected } = useRealtime();

  const { data: campaigns, isLoading, refetch, error } = useQuery('campaigns', campaignAPI.getAll, {
    retry: 3,
    onError: (error) => {
      console.error('Campaigns API error:', error);
      toast.error('Failed to load campaigns');
    }
  });
  
  // Debug logging
  console.log('Campaigns data:', campaigns);
  console.log('Is loading:', isLoading);
  console.log('Error:', error);
  
  const startMutation = useMutation(campaignAPI.start, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('campaigns');
      const message = data.message || 'Campaign started successfully';
      if (data.stats) {
        toast.success(`${message} (${data.stats.successCount} emails sent)`);
      } else {
        toast.success(message);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to start campaign');
    }
  });

  const pauseMutation = useMutation(campaignAPI.pause, {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      toast.success('Campaign paused');
    }
  });

  const resumeMutation = useMutation(campaignAPI.resume, {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      toast.success('Campaign resumed');
    }
  });

  const stopMutation = useMutation(campaignAPI.stop, {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      toast.success('Campaign stopped');
    }
  });

  const restartMutation = useMutation(
    ({ id, confirmed }) => campaignAPI.restart(id, confirmed),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('campaigns');
        toast.success(data.data?.message || 'Campaign restarted. Click Start to begin.');
      },
      onError: (error) => {
        const errorData = error.response?.data;
        if (errorData?.requiresConfirmation) {
          const confirmed = window.confirm(errorData.confirmationMessage);
          if (confirmed) {
            const campaignId = error.config?.url?.split('/').find((part, idx, arr) => arr[idx-1] === 'campaign');
            if (campaignId) {
              restartMutation.mutate({ id: campaignId, confirmed: true });
            }
          }
        } else {
          toast.error(errorData?.message || 'Failed to restart campaign');
        }
      }
    }
  );

  const [viewingCampaign, setViewingCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const { data: campaignDetails } = useQuery(
    ['campaign-details', viewingCampaign],
    () => campaignAPI.get(viewingCampaign),
    { enabled: !!viewingCampaign }
  );

  const deleteMutation = useMutation(campaignAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      setDeletingCampaign(null);
      setDeleteConfirmText('');
      toast.success('Campaign deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete campaign');
    }
  });

  const handleDeleteConfirm = () => {
    if (deleteConfirmText === deletingCampaign.name) {
      deleteMutation.mutate(deletingCampaign._id);
    } else {
      toast.error('Campaign name does not match');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} title={isConnected ? 'Real-time connected' : 'Real-time disconnected'}></div>
          </div>
          <p className="text-gray-600">Manage your email sequences • {isConnected ? 'Live updates' : 'Offline'}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              queryClient.clear(); // Clear all cache
              refetch();
              window.location.reload(); // Force page reload
            }}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Force Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </button>
        </div>
      </div>

      {showCreateForm && (
        <CreateCampaignForm
          onCancel={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            queryClient.invalidateQueries('campaigns');
          }}
        />
      )}

      {/* Campaigns List */}
      <div className="grid gap-6">
        {isLoading ? (
        <div>Loading campaigns...</div>
      ) : error ? (
        <div className="text-red-500">Error: {error.message}</div>
      ) : Array.isArray(campaigns?.data) ? campaigns.data.map((campaign) => (
          <div key={campaign._id} className="card">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                      campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{campaign.stats.totalSent}</div>
                    <div className="text-sm text-gray-500">Sent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{campaign.stats.totalOpened}</div>
                    <div className="text-sm text-gray-500">Opened</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{campaign.stats.totalClicked}</div>
                    <div className="text-sm text-gray-500">Clicked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{campaign.stats.totalReplied}</div>
                    <div className="text-sm text-gray-500">Replied</div>
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <Send className="h-4 w-4 mr-1" />
                  From: {campaign.mailboxId?.displayName || campaign.mailboxId?.email || 'Not set'}
                </div>

                <div className="text-sm text-gray-500">
                  {campaign.sequence.length} step sequence • {campaign.contacts.length} contacts
                </div>
              </div>

              <div className="flex space-x-2 ml-4">
                {campaign.status === 'draft' && (
                  <button
                    onClick={() => startMutation.mutate(campaign._id)}
                    disabled={startMutation.isLoading}
                    className="btn-primary flex items-center"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </button>
                )}
                {campaign.status === 'active' && (
                  <>
                    <button
                      onClick={() => pauseMutation.mutate(campaign._id)}
                      className="btn-secondary flex items-center"
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </button>
                    <button
                      onClick={() => stopMutation.mutate(campaign._id)}
                      className="btn-danger flex items-center"
                    >
                      Stop
                    </button>
                  </>
                )}
                {campaign.status === 'paused' && (
                  <>
                    <button
                      onClick={() => resumeMutation.mutate(campaign._id)}
                      className="btn-primary flex items-center"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </button>
                    <button
                      onClick={() => stopMutation.mutate(campaign._id)}
                      className="btn-danger flex items-center"
                    >
                      Stop
                    </button>
                  </>
                )}
                {campaign.status === 'stopped' && (
                  <button
                    onClick={() => {
                      const confirmed = window.confirm('This will restart the campaign from the beginning. Previous results will be archived. Continue?');
                      if (confirmed) {
                        restartMutation.mutate({ id: campaign._id, confirmed: true });
                      }
                    }}
                    disabled={restartMutation.isLoading}
                    className="btn-primary flex items-center disabled:opacity-50"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {restartMutation.isLoading ? 'Restarting...' : 'Restart'}
                  </button>
                )}
                <button 
                  onClick={() => setViewingCampaign(campaign._id)}
                  className="btn-secondary flex items-center"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </button>
                <button 
                  onClick={() => setDeletingCampaign(campaign)}
                  className="btn-danger flex items-center"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        )) : (
        <div>No campaigns found</div>
      )}
      </div>

      {Array.isArray(campaigns?.data) && campaigns.data.length === 0 && (
        <div className="text-center py-12">
          <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
          <p className="text-gray-500 mb-4">Create your first email campaign to get started</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary"
          >
            Create Campaign
          </button>
        </div>
      )}

      {/* Campaign Details Modal */}
      {viewingCampaign && campaignDetails && (
        <CampaignDetailsModal
          campaign={campaignDetails.data?.campaign || campaignDetails.data}
          emailLogs={campaignDetails.data?.emailLogs || []}
          onClose={() => setViewingCampaign(null)}
          viewingCampaign={viewingCampaign}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-red-600 mb-4">🚨 Delete Campaign</h2>
            <p className="text-gray-700 mb-4">
              This action cannot be undone. This will permanently delete the campaign and all associated email logs.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Please type <strong>{deletingCampaign.name}</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type campaign name here"
              className="input-field mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setDeletingCampaign(null);
                  setDeleteConfirmText('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== deletingCampaign.name || deleteMutation.isLoading}
                className="btn-danger disabled:opacity-50"
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateCampaignForm = ({ onCancel, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [campaignData, setCampaignData] = useState({
    name: '',
    mailboxId: '',
    contactIds: [],
    sequence: [
      {
        stepNumber: 1,
        subject: '',
        body: '',
        delayHours: 0,
        condition: 'no-reply'
      }
    ]
  });

  const { data: mailboxes } = useQuery('mailboxes', mailboxAPI.getAll);
  const { data: contactsData } = useQuery('contacts', () => contactAPI.getAll({ limit: 1000 }));
  const { data: templatesData } = useQuery('templates', () => fetch('/api/template', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }).then(res => res.json()));
  
  const createMutation = useMutation(campaignAPI.create, {
    onSuccess: () => {
      toast.success('Campaign created successfully');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    }
  });

  const handleSubmit = () => {
    createMutation.mutate(campaignData);
  };

  const addSequenceStep = () => {
    setCampaignData({
      ...campaignData,
      sequence: [
        ...campaignData.sequence,
        {
          stepNumber: campaignData.sequence.length + 1,
          subject: '',
          body: '',
          delayHours: 24,
          condition: 'no-reply'
        }
      ]
    });
  };

  const updateSequenceStep = (index, field, value) => {
    const newSequence = [...campaignData.sequence];
    newSequence[index][field] = value;
    setCampaignData({ ...campaignData, sequence: newSequence });
  };

  const contacts = contactsData?.data?.contacts || [];
  const verifiedMailboxes = Array.isArray(mailboxes?.data?.data) ? mailboxes.data.data.filter(m => m.isVerified) : [];
  const templates = templatesData?.data || [];

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Create New Campaign</h2>
        <div className="flex space-x-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                step >= s ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-medium">Campaign Details</h3>
          <input
            type="text"
            placeholder="Campaign Name"
            value={campaignData.name}
            onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
            className="input-field"
          />
          <select
            value={campaignData.mailboxId}
            onChange={(e) => setCampaignData({ ...campaignData, mailboxId: e.target.value })}
            className="input-field"
          >
            <option value="">Select Mailbox</option>
            {verifiedMailboxes.map((mailbox) => (
              <option key={mailbox._id} value={mailbox._id}>
                {mailbox.displayName} ({mailbox.email})
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h3 className="font-medium">Email Sequence</h3>
          {campaignData.sequence.map((seqStep, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">Step {seqStep.stepNumber}</h4>
                {index > 0 && (
                  <div className="flex items-center space-x-2">
                    <label className="text-sm">Delay:</label>
                    <input
                      type="number"
                      value={seqStep.delayHours}
                      onChange={(e) => updateSequenceStep(index, 'delayHours', parseInt(e.target.value))}
                      className="w-20 px-2 py-1 border rounded"
                    />
                    <span className="text-sm">hours</span>
                  </div>
                )}
              </div>
              
              {/* Template Selection */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Template</label>
                <select
                  onChange={(e) => {
                    const template = templatesData?.data?.find(t => t._id === e.target.value);
                    if (template) {
                      updateSequenceStep(index, 'subject', template.subject);
                      updateSequenceStep(index, 'body', template.body);
                    }
                  }}
                  className="input-field mb-2"
                >
                  <option value="">Select a saved template</option>
                  {templatesData?.data?.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                
                <div className="text-sm text-gray-600 mt-2">
                  <p><strong>Variables you can use:</strong></p>
                  <p><code>{'{firstName}'}</code> <code>{'{lastName}'}</code> <code>{'{email}'}</code> <code>{'{fullName}'}</code></p>
                </div>
              </div>
              
              <input
                type="text"
                placeholder="Subject line"
                value={seqStep.subject}
                onChange={(e) => updateSequenceStep(index, 'subject', e.target.value)}
                className="input-field mb-3"
              />
              <textarea
                placeholder="Email body"
                value={seqStep.body}
                onChange={(e) => updateSequenceStep(index, 'body', e.target.value)}
                className="input-field h-32"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addSequenceStep}
            className="btn-secondary"
          >
            Add Step
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-medium">Select Contacts ({campaignData.contactIds.length} selected)</h3>
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            {contacts.map((contact) => (
              <label key={contact._id} className="flex items-center p-3 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={campaignData.contactIds.includes(contact._id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCampaignData({
                        ...campaignData,
                        contactIds: [...campaignData.contactIds, contact._id]
                      });
                    } else {
                      setCampaignData({
                        ...campaignData,
                        contactIds: campaignData.contactIds.filter(id => id !== contact._id)
                      });
                    }
                  }}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                  <div className="text-sm text-gray-500">{contact.email}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button
          onClick={step === 1 ? onCancel : () => setStep(step - 1)}
          className="btn-secondary"
        >
          {step === 1 ? 'Cancel' : 'Previous'}
        </button>
        <button
          onClick={step === 3 ? handleSubmit : () => setStep(step + 1)}
          disabled={createMutation.isLoading}
          className="btn-primary disabled:opacity-50"
        >
          {step === 3 ? (createMutation.isLoading ? 'Creating...' : 'Create Campaign') : 'Next'}
        </button>
      </div>
    </div>
  );
};

const CampaignDetailsModal = ({ campaign, emailLogs, onClose, viewingCampaign }) => {
  const [selectedRun, setSelectedRun] = useState('current');
  const queryClient = useQueryClient();
  
  if (!campaign) return null;
  
  // Group logs by run
  const logsByRun = {};
  emailLogs?.forEach(log => {
    const run = log.campaignRun || 1;
    if (!logsByRun[run]) {
      logsByRun[run] = [];
    }
    logsByRun[run].push(log);
  });
  
  const currentRun = campaign.currentRun || 1;
  const totalRuns = campaign.totalRuns || 0;
  const displayLogs = selectedRun === 'current' ? logsByRun[currentRun] || [] : logsByRun[selectedRun] || [];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">{campaign?.name || 'Campaign Details'}</h2>
            {totalRuns > 0 && (
              <p className="text-sm text-gray-500">Run {currentRun} of {totalRuns + 1} total runs</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Campaign Status</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              campaign.status === 'active' ? 'bg-green-100 text-green-800' :
              campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
              campaign.status === 'stopped' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {campaign.status.toUpperCase()}
            </span>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Mailbox</h3>
            <p className="text-sm">{campaign.mailboxId?.displayName}</p>
            <p className="text-xs text-gray-500">{campaign.mailboxId?.email}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Contacts</h3>
            <p className="text-2xl font-bold">{campaign.contacts?.length || 0}</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Email Sequence</h3>
          <div className="space-y-3">
            {campaign.sequence?.map((step, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Step {step.stepNumber}</h4>
                  {index > 0 && (
                    <span className="text-sm text-gray-500">Delay: {step.delayHours}h</span>
                  )}
                </div>
                <p className="font-medium text-sm mb-1">{step.subject}</p>
                <p className="text-sm text-gray-600 truncate">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Email Activity</h3>
            {totalRuns > 0 && (
              <select
                value={selectedRun}
                onChange={(e) => setSelectedRun(e.target.value)}
                className="input-field w-auto"
              >
                <option value="current">Current Run ({currentRun})</option>
                {Object.keys(logsByRun).sort((a, b) => b - a).map(run => (
                  run != currentRun && (
                    <option key={run} value={run}>Previous Run {run}</option>
                  )
                ))}
              </select>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Opened</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Run</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayLogs?.slice(0, 10).map((log) => (
                  <tr key={log._id}>
                    <td className="px-4 py-2 text-sm">
                      {log.contactId?.firstName} {log.contactId?.lastName}
                      <div className="text-xs text-gray-500">{log.contactId?.email}</div>
                    </td>
                    <td className="px-4 py-2 text-sm">{log.subject}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        log.status === 'sent' ? 'bg-green-100 text-green-800' :
                        log.status === 'opened' ? 'bg-blue-100 text-blue-800' :
                        log.status === 'clicked' ? 'bg-purple-100 text-purple-800' :
                        log.status === 'replied' ? 'bg-yellow-100 text-yellow-800' :
                        log.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {log.openedAt ? (
                        <span className="text-green-600 font-bold text-lg" title={`Opened: ${new Date(log.openedAt).toLocaleString()}`}>✓</span>
                      ) : (
                        <span className="text-gray-300 text-lg">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(log.sentAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      #{log.campaignRun || 1}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={log.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          fetch(`/api/email-history/${log._id}`, {
                            method: 'PUT',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('token')}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ status: newStatus })
                          })
                          .then(res => res.json())
                          .then(data => {
                            toast.success('Status updated');
                            queryClient.invalidateQueries('campaigns');
                            queryClient.invalidateQueries(['campaign-details', viewingCampaign]);
                          })
                          .catch(err => toast.error('Failed to update'));
                        }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="sent">Sent</option>
                        <option value="opened">Opened</option>
                        <option value="clicked">Clicked</option>
                        <option value="replied">Replied</option>
                        <option value="failed">Failed</option>
                      </select>
                    </td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No email activity for this run
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;