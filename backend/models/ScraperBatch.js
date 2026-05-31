const mongoose = require('mongoose');

const scraperBatchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  query: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['running', 'paused', 'completed', 'failed', 'killed'],
    default: 'running'
  },
  count: {
    type: Number,
    default: 0
  },
  maxResults: {
    type: Number,
    default: 20
  },
  useProxy: {
    type: Boolean,
    default: false
  },
  taskId: String,
  errorMessage: String
}, {
  timestamps: true
});

module.exports = mongoose.model('ScraperBatch', scraperBatchSchema);
