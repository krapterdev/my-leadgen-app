const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Contact = require('../models/Contact');
const auth = require('../middleware/auth');
const validator = require('validator');

const router = express.Router();

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});

// Get all contacts
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search, businessType, location } = req.query;
    const query = { userId: req.user._id };

    if (status) query.status = status;
    
    // Filter by domain age category (businessType: STARTUP, ESTABLISHED, UNKNOWN)
    if (businessType) {
      query['customFields.businessType'] = businessType;
    }
    
    // Filter by company location (GMB address)
    if (location) {
      query['customFields.address'] = { $regex: location, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Contact.countDocuments(query);

    res.json({
      contacts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add single contact
router.post('/', auth, async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;
    
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ message: 'Email, first name, and last name are required' });
    }
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    const contactData = { ...req.body, userId: req.user._id, email: email.toLowerCase() };
    
    const existing = await Contact.findOne({ 
      userId: req.user._id, 
      email: contactData.email 
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Contact already exists' });
    }

    const contact = new Contact(contactData);
    await contact.save();
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload CSV
router.post('/upload', auth, upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const results = [];
    const duplicates = [];
    const errors = [];
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let imported = 0;
        
        for (const row of results) {
          try {
            const email = row.email?.toLowerCase();
            
            if (!email || !validator.isEmail(email)) {
              errors.push(`Invalid email: ${email}`);
              continue;
            }
            
            const contactData = {
              userId: req.user._id,
              email,
              firstName: row.firstName || row.first_name,
              lastName: row.lastName || row.last_name,
              company: row.company,
              title: row.title,
              timezone: row.timezone
            };

            if (!contactData.firstName || !contactData.lastName) {
              errors.push(`Missing name for: ${email}`);
              continue;
            }

            // Check for duplicate
            const existing = await Contact.findOne({ 
              userId: req.user._id, 
              email: contactData.email 
            });
            
            if (existing) {
              duplicates.push(contactData.email);
              continue;
            }

            const contact = new Contact(contactData);
            await contact.save();
            imported++;
          } catch (error) {
            console.error('Error importing contact:', error);
          }
        }

        // Clean up uploaded file
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('Error deleting file:', err);
        }

        res.json({
          message: 'CSV processed successfully',
          imported,
          duplicates: duplicates.length,
          errors: errors.length,
          total: results.length
        });
      })
      .on('error', (error) => {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
        res.status(500).json({ message: 'Error processing CSV', error: error.message });
      });
  } catch (error) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update contact
router.put('/:id', auth, async (req, res) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete contact
router.delete('/:id', auth, async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk delete contacts
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No contact IDs provided' });
    }
    const result = await Contact.deleteMany({
      _id: { $in: ids },
      userId: req.user._id
    });
    res.json({ message: 'Contacts deleted successfully', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clean trash contacts
router.post('/clean-trash', auth, async (req, res) => {
  try {
    const query = {
      userId: req.user._id,
      $or: [
        {
          email: { $regex: '^info@', $options: 'i' },
          $or: [
            { 'customFields.phone': { $exists: false } },
            { 'customFields.phone': '' }
          ],
          $or: [
            { 'customFields.website': { $exists: false } },
            { 'customFields.website': '' }
          ]
        },
        {
          email: { $exists: false },
          phone: { $exists: false },
          website: { $exists: false }
        }
      ]
    };
    const result = await Contact.deleteMany(query);
    res.json({ message: `Database cleaning completed. Removed ${result.deletedCount} empty shell leads.`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const { exec } = require('child_process');

// Trigger background scraper task
router.post('/scrape', auth, async (req, res) => {
  try {
    const { query, maxResults = 20, useProxy = false } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Command to run the trigger python script using the venv python
    const cmd = `../scraper/venv/bin/python trigger_scrape.py --query "${query.replace(/"/g, '\\"')}" --max_results ${maxResults} --use_proxy ${useProxy} --user_id "${req.user._id}"`;
    
    exec(cmd, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        console.error('Failed to trigger scraper task:', error, stderr);
        return res.status(500).json({ message: `Failed to trigger scraper task: ${stderr || error.message}` });
      }
      
      if (stdout.includes('ERROR:')) {
        console.error('Scraper task error in Python:', stdout);
        return res.status(500).json({ message: `Failed to queue scraper task: ${stdout.trim()}` });
      }
      
      console.log('Scraper task successfully queued:', stdout);
      res.json({ message: 'Scraping task queued successfully in background' });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;