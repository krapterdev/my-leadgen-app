// Professional rate limiting for email sending
class RateLimiter {
  constructor() {
    this.mailboxLimits = new Map(); // mailboxId -> { hourly: [], daily: [] }
  }

  // Check if mailbox can send email
  canSend(mailboxId, limits = { perHour: 50, perDay: 200 }) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    if (!this.mailboxLimits.has(mailboxId)) {
      this.mailboxLimits.set(mailboxId, { hourly: [], daily: [] });
    }

    const mailboxData = this.mailboxLimits.get(mailboxId);

    // Clean old entries
    mailboxData.hourly = mailboxData.hourly.filter(time => now - time < oneHour);
    mailboxData.daily = mailboxData.daily.filter(time => now - time < oneDay);

    // Check limits
    if (mailboxData.hourly.length >= limits.perHour) {
      return { 
        allowed: false, 
        reason: 'Hourly limit exceeded',
        resetIn: oneHour - (now - Math.min(...mailboxData.hourly))
      };
    }

    if (mailboxData.daily.length >= limits.perDay) {
      return { 
        allowed: false, 
        reason: 'Daily limit exceeded',
        resetIn: oneDay - (now - Math.min(...mailboxData.daily))
      };
    }

    return { allowed: true };
  }

  // Record email sent
  recordSent(mailboxId) {
    const now = Date.now();
    
    if (!this.mailboxLimits.has(mailboxId)) {
      this.mailboxLimits.set(mailboxId, { hourly: [], daily: [] });
    }

    const mailboxData = this.mailboxLimits.get(mailboxId);
    mailboxData.hourly.push(now);
    mailboxData.daily.push(now);
  }

  // Get current usage stats
  getStats(mailboxId, limits = { perHour: 50, perDay: 200 }) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    if (!this.mailboxLimits.has(mailboxId)) {
      return { hourly: 0, daily: 0, hourlyLimit: limits.perHour, dailyLimit: limits.perDay };
    }

    const mailboxData = this.mailboxLimits.get(mailboxId);
    
    const hourlyCount = mailboxData.hourly.filter(time => now - time < oneHour).length;
    const dailyCount = mailboxData.daily.filter(time => now - time < oneDay).length;

    return {
      hourly: hourlyCount,
      daily: dailyCount,
      hourlyLimit: limits.perHour,
      dailyLimit: limits.perDay,
      hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
      dailyRemaining: Math.max(0, limits.perDay - dailyCount)
    };
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter();

module.exports = {
  RateLimiter,
  globalRateLimiter
};