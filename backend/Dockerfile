FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json ./
COPY package-lock.json* ./

# Install production dependencies
RUN npm install --omit=dev --no-audit

# Copy application files
COPY . .

# Create required upload and export directories
RUN mkdir -p uploads/images uploads/documents uploads/reports uploads/prescriptions uploads/serial-lists exports

# Expose port
EXPOSE 3308

# Start application
CMD ["npm", "start"]

