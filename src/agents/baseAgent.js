/**
 * BaseAgent class
 * Every specialist agent in the multi-agent system inherits from this base class.
 * It manages states, logs, thinking processes, and database queries.
 */

export class BaseAgent {
  constructor(name, displayName, role, systemPrompt) {
    this.name = name;
    this.displayName = displayName;
    this.role = role;
    this.systemPrompt = systemPrompt;
    this.status = 'IDLE'; // IDLE, THINKING, QUERYING, ANALYZING, REPORTING
    this.logs = [];
    this.queryLog = [];
    this.onStateChangeCallbacks = [];
  }

  registerStateChangeCallback(callback) {
    this.onStateChangeCallbacks.push(callback);
  }

  transitionTo(status, activityLog = null) {
    this.status = status;
    if (activityLog) {
      this.addLog(activityLog);
    }
    this.notifyStateChange();
  }

  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push({ timestamp, message });
    this.notifyStateChange();
  }

  addQuery(queryStr, resultsCount = 0) {
    const timestamp = new Date().toLocaleTimeString();
    this.queryLog.push({ timestamp, query: queryStr, count: resultsCount });
    this.notifyStateChange();
  }

  notifyStateChange() {
    this.onStateChangeCallbacks.forEach(cb => cb(this));
  }

  clearLogs() {
    this.logs = [];
    this.queryLog = [];
    this.status = 'IDLE';
    this.notifyStateChange();
  }
}
