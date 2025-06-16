const express = require('express');
const router = express.Router();
const {
  createFreeRequest,
  getReceivedFreeRequests,
  getSentFreeRequests,
  respondToFreeRequest,
  cancelFreeRequest
} = require('../controllers/freeRequestController');

// Create a free request
router.post('/', createFreeRequest);

// Get received free requests (for product owners)
router.get('/received', getReceivedFreeRequests);

// Get sent free requests (for requesters)
router.get('/sent', getSentFreeRequests);

// Respond to free request (accept/reject)
router.patch('/:requestId/respond', respondToFreeRequest);

// Cancel free request
router.patch('/:requestId/cancel', cancelFreeRequest);

module.exports = router; 