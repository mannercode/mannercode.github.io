source "https://rubygems.org"

gemspec

gem "jekyll", ENV["JEKYLL_VERSION"] if ENV["JEKYLL_VERSION"]
gem "kramdown-parser-gfm" if ENV["JEKYLL_VERSION"] == "~> 4.3"
gem 'csv'
gem 'logger'
gem 'base64'
gem 'bigdecimal'

group :jekyll_plugins do
  gem "jekyll-plantuml"
end
