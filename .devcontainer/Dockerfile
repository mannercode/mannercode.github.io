# ruby:bullseye를 사용하면 안 된다. ubuntu plantuml 패키지에서는 ditaa가 svg로 출력이 안 된다.
FROM ruby:bookworm
RUN apt-get update && apt-get install -y plantuml
RUN gem install bundler jekyll
