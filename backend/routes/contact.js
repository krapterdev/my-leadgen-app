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
    const { page = 1, limit = 50, status, search } = req.query;
    const query = { userId: req.user._id };

    if (status) query.status = status;
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

module.exports = router;