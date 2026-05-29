const express = require('express');
const Template = require('../models/Template');

const router = express.Router();

// Auth helper
const authenticate = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token verification failed' });
  }
};

// Get all templates
router.get('/', authenticate, async (req, res) => {
  try {
    const templates = await Template.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ data: templates });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create template
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, subject, body, variables, category } = req.body;
    
    const template = new Template({
      userId: req.user._id,
      name,
      subject,
      body,
      variables: variables || [],
      category: category || 'general'
    });

    await template.save();
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single template
router.get('/:id', authenticate, async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.user._id });
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update template
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, subject, body, variables, category, isActive } = req.body;
    
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name, subject, body, variables, category, isActive },
      { new: true }
    );
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete template
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const template = await Template.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;