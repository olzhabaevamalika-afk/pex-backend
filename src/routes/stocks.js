import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Stock from '../models/Stock.js';
import PEXWebSocketServer from '../websocket/WebSocketServer.js';

const router = express.Router();
let wsServer = null;

export const setWebSocketServer = (server) => {
  wsServer = server;
};

// Create my own stock
router.post('/create', authenticate, async (req, res) => {
  try {
    const { ticker } = req.body;
    
    if (!ticker || ticker.length < 1 || ticker.length > 5) {
      return res.status(400).json({ error: 'Ticker must be 1-5 characters' });
    }
    
    const normalizedTicker = ticker.toUpperCase();
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user already has a stock
    if (user.myStock && user.myStock.ticker) {
      return res.status(400).json({ error: 'You already have a stock' });
    }
    
    // Check if ticker exists
    const existingStock = await Stock.findOne({ ticker: normalizedTicker });
    if (existingStock) {
      return res.status(400).json({ error: 'Ticker already taken' });
    }
    
    // Create stock
    const stock = new Stock({
      ticker: normalizedTicker,
      ownerId: user._id,
      ownerName: user.username,
      currentPrice: 100
    });
    
    await stock.save();
    
    // Update user
    user.myStock = {
      ticker: normalizedTicker,
      currentPrice: 100
    };
    await user.save();
    
    res.status(201).json({
      ticker: normalizedTicker,
      currentPrice: 100,
      message: 'Stock created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update stock price (only owner)
router.patch('/:ticker/price', authenticate, async (req, res) => {
  try {
    const { ticker } = req.params;
    const { price } = req.body;
    
    if (!price || price < 0.01) {
      return res.status(400).json({ error: 'Invalid price' });
    }
    
    const normalizedTicker = ticker.toUpperCase();
    
    const stock = await Stock.findOne({ ticker: normalizedTicker });
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    // Check ownership
    if (stock.ownerId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: You can only change your own stock price' });
    }
    
    // Update price in database
    stock.currentPrice = price;
    await stock.save();
    
    // Update user's myStock
    await User.findByIdAndUpdate(req.userId, {
      'myStock.currentPrice': price
    });
    
    // Broadcast to ALL connected clients via WebSocket
    if (wsServer) {
      await wsServer.broadcastTickerUpdate(normalizedTicker, price);
    }
    
    res.json({
      ticker: normalizedTicker,
      price,
      message: 'Price updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all stocks
router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find().populate('ownerId', 'username');
    res.json(stocks.map(s => ({
      ticker: s.ticker,
      price: s.currentPrice,
      owner: s.ownerName,
      ownerId: s.ownerId._id
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;