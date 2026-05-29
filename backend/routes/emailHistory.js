const express = require('express');
const EmailLog = require('../models/EmailLog');
const Campaign = require('../models/Campaign');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all email history with filters
router.get('/', auth, async (req, res) => {
  try {
    const { status, campaignId, limit = 50, page = 1 } = req.query;
    
    const query = { userId: req.user._id };
    if (status) query.status = status;
    if (campaignId) query.campaignId = campaignId;
    
    const skip = (page - 1) * limit;
    
    const emails = await EmailLog.find(query)
      .populate('contactId', 'email firstName lastName')
      .populate('campaignId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await EmailLog.countDocuments(query);
    
    res.json({
      emails,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update email status
router.put('/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const emailLog = await EmailLog.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!emailLog) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const oldStatus = emailLog.status;
    emailLog.status = status;
    
    // Update timestamps based on status
    if (status === 'opened' && !emailLog.openedAt) {
      emailLog.openedAt = new Date();
    } else if (status === 'clicked' && !emailLog.clickedAt) {
      emailLog.clickedAt = new Date();
    } else if (status === 'replied' && !emailLog.repliedAt) {
      emailLog.repliedAt = new Date();
    }
    
    await emailLog.save();
    
    // Update campaign stats if status changed
    if (oldStatus !== status && emailLog.campaignId) {
      const Campaign = require('../models/Campaign');
      
      // Decrement old status
      if (oldStatus === 'opened') {
        await Campaign.findByIdAndUpdate(emailLog.campaignId, { $inc: { 'stats.totalOpened': -1 } });
      } else if (oldStatus === 'clicked') {
        await Campaign.findByIdAndUpdate(emailLog.campaignId, { $inc: { 'stats.totalClicked': -1 } });
      } else if (oldStatus === 'replied') {
        await Campaign.findByIdAndUpdate(emailLog.campaignId, { $inc: { 'stats.totalReplied': -1 } });
      }
      
      // Increment new status
      if (status === 'opened') {
        await Campaign.findByIdAndUpdate(emailLog.campaignId, { $inc: { 'stats.totalOpened': 1 } });
      } else if (status === 'clicked') {
        await Campaign.findByIdAndUpdate(emailLog.campaignId, { $inc: { 'stats.totalClicked': 1 } });
      } else if (status === 'replied') {
        await Campaign.findByIdAndUpdate(emailLog.campaignId, { $inc: { 'stats.totalReplied': 1 } });
      }
    }
    
    res.json({ message: 'Email status updated successfully', emailLog });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete single email log
router.delete('/:id', auth, async (req, res) => {
  try {
    const emailLog = await EmailLog.findOne({ _id: req.params.id, userId: req.user._id });
    if (!emailLog) {
      return res.status(404).json({ message: 'Email not found' });
    }
    
    await EmailLog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete multiple email logs
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    
    await EmailLog.deleteMany({
      _id: { $in: ids },
      userId: req.user._id
    });
    
    res.json({ message: `${ids.length} emails deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear all email history
router.delete('/clear-all', auth, async (req, res) => {
  try {
    const result = await EmailLog.deleteMany({ userId: req.user._id });
    res.json({ message: `${result.deletedCount} emails cleared` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;