FROM node:20-slim

WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install dependencies (production only for slim image size)
RUN npm ci --only=production || npm install --production

# Bust cache for source code changes
ARG CACHEBUST=1

# Copy application files
COPY . .

# Create required upload and export directories
RUN mkdir -p uploads/images uploads/documents uploads/reports uploads/prescriptions uploads/serial-lists exports

# Expose port
EXPOSE 3308

# Start application
CMD ["npm", "start"]

