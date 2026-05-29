const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const mailboxRoutes = require('./routes/mailbox');
const dnsRoutes = require('./routes/dns');
const contactRoutes = require('./routes/contact');
const campaignRoutes = require('./routes/campaign');
const trackingRoutes = require('./routes/tracking');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes = require('./routes/settings');
const templateRoutes = require('./routes/template');
const dashboardRoutes = require('./routes/dashboard');
const realtimeRoutes = require('./routes/realtime');
const manualTrackingRoutes = require('./routes/manual-tracking');
const webhookRoutes = require('./routes/webhook');
const emailHistoryRoutes = require('./routes/emailHistory');

const { startImapWorker } = require('./workers/imapWorker');
const { startEmailWorker } = require('./workers/emailWorker');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased limit
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' // skip localhost
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Health check endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mailbox', mailboxRoutes);
app.use('/api/dns', dnsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/campaign', campaignRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/analytics', trackingRoutes); // For email-engagement endpoint
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/template', templateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/manual-tracking', manualTrackingRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/email-history', emailHistoryRoutes);
app.use('/api/email-status', require('./routes/emailStatus'));
app.use('/t', require('./routes/t'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start workers
try {
  startImapWorker();
  startEmailWorker();
  console.log('✅ All workers started successfully');
} catch (error) {
  console.error('Worker startup error:', error);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Warning for localhost tracking
  if (process.env.BASE_URL && process.env.BASE_URL.includes('localhost')) {
    console.warn('\n⚠️  WARNING: BASE_URL is set to localhost. Email tracking (opens/clicks) will NOT work for external recipients.');
    console.warn('👉 Set BASE_URL to a public domain or ngrok URL in .env for production use.\n');
  }
});

module.exports = app;