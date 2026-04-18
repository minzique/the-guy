FROM node:20-bookworm-slim

ARG HOST_UID=1000
ARG THE_GUY_VERSION=0.1.0

RUN apt-get update \
  && apt-get install --yes --no-install-recommends bash ca-certificates git tini \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --uid "${HOST_UID}" --create-home --shell /bin/bash guy

WORKDIR /opt/the-guy
COPY . /opt/the-guy

RUN npm install --global @mariozechner/pi-coding-agent \
  && printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' 'exec node /opt/the-guy/apps/guy-installer/dist/cli.js "$@"' > /usr/local/bin/guy \
  && chmod +x /usr/local/bin/guy \
  && mkdir -p /home/guy \
  && chown -R guy:guy /home/guy

ENV HOME=/home/guy \
  GUY_HOME=/home/guy \
  GUY_SANDBOX=1 \
  THE_GUY_VERSION=${THE_GUY_VERSION} \
  PATH=/home/guy/.local/bin:/usr/local/bin:${PATH}

USER guy
WORKDIR /workspace
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
