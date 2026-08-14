FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Bust cache for source code changes
ARG CACHEBUST=1

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p uploads/images uploads/documents uploads/reports uploads/prescriptions uploads/serial-lists exports

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]

