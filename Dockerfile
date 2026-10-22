# Mini Militia Web Dedicated Server Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy all application files
COPY package*.json ./
COPY . .

# Expose server port
EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

# Run dedicated game server
CMD ["node", "server.js"]
