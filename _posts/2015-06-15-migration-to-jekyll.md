---
layout: post
title: Migration to Jekyll
tags:
 - jekyll
comments: true
---

Late to the party, but I finally took the time to migrate my previous blog [code4k](http://code4k.blogspot.com) to [github](https://github.com/xoofx/xoofx.github.io) using [Jekyll](http://jekyllrb.com/) which is a static blog generator. 

I simply wanted to have a full and easy control of my website without relying on a laborious php+mysql setup (which always require site backups, MySql backups, PHP updates, CMS updates... etc.)

While looking for a proper solution (and reading [an excellent tribute to static website generator](https://developmentseed.org/blog/2012/07/27/build-cms-free-websites/)), I discovered that Jekyll is natively supported by [github pages](https://pages.github.com/), meaning that It is possible to host a web site on github pages while github takes care of generating the static site on their side, so that I don't have to push 2 repositories (the templated site and the generated static site)

I was a little reluctant about using Jekyll on Windows, as it is a Ruby program often relying on some native plugins, but I followed the tutorial "[Running Jekyll on Windows](http://jekyll-windows.juthilo.com/)" without any troubles. Before, I started to test it with Docker, but realized that in the end the Windows install was easier and more up-to-date.

After this, you just need to install the [github-pages gems](https://github.com/github/pages-gem), and then type `jekyll serve` in a command prompt to test and browse the website on the local machine, easy!

I have been inspired by the setup of the blog of [Phil Haack](http://haacked.com/). Also as github pages doesn't support archive by tags (because they usually require Jekyll plugins), I have slightly forked the idea for tags from "[Tags and Categories on github pages](http://www.minddust.com/post/tags-and-categories-on-github-pages/)" and make it a bit more automatic so that I have archive by tags running on github pages. The hack was to code a very simple plugin that generates tag pages, but instead of generating them in the output site (the generated site, as most of the other plugins I have seen do), it generates the pages on the original/templated site so that I can commit them along my repository.

It took me a bit of time to port my previous blog to Jekyll, as I had to fix manually some URLs. I had also to setup proper css handling...etc. but so far very happy with the changes. 
Now, whenever possible, I can finally enjoy typing my posts in markdown using my favorite markdown editor [MarkdownPad](http://markdownpad.com/)! and use git workflow to push my changes (like writing drafts in a branch). You can even edit these pages and contribute back to them to fix all the typos all around! ;)

At least, I hope that I will be quicker at updating this blog, so many things to share, so little done so far!


