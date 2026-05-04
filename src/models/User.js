import mongoose from 'mongoose';

const holdingSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    uppercase: true
  },
  shares: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  walletBalance: {
    type: Number,
    required: true,
    default: 10000,
    min: 0
  },
  holdings: [holdingSchema],
  myStock: {
    ticker: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true
    },
    currentPrice: {
      type: Number,
      default: 100,
      min: 0.01
    }
  }
}, {
  timestamps: true
});

// Remove this line to fix duplicate index warning:
// userSchema.index({ 'myStock.ticker': 1 });

export default mongoose.model('User', userSchema);