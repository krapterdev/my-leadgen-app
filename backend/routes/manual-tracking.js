const express = require('express');
const EmailLog = require('../models/EmailLog');
const Campaign = require('../models/Campaign');
const auth = require('../middleware/auth');

const router = express.Router();

// Manual tracking endpoint for testing
router.post('/mark-opened/:logId', auth, async (req, res) => {
  try {
    const { logId } = req.params;
    
    const emailLog = await EmailLog.findById(logId);
    if (!emailLog) {
      return res.status(404).json({ message: 'Email log not found' });
    }
    
    // Check if already opened
    if (emailLog.status === 'opened') {
      return res.json({ message: 'Email already marked as opened', stats: emailLog });
    }
    
    // Mark as opened
    emailLog.status = 'opened';
    emailLog.openedAt = new Date();
    emailLog.trackingEvents.push({
      type: 'open',
      userAgent: 'Manual Test',
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await emailLog.save();
    
    // Update campaign stats
    const updatedCampaign = await Campaign.findByIdAndUpdate(emailLog.campaignId, {
      $inc: { 'stats.totalOpened': 1 }
    }, { new: true });
    
    res.json({ 
      message: 'Email marked as opened successfully',
      emailLog,
      campaignStats: updatedCampaign.stats
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get tracking info for email
router.get('/info/:logId', auth, async (req, res) => {
  try {
    const { logId } = req.params;
    
    const emailLog = await EmailLog.findById(logId)
      .populate('contactId', 'email firstName lastName')
      .populate('campaignId', 'name');
    
    if (!emailLog) {
      return res.status(404).json({ message: 'Email log not found' });
    }
    
    const trackingUrl = `${process.env.BASE_URL || 'http://localhost:5001'}/api/tracking/open/${logId}`;
    
    res.json({
      emailLog,
      trackingUrl,
      isOpened: emailLog.status === 'opened',
      openedAt: emailLog.openedAt,
      trackingEvents: emailLog.trackingEvents
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;