require('dotenv').config();
const app = require('./app');
const migrate = require('./db/migrate');
const { syncFinanceBootstrap, hasBootstrapFile } = require('./services/financeBootstrap');

const PORT = process.env.PORT || 4000;

async function start() {
  // Wait for DB to be ready (especially in Docker)
  const maxRetries = 10;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await migrate();
      break;
    } catch (err) {
      if (i === maxRetries) {
        console.error('❌ Could not connect to database after', maxRetries, 'attempts. Exiting.');
        process.exit(1);
      }
      console.log(`⏳ Waiting for database... (attempt ${i}/${maxRetries})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (hasBootstrapFile()) {
    try {
      const result = await syncFinanceBootstrap();
      if (result.imported) {
        console.log('Finance bootstrap synced from Excel source');
      }
    } catch (err) {
      console.error('Failed to sync finance bootstrap data:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 CRM Backend running on http://localhost:${PORT}`);
  });
}

start();
