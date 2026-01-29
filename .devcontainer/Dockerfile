# ruby:bullseye를 사용하면 안 된다. ubuntu plantuml 패키지에서는 ditaa가 svg로 출력이 안 된다.
# ruby:bookworm 태그는 최신 Ruby로 이동하므로 버전을 고정한다.
FROM ruby:3.3-bookworm
ENV LANG=C.UTF-8

ARG DEV_TOOLS="git curl"
ARG BUILD_DEPS="build-essential libffi-dev"
ARG PLANTUML="openjdk-17-jre-headless graphviz fonts-noto-cjk"
RUN apt-get update && apt-get install -y --no-install-recommends \
    $DEV_TOOLS \
    $BUILD_DEPS \
    $PLANTUML \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar \
  -o /opt/plantuml.jar
RUN cat >/usr/local/bin/plantuml <<'SH' \
 && chmod +x /usr/local/bin/plantuml
#!/bin/sh
exec java -Djava.awt.headless=true -jar /opt/plantuml.jar "$@"
SH

ARG BUNDLER_VERSION=2.5.6
RUN gem install --no-document bundler -v ${BUNDLER_VERSION} \
 && gem install --no-document jekyll

# ---- non-root user ----
ARG USERNAME=jekyll
ARG UID=1000
ARG GID=1000

RUN groupadd -g ${GID} ${USERNAME} \
  && useradd -m -u ${UID} -g ${GID} -s /bin/bash ${USERNAME}

# bundler/gem 경로가 런타임에 쓰기 필요하면 권한 조정
# (공식 ruby는 /usr/local/bundle 를 bundler 기본 경로로 쓰는 경우가 많음)
RUN mkdir -p /usr/local/bundle \
  && chown -R ${UID}:${GID} /usr/local/bundle \
  && chown -R ${UID}:${GID} /opt

# root의 ~/.bashrc 대신, 새 유저 홈에 넣기
RUN echo 'PS1="\[\033[32m\]\w\[\033[00m\] "' >> /home/${USERNAME}/.bashrc \
 && echo "alias ls='ls --color=auto'" >> /home/${USERNAME}/.bashrc \
 && echo "alias l='ls --color=auto -lA'" >> /home/${USERNAME}/.bashrc \
 && chown ${UID}:${GID} /home/${USERNAME}/.bashrc

WORKDIR /work
RUN chown -R ${UID}:${GID} /work

USER ${USERNAME}
