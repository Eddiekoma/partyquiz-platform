/**
 * Artillery Load Test Processor
 * Custom functions for load testing scenarios
 */

module.exports = {
  // Generate random string for unique player names
  generateRandomString: function(context, events, done) {
    context.vars.randomPlayerName = `Player_${Math.random().toString(36).substring(7)}`;
    return done();
  },
  
  // Generate random answer option (0-3 for multiple choice)
  generateRandomAnswer: function(context, events, done) {
    context.vars.randomAnswer = Math.floor(Math.random() * 4);
    return done();
  },
  
  // Generate random response time (simulate real user)
  generateResponseTime: function(context, events, done) {
    // Most users answer in 3-7 seconds
    context.vars.responseTime = Math.floor(Math.random() * 4000) + 3000;
    return done();
  },
  
  // Log test progress
  logProgress: function(context, events, done) {
    console.log(`[Artillery] User ${context.vars.randomPlayerName} joined session`);
    return done();
  },
  
  // After response hook - log errors
  afterResponse: function(requestParams, response, context, ee, next) {
    if (response.statusCode >= 400) {
      console.error(`[Error] ${requestParams.url} returned ${response.statusCode}`);
      console.error(`Response: ${JSON.stringify(response.body).substring(0, 200)}`);
    }
    return next();
  }
};
