const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
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
// Start BullMQ email worker to listen for outbox sequences
require('./queues/emailWorker');

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

// Stripe Router (mounted before JSON parser for raw webhook body validation)
app.use('/api/stripe', require('./routes/stripe'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

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

// Root-level unsubscribe handler (Step 13)
app.get('/unsubscribe', async (req, res) => {
  try {
    const { leadId } = req.query;
    if (!leadId) return res.status(400).send('Lead ID is required');
    const Contact = require('./models/Contact');
    await Contact.findByIdAndUpdate(leadId, { status: 'unsubscribed' });
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #333;">
          <div style="max-width: 500px; margin: 50px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 4px solid #4f46e5;">
            <h2 style="color: #4f46e5; margin-bottom: 20px;">Successfully Unsubscribed</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">You have been unsubscribed from our mailing list. You will no longer receive follow-up emails from this campaign.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send('Error processing unsubscribe request');
  }
});

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
  console.log('✅ All Node workers started successfully');

  // Spawn Python Celery Worker automatically
  const { spawn } = require('child_process');
  const path = require('path');
  console.log('🔄 Spawning Python Celery background worker...');

  const celeryCmd = path.join(__dirname, '../scraper/venv/bin/celery');
  const celeryWorker = spawn(
    celeryCmd,
    ['-A', 'app.workers.celery_app', 'worker', '--loglevel=info'],
    {
      cwd: __dirname,
      env: { ...process.env, PYTHONPATH: __dirname, PYTHONUNBUFFERED: '1' }
    }
  );

  celeryWorker.stdout.on('data', (data) => {
    const text = data.toString().trim();
    console.log(`[Celery]: ${text}`);
    try {
      const { broadcastToAll, bufferLog } = require('./utils/realtime');
      bufferLog(text, 'stdout');
      broadcastToAll('celery-log', { text, type: 'stdout', timestamp: new Date().toLocaleTimeString() });
    } catch (e) {}
  });

  celeryWorker.stderr.on('data', (data) => {
    const text = data.toString().trim();
    console.error(`[Celery Err]: ${text}`);
    try {
      const { broadcastToAll, bufferLog } = require('./utils/realtime');
      bufferLog(text, 'stderr');
      broadcastToAll('celery-log', { text, type: 'stderr', timestamp: new Date().toLocaleTimeString() });
    } catch (e) {}
  });

  celeryWorker.on('error', (err) => {
    console.error('❌ Failed to start Celery process:', err);
  });

  celeryWorker.on('close', (code) => {
    console.log(`[Celery] worker process exited with code ${code}`);
  });

  // Clean shutdown
  process.on('SIGINT', () => {
    celeryWorker.kill();
    process.exit();
  });
  process.on('SIGTERM', () => {
    celeryWorker.kill();
    process.exit();
  });

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