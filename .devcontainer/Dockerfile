FROM ruby

# 필요한 패키지 설치
RUN apt-get update && \
    apt-get install -y default-jdk plantuml

# JAVA_HOME 환경 변수 설정
ENV JAVA_HOME /usr/lib/jvm/default-java

RUN gem install bundler jekyll
