const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./config/dbConnect');
const app = express();

dotenv.config();

connectDB();

app.use(cors());

app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/product', require('./routes/productRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/images', require('./routes/imageRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
