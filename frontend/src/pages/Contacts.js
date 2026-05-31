import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { contactAPI, analyticsAPI } from '../utils/api';
import toast from 'react-hot-toast';

// Reusable modal overlay component using CSS variables for theme flexibility
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      {/* Dialog Frame */}
      <div className="relative bg-surface-container border border-outline-variant rounded-xl shadow-2xl max-w-xl w-full overflow-hidden animate-slide-in text-on-surface z-10 scanline">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-high flex items-center justify-between">
          <h3 className="font-semibold text-primary uppercase tracking-wider text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            {title}
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface active:scale-95 transition-all flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const Contacts = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showScraper, setShowScraper] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [search, setSearch] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const queryClient = useQueryClient();

  // Active Scraper States
  const [currentBatchId, setCurrentBatchId] = useState('');
  const [scrapingProgress, setScrapingProgress] = useState(null);
  const [scrapedLeadsList, setScrapedLeadsList] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [timelineContact, setTimelineContact] = useState(null);

  // Terminal scroll container ref
  const terminalRef = useRef(null);

  // System Diagnostics logs when idle
  const [idleLogs, setIdleLogs] = useState([
    { text: '# systemctl status hacker-scraper.service', type: 'command' },
    { text: '[OK] LeadGen Scraper worker pool online.', type: 'success' },
    { text: '[OK] Proxy rotation cluster active: 15 proxy nodes online.', type: 'success' }
  ]);

  // Fetch Dashboard analytics overview for stats ribbon
  const { data: analytics } = useQuery('dashboard', analyticsAPI.getDashboard);
  const stats = analytics?.data?.overview || {};

  // Fetch absolute total contacts count in system
  const { data: totalContactsData } = useQuery(
    'total-contacts-count',
    () => contactAPI.getAll({ limit: 1 })
  );
  const totalScraped = totalContactsData?.data?.total || 0;

  const { data: batchesResponse } = useQuery('batches', contactAPI.getBatches);
  const batches = React.useMemo(() => batchesResponse?.data?.data || [], [batchesResponse]);

  // Auto-scroll terminal logs to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs, idleLogs, scrapingProgress]);

  // Sync total leads to idle terminal log
  useEffect(() => {
    setIdleLogs(prev => {
      const clean = prev.filter(p => !p.text.includes('Leads Database status'));
      return [
        ...clean,
        { text: `[INFO] Leads Database status: ${totalScraped} entries indexed.`, type: 'info' }
      ];
    });
  }, [totalScraped]);

  // Auto-detect running scraper batch on load or when batches query finishes
  useEffect(() => {
    const runningBatch = batches.find(b => b.status === 'running' || b.status === 'paused');
    if (runningBatch) {
      setCurrentBatchId(runningBatch._id);
      if (!scrapingProgress) {
        setScrapingProgress({
          batchId: runningBatch._id,
          query: runningBatch.query,
          location: runningBatch.location,
          progress: runningBatch.count,
          total: runningBatch.maxResults || 20,
          status: runningBatch.status.toUpperCase(),
          message: runningBatch.status === 'paused' ? 'Scraper paused' : 'Scraper running...'
        });
      }
    }
  }, [batches, scrapingProgress]);

  // Simulate active background worker check heartbeats when idle
  useEffect(() => {
    if (scrapingProgress) return;

    const interval = setInterval(() => {
      const checkType = Math.floor(Math.random() * 4);
      let newLog = '';
      if (checkType === 0) {
        newLog = `[OK] Celery worker heartbeat: latency ${Math.floor(Math.random() * 30 + 10)}ms`;
      } else if (checkType === 1) {
        newLog = `[OK] Redis proxy-cluster cache online. Memory: ${(Math.random() * 1.5 + 1.2).toFixed(2)}MB`;
      } else if (checkType === 2) {
        newLog = `[OK] Database health: MongoDB connected. Connections active.`;
      } else {
        newLog = `[INFO] Active listener: monitoring SSE event channel...`;
      }

      setIdleLogs(prev => {
        const next = [...prev, { text: newLog, type: 'info' }];
        if (next.length > 20) next.shift();
        return next;
      });
    }, 7000);

    return () => clearInterval(interval);
  }, [scrapingProgress]);

  // SSE Scraper progress updates & terminal log streaming
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const eventSource = new EventSource(`${apiUrl}/realtime/events?token=${encodeURIComponent(token)}`);

    // Scraper status webhook progress events
    eventSource.addEventListener('scraper-progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE Scraper Progress:', data);
        setScrapingProgress(data);
        if (data.batchId) {
          setCurrentBatchId(data.batchId);
        }

        if (data.message) {
          setTerminalLogs(prev => {
            const isDup = prev.length > 0 && prev[prev.length - 1].text === data.message;
            if (isDup) return prev;
            
            const next = [...prev, {
              text: data.message,
              status: data.status,
              timestamp: new Date().toLocaleTimeString(),
              type: 'progress'
            }];
            if (next.length > 80) next.shift();
            return next;
          });
        }

        if (data.company && data.status === 'PROGRESS') {
          setScrapedLeadsList(prev => {
            const exists = prev.some(c => c.name === data.company.name || (c.website && c.website === data.company.website));
            if (!exists) {
              return [data.company, ...prev];
            }
            return prev;
          });
          queryClient.invalidateQueries('contacts');
          queryClient.invalidateQueries('total-contacts-count');
        }

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          queryClient.invalidateQueries('contacts');
          queryClient.invalidateQueries('total-contacts-count');
          queryClient.invalidateQueries('batches');
        }
      } catch (err) {
        console.error('Error parsing scraper progress:', err);
      }
    });

    // Celery stdout/stderr terminal log streaming events
    eventSource.addEventListener('celery-log', (event) => {
      try {
        const data = JSON.parse(event.data);
        setTerminalLogs(prev => {
          const next = [...prev, {
            text: data.text,
            type: data.type === 'stderr' ? 'error' : 'stdout',
            timestamp: data.timestamp || new Date().toLocaleTimeString()
          }];
          if (next.length > 100) next.shift();
          return next;
        });
      } catch (err) {
        console.error('Error parsing celery log:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.error('SSE Scraper error:', err);
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  const { data: contactsData, isLoading } = useQuery(
    ['contacts', { page, search, businessType, location, batchId: selectedBatchId }],
    () => contactAPI.getAll({ page, search, businessType, location, batchId: selectedBatchId, limit: 20 }),
    { keepPreviousData: true }
  );

  // Clear selections when filter or pagination changes
  useEffect(() => {
    setSelectedContacts([]);
  }, [page, search, businessType, location, selectedBatchId]);

  // Scraper Control API triggers
  const handlePauseScraper = async () => {
    const batchId = currentBatchId || scrapingProgress?.batchId;
    console.log('handlePauseScraper batchId:', batchId);
    if (!batchId) {
      toast.error('No active batch ID found to pause.');
      return;
    }
    try {
      await contactAPI.pauseScrape(batchId);
      toast.success('Scraper paused');
      setScrapingProgress(prev => prev ? { ...prev, status: 'PAUSED' } : null);
      queryClient.invalidateQueries('batches');
    } catch (err) {
      toast.error('Failed to pause scraper: ' + err.message);
    }
  };

  const handleResumeScraper = async () => {
    const batchId = currentBatchId || scrapingProgress?.batchId;
    console.log('handleResumeScraper batchId:', batchId);
    if (!batchId) {
      toast.error('No active batch ID found to resume.');
      return;
    }
    try {
      await contactAPI.resumeScrape(batchId);
      toast.success('Scraper resumed');
      setScrapingProgress(prev => prev ? { ...prev, status: 'RUNNING' } : null);
      queryClient.invalidateQueries('batches');
    } catch (err) {
      toast.error('Failed to resume scraper: ' + err.message);
    }
  };

  const handleKillScraper = async () => {
    const batchId = currentBatchId || scrapingProgress?.batchId;
    console.log('handleKillScraper batchId:', batchId);
    if (!batchId) {
      toast.error('No active batch ID found to stop.');
      return;
    }
    if (!window.confirm('Are you sure you want to terminate this scraper job? Details collected so far will be saved.')) return;
    try {
      await contactAPI.killScrape(batchId);
      toast.success('Scraper job terminated');
      setScrapingProgress(null);
      setCurrentBatchId('');
      queryClient.invalidateQueries('batches');
      queryClient.invalidateQueries('contacts');
    } catch (err) {
      toast.error('Failed to stop scraper: ' + err.message);
    }
  };

  const handleRestartScraper = async (batchId) => {
    if (!batchId) return;
    try {
      const res = await contactAPI.restartScrape(batchId);
      toast.success('Scraper job restarted successfully!');
      setCurrentBatchId(res.data.batchId);
      setTerminalLogs([]);
      setScrapedLeadsList([]);
      setScrapingProgress({
        batchId: res.data.batchId,
        query: 'Restarting...',
        location: '',
        progress: 0,
        total: 20,
        status: 'INITIALIZING',
        message: 'Initializing re-run...'
      });
      queryClient.invalidateQueries('batches');
    } catch (err) {
      toast.error('Failed to restart scraper: ' + err.message);
    }
  };

  const scrapeMutation = useMutation(contactAPI.scrape, {
    onSuccess: (res) => {
      setShowScraper(false);
      setTerminalLogs([]);
      setScrapedLeadsList([]);
      setCurrentBatchId(res.data.batchId);
      setScrapingProgress({
        batchId: res.data.batchId,
        query: 'Queuing...',
        location: '',
        progress: 0,
        total: 20,
        status: 'INITIALIZING',
        message: 'Launching GMB Scraper Bot...'
      });
      queryClient.invalidateQueries('batches');
      toast.success('Scraper task successfully queued! logs streaming below.');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to trigger scraper');
    }
  });

  const createMutation = useMutation(contactAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('contacts');
      queryClient.invalidateQueries('total-contacts-count');
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
      queryClient.invalidateQueries('total-contacts-count');
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
        queryClient.invalidateQueries('total-contacts-count');
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
      queryClient.invalidateQueries('total-contacts-count');
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
      queryClient.invalidateQueries('total-contacts-count');
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

  // Custom technology badge renderer
  const renderTechStack = (techStr) => {
    if (!techStr) return <span className="text-on-surface-variant opacity-40">-</span>;
    const techs = techStr.split(',').map(t => t.trim()).filter(Boolean);
    if (techs.length === 0) return <span className="text-on-surface-variant opacity-40">-</span>;

    return (
      <div className="flex flex-wrap gap-1">
        {techs.slice(0, 3).map((tech, i) => {
          const lower = tech.toLowerCase();
          let colorClass = 'bg-surface-container-high text-on-surface';
          if (lower.includes('react')) colorClass = 'bg-blue-950/40 text-blue-400 border border-blue-900/50';
          else if (lower.includes('node') || lower.includes('js') || lower.includes('javascript')) colorClass = 'bg-green-950/40 text-green-400 border border-green-900/50';
          else if (lower.includes('python')) colorClass = 'bg-yellow-950/40 text-yellow-400 border border-yellow-900/50';
          else if (lower.includes('php') || lower.includes('laravel')) colorClass = 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/50';
          else if (lower.includes('mongo') || lower.includes('sql') || lower.includes('database')) colorClass = 'bg-purple-950/40 text-purple-400 border border-purple-900/50';
          else if (lower.includes('shopify') || lower.includes('wordpress')) colorClass = 'bg-rose-950/40 text-rose-400 border border-rose-900/50';

          return (
            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${colorClass}`}>
              {tech}
            </span>
          );
        })}
        {techs.length > 3 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
            +{techs.length - 3}
          </span>
        )}
      </div>
    );
  };

  if (isLoading && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-sm text-on-surface-variant font-mono uppercase tracking-widest animate-pulse">Initializing Interface...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none lg:px-4">
      {/* Top Header Command Ribbon */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container border border-outline-variant p-6 rounded-xl relative overflow-hidden scanline shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-[28px] animate-pulse">terminal</span>
            LEADS DATABASE COMMAND CENTER
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage scraped contacts, trigger scraper bots, and track outreach status</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowScraper(true)}
            className="flex-1 md:flex-initial bg-primary text-black hover:brightness-110 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center shadow-lg active:scale-95 transition-all cta-glow"
          >
            <span className="material-symbols-outlined text-[18px] mr-2">add</span>
            LAUNCH SCRAPER
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex-1 md:flex-initial btn-secondary flex items-center justify-center py-2.5"
          >
            <span className="material-symbols-outlined text-[18px] mr-2">person_add</span>
            Add Contact
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex-1 md:flex-initial btn-secondary flex items-center justify-center py-2.5"
          >
            <span className="material-symbols-outlined text-[18px] mr-2">upload_file</span>
            Upload CSV
          </button>
          <button
            onClick={handleExportAll}
            className="flex-1 md:flex-initial btn-secondary flex items-center justify-center py-2.5"
          >
            <span className="material-symbols-outlined text-[18px] mr-2">download_for_offline</span>
            Export Filtered
          </button>
          <button
            onClick={handleCleanTrash}
            disabled={cleanTrashMutation.isLoading}
            className="flex-1 md:flex-initial btn-secondary text-red-400 hover:text-red-300 border-red-900/50 bg-red-950/10 flex items-center justify-center py-2.5 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] mr-2">cleaning_services</span>
            Clean Trash
          </button>
        </div>
      </div>

      {/* Analytics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Scraped */}
        <div className="bg-surface-container-low border border-outline-variant p-5 rounded-xl flex items-center justify-between group hover:border-primary/50 transition-colors shadow-sm">
          <div>
            <p className="text-xs text-on-surface-variant mb-1 uppercase font-semibold tracking-wider flex items-center gap-1.5">
              Total Scraped Leads
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            </p>
            <h3 className="text-3xl font-bold text-on-surface">{totalScraped}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[26px]">data_exploration</span>
          </div>
        </div>

        {/* Emails Sent */}
        <div className="bg-surface-container-low border border-outline-variant p-5 rounded-xl flex items-center justify-between group hover:border-primary/50 transition-colors shadow-sm">
          <div>
            <p className="text-xs text-on-surface-variant mb-1 uppercase font-semibold tracking-wider">Emails Sent</p>
            <h3 className="text-3xl font-bold text-on-surface">{stats.totalSent || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[26px]">send</span>
          </div>
        </div>

        {/* Open Rate */}
        <div className="bg-surface-container-low border border-outline-variant p-5 rounded-xl flex items-center justify-between group hover:border-primary/50 transition-colors shadow-sm">
          <div>
            <p className="text-xs text-on-surface-variant mb-1 uppercase font-semibold tracking-wider flex items-center gap-1.5">
              Open Rate
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            </p>
            <h3 className="text-3xl font-bold text-primary">{(stats.openRate || 0).toFixed(1)}%</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
          </div>
        </div>

        {/* Follow-ups */}
        <div className="bg-surface-container-low border border-outline-variant p-5 rounded-xl flex items-center justify-between group hover:border-primary/50 transition-colors shadow-sm">
          <div>
            <p className="text-xs text-on-surface-variant mb-1 uppercase font-semibold tracking-wider">Replies Received</p>
            <h3 className="text-3xl font-bold text-on-surface">{stats.totalReplied || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[26px]">history</span>
          </div>
        </div>
      </div>

      {/* Live Scraper Terminal & Realtime Preview Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Live Scraper Terminal Monitor (2 cols on xl screens) */}
        <div className="xl:col-span-2 flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-2xl relative scanline h-80">
          {/* Terminal Window Header / Controls */}
          <div className="p-3 bg-surface-container-high border-b border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Left: Window Controls & Title */}
            <div className="flex items-center gap-3">
              {/* macOS styled window buttons */}
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/90 shadow-[0_0_6px_rgba(239,68,68,0.5)]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/90 shadow-[0_0_6px_rgba(234,179,8,0.5)]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-primary/90 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
              </div>
              <div className="h-4 w-px bg-outline-variant"></div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">terminal</span>
                <span className="font-semibold text-xs text-on-surface uppercase tracking-wider font-mono">CELERY LOG STREAM</span>
              </div>
              {scrapingProgress && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  scrapingProgress.status === 'PAUSED' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' :
                  scrapingProgress.status === 'COMPLETED' ? 'bg-green-950/40 text-green-400 border border-green-800/40' :
                  'bg-primary/20 text-primary border border-primary/30 animate-pulse'
                }`}>
                  {scrapingProgress.status}
                </span>
              )}
            </div>

            {/* Right: Telemetries & Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Active Broker Badge */}
              <div className="hidden md:flex items-center gap-1.5 bg-black/45 border border-outline-variant/30 px-2 py-0.5 rounded text-[9px] font-mono text-on-surface-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span>Broker: Redis</span>
              </div>

              {/* Scraper controls */}
              <div className="flex items-center gap-1 bg-black/45 border border-outline-variant/30 p-1 rounded-lg">
                {/* Pause Button */}
                <button
                  onClick={handlePauseScraper}
                  disabled={!scrapingProgress || !['RUNNING', 'SEARCHING', 'PROGRESS', 'INITIALIZING', 'STARTED'].includes(scrapingProgress.status.toUpperCase())}
                  className="quick-action-btn w-7 h-7 rounded bg-surface-container/30 border border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-amber-500 hover:border-amber-500/50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant/40 transition-all"
                  title="Pause Scraper"
                >
                  <span className="material-symbols-outlined text-[16px]">pause</span>
                </button>

                {/* Resume Button */}
                <button
                  onClick={handleResumeScraper}
                  disabled={!scrapingProgress || scrapingProgress.status.toUpperCase() !== 'PAUSED'}
                  className="quick-action-btn w-7 h-7 rounded bg-surface-container/30 border border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-green-400 hover:border-green-400/50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant/40 transition-all"
                  title="Resume Scraper"
                >
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                </button>

                {/* Stop / Kill Button */}
                <button
                  onClick={handleKillScraper}
                  disabled={!scrapingProgress || !['RUNNING', 'SEARCHING', 'PROGRESS', 'INITIALIZING', 'PAUSED', 'STARTED'].includes(scrapingProgress.status.toUpperCase())}
                  className="quick-action-btn w-7 h-7 rounded bg-surface-container/30 border border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-red-400 hover:border-red-400/50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant/40 transition-all"
                  title="Kill Scraper Task"
                >
                  <span className="material-symbols-outlined text-[16px]">stop</span>
                </button>

                {/* Restart Button */}
                <button
                  onClick={() => {
                    const targetId = selectedBatchId || currentBatchId || (batches.length > 0 ? batches[0]._id : null);
                    handleRestartScraper(targetId);
                  }}
                  disabled={!selectedBatchId && !currentBatchId && batches.length === 0}
                  className="quick-action-btn w-7 h-7 rounded bg-surface-container/30 border border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant/40 transition-all"
                  title={
                    selectedBatchId ? "Restart Selected Batch" :
                    currentBatchId ? "Restart Current Batch" :
                    batches.length > 0 ? `Restart Last Batch ("${batches[0].query}")` : "No Batch to Restart"
                  }
                >
                  <span className="material-symbols-outlined text-[16px]">replay</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Scraping Progress Overlay Banner */}
          {scrapingProgress && ['RUNNING', 'SEARCHING', 'PROGRESS', 'INITIALIZING', 'PAUSED', 'STARTED'].includes(scrapingProgress.status.toUpperCase()) && (
            <div className="px-4 py-2.5 bg-surface-container/80 border-b border-outline-variant/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-on-surface select-all">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span>Job: <strong className="text-primary">{scrapingProgress.query}</strong> {scrapingProgress.location ? `in ${scrapingProgress.location}` : ''}</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:w-36 bg-black/40 border border-outline-variant/20 h-2 rounded-full overflow-hidden p-[1px]">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-300 shadow-[0_0_8px_var(--color-primary)]"
                    style={{ width: `${Math.min(100, (scrapingProgress.progress / (scrapingProgress.total || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-on-surface-variant text-[10px] whitespace-nowrap min-w-[70px] text-right font-bold">
                  {scrapingProgress.progress}/{scrapingProgress.total} ({Math.round((scrapingProgress.progress / (scrapingProgress.total || 1)) * 100)}%)
                </span>
              </div>
            </div>
          )}

          {/* Scrollable logs */}
          <div ref={terminalRef} className="flex-1 p-4 font-mono text-[11px] terminal-scroll overflow-y-auto space-y-1 text-primary bg-black/95">
            <p className="text-on-surface-variant opacity-60"># tail -f /var/log/hacker-scraper.log</p>
            
            {terminalLogs.length > 0 ? (
              terminalLogs.map((log, i) => (
                <p key={i} className={
                  log.type === 'error' || log.status === 'FAILED' ? 'text-red-400 font-semibold' :
                  log.type === 'stdout' && log.text.includes('[Celery Err]') ? 'text-yellow-500/90' :
                  log.status === 'COMPLETED' ? 'text-green-400 font-semibold' :
                  log.status === 'DUPLICATE_SKIP' ? 'text-blue-400/80' :
                  'text-primary/90'
                }>
                  <span className="text-on-surface-variant opacity-45 mr-2">[{log.timestamp}]</span>
                  {log.text}
                </p>
              ))
            ) : (
              <>
                <p className="text-on-surface-variant opacity-60">[OK] Celery worker heartbeat: listening for jobs...</p>
                <p className="text-on-surface-variant opacity-60">[OK] Redis connection active.</p>
              </>
            )}
            <p className="text-primary flickering-cursor" id="typing-line"></p>
          </div>
        </div>

        {/* Right Column: Real-time Scraped Leads Preview Feed */}
        <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-2xl relative scanline h-80">
          {/* Header */}
          <div className="p-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_var(--color-primary)]"></span>
              <span className="font-semibold text-xs text-on-surface uppercase tracking-wider font-mono">LIVE RESULTS PREVIEW</span>
            </div>
            {scrapedLeadsList.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono font-bold">
                {scrapedLeadsList.length} Scraped
              </span>
            )}
          </div>

          {/* Scraped items scrolling container */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-black/95 terminal-scroll">
            {scrapedLeadsList.length > 0 ? (
              scrapedLeadsList.map((lead, i) => (
                <div key={i} className="p-2 border border-outline-variant/20 bg-surface-container/5 rounded font-mono text-[10px] space-y-1 hover:border-primary/30 transition-all duration-150 animate-slide-in">
                  <div className="flex justify-between items-start">
                    <span className="text-primary font-bold truncate max-w-[170px]" title={lead.name || lead.company}>
                      {lead.name || lead.company || 'Unnamed Lead'}
                    </span>
                    {lead.rating && (
                      <span className="text-yellow-500 font-bold flex items-center gap-0.5">
                        ⭐{lead.rating}
                      </span>
                    )}
                  </div>
                  {lead.website && (
                    <p className="text-on-surface-variant truncate">
                      <span className="text-primary/70">Web:</span>{' '}
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        {lead.website}
                      </a>
                    </p>
                  )}
                  {lead.phone && (
                    <p className="text-on-surface-variant">
                      <span className="text-primary/70">Phone:</span> {lead.phone}
                    </p>
                  )}
                  {lead.address && (
                    <p className="text-on-surface-variant truncate" title={lead.address}>
                      <span className="text-primary/70">Loc:</span> {lead.address}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-variant/40 space-y-2 font-mono">
                <span className="material-symbols-outlined text-[32px] animate-pulse">radar</span>
                <p className="text-[10px] uppercase tracking-wider">Awaiting active scrape results...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leads Management Card */}
      <div className="flex flex-col bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        
        {/* Table Control Panel */}
        <div className="p-4 border-b border-outline-variant bg-surface-container/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[20px]">database</span>
            <h4 className="font-semibold text-on-surface uppercase text-sm font-mono tracking-tight">Leads Management</h4>
            <div className="h-4 w-px bg-outline-variant hidden sm:block"></div>
            {selectedBatchId && (
              <span className="bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                Batch Filter Active 
                <button onClick={() => setSelectedBatchId('')} className="hover:text-red-400 flex items-center">
                  <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                </button>
              </span>
            )}
          </div>
          
          <div className="text-xs text-on-surface-variant font-medium bg-surface-container-high px-3 py-1 rounded-full border border-outline-variant">
            Showing {contacts.length} of {contactsData?.data?.total || 0} leads
          </div>
        </div>

        {/* Filters Grid */}
        <div className="p-4 bg-surface-container/10 border-b border-outline-variant grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search leads, domains..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-9 py-1.5 text-xs font-medium"
            />
          </div>

          {/* Batch Dropdown */}
          <div>
            <select
              value={selectedBatchId}
              onChange={(e) => { setSelectedBatchId(e.target.value); setPage(1); }}
              className="input-field py-1.5 text-xs bg-surface-container text-on-surface font-medium"
            >
              <option value="">All Scraper Batches</option>
              {batches.map((batch) => (
                <option key={batch._id} value={batch._id}>
                  {batch.query} [{batch.location}] ({batch.count} leads)
                </option>
              ))}
            </select>
          </div>

          {/* Company Age Category */}
          <div>
            <select
              value={businessType}
              onChange={(e) => { setBusinessType(e.target.value); setPage(1); }}
              className="input-field py-1.5 text-xs bg-surface-container text-on-surface font-medium"
            >
              <option value="">All Company Ages</option>
              <option value="STARTUP">Startup (&lt; 3 yrs)</option>
              <option value="ESTABLISHED">Established (&gt;= 3 yrs)</option>
              <option value="UNKNOWN">Unknown Age</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <input
              type="text"
              placeholder="Filter by Location (e.g. Noida)..."
              value={location}
              onChange={(e) => { setLocation(e.target.value); setPage(1); }}
              className="input-field py-1.5 text-xs font-medium"
            />
          </div>
        </div>

        {/* Table Component */}
        <div className="overflow-x-auto min-h-[420px]">
          {contacts.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container-high z-10">
                <tr className="border-b border-outline-variant">
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && contacts.every(c => selectedContacts.includes(c._id))}
                      onChange={handleSelectAll}
                      className="h-3.5 w-3.5 text-primary border-outline-variant bg-surface-container rounded focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Lead / Company</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tech Stack</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-center">Age & Ratings</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Outreach Hook</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {contacts.map((contact) => {
                  const isSelected = selectedContacts.includes(contact._id);
                  return (
                    <tr 
                      key={contact._id} 
                      className={`hover:bg-primary/5 transition-all duration-150 group cursor-pointer ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectContact(contact._id)}
                          className="h-3.5 w-3.5 text-primary border-outline-variant bg-surface-container rounded focus:ring-primary cursor-pointer"
                        />
                      </td>

                      {/* Name & Company */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center font-bold text-primary border border-outline-variant text-sm uppercase">
                            {(contact.company || contact.firstName || 'N')[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-on-surface text-sm flex items-center gap-1.5 flex-wrap">
                              {contact.company || 'Unnamed Company'}
                              {contact.customFields?.businessType && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  contact.customFields.businessType === 'STARTUP' 
                                    ? 'bg-primary-container text-on-primary-container' 
                                    : 'bg-surface-variant text-on-surface-variant border border-outline-variant'
                                }`}>
                                  {contact.customFields.businessType === 'STARTUP' ? 'Startup' : 'Established'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                              {contact.firstName} {contact.lastName} &middot; <span className="opacity-70 select-all">{contact.email}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tech Stack */}
                      <td className="px-4 py-3">
                        {renderTechStack(contact.customFields?.techStack)}
                      </td>

                      {/* Age & Ratings */}
                      <td className="px-4 py-3 text-center">
                        {contact.customFields?.domainAgeDays && contact.customFields.domainAgeDays !== '-1' ? (
                          <p className="text-xs font-semibold text-on-surface">
                            {Math.round(contact.customFields.domainAgeDays / 365 * 10) / 10} yrs
                          </p>
                        ) : (
                          <p className="text-xs text-on-surface-variant opacity-50">-</p>
                        )}
                        {contact.customFields?.rating && (
                          <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[10px] text-yellow-500 font-bold" title={`${contact.customFields.reviewsCount || 0} GMB reviews`}>
                            <span className="material-symbols-outlined text-[11px] fill-current">star</span>
                            {contact.customFields.rating}
                          </div>
                        )}
                      </td>

                      {/* Outreach Hook */}
                      <td className="px-4 py-3 text-xs max-w-xs truncate">
                        <p className="truncate text-on-surface-variant" title={contact.customFields?.outreachHook}>
                          {contact.customFields?.outreachHook || '-'}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                          contact.status === 'active' ? 'bg-green-950/30 text-green-400 border-green-800/50' :
                          contact.status === 'replied' ? 'bg-blue-950/30 text-blue-400 border-blue-800/50' :
                          contact.status === 'unsubscribed' ? 'bg-red-950/30 text-red-400 border-red-900/50' :
                          'bg-surface-variant text-on-surface-variant border-outline-variant'
                        }`}>
                          {contact.status}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setTimelineContact(contact)}
                            className="quick-action-btn w-7 h-7 rounded border border-outline-variant bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors"
                            title="View Activity Timeline"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </button>
                          <button 
                            onClick={() => setEditingContact(contact)}
                            className="quick-action-btn w-7 h-7 rounded border border-outline-variant bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors"
                            title="Edit Contact"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button 
                            onClick={() => handleDelete(contact)}
                            className="quick-action-btn w-7 h-7 rounded border border-outline-variant bg-surface-container flex items-center justify-center text-red-400 hover:text-red-300 border-outline-variant hover:bg-red-950/20 transition-colors"
                            title="Delete Contact"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-20 bg-surface-container/5">
              <span className="material-symbols-outlined text-[56px] text-on-surface-variant opacity-30 mb-3 animate-pulse">database_off</span>
              <h3 className="text-lg font-semibold text-on-surface">No leads found</h3>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto mt-1">
                Launch the Google Maps scraper bot to index leads or import a CSV list of contacts.
              </p>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container/20 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-on-surface-variant font-medium font-mono">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Visual Timeline Popup (Slide-in) */}
      {timelineContact && (
        <div className="fixed right-6 bottom-6 w-80 bg-surface-container-highest border border-primary shadow-2xl rounded-xl z-50 animate-slide-in flex flex-col text-on-surface max-h-[80vh] overflow-hidden">
          <div className="p-3 border-b border-outline-variant flex items-center justify-between bg-primary/5">
            <h5 className="font-semibold text-primary uppercase tracking-wider text-xs flex items-center">
              <span className="material-symbols-outlined text-[16px] mr-1.5 animate-pulse">history</span>
              Lead Activity Timeline
            </h5>
            <button className="text-on-surface-variant hover:text-on-surface active:scale-95 transition-all flex items-center" onClick={() => setTimelineContact(null)}>
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="pb-3 border-b border-outline-variant/30">
              <h4 className="font-bold text-sm text-on-surface select-all">{timelineContact.company || 'Unnamed Company'}</h4>
              <p className="text-xs text-on-surface-variant mt-1">Lead: {timelineContact.firstName} {timelineContact.lastName}</p>
              <p className="text-xs text-on-surface-variant truncate select-all">{timelineContact.email}</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative pl-6 border-l border-primary/30">
                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20"></div>
                <p className="font-semibold text-xs text-primary uppercase mb-1">Lead Acquired</p>
                <div className="bg-surface-container border border-outline-variant p-2 rounded text-[11px] space-y-1 select-all">
                  {timelineContact.customFields?.website && (
                    <p className="truncate">
                      <span className="text-on-surface-variant">URL:</span>{' '}
                      <a href={timelineContact.customFields.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        {timelineContact.customFields.website}
                      </a>
                    </p>
                  )}
                  {timelineContact.customFields?.phone && <p><span className="text-on-surface-variant">Phone:</span> {timelineContact.customFields.phone}</p>}
                  {timelineContact.customFields?.rating && <p><span className="text-on-surface-variant">Rating:</span> {timelineContact.customFields.rating} ⭐ ({timelineContact.customFields.reviewsCount || 0} reviews)</p>}
                  {timelineContact.customFields?.address && <p className="truncate" title={timelineContact.customFields.address}><span className="text-on-surface-variant">Loc:</span> {timelineContact.customFields.address}</p>}
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1 italic">
                  {new Date(timelineContact.createdAt).toLocaleString()}
                </p>
              </div>
              
              {timelineContact.customFields?.outreachHook && (
                <div className="relative pl-6 border-l border-primary/30">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20"></div>
                  <p className="font-semibold text-xs text-primary uppercase mb-1">Outreach Enriched</p>
                  <div className="bg-surface-container border border-outline-variant p-2 rounded text-[11px] space-y-1 select-all">
                    <p><span className="text-on-surface-variant font-bold">Hook:</span> {timelineContact.customFields.outreachHook}</p>
                    {timelineContact.customFields?.personalizedPitch && (
                      <p className="mt-1 border-t border-outline-variant/30 pt-1 text-on-surface-variant">
                        <span className="text-on-surface font-semibold">Pitch:</span> {timelineContact.customFields.personalizedPitch}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {timelineContact.status !== 'active' && (
                <div className="relative pl-6 border-l border-outline-variant">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <p className="font-semibold text-xs text-blue-400 uppercase mb-1">Email Delivered</p>
                  <p className="text-[10px] text-on-surface-variant">Outreach campaign initiated</p>
                </div>
              )}

              {(timelineContact.status === 'opened' || timelineContact.status === 'replied') && (
                <div className="relative pl-6 border-l border-outline-variant">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <p className="font-semibold text-xs text-amber-400 uppercase mb-1">Email Opened</p>
                  <p className="text-[10px] text-on-surface-variant">Recipient engaged with content</p>
                </div>
              )}

              {timelineContact.status === 'replied' && (
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-500/25"></div>
                  <p className="font-semibold text-xs text-green-400 uppercase mb-1">Reply Received</p>
                  <p className="text-[10px] text-on-surface-variant">Lead successfully engaged!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar (Fixed Overlay) */}
      {selectedContacts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-surface-container border border-primary shadow-2xl rounded-xl px-6 py-4 flex items-center justify-between space-x-6 z-40 animate-slide-in ring-2 ring-primary/30 max-w-lg w-full">
          <div className="flex items-center space-x-2 text-sm text-on-surface font-semibold">
            <span className="bg-primary text-black text-xs px-2.5 py-1 rounded-full font-bold">
              {selectedContacts.length}
            </span>
            <span>contacts selected</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const selectedList = contacts.filter(c => selectedContacts.includes(c._id));
                downloadCSV(selectedList, 'selected-leads.csv');
              }}
              className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold py-1.5 px-3 rounded flex items-center text-xs transition-colors"
            >
              Export Selected
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete the ${selectedContacts.length} selected contacts?`)) {
                  bulkDeleteMutation.mutate(selectedContacts);
                }
              }}
              disabled={bulkDeleteMutation.isLoading}
              className="bg-red-950/40 border border-red-900/50 hover:bg-red-900/30 text-red-400 font-bold py-1.5 px-3 rounded flex items-center text-xs transition-colors disabled:opacity-50"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedContacts([])}
              className="text-on-surface-variant hover:text-on-surface text-xs font-semibold py-1.5 px-2 active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Dialog Overlays */}
      <Modal isOpen={showScraper} onClose={() => setShowScraper(false)} title="LAUNCH SCRAPER BOT">
        <ScraperForm
          onSubmit={scrapeMutation.mutate}
          onCancel={() => setShowScraper(false)}
          loading={scrapeMutation.isLoading}
        />
      </Modal>

      <Modal isOpen={showAddForm} onClose={() => setShowAddForm(false)} title="ADD NEW CONTACT">
        <ContactForm
          onSubmit={createMutation.mutate}
          onCancel={() => setShowAddForm(false)}
          loading={createMutation.isLoading}
        />
      </Modal>

      <Modal isOpen={!!editingContact} onClose={() => setEditingContact(null)} title="EDIT CONTACT DETAILS">
        {editingContact && (
          <ContactForm
            contact={editingContact}
            onSubmit={(data) => updateMutation.mutate({ id: editingContact._id, data })}
            onCancel={() => setEditingContact(null)}
            loading={updateMutation.isLoading}
          />
        )}
      </Modal>

      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="UPLOAD CONTACTS CSV">
        <UploadCSVForm
          onSubmit={uploadMutation.mutate}
          onCancel={() => setShowUpload(false)}
          loading={uploadMutation.isLoading}
        />
      </Modal>
    </div>
  );
};

// Form sub-components modified to look premium in Dialog modals
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
    <form onSubmit={handleSubmit} className="space-y-4 text-on-surface font-mono">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">First Name</label>
          <input
            type="text"
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            className="input-field text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Last Name</label>
          <input
            type="text"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            className="input-field text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Email Address</label>
        <input
          type="email"
          placeholder="Email Address"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="input-field text-sm"
          disabled={!!contact}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Company</label>
          <input
            type="text"
            placeholder="Company"
            value={formData.company}
            onChange={(e) => setFormData({...formData, company: e.target.value})}
            className="input-field text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Job Title</label>
          <input
            type="text"
            placeholder="Job Title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="input-field text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Status</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({...formData, status: e.target.value})}
          className="input-field text-sm bg-surface-container"
        >
          <option value="active">Active</option>
          <option value="suppressed">Suppressed</option>
          <option value="bounced">Bounced</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="replied">Replied</option>
        </select>
      </div>
      <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant/30">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary text-sm disabled:opacity-50">
          {loading ? (contact ? 'Updating...' : 'Adding...') : (contact ? 'Update Contact' : 'Add Contact')}
        </button>
      </div>
    </form>
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
    <form onSubmit={handleSubmit} className="space-y-4 text-on-surface font-mono">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Select CSV File</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="input-field text-sm"
          required
        />
        <p className="text-xs text-on-surface-variant mt-2 opacity-80">
          * Requirements: CSV must contain column headers: email, firstName, lastName, company, title
        </p>
      </div>
      <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant/30">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Cancel
        </button>
        <button type="submit" disabled={loading || !file} className="btn-primary text-sm disabled:opacity-50">
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </form>
  );
};

const ScraperForm = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    query: '',
    location: '',
    maxResults: 20,
    useProxy: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.query || !formData.location) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-on-surface font-mono">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Search Query</label>
          <input
            type="text"
            placeholder="e.g. Software Companies, Cafes, Web Agencies"
            value={formData.query}
            onChange={(e) => setFormData({...formData, query: e.target.value})}
            className="input-field text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Location</label>
          <input
            type="text"
            placeholder="e.g. Noida, Delhi, Gurugram"
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            className="input-field text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Max Results</label>
          <input
            type="number"
            min="1"
            max="100"
            value={formData.maxResults}
            onChange={(e) => setFormData({...formData, maxResults: parseInt(e.target.value) || 20})}
            className="input-field text-sm"
            required
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-2 py-2 select-none">
        <input
          type="checkbox"
          id="useProxy"
          checked={formData.useProxy}
          onChange={(e) => setFormData({...formData, useProxy: e.target.checked})}
          className="h-4 w-4 text-primary border-outline-variant bg-surface-container rounded focus:ring-primary cursor-pointer"
        />
        <label htmlFor="useProxy" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant cursor-pointer select-none">
          Rotate proxies (Avoid target blocking, slightly slower)
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant/30">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={loading || !formData.query || !formData.location} 
          className="bg-primary text-black hover:brightness-110 font-bold py-2 px-4 rounded shadow-lg text-sm disabled:opacity-50 flex items-center active:scale-95 transition-all"
        >
          {loading ? 'Queueing Scraper...' : 'Launch Scraper Bot'}
        </button>
      </div>
    </form>
  );
};

export default Contacts;