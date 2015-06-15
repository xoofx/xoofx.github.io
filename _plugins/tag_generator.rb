require "yaml"
require 'fileutils'

module CustomTagGenerator

  class CustomTagPage < Jekyll::Page
    def initialize(site, base, dir)
      @site = site
      @base = base
      @dir = dir
      @name = 'index.html'
      self.process(@name)
      self.read_yaml(File.join(base, '_layouts'), "blog_by_tag.html")
    end
  end

  class Generator < Jekyll::Generator
    safe true
    def generate(site)
		if site.data.has_key?("tags")
		  localTags = site.data["tags"]
		else
		  localTags = {}
		  site.data["tags"] = localTags
		end
				
		hasNewTags = false
		site.tags.keys.each do |tag|
		  safeTag = tag.gsub(/\./, '').gsub(/#/, 'sharp').gsub(/ +/, '').downcase
		  tagDirectory = "/blog/tag/" + safeTag
		  tagFullDirectory = site.source + tagDirectory
		  if !File.directory?(tagFullDirectory)
		    FileUtils.mkpath(tagFullDirectory)
			File.open(tagFullDirectory + "/index.html", "w"){ |tagFile| tagFile.puts "---\nlayout: blog_by_tag\n---\n"}
		  end
		  if !localTags.has_key?(safeTag) || localTags[safeTag] != tag
		    localTags[safeTag] = tag
			hasNewTags = true
			# Adds the tag page to the current pages
			site.pages << CustomTagPage::new(site, site.source, tagDirectory)
		  end
		end
		
		if hasNewTags
		  tagMapDirectory = site.source + "/_data"
		  if !File.directory?(tagMapDirectory)
		    FileUtils.mkpath(tagMapDirectory)
	      end
			File.open(tagMapDirectory + "/tags.yml", "w"){ |tagFile| tagFile.puts YAML.dump(localTags)}
		end
    end
  end
end