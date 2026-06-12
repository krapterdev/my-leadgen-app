// Professional rate limiting for email sending
class RateLimiter {
  constructor() {
    this.mailboxLimits = new Map(); // mailboxId -> { hourly: [], daily: [] }
  }

  // Check if mailbox can send email (supports automated warmup)
  canSend(mailboxId, mailboxOrLimits) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    let limits = { perHour: 50, perDay: 200 };
    if (mailboxOrLimits) {
      if (mailboxOrLimits.throttleSettings) {
        limits.perHour = mailboxOrLimits.throttleSettings.perHour || 50;
        limits.perDay = mailboxOrLimits.throttleSettings.perDay || 200;
      } else {
        limits.perHour = mailboxOrLimits.perHour || 50;
        limits.perDay = mailboxOrLimits.perDay || 200;
      }

      // Automated Warmup Limit (Step 14)
      if (mailboxOrLimits.warmupEnabled) {
        const startDate = mailboxOrLimits.warmupStartDate ? new Date(mailboxOrLimits.warmupStartDate) : new Date(mailboxOrLimits.createdAt || Date.now());
        const daysElapsed = Math.floor((now - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const startLimit = mailboxOrLimits.warmupStartLimit || 5;
        const increment = mailboxOrLimits.warmupIncrement || 5;
        
        // Day 1: 5, Day 2: 10, Day 3: 15... or 5 * 2^daysElapsed
        // Capped at standard daily throttle limit
        const calculatedDailyLimit = startLimit + Math.max(0, daysElapsed) * increment;
        limits.perDay = Math.min(limits.perDay, calculatedDailyLimit);
      }
    }

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
        reason: `Daily limit exceeded (Limit: ${limits.perDay})`,
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