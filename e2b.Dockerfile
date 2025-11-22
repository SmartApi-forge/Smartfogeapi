# You can use most Debian-based base images
FROM node:22-slim

# Install system dependencies including network tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    netcat-openbsd \
    net-tools \
    lsof \
    git \
    python3 \
    python3-pip \
    build-essential \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY compile_page.sh /compile_page.sh
RUN chmod +x /compile_page.sh

# Also copy to /usr/local/bin for easy access
COPY compile_page.sh /usr/local/bin/compile_page.sh
RUN chmod +x /usr/local/bin/compile_page.sh

# Create non-root user and set up working directory
RUN groupadd --gid 1001 appuser || true && \
    useradd --uid 1001 --gid 1001 --shell /bin/bash --create-home appuser || true

# Set up working directory with proper ownership
WORKDIR /home/user
RUN chown -R appuser:appuser /home/user && \
    chmod -R 755 /home/user

# Install global npm packages for API development and validation
RUN npm install -g \
    typescript \
    eslint \
    @apidevtools/swagger-parser \
    @stoplight/spectral-cli \
    openapi-generator-cli \
    ts-node \
    nodemon

# Create initial package.json for API projects
RUN npm init -y

# Install common development dependencies
RUN npm install --save-dev \
    @types/node \
    @typescript-eslint/eslint-plugin \
    @typescript-eslint/parser \
    eslint \
    typescript \
    jest \
    @types/jest \
    ts-jest \
    supertest \
    @types/supertest

# Install common runtime dependencies for API development
RUN npm install \
    express \
    @types/express \
    cors \
    @types/cors \
    helmet \
    dotenv \
    joi \
    swagger-jsdoc \
    swagger-ui-express

# Create default TypeScript configuration
RUN echo '{"compilerOptions":{"target":"es2020","module":"commonjs","lib":["es2020"],"outDir":"./dist","rootDir":"./src","strict":true,"esModuleInterop":true,"skipLibCheck":true,"forceConsistentCasingInFileNames":true,"resolveJsonModule":true,"declaration":true,"declarationMap":true,"sourceMap":true},"include":["src/**/*"],"exclude":["node_modules","dist","**/*.test.ts"]}' > /home/user/tsconfig.json

# Create default ESLint configuration
RUN echo '{"parser":"@typescript-eslint/parser","extends":["eslint:recommended","@typescript-eslint/recommended"],"plugins":["@typescript-eslint"],"env":{"node":true,"es2020":true},"rules":{"@typescript-eslint/no-unused-vars":"error","@typescript-eslint/explicit-function-return-type":"warn"}}' > /home/user/.eslintrc.json

# Create Jest configuration
RUN echo '{"preset":"ts-jest","testEnvironment":"node","roots":["<rootDir>/src"],"testMatch":["**/__tests__/**/*.ts","**/?(*.)+(spec|test).ts"],"collectCoverageFrom":["src/**/*.ts","!src/**/*.d.ts"]}' > /home/user/jest.config.json

# Create src directory structure
RUN mkdir -p /home/user/src /home/user/tests /home/user/docs

# Expose common API ports
EXPOSE 3000 8000 5000 4000 8080

# Set environment variables for better networking
ENV HOST=0.0.0.0
ENV PORT=3000

# Switch to non-root user for runtime
USER appuser
