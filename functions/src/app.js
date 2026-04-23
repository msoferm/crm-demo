const express = require('express');
const cors = require('cors');
const path = require('path');

const equipmentRoutes = require('./routes/equipment');
const clientsRoutes = require('./routes/clients');
const ordersRoutes = require('./routes/orders');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const financesRoutes = require('./routes/finances');
const fixedExpensesRoutes = require('./routes/fixed-expenses');
const variableExpensesRoutes = require('./routes/variable-expenses');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API routes
app.use('/api/equipment', equipmentRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/fixed-expenses', fixedExpensesRoutes);
app.use('/api/variable-expenses', variableExpensesRoutes);

// 404 + Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
