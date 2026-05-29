import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from 'react-query';
import toast from 'react-hot-toast';

export const useRealtime = () => {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Create EventSource connection (EventSource doesn't support custom headers)
    const eventSource = new EventSource(`http://localhost:5001/api/realtime/events?token=${encodeURIComponent(token)}`);

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('🔗 Real-time connection established');
      setIsConnected(true);
    };

    eventSource.addEventListener('connected', (event) => {
      console.log('✅ Connected to real-time updates');
    });

    eventSource.addEventListener('campaign-stats', (event) => {
      const data = JSON.parse(event.data);
      console.log('📊 Campaign stats updated:', data);
      
      // Update campaign data in cache
      queryClient.setQueryData('campaigns', (oldData) => {
        if (!oldData?.data) return oldData;
        
        return {
          ...oldData,
          data: oldData.data.map(campaign => 
            campaign._id === data.campaignId 
              ? { ...campaign, stats: data.stats }
              : campaign
          )
        };
      });
      
      // Invalidate to force refresh
      queryClient.invalidateQueries('campaigns');
    });

    eventSource.addEventListener('email-update', (event) => {
      const data = JSON.parse(event.data);
      console.log('📧 Email update:', data);
      
      // Show notification
      const contact = data.emailLog?.contactId;
      const contactName = contact ? `${contact.firstName} ${contact.lastName}` : 'Someone';
      
      if (data.emailLog?.status === 'opened') {
        toast.success(`📧 ${contactName} opened your email!`, {
          duration: 4000,
          icon: '👀'
        });
      } else if (data.emailLog?.status === 'replied') {
        toast.success(`📨 ${contactName} replied to your email!`, {
          duration: 5000,
          icon: '🎉'
        });
      }
      
      // Invalidate queries
      queryClient.invalidateQueries(['campaign-details', data.campaignId]);
      queryClient.invalidateQueries('campaigns');
      queryClient.invalidateQueries('email-history');
    });

    eventSource.onerror = (error) => {
      console.error('❌ Real-time connection error:', error);
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        console.log('🔌 Real-time connection closed');
      }
    };
  }, [queryClient]);

  return {
    isConnected
  };
};