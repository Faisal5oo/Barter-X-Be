const cron = require('node-cron');
const Product = require('../models/Product');

// Schedule cleanup of expired food listings every hour
const scheduleCleanupTasks = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Running cleanup of expired food listings...');
      await Product.cleanupExpiredFood();
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });
};

module.exports = {
  scheduleCleanupTasks
}; 