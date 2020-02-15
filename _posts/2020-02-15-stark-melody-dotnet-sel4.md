---
layout: post
title: Stark and Melody - Prototyping a language and OS with the help of the .NET ecosystem and the seL4 micro-kernel
tags:
 - Stark
 - Compiler
 - LLVM
 - C#
 - .NET
comments: true
---

<img src="../images/stark.png" style="width:150px; height: 150px; float: right;"/>

What would it take these days to build a prototype of a new language and operating system built on top of it, just for fun? 

Incidentally, during the 2018 winter holidays, while playing with a RaspberryPI3B+

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">Woot! I just hacked the &quot;Building an Operating System for the Raspberry Pi&quot; <a href="https://t.co/tSvS8Bz0ft">https://t.co/tSvS8Bz0ft</a> by writing the kernel in C# and using the AOT Compiler with a slightly modified version of CoreRT to compile it to ARM, and... it&#39;s running! I&#39;m super happy, it is so much fun! 🤗 <a href="https://t.co/lM3MrH04Tk">pic.twitter.com/lM3MrH04Tk</a></p>&mdash; Alexandre Mutel (@xoofx) <a href="https://twitter.com/xoofx/status/1080583909384118272?ref_src=twsrc%5Etfw">January 2, 2019</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

This brought me back to my teenager time when I had so much fun running assembly code directly on Amstrad/Amiga computers without using an OS... time has passed, and as I was also re-reading all the fascinating [collection of blog posts of Joe Duffy about Midori](http://joeduffyblog.com/2015/11/03/blogging-about-midori/) and also discovered through some discussions on Twitter that Google has been actually working on a [new OS called Fuchsia](https://en.wikipedia.org/wiki/Google_Fuchsia) with its micro-kernel [Zircon](https://fuchsia.googlesource.com/zircon), it made me realized how much I would like to reinvestigate these areas...

So one year ago, I decided to re-focus the work on [the stark programming language experiment](http://xoofx.com/blog/2017/01/17/the-stark-programming-language-experiment/) and to extend its goal by building, not only a safe and efficient system programming language, but also a fast, secure and lightweight micro-kernel and capability based operating system, IoT and cloud ready (game OS also, why not?), async/await event/driven based, but also built with data oriented techniques... 

I believe that there are still large and exciting areas to explore and challenge in this domain, as much as I'm eager to be technically challenged, learn and share from this experiment!

Though while I have been enjoying the early design/prototyping of stark, It became also obvious that starting entirely from scratch a whole compiler would not allow me to make enough sustainable progress and to keep enough motivation during my spare-time on the long run... 

But in this era of OSS goodness, we can rely on the shoulders of existing giants to experiment and prototype more quickly what would have been impossible in the past... So during the past year, with the help of the .NET ecosystem and the [seL4 micro-kernel](http://sel4.systems/), I have built a vertical prototype of the language, its core library, its front-end compiler, a native compiler and an embryo-integration with seL4:

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Finally, here is a capture of the boot sequence of a HelloWorld program with <a href="https://twitter.com/hashtag/starklang?src=hash&amp;ref_src=twsrc%5Etfw">#starklang</a> on top of the seL4 micro-kernel. <br>This marks the end of the 1st vertical prototype by bringing up together a front-end compiler, native compiler and micro-kernel integration! ❤️ <a href="https://t.co/kEQ2esGHj4">pic.twitter.com/kEQ2esGHj4</a></p>&mdash; Alexandre Mutel (@xoofx) <a href="https://twitter.com/xoofx/status/1226962715656278022?ref_src=twsrc%5Etfw">February 10, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

In this blog post I would like to go through:

- More details about the "why" of this project
- How was built this first milestone prototype?
- Where is it going?

## Foundations

### Stark - The language

The goals might have changed slightly since I wrote ["Going Native 2.0, The future of WinRT"](https://xoofx.com/blog/2012/08/08/going-native-20-future-of-winrt/) or more recently about [stark](https://xoofx.com/blog/2017/01/17/the-stark-programming-language-experiment/), but they are basically a delicate balance and tradeoffs between the 3 following pillars:

- Safe
- Efficient
- Productive

#### Safe

As a programmer, this language should help me to:

<div class="table-responsive">
  <table class="table">
      <tr>
         <th>Requirements</th>
         <th>Impact on the language</th>
      </tr>
      <tr>
         <td>Disallow dangling references to objects.</td>
         <td>
            <ul>
                <li>An object cannot be de-allocated if it is still in used somewhere.</li>
            <ul>
        </td>
      </tr>
      <tr>
         <td>Remove the possibility of null reference.</td>
         <td>
            <ul>
                <li>Assignment in constructors are mandatory if the struct/class contains references.</li>
                <li>You can't create an array of references (direct or indirect) without assigning them at creation.</li>
            <ul>
        </td>
      </tr>
      <tr>
         <td>Avoid race conditions related to multi-threading.</td>
         <td>
            <ul>
                <li>Shared mutable static should not possible.</li>
                <li>Shared mutable data between threads should not possible.</li>
            <ul>
        </td>
      </tr>
      <tr>
         <td>Remove the possibility of uninitialized state for objects.</td>
         <td>
            <ul>
                <li>A constructor should assign all its mandatory members before proceeding anywhere else.</li>
                <li>The this pointer cannot escape a constructor if its object is not fully initialized.</li>
                <li>Calling virtual methods in a constructor is not possible.</li>
            <ul>
        </td>
      </tr>
      <tr>
         <td>Don't allow arithmetic values to overflow, by default.</td>
         <td>
            <ul>
                <li>Mostly transparent.</li>
            <ul>
        </td>
      </tr>
      <tr>
         <td>Clear error model
            <ul>
                <li>Recoverable errors: Exceptions.</li>
                <li>Non-recoverable errors: Aborts.</li>
            <ul>
         </td>
         <td>
            <ul>
                <li>TODO.</li>
            <ul>
        </td>
      </tr>
      <tr>
         <td>Design by contracts.</td>
         <td>
            <ul>
                <li>Detect at compile time contracts on e.g method arguments that would not be fullfil.</li>
                <li>Otherwise run these contracts at runtime which could lead to a program abort.</li>
            <ul>
        </td>
      </tr>      
  </table>
</div>

#### Efficient

#### Productive


### Melody - The operating System

### Why both?


<!-- <img src="stark-platform.png"/> -->

## The 2019 prototype 

### Overview


### The front-end compiler

- Departure from ECMA-335
- Fork of Roslyn
- Fork of dnspy
- Fork of System.Reflection.Metadata

Details:

- Remove inheritance of ValueType from object
- Implementation of language parser changes
- Implementation of the module syntax
- Implementation of checked exceptions
- Implementation of unsafe IL
- Implementation of literal generic context
- Implementation of ranges
- Implementation of new iterator pattern
- Implementation of slices
- Pointers in generics
- 
- RuntimeExport/RuntimeImport symbol binding
- Native integer support
- Parameter less constructor for structs
- CallerArgumentExpression
- Casts between types (e.g int to float not implicit)
- Design by contracts (e.g requires)
- Remove of covariant arrays
- 
- Tomlyn


### The native compiler

- Using RyuJIT
- CoreRT like
- LibObjectFile
- Iced

### The micro-kernel


### Feedback


## Next phases

### Overall schedule


### The language


### The front-end compiler


### The native compiler


### The operating system












