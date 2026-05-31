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
    enum: ['running', 'completed', 'failed'],
    default: 'running'
  },
  count: {
    type: Number,
    default: 0
  },
  errorMessage: String
}, {
  timestamps: true
});

module.exports = mongoose.model('ScraperBatch', scraperBatchSchema);
