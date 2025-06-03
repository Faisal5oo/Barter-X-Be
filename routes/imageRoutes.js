const express = require('express');
const router = express.Router();
const { generateSignedUrls, uploadImages } = require('../controllers/imageController');
const { uploadMultiple } = require('../middleware/uploadMiddleware');

router.post('/signed-urls', generateSignedUrls);
router.post('/upload', uploadMultiple, uploadImages);

module.exports = router; 