const validateRegistration = (req, res, next) => {
  const { name, email, password } = req.body;

  // Check if all required fields are provided
  if (!name || !email || !password) {
    return res.status(400).json({
      message: "All fields are required",
      success: false
    });
  }

  // Validate name
  if (name.trim().length < 2) {
    return res.status(400).json({
      message: "Name must be at least 2 characters long",
      success: false
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Please enter a valid email address",
      success: false
    });
  }

  // Validate password
  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters long",
      success: false
    });
  }

  // Password strength validation (optional but recommended)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      success: false
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  // Check if all required fields are provided
  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
      success: false
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Please enter a valid email address",
      success: false
    });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin
};
