# Use a lightweight Node.js image
FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install FFmpeg (audio relay + clip transcoding) and the Intel VAAPI driver
# so clip transcoding can use Quick Sync hardware encoding on Intel hosts
# (e.g. a NUC) when /dev/dri is passed through. Falls back to software
# encoding automatically if the driver or device isn't available.
RUN apt-get update && apt-get install -y ffmpeg intel-media-va-driver vainfo && rm -rf /var/lib/apt/lists/*

# Install npm dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the frontend and bundle the server
RUN npm run build

# Expose the default port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
