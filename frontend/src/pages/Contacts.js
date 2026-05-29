import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { contactAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Upload, Users, Search, Edit2, Trash2 } from 'lucide-react';

const Contacts = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: contactsData, isLoading } = useQuery(
    ['contacts', { page, search }],
    () => contactAPI.getAll({ page, search, limit: 20 }),
    { keepPreviousData: true }
  );

  const createMutation = useMutation(contactAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('contacts');
      setShowAddForm(false);
      toast.success('Contact added successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add contact');
    }
  });

  const updateMutation = useMutation(
    ({ id, data }) => contactAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contacts');
        setEditingContact(null);
        toast.success('Contact updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update contact');
      }
    }
  );

  const deleteMutation = useMutation(contactAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('contacts');
      toast.success('Contact deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete contact');
    }
  });

  const handleDelete = (contact) => {
    if (window.confirm(`Delete ${contact.firstName} ${contact.lastName}?`)) {
      deleteMutation.mutate(contact._id);
    }
  };

  const uploadMutation = useMutation(contactAPI.uploadCSV, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('contacts');
      setShowUpload(false);
      toast.success(`Imported ${data.data.imported} contacts. ${data.data.duplicates} duplicates skipped.`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Upload failed');
    }
  });

  const contacts = contactsData?.data?.contacts || [];
  const totalPages = contactsData?.data?.totalPages || 1;

  if (isLoading && page === 1) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600">Manage your email recipients</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowUpload(true)}
            className="btn-secondary flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <ContactForm
          onSubmit={createMutation.mutate}
          onCancel={() => setShowAddForm(false)}
          loading={createMutation.isLoading}
        />
      )}

      {/* Edit Contact Form */}
      {editingContact && (
        <ContactForm
          contact={editingContact}
          onSubmit={(data) => updateMutation.mutate({ id: editingContact._id, data })}
          onCancel={() => setEditingContact(null)}
          loading={updateMutation.isLoading}
        />
      )}

      {/* Upload CSV Form */}
      {showUpload && (
        <UploadCSVForm
          onSubmit={uploadMutation.mutate}
          onCancel={() => setShowUpload(false)}
          loading={uploadMutation.isLoading}
        />
      )}

      {/* Contacts List */}
      <div className="card">
        {contacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contacts.map((contact) => (
                  <tr key={contact._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{contact.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{contact.company || '-'}</div>
                      <div className="text-sm text-gray-500">{contact.title || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        contact.status === 'active' ? 'bg-green-100 text-green-800' :
                        contact.status === 'replied' ? 'bg-blue-100 text-blue-800' :
                        contact.status === 'unsubscribed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingContact(contact)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contact)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
            <p className="text-gray-500 mb-4">Add contacts manually or upload a CSV file</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-6 border-t">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ContactForm = ({ contact, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    email: contact?.email || '',
    company: contact?.company || '',
    title: contact?.title || '',
    status: contact?.status || 'active'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">{contact ? 'Edit Contact' : 'Add New Contact'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            className="input-field"
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            className="input-field"
          />
        </div>
        <input
          type="email"
          placeholder="Email Address"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="input-field"
          disabled={!!contact}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Company"
            value={formData.company}
            onChange={(e) => setFormData({...formData, company: e.target.value})}
            className="input-field"
          />
          <input
            type="text"
            placeholder="Job Title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value})}
            className="input-field"
          >
            <option value="active">Active</option>
            <option value="suppressed">Suppressed</option>
            <option value="bounced">Bounced</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="replied">Replied</option>
          </select>
        </div>
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? (contact ? 'Updating...' : 'Adding...') : (contact ? 'Update Contact' : 'Add Contact')}
          </button>
        </div>
      </form>
    </div>
  );
};

const UploadCSVForm = ({ onSubmit, onCancel, loading }) => {
  const [file, setFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) return;
    
    const formData = new FormData();
    formData.append('csv', file);
    onSubmit(formData);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Upload CSV File</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
            className="input-field"
            required
          />
          <p className="text-sm text-gray-500 mt-2">
            CSV should have columns: email, firstName, lastName, company, title
          </p>
        </div>
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading || !file} className="btn-primary disabled:opacity-50">
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Contacts;