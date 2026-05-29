import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { mailboxAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Mail, CheckCircle, XCircle, Trash2 } from 'lucide-react';

const Mailboxes = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: mailboxesResponse, isLoading } = useQuery('mailboxes', mailboxAPI.getAll);
  const mailboxes = Array.isArray(mailboxesResponse?.data?.data) ? mailboxesResponse.data.data : [];
  
  const createMutation = useMutation(mailboxAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('mailboxes');
      setShowAddForm(false);
      toast.success('Mailbox added successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add mailbox');
    }
  });

  const [verifyingId, setVerifyingId] = useState(null);
  
  const verifyMutation = useMutation(mailboxAPI.verify, {
    onMutate: (mailboxId) => {
      setVerifyingId(mailboxId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries('mailboxes');
      toast.success('Mailbox verified successfully');
      setVerifyingId(null);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || 'Verification failed';
      const suggestion = error.response?.data?.suggestion;
      toast.error(errorMsg + (suggestion ? '. ' + suggestion : ''));
      setVerifyingId(null);
    }
  });

  const deleteMutation = useMutation(mailboxAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('mailboxes');
      toast.success('Mailbox deleted successfully');
    }
  });

  const providers = [
    { value: 'gmail', label: 'Gmail' },
    { value: 'gsuite', label: 'G Suite' },
    { value: 'outlook', label: 'Outlook' },
    { value: 'office365', label: 'Office 365' },
    { value: 'yahoo', label: 'Yahoo' },
    { value: 'custom', label: 'Custom SMTP' },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  console.log('Mailboxes data:', mailboxesResponse);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mailboxes</h1>
          <p className="text-gray-600">Manage your sending email accounts</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Mailbox
        </button>
      </div>

      {/* Add Mailbox Form */}
      {showAddForm && <AddMailboxForm 
        providers={providers}
        onSubmit={createMutation.mutate}
        onCancel={() => setShowAddForm(false)}
        loading={createMutation.isLoading}
      />}

      {/* Mailboxes List */}
      <div className="grid gap-4">
        {Array.isArray(mailboxes) && mailboxes.map((mailbox) => (
          <div key={mailbox._id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Mail className="h-8 w-8 text-gray-400 mr-4" />
                <div>
                  <h3 className="font-medium text-gray-900">{mailbox.displayName}</h3>
                  <p className="text-sm text-gray-500">{mailbox.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{mailbox.provider}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  {mailbox.isVerified ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm ${mailbox.isVerified ? 'text-green-600' : 'text-red-600'}`}>
                    {mailbox.isVerified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  {!mailbox.isVerified && (
                    <button
                      onClick={() => verifyMutation.mutate(mailbox._id)}
                      disabled={verifyingId === mailbox._id}
                      className="btn-secondary text-sm flex items-center"
                    >
                      {verifyingId === mailbox._id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                          Verifying...
                        </>
                      ) : (
                        'Verify'
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(mailbox._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(!Array.isArray(mailboxes) || mailboxes.length === 0) && (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No mailboxes yet</h3>
          <p className="text-gray-500 mb-4">Add your first mailbox to start sending emails</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary"
          >
            Add Mailbox
          </button>
        </div>
      )}
    </div>
  );
};

const AddMailboxForm = ({ providers, onSubmit, onCancel, loading }) => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const selectedProvider = watch('provider');

  const onFormSubmit = (data) => {
    console.log('Form data:', data);
    onSubmit(data);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Add New Mailbox</h2>
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              {...register('displayName', { required: 'Display name is required' })}
              className="input-field"
              placeholder="John Doe"
            />
            {errors.displayName && (
              <p className="text-red-500 text-sm mt-1">{errors.displayName.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              {...register('email', { required: 'Email is required' })}
              type="email"
              className="input-field"
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider
          </label>
          <select
            {...register('provider', { required: 'Provider is required' })}
            className="input-field"
          >
            <option value="">Select provider</option>
            {providers.map(provider => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            {...register('password', { required: 'Password is required' })}
            type="password"
            className="input-field"
            placeholder="App password or regular password"
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        {selectedProvider === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMTP Host
              </label>
              <input
                {...register('smtpHost')}
                className="input-field"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMTP Port
              </label>
              <input
                {...register('smtpPort')}
                type="number"
                className="input-field"
                placeholder="587"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Mailbox'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Mailboxes;