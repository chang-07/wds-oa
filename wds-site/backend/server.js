require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema and Model
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const User = mongoose.model('User', UserSchema);

// Message Schema and Model
const MessageSchema = new mongoose.Schema({
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model('Message', MessageSchema);

// Bubble Schema and Model
const BubbleSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  color: {
    type: String,
    required: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Bubble = mongoose.model('Bubble', BubbleSchema);

// Channel Schema and Model
const ChannelSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  }],
});

const Channel = mongoose.model('Channel', ChannelSchema);


// JWT Secret
const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey';

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded.user;
    next();
  } catch (e) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    let user = await User.findOne({ username });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({ username, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { user: { id: user.id } };
    jwt.sign(payload, jwtSecret, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.post('/api/auth/login', async (req, res) => {
  console.log('Login request received:', req.body);
  const { username, password } = req.body;
  try {
    let user = await User.findOne({ username });
    if (!user) {
      console.log('User not found:', username);
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for user:', username);
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = { user: { id: user.id } };
    jwt.sign(payload, jwtSecret, { expiresIn: '1h' }, (err, token) => {
      if (err) {
        console.error('JWT signing error:', err);
        throw err;
      }
      console.log('Login successful for user:', username);
      res.json({ token });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('Server error');
  }
});

app.get('/api/auth/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Message Routes
app.post('/api/messages', auth, async (req, res) => {
  const { receiverId, content } = req.body;
  try {
    const newMessage = new Message({
      sender: req.user.id,
      receiver: receiverId,
      content,
    });
    const message = await newMessage.save();
    res.json(message);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.get('/api/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user.id }, { receiver: req.user.id }],
    })
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Bubble Routes
// @route   POST /api/bubbles
// @desc    Create a new bubble
// @access  Private
app.post('/api/bubbles', auth, async (req, res) => {
  const { text, position, color } = req.body;
  try {
    const newBubble = new Bubble({
      text,
      position,
      color,
      creator: req.user.id,
    });
    const bubble = await newBubble.save();
    res.json(bubble);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/bubbles
// @desc    Get all bubbles
// @access  Public (or Private if only logged-in users can see bubbles)
app.get('/api/bubbles', async (req, res) => { // Changed to public for now
  try {
    const bubbles = await Bubble.find().populate('creator', 'username');
    res.json(bubbles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/bubbles/:id
// @desc    Update a bubble's position
// @access  Private (only creator can update, or any logged-in user)
app.put('/api/bubbles/:id', auth, async (req, res) => {
  const { x, y } = req.body;
  try {
    let bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ msg: 'Bubble not found' });

    // Optional: Check if req.user.id matches bubble.creator to restrict updates
    // if (bubble.creator.toString() !== req.user.id) {
    //   return res.status(401).json({ msg: 'User not authorized' });
    // }

    bubble.position.x = x;
    bubble.position.y = y;
    await bubble.save();
    res.json(bubble);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/bubbles/:id
// @desc    Delete a bubble
// @access  Private (only creator can delete)
app.delete('/api/bubbles/:id', auth, async (req, res) => {
  try {
    let bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ msg: 'Bubble not found' });

    // Optional: Check if req.user.id matches bubble.creator to restrict deletion
    // if (bubble.creator.toString() !== req.user.id) {
    //   return res.status(401).json({ msg: 'User not authorized' });
    // }

    await Bubble.deleteOne({ _id: req.params.id });
    res.json({ msg: 'Bubble removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Channel Routes
app.post('/api/channels', auth, async (req, res) => {
  const { receiverId, content, senderId } = req.body;
  try {
    // Use senderId if provided (bubble creator), otherwise use current user
    const messageSender = senderId || req.user.id;
    const participants = [req.user.id, receiverId];
    
    // Add senderId to participants if it's different from current user
    if (senderId && !participants.includes(senderId)) {
      participants.push(senderId);
    }
    
    const newChannel = new Channel({
      participants: participants,
    });
    const channel = await newChannel.save();
    
    // For the initial message, the receiver should be the current user (who clicked the bubble)
    // and the sender should be the bubble creator
    const newMessage = new Message({
          channel: channel._id,
          sender: req.user.id, // The person who popped the bubble
          receiver: receiverId, // The bubble creator
          content,
        });
    const message = await newMessage.save();
    channel.messages.push(message._id);
    await channel.save();
    
    // Populate the channel with messages and sender info before returning
    const populatedChannel = await Channel.findById(channel._id).populate({
      path: 'messages',
      populate: {
        path: 'sender receiver',
        select: 'username',
      },
    });
    res.json(populatedChannel);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.post('/api/channels/:id/messages', auth, async (req, res) => {
  const { content } = req.body;
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ msg: 'Channel not found' });

    // Find a receiver who is not the current user
    const receiver = channel.participants.find(p => p.toString() !== req.user.id);
    
    // If no other participant found, use the first participant as receiver
    const messageReceiver = receiver || channel.participants[0];

    const newMessage = new Message({
      channel: req.params.id,
      sender: req.user.id,
      receiver: messageReceiver,
      content,
    });
    const message = await newMessage.save();
    channel.messages.push(message._id);
    await channel.save();
    
    // Populate the message with sender info before returning
    const populatedMessage = await Message.findById(message._id).populate('sender receiver', 'username');
    res.json(populatedMessage);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.get('/api/channels/:id', auth, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id).populate({
      path: 'messages',
      populate: {
        path: 'sender receiver',
        select: 'username',
      },
    });
    if (!channel) return res.status(404).json({ msg: 'Channel not found' });
    res.json(channel);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/channels/user/:userId
// @desc    Get all channels for a specific user
// @access  Private (only the user themselves can access their channels)
app.get('/api/channels/user/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    // Ensure the requesting user is the same as the userId in the params
    if (req.user.id !== userId) {
      return res.status(403).json({ msg: 'Not authorized to view these channels' });
    }

    const channels = await Channel.find({ participants: userId })
      .sort({ _id: -1 }) // Sort by _id in descending order (most recent first)
      .limit(10)        // Limit to 10 channels
      .populate({
        path: 'messages',
        populate: {
          path: 'sender receiver',
          select: 'username',
        },
      });
    res.json(channels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});



// Start the server
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
