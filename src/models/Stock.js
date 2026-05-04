import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true,
    default: 100,
    min: 0.01
  },
  totalShares: {
    type: Number,
    default: 1000000 // 1 million shares outstanding
  }
}, {
  timestamps: true
});

export default mongoose.model('Stock', stockSchema);