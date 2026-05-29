const express = require('express');
const EmailLog = require('../models/EmailLog');
const Campaign = require('../models/Campaign');
const auth = require('../middleware/auth');

const router = express.Router();

// Sync all email statuses and return comprehensive stats
router.post('/sync-status', auth, async (req, res) => {
  try {
    console.log('🔄 Starting email status sync...');

    // Get all emails for this user
    const allEmails = await EmailLog.find({ userId: req.user._id })
      .populate('campaignId', 'name')
      .populate('contactId', 'email firstName lastName')
      .sort({ sentAt: -1 });

    // Calculate comprehensive stats
    const stats = {
      total: allEmails.length,
      sent: 0,
      opened: 0,
      notOpened: 0,
      clicked: 0,
      replied: 0,
      failed: 0,
      bounced: 0,
      byStatus: {},
      byCampaign: {},
      recentOpens: [],
      recentReplies: []
    };

    // Process each email
    allEmails.forEach(email => {
      // Count by status
      if (!stats.byStatus[email.status]) {
        stats.byStatus[email.status] = 0;
      }
      stats.byStatus[email.status]++;

      // Main stats
      if (email.status === 'sent') stats.sent++;
      if (email.status === 'opened' || email.openedAt) stats.opened++;
      if (email.status === 'sent' && !email.openedAt) stats.notOpened++;
      if (email.status === 'clicked') stats.clicked++;
      if (email.status === 'replied') stats.replied++;
      if (email.status === 'failed') stats.failed++;
      if (email.status === 'bounced') stats.bounced++;

      // Count by campaign
      if (email.campaignId) {
        const campaignName = email.campaignId.name || 'Unknown';
        if (!stats.byCampaign[campaignName]) {
          stats.byCampaign[campaignName] = {
            total: 0,
            opened: 0,
            replied: 0,
            notOpened: 0
          };
        }
        stats.byCampaign[campaignName].total++;
        if (email.openedAt) stats.byCampaign[campaignName].opened++;
        if (email.status === 'replied') stats.byCampaign[campaignName].replied++;
        if (email.status === 'sent' && !email.openedAt) stats.byCampaign[campaignName].notOpened++;
      }

      // Recent opens (last 24 hours)
      if (email.openedAt && new Date() - new Date(email.openedAt) < 24 * 60 * 60 * 1000) {
        stats.recentOpens.push({
          email: email.contactId?.email,
          name: `${email.contactId?.firstName || ''} ${email.contactId?.lastName || ''}`.trim(),
          subject: email.subject,
          openedAt: email.openedAt,
          campaign: email.campaignId?.name
        });
      }

      // Recent replies (last 24 hours)
      if (email.repliedAt && new Date() - new Date(email.repliedAt) < 24 * 60 * 60 * 1000) {
        stats.recentReplies.push({
          email: email.contactId?.email,
          name: `${email.contactId?.firstName || ''} ${email.contactId?.lastName || ''}`.trim(),
          subject: email.subject,
          repliedAt: email.repliedAt,
          campaign: email.campaignId?.name
        });
      }
    });

    // Calculate open rate
    stats.openRate = stats.total > 0 ? ((stats.opened / stats.total) * 100).toFixed(1) : 0;
    stats.replyRate = stats.total > 0 ? ((stats.replied / stats.total) * 100).toFixed(1) : 0;

    console.log('✅ Status sync complete');
    console.log(`📊 Total: ${stats.total}, Opened: ${stats.opened}, Not Opened: ${stats.notOpened}, Replied: ${stats.replied}`);

    res.json({
      success: true,
      message: 'Email status synced successfully',
      stats,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync email status',
      error: error.message
    });
  }
});

// Get detailed list of emails by status
router.get('/by-status/:status', auth, async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 50 } = req.query;

    let query = { userId: req.user._id };

    if (status === 'not-opened') {
      query.status = 'sent';
      query.openedAt = { $exists: false };
    } else {
      query.status = status;
    }

    const emails = await EmailLog.find(query)
      .populate('campaignId', 'name')
      .populate('contactId', 'email firstName lastName')
      .sort({ sentAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: emails.length,
      emails
    });

  } catch (error) {
    console.error('Error fetching emails by status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch emails',
      error: error.message
    });
  }
});

module.exports = router;
