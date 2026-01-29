FROM ruby:3.3-bookworm
ENV LANG=C.UTF-8

ARG DEV_TOOLS="git curl"
ARG BUILD_DEPS="build-essential libffi-dev"
ARG PLANTUML="openjdk-17-jre-headless graphviz fonts-noto-cjk"
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends \
    $DEV_TOOLS \
    $BUILD_DEPS \
    $PLANTUML; \
  curl -fsSL https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar \
    -o /opt/plantuml.jar; \
  printf '%s\n' \
    '#!/bin/sh' \
    'exec java -Djava.awt.headless=true -jar /opt/plantuml.jar "$@"' \
    > /usr/local/bin/plantuml; \
  chmod +x /usr/local/bin/plantuml; \
  rm -rf /var/lib/apt/lists/*

ARG BUNDLER_VERSION=2.5.6
RUN gem install --no-document bundler -v ${BUNDLER_VERSION} \
  && gem install --no-document jekyll

ARG USERNAME=jekyll
ARG UID=1000
ARG GID=1000
RUN set -eux; \
  groupadd -g ${GID} ${USERNAME}; \
  useradd -m -u ${UID} -g ${GID} -s /bin/bash ${USERNAME}; \
  mkdir -p /usr/local/bundle /home/${USERNAME}/.bundle /work; \
  chown -R ${UID}:${GID} /usr/local/bundle /home/${USERNAME}/.bundle /opt /work;

ENV BUNDLE_PATH=/home/${USERNAME}/.bundle \
  BUNDLE_APP_CONFIG=/home/${USERNAME}/.bundle \
  BUNDLE_BIN=/home/${USERNAME}/.bundle/bin \
  PATH="/home/${USERNAME}/.bundle/bin:${PATH}"

WORKDIR /work

USER ${USERNAME}
