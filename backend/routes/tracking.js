const express = require('express');
const EmailLog = require('../models/EmailLog');
const Campaign = require('../models/Campaign');

const router = express.Router();

// Debug route to check email logs
router.get('/debug/emails', async (req, res) => {
  try {
    const recentEmails = await EmailLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id status openedAt campaignId contactId');
    res.json(recentEmails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug route to check campaign stats
router.get('/debug/campaign/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).select('name stats');
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tracking pixel endpoint
router.get('/pixel/:logId.gif', async (req, res) => {
  const { logId } = req.params;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip;
  
  console.log(`📷 TRACKING PIXEL HIT: ${logId}`);
  console.log(`🔍 User-Agent: ${userAgent}`);
  console.log(`🌍 IP: ${ip}`);
  
  try {
    const emailLog = await EmailLog.findById(logId).populate('contactId', 'email firstName lastName');
    if (emailLog) {
      console.log(`📧 Found email log - Status: ${emailLog.status}, Opened: ${emailLog.openedAt}`);
      
      if (!emailLog.openedAt) {
        emailLog.status = 'opened';
        emailLog.openedAt = new Date();
        await emailLog.save();
        
        if (emailLog.campaignId) {
          const campaign = await Campaign.findByIdAndUpdate(
            emailLog.campaignId,
            { $inc: { 'stats.totalOpened': 1 } },
            { new: true }
          );
          
          console.log(`✅ EMAIL OPENED: ${logId}`);
          console.log(`📊 Campaign stats updated: ${campaign.stats.totalOpened} opens`);
          
          // Broadcast real-time updates
          const { broadcastCampaignUpdate, broadcastEmailUpdate } = require('../utils/realtime');
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
        console.log(`🔄 Already opened at: ${emailLog.openedAt}`);
      }
    } else {
      console.log(`❌ Email log not found: ${logId}`);
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

// Professional email engagement analytics endpoint
router.get('/email-engagement/:logId.gif', async (req, res) => {
  const { logId } = req.params;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || 'Unknown';
  
  console.log(`🚀 GMAIL TRACKING HIT: ${logId}`);
  console.log(`🔍 User-Agent: ${userAgent}`);
  console.log(`🌍 IP: ${ip}`);
  
  try {
    const emailLog = await EmailLog.findById(logId);
    if (emailLog) {
      console.log(`📧 Found email log - Current status: ${emailLog.status}`);
      
      if (!emailLog.openedAt) {
        emailLog.status = 'opened';
        emailLog.openedAt = new Date();
        await emailLog.save();
        
        if (emailLog.campaignId) {
          await Campaign.findByIdAndUpdate(emailLog.campaignId, {
            $inc: { 'stats.totalOpened': 1 }
          });
        }
        
        console.log(`✅ GMAIL OPEN TRACKED SUCCESSFULLY!`);
      } else {
        console.log(`🔄 Already opened at: ${emailLog.openedAt}`);
      }
    } else {
      console.log(`❌ Email log not found: ${logId}`);
    }
  } catch (error) {
    console.error('❌ Tracking error:', error);
  }
  
  // Return GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store'
  });
  res.send(gif);
});

// New tracking route with campaign and email parameters
router.get('/track/open', async (req, res) => {
  try {
    const { cid: campaignId, email } = req.query;
    
    console.log(`📊 Open tracking: Campaign ${campaignId}, Email ${email}`);

    // Find contact and email log
    const contact = await require('../models/Contact').findOne({ email });
    if (contact) {
      const emailLog = await EmailLog.findOne({ 
        campaignId, 
        contactId: contact._id 
      });
      
      if (emailLog && !emailLog.openedAt) {
        emailLog.status = 'opened';
        emailLog.openedAt = new Date();
        await emailLog.save();
        
        // Update campaign stats
        await Campaign.findByIdAndUpdate(campaignId, {
          $inc: { 'stats.totalOpened': 1 }
        });
        
        console.log(`✅ Email marked as opened: ${email}`);
      }
    }

    // Return tracking pixel with anti-cache headers
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });
    res.send(pixel);
  } catch (error) {
    console.error('Open tracking error:', error);
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
  }
});

// Alternative tracking route
router.get('/open/:logId', async (req, res) => {
  const { logId } = req.params;
  console.log(`🚀 TRACKING HIT (open route): ${logId} from ${req.ip}`);
  
  try {
    const emailLog = await EmailLog.findById(logId).populate('contactId', 'email firstName lastName');
    
    if (emailLog) {
      console.log(`📧 FOUND EMAIL: ${emailLog.status}`);
      
      if (!emailLog.openedAt) {
        emailLog.status = 'opened';
        emailLog.openedAt = new Date();
        await emailLog.save();
        
        if (emailLog.campaignId) {
          const campaign = await Campaign.findByIdAndUpdate(
            emailLog.campaignId,
            { $inc: { 'stats.totalOpened': 1 } },
            { new: true }
          );
          
          console.log(`✅ MARKED AS OPENED!`);
          console.log(`📊 Campaign opens: ${campaign.stats.totalOpened}`);
          
          // Broadcast updates
          const { broadcastCampaignUpdate, broadcastEmailUpdate } = require('../utils/realtime');
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
      }
    } else {
      console.log(`❌ Email log not found: ${logId}`);
    }
  } catch (error) {
    console.error('Tracking error:', error);
  }
  
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache'
  });
  res.send(pixel);
});

// Click tracking redirect
router.get('/click/:logId', async (req, res) => {
  try {
    const { logId } = req.params;
    const { url } = req.query;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    const emailLog = await EmailLog.findById(logId);
    if (emailLog) {
      if (emailLog.status === 'sent' || emailLog.status === 'opened') {
        emailLog.status = 'clicked';
        emailLog.clickedAt = new Date();
      }
      
      emailLog.trackingEvents.push({
        type: 'click',
        userAgent,
        ipAddress,
        url
      });
      await emailLog.save();

      // Update campaign stats
      await Campaign.findByIdAndUpdate(emailLog.campaignId, {
        $inc: { 'stats.totalClicked': 1 }
      });
    }

    // Redirect to original URL
    res.redirect(decodeURIComponent(url));
  } catch (error) {
    console.error('Click tracking error:', error);
    res.status(500).send('Error');
  }
});

// Unsubscribe
router.get('/unsubscribe/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const Contact = require('../models/Contact');
    
    await Contact.findByIdAndUpdate(contactId, {
      status: 'unsubscribed'
    });

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Successfully Unsubscribed</h2>
          <p>You have been unsubscribed from our mailing list.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send('Error processing unsubscribe request');
  }
});

module.exports = router;