FROM node:24-slim
WORKDIR /app

# Install Chromium and Firefox browsers and dependencies (including WebDriver binaries)
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    firefox-esr \
    curl \
    nano \
    netcat-openbsd \
    xvfb \
    x11-utils \
    strace \
    sudo \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install geckodriver (not always available in Debian repos) by downloading a release
ENV GECKODRIVER_VERSION=0.33.0
RUN curl -sSL -o /tmp/geckodriver.tar.gz "https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz" \
    && tar -xzf /tmp/geckodriver.tar.gz -C /usr/local/bin \
    && chmod +x /usr/local/bin/geckodriver \
    && rm /tmp/geckodriver.tar.gz || true

# Install devops-test-runtime with INGRESS_DOMAIN
COPY devops-test-runtime_11.0.6_amd64.deb /tmp/
RUN yes | INGRESS_DOMAIN=loop.platform-staging1.us-east.containers.appdomain.cloud DEBIAN_FRONTEND=noninteractive dpkg -i /tmp/devops-test-runtime_11.0.6_amd64.deb || (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -f -y) \
    && rm /tmp/devops-test-runtime_11.0.6_amd64.deb

COPY package.json tsconfig.json ./
RUN npm install
#RUN npm i -g npx
COPY src ./src
COPY web ./web
RUN npm run build
#Do this later in the build so we can cache more stable layers
COPY entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
COPY mcp.json ./
# Expose port 3000 for web interface
EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
# Default to interactive mode, but can be overridden
CMD ["--interactive"]
