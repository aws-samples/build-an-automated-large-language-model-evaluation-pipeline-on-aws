FROM node:18.20

# Create non-root user and group
RUN groupadd -r appuser && useradd -r -g -m appuser appuser

WORKDIR /app

COPY . .

# Change ownership of app files to non-root user
RUN chown -R appuser:appuser /app

# Install dependencies and build as non-root user
USER appuser
RUN npm install

RUN npm run build

EXPOSE 3000 5000

# Add health check (checking both services)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1 && \
      curl -f http://localhost:5000/ || exit 1

CMD ["bash", "/app/start_servers.sh"]
