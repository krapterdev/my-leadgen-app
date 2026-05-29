const express = require('express');
const auth = require('../middleware/auth');
const Campaign = require('../models/Campaign');
const EmailLog = require('../models/EmailLog');
const Contact = require('../models/Contact');
const Mailbox = require('../models/Mailbox');
const { globalRateLimiter } = require('../utils/rateLimiter');

const router = express.Router();

// Professional dashboard analytics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Parallel queries for better performance
    const [
      totalCampaigns,
      activeCampaigns,
      totalContacts,
      totalMailboxes,
      verifiedMailboxes,
      emailStats,
      recentActivity
    ] = await Promise.all([
      Campaign.countDocuments({ userId }),
      Campaign.countDocuments({ userId, status: 'active' }),
      Contact.countDocuments({ userId }),
      Mailbox.countDocuments({ userId }),
      Mailbox.countDocuments({ userId, isVerified: true }),
      EmailLog.aggregate([
        { $match: { userId, sentAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalSent: { $sum: 1 },
            totalOpened: { $sum: { $cond: [{ $eq: ['$opened', true] }, 1, 0] } },
            totalClicked: { $sum: { $cond: [{ $eq: ['$clicked', true] }, 1, 0] } },
            totalReplied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
            totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
          }
        }
      ]),
      EmailLog.find({ userId, sentAt: { $gte: startDate } })
        .populate('contactId', 'email firstName lastName')
        .populate('campaignId', 'name')
        .sort({ sentAt: -1 })
        .limit(10)
    ]);

    const stats = emailStats[0] || {
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalReplied: 0,
      totalFailed: 0
    };

    // Calculate rates
    const openRate = stats.totalSent > 0 ? ((stats.totalOpened / stats.totalSent) * 100).toFixed(1) : 0;
    const clickRate = stats.totalSent > 0 ? ((stats.totalClicked / stats.totalSent) * 100).toFixed(1) : 0;
    const replyRate = stats.totalSent > 0 ? ((stats.totalReplied / stats.totalSent) * 100).toFixed(1) : 0;

    // Get mailbox usage stats
    const mailboxes = await Mailbox.find({ userId, isVerified: true });
    const mailboxStats = mailboxes.map(mailbox => ({
      id: mailbox._id,
      email: mailbox.email,
      displayName: mailbox.displayName,
      usage: globalRateLimiter.getStats(mailbox._id, mailbox.throttleSettings)
    }));

    res.json({
      overview: {
        totalCampaigns,
        activeCampaigns,
        totalContacts,
        totalMailboxes,
        verifiedMailboxes
      },
      emailMetrics: {
        ...stats,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        replyRate: parseFloat(replyRate)
      },
      mailboxStats,
      recentActivity: recentActivity.map(log => ({
        id: log._id,
        contact: log.contactId ? `${log.contactId.firstName} ${log.contactId.lastName}` : 'Unknown',
        email: log.contactId?.email,
        campaign: log.campaignId?.name,
        subject: log.subject,
        status: log.status,
        sentAt: log.sentAt,
        opened: log.opened,
        clicked: log.clicked
      })),
      timeframe
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Real-time campaign performance
router.get('/campaign/:id/performance', auth, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user._id;

    // Verify campaign ownership
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Get detailed performance data
    const performance = await EmailLog.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: '$stepNumber',
          totalSent: { $sum: 1 },
          totalOpened: { $sum: { $cond: [{ $eq: ['$opened', true] }, 1, 0] } },
          totalClicked: { $sum: { $cond: [{ $eq: ['$clicked', true] }, 1, 0] } },
          totalReplied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
          totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get hourly sending pattern
    const hourlyData = await EmailLog.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: { $hour: '$sentAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        startDate: campaign.startDate
      },
      stepPerformance: performance,
      hourlyPattern: hourlyData,
      totalContacts: campaign.contacts.length
    });

  } catch (error) {
    console.error('Campaign performance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;