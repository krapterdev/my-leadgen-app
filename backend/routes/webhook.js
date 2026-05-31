const express = require('express');
const EmailLog = require('../models/EmailLog');
const Campaign = require('../models/Campaign');

const router = express.Router();

// Webhook for external tracking services (SendGrid, Mailgun, etc.)
router.post('/email-event', async (req, res) => {
  try {
    const { event, email_id, event_type } = req.body;
    
    console.log('📨 Webhook received:', { event, email_id, event_type });
    
    // Handle different event types
    if (event === 'open' || event_type === 'open') {
      const emailLog = await EmailLog.findById(email_id);
      if (emailLog && !emailLog.openedAt) {
        emailLog.status = 'opened';
        emailLog.openedAt = new Date();
        await emailLog.save();
        
        await Campaign.findByIdAndUpdate(emailLog.campaignId, {
          $inc: { 'stats.totalOpened': 1 }
        });
        
        console.log('✅ Email opened via webhook');
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scraper progress webhook
router.post('/scraper-progress', async (req, res) => {
  try {
    const { userId, status, progress, total, message, company, batchId } = req.body;
    console.log(`[Scraper Webhook] Progress: ${progress}/${total} | Status: ${status} | Msg: ${message} | BatchId: ${batchId}`);
    const { sendToUser } = require('../utils/realtime');
    sendToUser(userId, 'scraper-progress', {
      status,
      progress,
      total,
      message,
      company,
      batchId,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Scraper webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;