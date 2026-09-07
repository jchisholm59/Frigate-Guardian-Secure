# Use a lightweight Node.js image
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the frontend and bundle the server
RUN npm run build

# Expose the default port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
