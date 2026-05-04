// import express from 'express';
// import http from 'http';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';
// import PEXWebSocketServer from './websocket/WebSocketServer.js';
// import authRoutes from './routes/auth.js';
// import stockRoutes, { setWebSocketServer as setStockWSS } from './routes/stocks.js';
// import tradingRoutes, { setWebSocketServer as setTradingWSS } from './routes/trading.js';

// dotenv.config();

// const app = express();
// const server = http.createServer(app);

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/stocks', stockRoutes);
// app.use('/api/trading', tradingRoutes);

// // Health check
// app.get('/health', (req, res) => {
//   res.json({ status: 'ok', timestamp: new Date().toISOString() });
// });

// // Initialize WebSocket server
// const wsServer = new PEXWebSocketServer(server);
// setStockWSS(wsServer);
// setTradingWSS(wsServer);

// // Database connection
// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// })
// .then(() => console.log('MongoDB connected'))
// .catch(err => console.error('MongoDB connection error:', err));

// const PORT = process.env.PORT || 5001;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`WebSocket server ready for connections`);
// });




import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import PEXWebSocketServer from './websocket/WebSocketServer.js';
import authRoutes from './routes/auth.js';
import stockRoutes, { setWebSocketServer as setStockWSS } from './routes/stocks.js';
import tradingRoutes, { setWebSocketServer as setTradingWSS } from './routes/trading.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Verify environment variables
console.log('Environment check:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
console.log('PORT:', process.env.PORT || '5001');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/trading', tradingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize WebSocket server
const wsServer = new PEXWebSocketServer(server);
setStockWSS(wsServer);
setTradingWSS(wsServer);

// Database connection with better error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pex';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully to:', MONGODB_URI);
  console.log('Database: pex');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('\nTroubleshooting:');
  console.log('1. Make sure MongoDB is installed: brew install mongodb-community');
  console.log('2. Start MongoDB: brew services start mongodb-community');
  console.log('3. Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest');
  process.exit(1);
});

// Fix duplicate index warning - remove index from schema
// Update backend/src/models/User.js line ~40:

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
});