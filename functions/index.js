const { setGlobalOptions } = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

setGlobalOptions({ maxInstances: 10 });

const databaseUrl = defineSecret('DATABASE_URL');

let app;

exports.api = onRequest(
  { secrets: [databaseUrl], region: 'europe-west1', invoker: 'public' },
  (req, res) => {
    process.env.DATABASE_URL = databaseUrl.value();
    process.env.CORS_ORIGIN = '*';

    if (!app) {
      app = require('./src/app');
    }
    app(req, res);
  }
);
