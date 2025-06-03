const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcryptjs");

exports.registerUser = async (req, res) => {
    try {
      const { name, email, password } = req.body;
  
      console.log('Checking if user exists...');
      const existingUser = await User.findOne({ email });
  
      if (existingUser) {
        return res.status(400).json({ 
          message: "Email already exists",
          success: false 
        });
      }
  
      const hashedPassword = await bcrypt.hash(password, 12);
  
      const user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        favorites: [],
        myListings: [],
        myOffers: [],
        notifications: [],
      });
  
      await user.save();
  
      const token = generateToken(user._id);
  
      res.status(201).json({
        message: "User registered successfully",
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error('🚨 Register User Error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({ 
          message: "Email already exists",
          success: false 
        });
      }
      
      res.status(500).json({ 
        message: "Server error. Please try again later.", 
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  

  exports.loginUser = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return res.status(400).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ 
          message: "Invalid email or password",
          success: false 
        });
      }
  
      const token = generateToken(user._id);
  
      res.status(200).json({
        message: "Login successful",
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error('🚨 Login User Error:', error);
      res.status(500).json({ 
        message: "Server error. Please try again later.", 
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  exports.getCurrentUser = async (req, res) => {
    try {
      const user = req.user;
      
      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          favorites: user.favorites,
          myListings: user.myListings,
          myOffers: user.myOffers,
          notifications: user.notifications,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      console.error('🚨 Get Current User Error:', error);
      res.status(500).json({ 
        message: "Server error. Please try again later.", 
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };