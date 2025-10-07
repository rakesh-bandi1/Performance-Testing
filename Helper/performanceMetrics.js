class PerformanceMetrics {
  constructor() {
    this.startTime = new Date();
    this.metrics = [];
    this.errors = [];
  }

  addMetric(userId, metricName, value, timestamp = new Date()) {
    this.metrics.push({
      userId,
      metricName,
      value,
      timestamp,
      duration: this.calculateDuration(timestamp),
    });
  }

  addError(userId, error, context) {
    this.errors.push({
      userId,
      error: error.message,
      context,
      timestamp: new Date(),
    });
  }

  calculateDuration(timestamp) {
    return (timestamp - this.startTime) / 1000;
  }

  getScriptRunTime() {
    return this.calculateDuration(new Date());
  }
}

module.exports = PerformanceMetrics;
