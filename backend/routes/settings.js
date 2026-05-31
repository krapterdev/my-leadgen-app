const express = require('express');
const Mailbox = require('../models/Mailbox');
const DnsSettings = require('../models/DnsSettings');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all settings
router.get('/', async (req, res) => {
  try {
    // Check auth
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    let user;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = require('../models/User');
      user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    } catch (error) {
      return res.status(401).json({ message: 'Token verification failed' });
    }
    
    const userId = user._id;

    const [mailboxes, dnsSettings] = await Promise.all([
      Mailbox.find({ userId }).select('-smtpSettings.password -imapSettings.password'),
      DnsSettings.find({ userId })
    ]);
    
    console.log('Settings - Found mailboxes:', mailboxes.length);

    res.json({
      data: {
        user,
        mailboxes,
        dnsSettings,
        preferences: {
          timezone: 'UTC',
          defaultSendingLimits: {
            perHour: 50,
            perDay: 200
          },
          trackingEnabled: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, company } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, company },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    // In a real app, you'd store preferences in a separate model
    // For now, we'll just return the updated preferences
    const preferences = req.body;
    
    res.json({
      message: 'Preferences updated successfully',
      preferences
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update active section tracking
router.post('/active-section', auth, async (req, res) => {
  try {
    const { section } = req.body;
    global.activeSection = section;
    console.log(`[Section Tracking] Active section updated to: ${section}`);
    res.json({ success: true, activeSection: global.activeSection });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;