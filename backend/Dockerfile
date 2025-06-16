# Set the base image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 8000

# Start the application
RUN apt update && apt install daemontools && rm -rf /var/lib/apt/lists/*
CMD ["envdir", "/etc/datadog/secrets", "yarn", "run", "start"]
