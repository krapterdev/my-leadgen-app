const express = require('express');
const EmailLog = require('../models/EmailLog');
const Campaign = require('../models/Campaign');
const { broadcastCampaignUpdate, broadcastEmailUpdate } = require('../utils/realtime');

const router = express.Router();

// GET /t/track?mid=UNIQUE_ID
router.get('/track', async (req, res) => {
  const { mid } = req.query;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip;

  console.log(`📷 TRACKING PIXEL HIT (New Route): ${mid}`);
  console.log(`🔍 User-Agent: ${userAgent}`);
  console.log(`🌍 IP: ${ip}`);

  try {
    if (mid) {
      const emailLog = await EmailLog.findById(mid);
      
      if (emailLog) {
        console.log(`📧 Found email log - Status: ${emailLog.status}, Opened: ${emailLog.openedAt}`);

        // Record this tracking attempt
        const trackingMethod = {
          method: 'pixel',
          timestamp: new Date(),
          userAgent: userAgent,
          ipAddress: ip
        };

        if (!emailLog.openedAt) {
          emailLog.status = 'opened';
          emailLog.openedAt = new Date();
          
          // Add tracking method
          if (!emailLog.trackingMethods) {
            emailLog.trackingMethods = [];
          }
          emailLog.trackingMethods.push(trackingMethod);
          
          // Add tracking event
          emailLog.trackingEvents.push({
            type: 'open',
            userAgent: userAgent,
            ipAddress: ip,
            timestamp: new Date()
          });

          await emailLog.save();

          // Update campaign stats if applicable
          if (emailLog.campaignId) {
            const campaign = await Campaign.findByIdAndUpdate(
              emailLog.campaignId,
              { $inc: { 'stats.totalOpened': 1 } },
              { new: true }
            );

            console.log(`✅ EMAIL OPENED: ${mid}`);
            console.log(`📊 Campaign ${emailLog.campaignId} - Total Opened: ${campaign.stats.totalOpened}`);
            
            // Broadcast real-time updates
            if (emailLog.userId) {
              broadcastCampaignUpdate(emailLog.userId.toString(), emailLog.campaignId.toString(), campaign.stats);
              broadcastEmailUpdate(emailLog.userId.toString(), emailLog.campaignId.toString(), {
                _id: emailLog._id,
                contactId: emailLog.contactId,
                status: 'opened',
                openedAt: emailLog.openedAt,
                subject: emailLog.subject
              });
            }
          }
        } else {
          // Already opened, but still log the tracking attempt
          if (!emailLog.trackingMethods) {
            emailLog.trackingMethods = [];
          }
          emailLog.trackingMethods.push(trackingMethod);
          await emailLog.save();
          console.log(`🔄 Already opened at: ${emailLog.openedAt} (logged additional tracking)`);
        }
      } else {
        console.log(`❌ Email log not found: ${mid}`);
      }
    }
  } catch (error) {
    console.error('❌ Tracking error:', error);
  }

  // Return 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.send(pixel);
});

module.exports = router;
