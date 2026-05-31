const express = require('express');
const auth = require('../middleware/auth');
const { addClient } = require('../utils/realtime');

const router = express.Router();

// SSE endpoint for real-time updates
router.get('/events', async (req, res) => {
  try {
    // Get token from query parameter (EventSource doesn't support headers)
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    // Verify token manually
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    req.user = user;
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ message: 'Connected to real-time updates' })}\n\n`);

  // Send buffered logs history
  try {
    const { getLogBuffer } = require('../utils/realtime');
    const history = getLogBuffer();
    history.forEach(log => {
      res.write(`event: celery-log\n`);
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });
  } catch (logHistErr) {
    console.error('Error sending buffered logs to new connection:', logHistErr);
  }

  // Add client to real-time updates
  addClient(req.user._id.toString(), res);

  console.log(`User ${req.user._id} connected to real-time updates`);
  
  } catch (error) {
    console.error('Real-time connection error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
});

module.exports = router;