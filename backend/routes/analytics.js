const express = require('express');
const Campaign = require('../models/Campaign');
const EmailLog = require('../models/EmailLog');
const auth = require('../middleware/auth');

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Overall stats
    const totalCampaigns = await Campaign.countDocuments({ userId });
    const activeCampaigns = await Campaign.countDocuments({ userId, status: 'active' });
    
    const emailStats = await EmailLog.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalOpened: { $sum: { $cond: [{ $eq: ['$status', 'opened'] }, 1, 0] } },
          totalClicked: { $sum: { $cond: [{ $eq: ['$status', 'clicked'] }, 1, 0] } },
          totalReplied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
          totalBounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } }
        }
      }
    ]);

    const stats = emailStats[0] || {
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalReplied: 0,
      totalBounced: 0
    };

    // Calculate rates
    const openRate = stats.totalSent > 0 ? (stats.totalOpened / stats.totalSent * 100).toFixed(2) : 0;
    const clickRate = stats.totalSent > 0 ? (stats.totalClicked / stats.totalSent * 100).toFixed(2) : 0;
    const replyRate = stats.totalSent > 0 ? (stats.totalReplied / stats.totalSent * 100).toFixed(2) : 0;

    // Recent activity
    const recentEmails = await EmailLog.find({ userId })
      .populate('contactId', 'email firstName lastName')
      .populate('campaignId', 'name')
      .sort({ sentAt: -1 })
      .limit(10);

    res.json({
      overview: {
        totalCampaigns,
        activeCampaigns,
        ...stats,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        replyRate: parseFloat(replyRate)
      },
      recentActivity: recentEmails
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get campaign analytics
router.get('/campaign/:id', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Step-by-step analytics
    const stepStats = await EmailLog.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: '$stepNumber',
          sent: { $sum: 1 },
          opened: { $sum: { $cond: [{ $eq: ['$status', 'opened'] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $eq: ['$status', 'clicked'] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
          bounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily performance
    const dailyStats = await EmailLog.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
          sent: { $sum: 1 },
          opened: { $sum: { $cond: [{ $eq: ['$status', 'opened'] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $eq: ['$status', 'clicked'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        stats: campaign.stats
      },
      stepStats,
      dailyStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;