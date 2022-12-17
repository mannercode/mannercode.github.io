FROM node:lts

# color prompt
RUN echo 'PS1="\[\033[32m\]\w\[\033[00m\] "' >> ~/.bashrc
RUN echo "alias ls='ls --color=auto'" >> ~/.bashrc
RUN echo "alias l='ls --color=auto -lA'" >> ~/.bashrc

RUN apt update
RUN apt upgrade -y

RUN apt-get install -y ruby-full
RUN gem install public_suffix -v 4.0.7
RUN gem install rouge -v 3.30.0
RUN gem install bundler jekyll
