FROM node:18.20

# Create non-root user and group
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY . .

# Change ownership of app files to non-root user
RUN chown -R appuser:appuser /app

# Install dependencies and build as non-root user
USER appuser
RUN npm install

RUN npm run build

EXPOSE 3000 5000

USER appuser CMD ["bash", "/app/start_servers.sh"]
