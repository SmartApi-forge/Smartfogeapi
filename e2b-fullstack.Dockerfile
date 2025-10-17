# E2B Full-Stack Dockerfile
# Template for running full-stack applications with preview capabilities
FROM node:22-slim

# Install system dependencies and tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    netcat-openbsd \
    net-tools \
    lsof \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the full-stack helper script
COPY compile_fullstack.sh /usr/local/bin/compile_fullstack.sh
RUN chmod +x /usr/local/bin/compile_fullstack.sh

# Create non-root user
RUN groupadd --gid 1001 appuser || true && \
    useradd --uid 1001 --gid 1001 --shell /bin/bash --create-home appuser || true

# Set up working directory
WORKDIR /home/user
RUN chown -R appuser:appuser /home/user && \
    chmod -R 755 /home/user

# Install global npm packages for full-stack development
RUN npm install -g \
    typescript \
    ts-node \
    nodemon \
    next \
    vite \
    @vue/cli \
    @angular/cli \
    create-react-app \
    pnpm

# Install Python web frameworks
RUN pip3 install --break-system-packages \
    fastapi \
    uvicorn \
    flask \
    django

# Create directory structure
RUN mkdir -p /home/user/repo /home/user/src /home/user/logs

# Expose common ports for different frameworks
# 3000 - Next.js, Create React App, Express
# 5173 - Vite
# 4200 - Angular
# 8000 - FastAPI
# 5000 - Flask
# 8080 - General HTTP
EXPOSE 3000 5173 4200 8000 5000 8080

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=development

# Switch to non-root user
USER appuser

# Default command (can be overridden)
CMD ["/bin/bash"]

