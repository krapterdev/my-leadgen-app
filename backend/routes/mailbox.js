const express = require('express');
const nodemailer = require('nodemailer');
const Mailbox = require('../models/Mailbox');
const auth = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { getProviderSettings } = require('../utils/emailProviders');
const validator = require('validator');

const router = express.Router();

// Get all mailboxes
router.get('/', auth, async (req, res) => {
  try {
    const mailboxes = await Mailbox.find({ userId: req.user._id }).select('-smtpSettings.password -imapSettings.password');
    res.json({ data: mailboxes });
  } catch (error) {
    console.error('Get mailboxes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add new mailbox
router.post('/', auth, async (req, res) => {
  try {
    const { email, displayName, provider, password } = req.body;
    
    if (!email || !displayName || !provider || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const existingMailbox = await Mailbox.findOne({ userId: req.user._id, email });
    if (existingMailbox) {
      return res.status(400).json({ message: 'Email already exists in your mailboxes' });
    }

    const providerSettings = getProviderSettings(provider);
    const encryptedPassword = encrypt(password);

    const mailbox = new Mailbox({
      userId: req.user._id,
      email,
      displayName,
      provider,
      smtpSettings: {
        host: providerSettings.smtp.host,
        port: providerSettings.smtp.port,
        secure: providerSettings.smtp.secure,
        username: email,
        password: encryptedPassword
      },
      imapSettings: {
        host: providerSettings.imap.host,
        port: providerSettings.imap.port,
        secure: providerSettings.imap.secure,
        username: email,
        password: encryptedPassword
      },
      throttleSettings: { perHour: 50, perDay: 200 }
    });

    await mailbox.save();
    
    // Return the created mailbox with proper format
    const response = mailbox.toObject();
    delete response.smtpSettings.password;
    delete response.imapSettings.password;
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Mailbox creation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message, stack: error.stack });
  }
});

// Verify mailbox
router.post('/:id/verify', auth, async (req, res) => {
  try {
    const mailbox = await Mailbox.findOne({ _id: req.params.id, userId: req.user._id });
    if (!mailbox) {
      return res.status(404).json({ message: 'Mailbox not found' });
    }

    // Perform actual SMTP verification
    try {
      const decryptedPassword = decrypt(mailbox.smtpSettings.password);
      const transporter = nodemailer.createTransport({
        host: mailbox.smtpSettings.host,
        port: mailbox.smtpSettings.port,
        secure: mailbox.smtpSettings.secure,
        auth: {
          user: mailbox.smtpSettings.username,
          pass: decryptedPassword
        },
        timeout: 10000
      });
      
      await transporter.verify();
    } catch (smtpError) {
      console.error('SMTP verification failed:', smtpError);
      
      let errorMessage = 'SMTP verification failed';
      let suggestion = 'Please check your email credentials';
      
      if (smtpError.code === 'EAUTH') {
        errorMessage = 'Authentication failed';
        suggestion = 'Use App Password for Gmail/Outlook, not regular password';
      } else if (smtpError.code === 'ECONNECTION') {
        errorMessage = 'Connection failed';
        suggestion = 'Check your internet connection and SMTP settings';
      }
      
      return res.status(400).json({ 
        message: errorMessage, 
        error: smtpError.message,
        suggestion: suggestion
      });
    }

    mailbox.isVerified = true;
    mailbox.lastVerified = new Date();
    await mailbox.save();

    res.json({ message: 'Mailbox verified successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Verification failed', error: error.message });
  }
});

// Update mailbox
router.put('/:id', auth, async (req, res) => {
  try {
    const { displayName, password } = req.body;
    
    const mailbox = await Mailbox.findOne({ _id: req.params.id, userId: req.user._id });
    if (!mailbox) {
      return res.status(404).json({ message: 'Mailbox not found' });
    }

    if (displayName) mailbox.displayName = displayName;
    if (password) {
      const encryptedPassword = encrypt(password);
      mailbox.smtpSettings.password = encryptedPassword;
      mailbox.imapSettings.password = encryptedPassword;
      mailbox.isVerified = false;
    }

    await mailbox.save();
    
    const response = mailbox.toObject();
    delete response.smtpSettings.password;
    delete response.imapSettings.password;
    
    res.json(response);
  } catch (error) {
    console.error('Mailbox update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete mailbox
router.delete('/:id', auth, async (req, res) => {
  try {
    const mailbox = await Mailbox.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!mailbox) {
      return res.status(404).json({ message: 'Mailbox not found' });
    }
    res.json({ message: 'Mailbox deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;