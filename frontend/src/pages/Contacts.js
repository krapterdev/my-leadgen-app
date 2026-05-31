import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { contactAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Upload, Users, Search, Edit2, Trash2, Sparkles } from 'lucide-react';

const Contacts = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showScraper, setShowScraper] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [search, setSearch] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [page, setPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const queryClient = useQueryClient();

  const { data: contactsData, isLoading } = useQuery(
    ['contacts', { page, search, businessType, location }],
    () => contactAPI.getAll({ page, search, businessType, location, limit: 20 }),
    { keepPreviousData: true }
  );

  // Clear selections when filter or pagination changes
  useEffect(() => {
    setSelectedContacts([]);
  }, [page, search, businessType, location]);

  const scrapeMutation = useMutation(contactAPI.scrape, {
    onSuccess: () => {
      setShowScraper(false);
      toast.success('Scraper task successfully queued in the background! Leads will populate shortly.');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to trigger scraper');
    }
  });

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

  const bulkDeleteMutation = useMutation(
    (ids) => contactAPI.bulkDelete(ids),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('contacts');
        setSelectedContacts([]);
        toast.success(res.data?.message || 'Selected contacts deleted successfully');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete selected contacts');
      }
    }
  );

  const cleanTrashMutation = useMutation(contactAPI.cleanTrash, {
    onSuccess: (res) => {
      queryClient.invalidateQueries('contacts');
      toast.success(res.data?.message || 'Database clean successfully finished');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to clean database');
    }
  });

  const handleCleanTrash = () => {
    if (window.confirm('Are you sure you want to clean up the database? This will permanently delete empty leads that do not have active phone and website contacts.')) {
      cleanTrashMutation.mutate();
    }
  };

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

  const handleSelectContact = (id) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const displayedIds = contacts.map(c => c._id);
    const allSelected = displayedIds.every(id => selectedContacts.includes(id));
    if (allSelected) {
      setSelectedContacts(prev => prev.filter(id => !displayedIds.includes(id)));
    } else {
      setSelectedContacts(prev => {
        const newSelection = [...prev];
        displayedIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const downloadCSV = (dataList, filename = 'leads-export.csv') => {
    if (!dataList || dataList.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Company Name',
      'Email',
      'First Name',
      'Last Name',
      'Title',
      'Status',
      'Website',
      'Phone',
      'Rating',
      'Reviews Count',
      'GMB Address',
      'Tech Stack',
      'Outreach Hook',
      'Personalized Pitch'
    ];

    const rows = dataList.map(contact => {
      // customFields maps are retrieved as standard objects on the client
      const cf = contact.customFields || {};
      return [
        contact.company || '',
        contact.email || '',
        contact.firstName || '',
        contact.lastName || '',
        contact.title || '',
        contact.status || '',
        cf.website || '',
        cf.phone || '',
        cf.rating || '',
        cf.reviewsCount || '',
        cf.address || '',
        cf.techStack || '',
        cf.outreachHook || '',
        cf.personalizedPitch || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const cleaned = String(val).replace(/"/g, '""');
        return `"${cleaned}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = async () => {
    try {
      toast.loading('Fetching all filtered contacts for export...', { id: 'csv-export' });
      const response = await contactAPI.getAll({ 
        search, 
        businessType, 
        location, 
        limit: 10000 
      });
      const allFiltered = response?.data?.contacts || [];
      toast.success(`Exporting ${allFiltered.length} contacts to CSV`, { id: 'csv-export' });
      downloadCSV(allFiltered, 'all-filtered-leads.csv');
    } catch (err) {
      toast.error('Failed to export contacts: ' + err.message, { id: 'csv-export' });
    }
  };

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
            onClick={() => setShowScraper(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded flex items-center shadow transition-colors"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Launch Scraper
          </button>
          <button
            onClick={handleExportAll}
            className="btn-secondary flex items-center"
          >
            <Upload className="h-4 w-4 mr-2 rotate-180" />
            Export CSV
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="btn-secondary flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </button>
          <button
            onClick={handleCleanTrash}
            disabled={cleanTrashMutation.isLoading}
            className="btn-secondary text-red-600 hover:text-red-700 flex items-center border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clean Trash Leads
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

      {/* Filters and Search Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10"
          />
        </div>

        <div>
          <select
            value={businessType}
            onChange={(e) => { setBusinessType(e.target.value); setPage(1); }}
            className="input-field"
          >
            <option value="">All Company Ages (Startup/Established)</option>
            <option value="STARTUP">Startup (&lt; 3 years old)</option>
            <option value="ESTABLISHED">Established (&gt;= 3 years old)</option>
            <option value="UNKNOWN">Unknown Age</option>
          </select>
        </div>

        <div>
          <input
            type="text"
            placeholder="Filter by Location (e.g. Noida, Delhi)..."
            value={location}
            onChange={(e) => { setLocation(e.target.value); setPage(1); }}
            className="input-field"
          />
        </div>
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

      {/* Launch Scraper Form */}
      {showScraper && (
        <ScraperForm
          onSubmit={scrapeMutation.mutate}
          onCancel={() => setShowScraper(false)}
          loading={scrapeMutation.isLoading}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && contacts.every(c => selectedContacts.includes(c._id))}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Age & Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location / Details
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
                  <tr 
                    key={contact._id}
                    className={selectedContacts.includes(contact._id) ? 'bg-indigo-50/30' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap w-10">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact._id)}
                        onChange={() => handleSelectContact(contact._id)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
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
                      <div className="flex flex-col space-y-1 items-start">
                        {contact.customFields?.businessType && (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            contact.customFields.businessType === 'STARTUP' ? 'bg-indigo-100 text-indigo-800' :
                            contact.customFields.businessType === 'ESTABLISHED' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {contact.customFields.businessType}
                          </span>
                        )}
                        {contact.customFields?.hiringIntent === 'YES' && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800" title={`Hiring Intent Score: ${contact.customFields.hiringIntentScore || 0}`}>
                            Hiring
                          </span>
                        )}
                        {contact.customFields?.domainAgeDays && contact.customFields.domainAgeDays !== '-1' && (
                          <div className="text-xs text-gray-500">
                            {contact.customFields.domainAgeDays} days old
                          </div>
                        )}
                        {!contact.customFields?.businessType && !contact.customFields?.hiringIntent && (
                          <span className="text-xs text-gray-400">Not Analyzed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-normal max-w-xs text-sm text-gray-900">
                      <div className="text-sm text-gray-900 truncate max-w-xs" title={contact.customFields?.address}>
                        {contact.customFields?.address || '-'}
                      </div>
                      {contact.customFields?.website && (
                        <a 
                          href={contact.customFields.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline block mt-0.5"
                        >
                          {contact.customFields.website}
                        </a>
                      )}
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

      {/* Bulk Action Bar */}
      {selectedContacts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-xl px-6 py-4 flex items-center justify-between space-x-6 z-50 animate-fade-in ring-2 ring-indigo-500 ring-opacity-50">
          <div className="flex items-center space-x-2 text-sm text-gray-700 font-medium">
            <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-1 rounded-full font-bold">
              {selectedContacts.length}
            </span>
            <span>contacts selected</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const selectedList = contacts.filter(c => selectedContacts.includes(c._id));
                downloadCSV(selectedList, 'selected-leads.csv');
              }}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-1.5 px-3 rounded flex items-center text-xs transition-colors"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5 rotate-180 text-indigo-600" />
              Export Selected
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete the ${selectedContacts.length} selected contacts?`)) {
                  bulkDeleteMutation.mutate(selectedContacts);
                }
              }}
              disabled={bulkDeleteMutation.isLoading}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-1.5 px-3 rounded flex items-center text-xs transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-500" />
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedContacts([])}
              className="text-gray-400 hover:text-gray-600 text-xs font-semibold py-1.5 px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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

const ScraperForm = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    query: '',
    maxResults: 20,
    useProxy: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.query) return;
    onSubmit(formData);
  };

  return (
    <div className="card border-2 border-indigo-100 bg-indigo-50/10 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-indigo-900 flex items-center">
          <Sparkles className="h-5 w-5 mr-2 text-indigo-600 animate-pulse" />
          Google Maps (GMB) Lead Scraper Engine
        </h2>
        <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded shadow-sm">
          Celery Backend Queue
        </span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Query</label>
            <input
              type="text"
              placeholder="e.g. Web Development Companies in Noida"
              value={formData.query}
              onChange={(e) => setFormData({...formData, query: e.target.value})}
              className="input-field border-indigo-200 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.maxResults}
              onChange={(e) => setFormData({...formData, maxResults: parseInt(e.target.value) || 20})}
              className="input-field border-indigo-200 focus:border-indigo-500"
              required
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="useProxy"
            checked={formData.useProxy}
            onChange={(e) => setFormData({...formData, useProxy: e.target.checked})}
            className="h-4 w-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="useProxy" className="text-sm font-medium text-gray-700 select-none">
            Rotate Free Residential Proxies (Avoid GMB blocks, slightly slower)
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading || !formData.query} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded shadow disabled:opacity-50 flex items-center transition-colors"
          >
            {loading ? 'Queueing Scraper...' : 'Launch Scraper Job'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Contacts;