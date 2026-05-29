import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { dnsAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, CheckCircle, XCircle, Copy } from 'lucide-react';

const DnsSettings = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [generatedRecords, setGeneratedRecords] = useState(null);
  const queryClient = useQueryClient();

  const { data: dnsResponse, isLoading } = useQuery('dns', dnsAPI.getAll);
  const dnsSettings = dnsResponse?.data || [];

  const saveMutation = useMutation(dnsAPI.save, {
    onSuccess: () => {
      queryClient.invalidateQueries('dns');
      setShowAddForm(false);
      toast.success('DNS settings saved successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save DNS settings');
    }
  });

  const generateMutation = useMutation(dnsAPI.generate, {
    onSuccess: (data) => {
      setGeneratedRecords(data.data);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to generate DNS records');
    }
  });

  const verifyMutation = useMutation(dnsAPI.verify, {
    onSuccess: () => {
      queryClient.invalidateQueries('dns');
      toast.success('DNS settings verified successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Verification failed');
    }
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DNS Settings</h1>
          <p className="text-gray-600">Configure domain authentication records</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Domain
        </button>
      </div>

      {/* Add Domain Form */}
      {showAddForm && (
        <AddDomainForm
          onSubmit={saveMutation.mutate}
          onCancel={() => setShowAddForm(false)}
          loading={saveMutation.isLoading}
          onGenerate={generateMutation.mutate}
          generatedRecords={generatedRecords}
          generating={generateMutation.isLoading}
        />
      )}

      {/* DNS Settings List */}
      <div className="space-y-4">
        {dnsSettings?.map((dns) => (
          <div key={dns._id} className="card">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{dns.domain}</h3>
                  <div className="flex items-center">
                    {dns.isVerified ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mr-1" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm ${dns.isVerified ? 'text-green-600' : 'text-red-600'}`}>
                      {dns.isVerified ? 'Verified' : 'Not Verified'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {dns.spfRecord && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SPF Record</label>
                      <div className="flex items-center">
                        <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono">
                          {dns.spfRecord}
                        </code>
                        <button
                          onClick={() => copyToClipboard(dns.spfRecord)}
                          className="ml-2 p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {dns.dkimRecord && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">DKIM Record</label>
                      <div className="flex items-center">
                        <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono">
                          {dns.dkimRecord.substring(0, 50)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(dns.dkimRecord)}
                          className="ml-2 p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {dns.dmarcRecord && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">DMARC Record</label>
                      <div className="flex items-center">
                        <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono">
                          {dns.dmarcRecord}
                        </code>
                        <button
                          onClick={() => copyToClipboard(dns.dmarcRecord)}
                          className="ml-2 p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {dns.trackingDomain && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Domain</label>
                      <div className="flex items-center">
                        <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono">
                          {dns.trackingDomain}
                        </code>
                        <button
                          onClick={() => copyToClipboard(dns.trackingDomain)}
                          className="ml-2 p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="ml-4">
                {!dns.isVerified && (
                  <button
                    onClick={() => verifyMutation.mutate(dns._id)}
                    disabled={verifyMutation.isLoading}
                    className="btn-secondary"
                  >
                    Verify
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {dnsSettings?.length === 0 && (
        <div className="text-center py-12">
          <div className="h-12 w-12 text-gray-400 mx-auto mb-4">🌐</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No DNS settings yet</h3>
          <p className="text-gray-500 mb-4">Add your domain to configure authentication records</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary"
          >
            Add Domain
          </button>
        </div>
      )}
    </div>
  );
};

const AddDomainForm = ({ onSubmit, onCancel, loading, onGenerate, generatedRecords, generating }) => {
  const [formData, setFormData] = useState({
    domain: '',
    spfRecord: '',
    dkimRecord: '',
    dmarcRecord: '',
    trackingDomain: ''
  });

  const handleGenerate = () => {
    if (!formData.domain) {
      toast.error('Please enter a domain first');
      return;
    }
    onGenerate(formData.domain);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = generatedRecords ? {
      ...formData,
      spfRecord: generatedRecords.records.spf,
      dkimRecord: generatedRecords.records.dkim,
      dmarcRecord: generatedRecords.records.dmarc,
      trackingDomain: generatedRecords.records.trackingDomain
    } : formData;
    
    onSubmit(dataToSubmit);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Add Domain DNS Settings</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Domain
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="example.com"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              className="input-field flex-1"
              required
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="btn-secondary"
            >
              {generating ? 'Generating...' : 'Generate Records'}
            </button>
          </div>
        </div>

        {generatedRecords && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900">Generated DNS Records</h3>
            <p className="text-sm text-blue-700">Add these records to your DNS provider:</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-blue-800 mb-1">SPF Record (TXT)</label>
                <code className="block bg-white p-2 rounded text-sm font-mono border">
                  {generatedRecords.records.spf}
                </code>
                <p className="text-xs text-blue-600 mt-1">{generatedRecords.instructions.spf}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-800 mb-1">DKIM Record (TXT)</label>
                <code className="block bg-white p-2 rounded text-sm font-mono border">
                  {generatedRecords.records.dkim.substring(0, 50)}...
                </code>
                <p className="text-xs text-blue-600 mt-1">{generatedRecords.instructions.dkim}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-800 mb-1">DMARC Record (TXT)</label>
                <code className="block bg-white p-2 rounded text-sm font-mono border">
                  {generatedRecords.records.dmarc}
                </code>
                <p className="text-xs text-blue-600 mt-1">{generatedRecords.instructions.dmarc}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-800 mb-1">Tracking Domain (CNAME)</label>
                <code className="block bg-white p-2 rounded text-sm font-mono border">
                  {generatedRecords.records.trackingDomain}
                </code>
                <p className="text-xs text-blue-600 mt-1">{generatedRecords.instructions.tracking}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save DNS Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DnsSettings;