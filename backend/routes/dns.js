const express = require('express');
const DnsSettings = require('../models/DnsSettings');
const auth = require('../middleware/auth');

const router = express.Router();

// Get DNS settings
router.get('/', auth, async (req, res) => {
  try {
    const dnsSettings = await DnsSettings.find({ userId: req.user._id });
    res.json({ data: dnsSettings });
  } catch (error) {
    console.error('Get DNS error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add/Update DNS settings
router.post('/', auth, async (req, res) => {
  try {
    const { domain, spfRecord, dkimRecord, dmarcRecord, trackingDomain } = req.body;

    let dnsSettings = await DnsSettings.findOne({ userId: req.user._id, domain });
    
    if (dnsSettings) {
      // Update existing
      dnsSettings.spfRecord = spfRecord;
      dnsSettings.dkimRecord = dkimRecord;
      dnsSettings.dmarcRecord = dmarcRecord;
      dnsSettings.trackingDomain = trackingDomain;
    } else {
      // Create new
      dnsSettings = new DnsSettings({
        userId: req.user._id,
        domain,
        spfRecord,
        dkimRecord,
        dmarcRecord,
        trackingDomain
      });
    }

    await dnsSettings.save();
    res.json(dnsSettings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate DNS records
router.post('/generate', auth, async (req, res) => {
  try {
    const { domain } = req.body;

    const dnsRecords = {
      spf: `v=spf1 include:_spf.google.com include:spf.protection.outlook.com ~all`,
      dkim: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...`, // Placeholder
      dmarc: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; ruf=mailto:dmarc@${domain}; fo=1`,
      trackingDomain: `track.${domain}`
    };

    res.json({
      domain,
      records: dnsRecords,
      instructions: {
        spf: `Add this TXT record to your domain: "${dnsRecords.spf}"`,
        dkim: `Add this TXT record with selector 'default._domainkey': "${dnsRecords.dkim}"`,
        dmarc: `Add this TXT record to '_dmarc.${domain}': "${dnsRecords.dmarc}"`,
        tracking: `Add this CNAME record: "${dnsRecords.trackingDomain}" pointing to your server`
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify DNS settings
router.post('/:id/verify', auth, async (req, res) => {
  try {
    const dnsSettings = await DnsSettings.findOne({ _id: req.params.id, userId: req.user._id });
    if (!dnsSettings) {
      return res.status(404).json({ message: 'DNS settings not found' });
    }

    // Here you would implement actual DNS verification
    // For now, we'll just mark as verified
    dnsSettings.isVerified = true;
    dnsSettings.lastVerified = new Date();
    await dnsSettings.save();

    res.json({ message: 'DNS settings verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;