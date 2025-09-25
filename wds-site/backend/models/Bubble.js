const mongoose = require('mongoose');

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

module.exports = mongoose.model('Bubble', BubbleSchema);