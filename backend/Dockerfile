# Backend Dockerfile for jant-vid-pipe
# Python FastAPI application with Firestore, Firebase Storage, and Replicate integration

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for FFmpeg and image processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Copy service account key (IMPORTANT: This is needed for Firestore/Firebase Storage)
# Make sure this file exists in backend/ directory before building
COPY serviceAccountKey.json ./

# Create uploads directory (though we primarily use Firebase Storage now)
RUN mkdir -p uploads/brands uploads/characters uploads/products uploads/backgrounds uploads/composites uploads/temp

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:${PORT}/health', timeout=2)"

# Run the application
# Use uvicorn with host 0.0.0.0 to accept external connections
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
