const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getCurrentUser } = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../validators/authValidator');
const authMiddleware = require('../middleware/authMiddleware');


router.post('/register', validateRegistration, registerUser);
router.post('/login', validateLogin, loginUser);
router.get('/me', authMiddleware, getCurrentUser);

module.exports = router;
