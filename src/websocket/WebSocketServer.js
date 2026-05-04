import { WebSocketServer } from 'ws';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import Stock from '../models/Stock.js';

class PEXWebSocketServer {
  constructor(server) {
    this.wss = new WebSocketServer({ 
      server,
      // Custom protocol handling for JWT handshake
      handleProtocols: (protocols, request) => {
        // Client sends JWT as subprotocol
        const jwt = Array.from(protocols)[0];
        if (jwt && jwt.length > 10) {
          return jwt;
        }
        return false;
      }
    });
    
    this.clients = new Map(); // userId -> { ws, ticker }
    
    this.setupListeners();
  }
  
  setupListeners() {
    this.wss.on('connection', async (ws, request, client) => {
      // Extract JWT from protocol header
      const token = ws.protocol;
      
      if (!token) {
        ws.close(1008, 'JWT token required in Sec-WebSocket-Protocol header');
        return;
      }
      
      const decoded = verifyToken(token);
      if (!decoded) {
        ws.close(1008, 'Invalid JWT token');
        return;
      }
      
      const userId = decoded.userId;
      
      // Get user's stock ticker
      const user = await User.findById(userId);
      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }
      
      this.clients.set(userId, {
        ws,
        ticker: user.myStock?.ticker || null
      });
      
      console.log(`WebSocket connected: ${user.username} (${userId})`);
      
      // Send initial market data
      await this.sendInitialData(ws);
      
      ws.on('close', () => {
        this.clients.delete(userId);
        console.log(`WebSocket disconnected: ${user.username}`);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${user.username}:`, error);
      });
    });
  }
  
  async sendInitialData(ws) {
    const stocks = await Stock.find().populate('ownerId', 'username');
    const marketData = {
      type: 'INITIAL_MARKET_DATA',
      payload: stocks.map(stock => ({
        ticker: stock.ticker,
        price: stock.currentPrice,
        owner: stock.ownerName
      }))
    };
    ws.send(JSON.stringify(marketData));
  }
  
  async broadcastTickerUpdate(ticker, newPrice) {
    // Format: { "type": "TICKER_UPDATE", "payload": { "ticker": "XYZ", "price": 155.20 } }
    const message = JSON.stringify({
      type: 'TICKER_UPDATE',
      payload: {
        ticker: ticker,
        price: newPrice
      }
    });
    
    // Broadcast to ALL connected clients
    for (const [userId, client] of this.clients) {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(message);
      }
    }
  }
  
  async broadcastTrade(ticker, shares, buyerName, sellerName) {
    const message = JSON.stringify({
      type: 'TRADE_EXECUTED',
      payload: {
        ticker,
        shares,
        buyer: buyerName,
        seller: sellerName,
        timestamp: new Date().toISOString()
      }
    });
    
    for (const [userId, client] of this.clients) {
      if (client.ws.readyState === 1) {
        client.ws.send(message);
      }
    }
  }
}

export default PEXWebSocketServer;