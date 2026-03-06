FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy TypeScript source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npm run build

# Create runtime directories
RUN mkdir -p store workspace/uploads

# Clean up dev deps
RUN npm prune --production

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
