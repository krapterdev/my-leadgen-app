const express = require('express');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const EmailLog = require('../models/EmailLog');
const auth = require('../middleware/auth');
const { sendUsingMailbox, processEmailSequences } = require('../workers/emailWorker');

const router = express.Router();

// Debug route
router.get('/debug', async (req, res) => {
  try {
    const campaigns = await Campaign.find().limit(5);
    res.json({ 
      message: 'Debug successful',
      count: campaigns.length,
      campaigns: campaigns
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all campaigns
router.get('/', auth, async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user._id })
      .populate('mailboxId', 'email displayName')
      .sort({ createdAt: -1 });
    
    // Recalculate stats for each campaign to ensure accuracy (current run only)
    for (const campaign of campaigns) {
      const currentRun = campaign.currentRun || 1;
      const emailLogs = await EmailLog.find({ 
        campaignId: campaign._id, 
        campaignRun: currentRun 
      });
      const actualSent = emailLogs.filter(log => ['sent', 'opened', 'clicked'].includes(log.status)).length;
      const actualOpened = emailLogs.filter(log => ['opened', 'clicked'].includes(log.status)).length;
      const actualClicked = emailLogs.filter(log => log.status === 'clicked').length;
      
      // Update stats if they don't match
      if (campaign.stats.totalSent !== actualSent || 
          campaign.stats.totalOpened !== actualOpened || 
          campaign.stats.totalClicked !== actualClicked) {
        campaign.stats.totalSent = actualSent;
        campaign.stats.totalOpened = actualOpened;
        campaign.stats.totalClicked = actualClicked;
        await campaign.save();
      }
    }
    
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create campaign
router.post('/', auth, async (req, res) => {
  try {
    const { name, mailboxId, sequence, contactIds } = req.body;

    const campaign = new Campaign({
      userId: req.user._id,
      name,
      mailboxId,
      sequence,
      contacts: contactIds
    });

    await campaign.save();
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start campaign
router.post('/:id/start', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('contacts')
      .populate('mailboxId');

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status === 'active') {
      return res.status(400).json({ message: 'Campaign is already running' });
    }

    // Validate mailbox
    if (!campaign.mailboxId || !campaign.mailboxId.isVerified) {
      return res.status(400).json({ message: 'Mailbox not verified. Please verify your mailbox first.' });
    }

    // Validate sequence
    if (!campaign.sequence || campaign.sequence.length === 0) {
      return res.status(400).json({ message: 'Campaign must have at least one email step' });
    }

    // Validate contacts
    if (!campaign.contacts || campaign.contacts.length === 0) {
      return res.status(400).json({ message: 'Campaign must have at least one contact' });
    }

    campaign.status = 'active';
    campaign.startDate = new Date();
    await campaign.save();

    // Send first step emails immediately
    const firstStep = campaign.sequence[0];
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log(`Starting campaign ${campaign.name} with ${campaign.contacts.length} contacts`);
    console.log(`First step: ${firstStep.subject}`);
    console.log(`Mailbox: ${campaign.mailboxId.email}`);

    for (const contact of campaign.contacts) {
      // Skip contacts that are explicitly inactive
      if (contact.status && contact.status !== 'active') {
        console.log(`⏭️ Skipping ${contact.email} - status: ${contact.status}`);
        continue;
      }
      
      console.log(`📤 Sending to: ${contact.email}`);
      try {
        await sendUsingMailbox(
          campaign.mailboxId._id,
          contact.email,
          firstStep.subject,
          firstStep.body,
          {
            campaignId: campaign._id,
            contactId: contact._id,
            stepNumber: 1,
            campaignRun: campaign.currentRun || 1
          }
        );
        successCount++;
        console.log(`✅ Email sent successfully to ${contact.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send to ${contact.email}:`, emailError.message);
        errorCount++;
        errors.push(`${contact.email}: ${emailError.message}`);
      }
    }

    // Update campaign stats
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      campaign._id, 
      { 
        $inc: { 'stats.totalSent': successCount },
        status: 'active',
        startDate: new Date()
      },
      { new: true }
    );

    const response = {
      message: `Campaign started successfully. Sent ${successCount} emails.`,
      stats: { 
        successCount, 
        errorCount, 
        totalContacts: campaign.contacts.length,
        campaignStats: updatedCampaign.stats
      }
    };

    if (errorCount > 0) {
      response.message += ` ${errorCount} emails failed.`;
      response.errors = errors.slice(0, 5); // Show first 5 errors
    }

    console.log(`Campaign start complete: ${successCount} sent, ${errorCount} failed`);
    res.json(response);
  } catch (error) {
    console.error('Campaign start error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Pause campaign
router.post('/:id/pause', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'paused' },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json({ message: 'Campaign paused successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Manually process campaign (Force Run)
router.post('/:id/process', auth, async (req, res) => {
  try {
    const { force } = req.body;
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({ message: 'Campaign is not active' });
    }

    // Trigger worker immediately
    console.log(`Manually triggering worker for campaign ${campaign.name} (Force: ${force})`);
    
    // Run in background to not block response
    processEmailSequences({ campaignId: campaign._id, force: !!force })
      .then(() => console.log(`Manual processing complete for ${campaign.name}`))
      .catch(err => console.error(`Manual processing failed for ${campaign.name}:`, err));

    res.json({ message: 'Campaign processing started in background' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Resume campaign
router.post('/:id/resume', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status !== 'paused') {
      return res.status(400).json({ message: 'Campaign is not paused' });
    }

    campaign.status = 'active';
    await campaign.save();

    res.json({ message: 'Campaign resumed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Stop campaign (complete halt)
router.post('/:id/stop', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'stopped', stoppedAt: new Date() },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json({ message: 'Campaign stopped successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Restart stopped campaign (with confirmation) - Archives old results and starts fresh
router.post('/:id/restart', auth, async (req, res) => {
  try {
    const { confirmed } = req.body;
    
    if (!confirmed) {
      return res.status(400).json({ 
        message: 'Confirmation required',
        requiresConfirmation: true,
        confirmationMessage: 'This will restart the campaign from the beginning. Previous results will be archived and a fresh campaign will start. Are you sure?'
      });
    }

    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('contacts')
      .populate('mailboxId');

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status !== 'stopped') {
      return res.status(400).json({ message: 'Campaign is not stopped' });
    }

    // Archive previous run by incrementing run counter
    campaign.currentRun = (campaign.currentRun || 1) + 1;
    campaign.totalRuns = (campaign.totalRuns || 0) + 1;
    campaign.status = 'draft';
    campaign.restartedAt = new Date();
    
    // Reset current run stats
    campaign.stats = {
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalReplied: 0,
      totalBounced: 0
    };
    
    await campaign.save();

    res.json({ 
      message: `Campaign restarted successfully (Run ${campaign.currentRun}). Click Start to begin sending emails.`,
      stats: { 
        currentRun: campaign.currentRun,
        totalRuns: campaign.totalRuns
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get campaign details
router.get('/:id', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('mailboxId', 'email displayName')
      .populate('contacts');

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Get email logs for this campaign grouped by run
    const emailLogs = await EmailLog.find({ campaignId: campaign._id })
      .populate('contactId', 'email firstName lastName')
      .sort({ campaignRun: -1, sentAt: -1 });

    // Group logs by campaign run
    const logsByRun = {};
    emailLogs.forEach(log => {
      const run = log.campaignRun || 1;
      if (!logsByRun[run]) {
        logsByRun[run] = [];
      }
      logsByRun[run].push(log);
    });

    res.json({ 
      campaign, 
      emailLogs,
      logsByRun,
      currentRun: campaign.currentRun || 1,
      totalRuns: campaign.totalRuns || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete campaign
router.delete('/:id', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Delete associated email logs
    await EmailLog.deleteMany({ campaignId: req.params.id });

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;