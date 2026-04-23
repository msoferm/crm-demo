FROM node:20-alpine

# wget needed for docker-compose healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Install dependencies first (layer caching)
COPY crm-backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source and bootstrap data
COPY crm-backend/ ./
COPY excel-bootstrap-data.js ./excel-bootstrap-data.js

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 4000

CMD ["node", "src/server.js"]
