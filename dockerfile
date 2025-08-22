FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Switch to non-root user for security
USER pptruser

# Default command
CMD ["npm", "run", "vizpad"]

