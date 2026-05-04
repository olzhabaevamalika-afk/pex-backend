import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Stock from '../models/Stock.js';
import mongoose from 'mongoose';
import PEXWebSocketServer from '../websocket/WebSocketServer.js';

const router = express.Router();
let wsServer = null;

export const setWebSocketServer = (server) => {
  wsServer = server;
};

// Buy shares - Atomic transaction
router.post('/buy', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { ticker, shares } = req.body;
    
    if (!shares || shares <= 0) {
      return res.status(400).json({ error: 'Invalid shares quantity' });
    }
    
    const normalizedTicker = ticker.toUpperCase();
    
    // Get stock with lock
    const stock = await Stock.findOne({ ticker: normalizedTicker }).session(session);
    if (!stock) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    // Get buyer with lock
    const buyer = await User.findById(req.userId).session(session);
    if (!buyer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const totalCost = stock.currentPrice * shares;
    
    // Check if buyer has enough cash
    if (buyer.walletBalance < totalCost) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    
    // Get seller (stock owner)
    const seller = await User.findById(stock.ownerId).session(session);
    if (!seller) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Seller not found' });
    }
    
    // Atomic transaction: Update buyer's balance and holdings
    buyer.walletBalance -= totalCost;
    
    // Update buyer's holdings
    const holdingIndex = buyer.holdings.findIndex(h => h.ticker === normalizedTicker);
    if (holdingIndex >= 0) {
      buyer.holdings[holdingIndex].shares += shares;
    } else {
      buyer.holdings.push({ ticker: normalizedTicker, shares });
    }
    
    // Update seller's balance
    seller.walletBalance += totalCost;
    
    // Save both in transaction
    await buyer.save({ session });
    await seller.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    // Broadcast trade
    if (wsServer) {
      await wsServer.broadcastTrade(normalizedTicker, shares, buyer.username, seller.username);
    }
    
    res.json({
      success: true,
      ticker: normalizedTicker,
      shares,
      price: stock.currentPrice,
      totalCost,
      newBalance: buyer.walletBalance,
      holdings: buyer.holdings
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
});

// Sell shares - Atomic transaction
router.post('/sell', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { ticker, shares } = req.body;
    
    if (!shares || shares <= 0) {
      return res.status(400).json({ error: 'Invalid shares quantity' });
    }
    
    const normalizedTicker = ticker.toUpperCase();
    
    // Get stock with lock
    const stock = await Stock.findOne({ ticker: normalizedTicker }).session(session);
    if (!stock) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    // Get seller with lock
    const seller = await User.findById(req.userId).session(session);
    if (!seller) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if seller has shares
    const holdingIndex = seller.holdings.findIndex(h => h.ticker === normalizedTicker);
    if (holdingIndex === -1 || seller.holdings[holdingIndex].shares < shares) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Insufficient shares' });
    }
    
    const totalRevenue = stock.currentPrice * shares;
    
    // Get buyer (stock owner)
    const buyer = await User.findById(stock.ownerId).session(session);
    if (!buyer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Buyer not found' });
    }
    
    // Atomic transaction: Update seller's balance and holdings
    seller.walletBalance += totalRevenue;
    
    // Remove or reduce shares
    if (seller.holdings[holdingIndex].shares === shares) {
      seller.holdings.splice(holdingIndex, 1);
    } else {
      seller.holdings[holdingIndex].shares -= shares;
    }
    
    // Update buyer's balance
    buyer.walletBalance -= totalRevenue;
    
    // Save both in transaction
    await seller.save({ session });
    await buyer.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    // Broadcast trade
    if (wsServer) {
      await wsServer.broadcastTrade(normalizedTicker, shares, buyer.username, seller.username);
    }
    
    res.json({
      success: true,
      ticker: normalizedTicker,
      shares,
      price: stock.currentPrice,
      totalRevenue,
      newBalance: seller.walletBalance,
      holdings: seller.holdings
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
});

// Get user portfolio
router.get('/portfolio', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get current prices for all stocks
    const stocksWithPrices = await Promise.all(
      user.holdings.map(async (holding) => {
        const stock = await Stock.findOne({ ticker: holding.ticker });
        return {
          ticker: holding.ticker,
          shares: holding.shares,
          currentPrice: stock?.currentPrice || 0
        };
      })
    );
    
    res.json({
      walletBalance: user.walletBalance,
      holdings: stocksWithPrices,
      myStock: user.myStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;