---
layout: post
title: Goodbye project.json
tags:
 - msbuild
comments: true
---
This is a follow-up about `project.json` being abandoned in favour of msbuild https://twitter.com/xoofx/status/730223811895779328

# Why `project.json` (speculations)?

- Because at the time the ASP.NET team worked on this, MSBuild was not open-source nor cross platform
- MSBuild is a XML file that is laborious to edit, too verbose and usually not friendly in the eyes of a developer (at least, a bit more laborious to edit/view than a JSON file)
- MSBuild and NuGet were poorly integrated (NuGet was polluting project references, references were duplicated/stored in a separate package.config file...etc., you had to specify a `nuspec` file on the side to package something from a csproj)
- NuGet dependencies were not transitive, so we had to list dependencies explicitly
- MSBuild was not able to easily target multiple platforms (you can, but you have to duplicate sln/csproj in order to achieve it correctly, very laborious)
- "Dude, I don't want to maintain a list of files to build my app" (a js dev talking)
- JSON is widely used in node.js/web techs, so let's use a format that sounds familiar to web devs
- JSON felt more "data-oriented" than the freaking/bizarre msbuild model (some declaratives, some processes with an awful XML declarative language...etc.)

# What went wrong with `project.json`?

The problem is that `project.json` quickly had to replicate many `msbuild` project behaviours  https://github.com/aspnet/Home/wiki/Project.json-file (things like configurations, build targets, compilation flags, build commands...etc.) and well, you don't want to rebuild a build system, so at some point, everything had to go back to a well established build system (hint: `msbuild`) in order to build things efficiently (track file dependencies, don't compile things that are not necessary, add build conditions... etc.)

Things became worse and a bit more weird with `xproj` that acted as a bridge between the `msbuild` system and pseudo-build-system `project.json`, still `project.json` (and the underlying dnx ASP.NET vnext build system) was nowhere a build-system

# So back to `msbuild`?

While not ideal, it is easier to adapt msbuild to cover the missing bits, mainly:

- integrate the `project.json` dependencies part directly into a csproj is easy to do
- automate cross-platform compilation
- automate NuGet package creation

Incidentally, I wrote an article almost 2 years ago that talked a little bit about this in "[Packages vNext: Power-up our .NET Builds](http://xoofx.com/blog/2014/08/13/packages-vnext-power-up-our-net-builds/)". 

So I could not be more happy to see `project.json` being phased out. Back to a unified model will be way more sane and simpler to manage!

