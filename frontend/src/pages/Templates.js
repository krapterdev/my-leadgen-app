import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { templateAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';

const Templates = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const queryClient = useQueryClient();

  const { data: templatesResponse, isLoading } = useQuery('templates', templateAPI.getAll);
  const templates = templatesResponse?.data?.data || [];

  const createMutation = useMutation(templateAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('templates');
      setShowForm(false);
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create template');
    }
  });

  const updateMutation = useMutation(
    ({ id, data }) => templateAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('templates');
        setEditingTemplate(null);
        setShowForm(false);
        toast.success('Template updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update template');
      }
    }
  );

  const deleteMutation = useMutation(templateAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('templates');
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete template');
    }
  });

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowForm(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-600">Create and manage reusable email templates</p>
        </div>
        <button
          onClick={handleCreate}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </button>
      </div>

      {showForm && (
        <TemplateForm
          template={editingTemplate}
          onSubmit={(data) => {
            if (editingTemplate) {
              updateMutation.mutate({ id: editingTemplate._id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingTemplate(null);
          }}
          loading={createMutation.isLoading || updateMutation.isLoading}
        />
      )}

      <div className="grid gap-4">
        {templates.map((template) => (
          <div key={template._id} className="card">
            <div className="flex justify-between items-start">
              <div className="flex items-start">
                <FileText className="h-8 w-8 text-gray-400 mr-4 mt-1" />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{template.subject}</p>
                  <div className="text-xs text-gray-500">
                    Category: {template.category} • Created: {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 text-sm text-gray-700 line-clamp-2">
                    {template.body.substring(0, 150)}...
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(template._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
          <p className="text-gray-500 mb-4">Create your first email template</p>
          <button onClick={handleCreate} className="btn-primary">
            Create Template
          </button>
        </div>
      )}
    </div>
  );
};

const TemplateForm = ({ template, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    body: template?.body || '',
    category: template?.category || 'general'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">
        {template ? 'Edit Template' : 'Create New Template'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="Welcome Email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input-field"
            >
              <option value="general">General</option>
              <option value="welcome">Welcome</option>
              <option value="follow-up">Follow-up</option>
              <option value="promotional">Promotional</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Line
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="input-field"
            placeholder="Welcome to our platform!"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Body
          </label>
          <textarea
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            className="input-field h-64"
            placeholder="Hi {firstName},\n\nWelcome to our platform!\n\nBest regards,\nTeam"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {'{'}variableName{'}'} for dynamic content (e.g., {'{'}firstName{'}'}, {'{'}company{'}'})
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Templates;