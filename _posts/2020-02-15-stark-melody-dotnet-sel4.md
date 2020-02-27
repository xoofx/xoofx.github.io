---
layout: post
title: The Odyssey of Stark and Melody
subtitle: Prototyping a new language and OS with the help of the .NET ecosystem and seL4 micro-kernel
tags:
 - Stark
 - Melody
 - OS
 - Compiler
 - LLVM
 - C#
 - .NET
comments: true
---

<img src="/images/stark.png" style="width:150px; height: 150px; float: right;"/>

What would it take these days to build a prototype of a new language and operating system built on top of it, just for fun? 

This idea started to emerge during the 2018 winter holidays:

<blockquote class="twitter-tweet tw-align-center" data-lang="en"><p lang="en" dir="ltr">Woot! I just hacked the &quot;Building an Operating System for the Raspberry Pi&quot; <a href="https://t.co/tSvS8Bz0ft">https://t.co/tSvS8Bz0ft</a> by writing the kernel in C# and using the AOT Compiler with a slightly modified version of CoreRT to compile it to ARM, and... it&#39;s running! I&#39;m super happy, it is so much fun! 🤗 <a href="https://t.co/lM3MrH04Tk">pic.twitter.com/lM3MrH04Tk</a></p>&mdash; Alexandre Mutel (@xoofx) <a href="https://twitter.com/xoofx/status/1080583909384118272?ref_src=twsrc%5Etfw">January 2, 2019</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

This brought me back to my teenager time when I had so much fun running assembly code directly on Amstrad/Amiga computers without using an OS... time has passed, and as I was also re-reading all the fascinating [collection of blog posts of Joe Duffy about Midori](http://joeduffyblog.com/2015/11/03/blogging-about-midori/) and also discovered through some discussions on Twitter that Google has been actually working on a [new OS called Fuchsia](https://en.wikipedia.org/wiki/Google_Fuchsia) with its micro-kernel [Zircon](https://fuchsia.googlesource.com/zircon), it made me realized how much I would like to reinvestigate these areas...

So one year ago, I decided to re-focus the work on [the stark programming language experiment](http://xoofx.com/blog/2017/01/17/the-stark-programming-language-experiment/) and to extend its goal by building, not only a safe and efficient system programming language, but also a fast, secure and lightweight micro-kernel and capability based operating system, IoT and cloud ready (game OS also, why not?), async/await event/driven based, but also built with data oriented techniques... 

There are still large and exciting areas to explore and challenge in this domain, as much as I'm eager to be technically challenged, learn and share from this experiment!

Though while I have been enjoying the early design/prototyping of stark, It became also obvious that starting entirely from scratch a whole compiler would not allow me to make enough sustainable progress and to keep enough motivation during my spare-time on the long run... 

Luckily, thanks to the development of OSS, we can rely on the shoulders of existing giants to experiment and prototype more quickly what would have been impossible in the past... So during the past year, with the help of the .NET ecosystem and the [seL4 micro-kernel](http://sel4.systems/), I was able to  build a vertical prototype of the language, its core library, its front-end compiler, a native compiler and an embryo-integration with seL4:

<blockquote class="twitter-tweet tw-align-center"><p lang="en" dir="ltr">Finally, here is a capture of the boot sequence of a HelloWorld program with <a href="https://twitter.com/hashtag/starklang?src=hash&amp;ref_src=twsrc%5Etfw">#starklang</a> on top of the seL4 micro-kernel. <br>This marks the end of the 1st vertical prototype by bringing up together a front-end compiler, native compiler and micro-kernel integration! ❤️ <a href="https://t.co/kEQ2esGHj4">pic.twitter.com/kEQ2esGHj4</a></p>&mdash; Alexandre Mutel (@xoofx) <a href="https://twitter.com/xoofx/status/1226962715656278022?ref_src=twsrc%5Etfw">February 10, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

Though, apart [sharing my progess on Twitter](https://twitter.com/search?q=%23starklang&src=typed_query&f=live), I haven't taken the time so far to explain what this is all about... So before continuing further this experiment, It is time for me to share more about this project, and more specifically to:

- Give more details about the "why?" of this project
- Explain how this first milestone prototype was built
- And where is it going?

## Foundations

### Stark - The language

I have realized that I never wrote down at least some high level requirements and goals for this language. They might have changed slightly since I wrote ["Going Native 2.0, The future of WinRT"](https://xoofx.com/blog/2012/08/08/going-native-20-future-of-winrt/) or more recently about [stark](https://xoofx.com/blog/2017/01/17/the-stark-programming-language-experiment/), but in the end, they are tactical tradeoffs between the 3 following pillars:

- [Safe](#safe)
- [Efficient](#efficient)
- [Productive](#productive)

> Note: Stark is not a fork of C# nor it can be compatible with .NET
>
> Many of the following features are requiring such significant breaking changes that they can't be retro-fitted into an existing platform like .NET.

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
            </ul>
        </td>
      </tr>
      <tr>
         <td>Remove the possibility of null reference.</td>
         <td>
            <ul>
                <li>Assignment in constructors are mandatory if the struct/class contains references.</li>
                <li>You can't create an array of references (direct or indirect) without assigning them at creation.</li>
            </ul>
        </td>
      </tr>
      <tr>
         <td>Avoid race conditions related to multi-threading.</td>
         <td>
            <ul>
                <li>Globally shared mutable data should not possible.</li>
                <li>Same mutable data between threads should not possible.</li>
            </ul>
        </td>
      </tr>
      <tr>
         <td>Remove the possibility of uninitialized state for objects.</td>
         <td>
            <ul>
                <li>A constructor should assign all its mandatory members before proceeding anywhere else.</li>
                <li>The this pointer cannot escape a constructor if its object is not fully initialized.</li>
                <li>Calling virtual methods in a constructor is not possible.</li>
            </ul>
        </td>
      </tr>
      <tr>
         <td>Don't allow arithmetic values to overflow, by default.</td>
         <td>
            <ul>
                <li>Mostly transparent.</li>
            </ul>
        </td>
      </tr>
      <tr>
         <td>Clear error model
            <ul>
                <li>Recoverable errors: Exceptions.</li>
                <li>Non-recoverable errors: Aborts.</li>
            </ul>
         </td>
         <td>
            <ul>
                <li>Use checked user exceptions as part of method signature intent.</li>
                <li>Use contracts and asserts for aborts.</li>
            </ul>
        </td>
      </tr>
      <tr>
         <td>Design by contracts.</td>
         <td>
            <ul>
                <li>Detect at compile time contracts on e.g method arguments that would not be fulfilled.</li>
                <li>Otherwise run these contracts at runtime which could lead to a program abort.</li>
            </ul>
        </td>
      </tr>      
      <tr>
         <td>Allow unsafe</td>
         <td>
            <ul>
                <li>Only via explicit unsafe in the code and by enabling it via a compiler command line switch.</li>
                <li>It should be possible to remove safety for some of the cases above.</li>
            </ul>
        </td>
      </tr>
  </table>
</div>

#### Efficient

<div class="table-responsive">
  <table class="table">
      <tr>
         <th>Requirements</th>
         <th>Impact on the language</th>
      </tr>
      <tr>
         <td>Compile time optimizations.</td>
         <td>
            <ul>
                <li>Codegen should be AOT only.</li>
                <li>Codegen optimizations should range from fast compilation with good enough optimizations to heavily optimized -O3 code.</li>
            </ul>
        </td>
      </tr>  
      <tr>
         <td>Zero cost for const data.</td>
         <td>
            <ul>
                <li>Const data known at compile time should not involve any initialization at runtime.</li>
                <li>All const data at compile time should be readonly in a readonly data section in the executable. No heap allocations should occur for these data.</li>
            </ul>
        </td>
      </tr>       
      <tr>
         <td>Provide control over data locality.</td>
         <td>
            <ul>
                <li>By-value fixed array should be supported as a core type.</li>
                <li>Allocation on the stack of reference types should be possible.</li>
                <li>Control how an object is co-located on the heap with other objects.</li>
                <li>Provide a way to easily define SOA (Struct Of Arrays) Layout for objects.</li>
            </ul>
        </td>
      </tr>  
      <tr>
         <td>More explicit control over heap allocation and lifetime.</td>
         <td>
            <ul>
                <li>Implicit or explicit boxing of value type should not be possible.</li>
                <li>The concept of lifetime should be accessible to a developer.</li>
                <li>It should be possible to allocate objects with similar lifetime to a same region in memory.</li>
                <li>Memory handling should provide an automatic assistance but also manual awareness and control for the developer.</li>
                <li>De-allocation of memory blocks should be smoothed but controlled over time.</li>
                <li>Lifetime of an object should be known locally and statically (e.g attached to the app, attached to a request, attached to a level in a game...etc.).</li>
                <li>A local lifetime provided by a library can be re-mapped by the user of this library.</li>
                <li>An application should have an allowed budget memory by its parent application.</li>
                <li>It should be possible to recover from not having enough memory budget (instead of aborting).</li>
                <li>No destructors.</li>                
            </ul>
        </td>
      </tr>  
      <tr>
         <td>Lightweight async and await.</td>
         <td>
            <ul>
                <li>Async should be the norm when using external services.</li>
                <li>Await should be a free operation and should allow inline across methods.</li>
                <li>Await should not involve any heap operation.</li>
            </ul>
        </td>
      </tr>
      <tr>
         <td>Minimize object runtime cost and footprint.</td>
         <td>
            <ul>
                <li>Minimum required metadata at runtime, mainly for inheritance.</li>
                <li>No default virtual methods on objects (no Equals, GetHashCode, ToString methods).</li>
                <li>No reflection/introspection accessible by default.</li>
                <li>Attached attributes are only compile time by default. No cost at runtime, no space occupied.</li>
                <li>Static function pointers should be only a pointer, no heap allocation involved.</li>
                <li>Closure function pointers should be composed of an object reference (for the state) and a function pointer. They are fat function pointers (e.g instance method of an object).</li>
                <li>An interface reference is not an object reference but a fat pointer/value type with the original object and a virtual method table.</li>
            </ul>
        </td>
      </tr>  
      <tr>
         <td>Efficient monomorphization.</td>
         <td>
            <ul>
                <li>Value type in generics are always resulting in a monomorphization.</li>
                <li>Interface constraints on reference type can result in a monomorphization depending on optimization opportunities.</li>
                <li>It should be possible to request explicit monomorphization.</li>
                <li>Codegen dependencies with monomorphization should be known to allow incremental recompilation.</li>
                <li>Generic virtual methods are not possible.</li>
                <li>Cost of monomorphization should be made known to a developer (code size occupied per type... etc.).</li>
            </ul>
        </td>
      </tr>
      <tr>
         <td>SIMD and Low level.</td>
         <td>
            <ul>
                <li>SIMD types should be part of the core types.</li>
                <li>It should be possible to use explicitly CPU dependent intrinsics.</li>
                <li>The language and compiler infrastructure should provide way to emit non-standard low level code (e.g unsafe IL or assembler required by the runtime and/or an OS kernel).</li>
            </ul>
        </td>
      </tr>      
  </table>
</div>

#### Productive

<div class="table-responsive">
  <table class="table">
      <tr>
         <th>Requirements</th>
         <th>Impact on the language</th>
      </tr>
      <tr>
         <td>Functional, object and data oriented programming.</td>
         <td>
            <ul>
                <li>While more imperative than functional at his heart, the language should offer ways to solve problems with different programming approaches and allow to combine them.</li>
                <li>But the language should not be a Zoo of programming approaches.</li>                
            </ul>
         </td>
      </tr>        
      <tr>
         <td>Unified and integrated development experience.</td>
         <td>
            <ul>
                <li>Build, Package, Tests, Benchmarks, Code coverage, Deploy should be part of the core experience and integrated.</li>
                <li>Code should allow to define integrated tests and benchmarks along the library being developed.</li>
                <li>Compiled code should contain all configuration paths (e.g depending on CPU target). No preprocessor #ifdef techniques but use instead features/selectors via config.</li>
                <li>Should be possible to work with pre-compiled code or pull git package source dependencies.</li>
                <li>Should provide good intellisense (completion, navigation, refactoring) and IDE support.</li>                
            </ul>
        </td>
      </tr>        
      <tr>
         <td>Concise syntax but not cryptic.</td>
         <td>
            <ul>
                <li>Avoid language separators when they don't bring enough cognitive value. Trailing `;` should be optional. Parenthesis in control flows should not be mandatory.</li>
                <li>The language should provide a simple and "intuitive" left-to-right code reading experience.</li>
            </ul>
         </td>
      </tr>  
      <tr>
         <td>Compile time.</td>
         <td>
            <ul>
                <li>Codegen should be as fast as possible when debug/dev iteration is involved.</li>
            </ul>
        </td>
      </tr>  
  </table>
</div>

### Melody - A Micro Operating System

Melody is the name of the Operating System that will be built with the Stark language.

<img src="/images/melody.png" class="mx-auto" style="display: block"/>

Why developing an operating system while you would have already enough work for the rest of your entire life with just the language?

This experiment is first an opportunity to enjoy again hacking "bare metal" low level parts over the hardware, to revisit foundations that I took for granted (resource management, memory management, interrupt handlers, processes/threads lifecycle, kernel vs user code...) and to better understand the constraints of designing an operating system.

Secondly, using the language in a low-level situation should hopefully help to drive and focus the implementation of its requirements. But this should be also a two-way feedback process, where the language could benefit some OS features and vice e versa.

Lastly, I can't resign myself that the 2 existing dominant operating systems should obliterate the need to look for a better architecture or that the future of OS development will remain in these two solely. Even if the existing OS have been able to adapt some modern challenges (e.g Web, hypervisors, containers...), they feel still very brittle in their overall monolithic kernel approach, specially when security is involved. In this era of rising IoT, it feels even more surprising that [object-capability](https://en.wikipedia.org/wiki/Object-capability_model) based OS are still not mainstream. Also, I believe that It was a mistake to abandon the project [Midori](http://joeduffyblog.com/2015/11/03/blogging-about-midori/).

Melody will be driven by the following 3 pillars:

- Secure:
  - Capabilities should be at the heart of managing HW resources and used for connecting services. 
  - All drivers/services/apps should live in user land. 
  - The operating system should be built on a secure micro-kernel.
- Efficient:
  - Should scale well from IoT to Cloud.
  - IPC between services should be fast.
  - Async based events should be the primary communication between services
  - Processes should not be backed to disk (no-swap) but instead use a resume/suspend/restore lifecycle.
- Lightweight:
  - Footprint of a HTTP client/server app with the OS should be minimal (a few Mb)

## The 2019 prototype

The overall goal of this first year prototype was relatively simple:

> A HelloWorld x86_64 Stark program running on a bare metal "OS" similar to the one I did with C# and CoreRT for the Raspberry Pi

The steps to achieve this goal would involve:

- Prototype the syntax of the Stark language
- Simple IDE integration (syntax highlighting)
- Use the Stark language entirely for both the HelloWorld program and its core library (so no additional C runtime on the side)
- Implement a front-end compiler for translating Stark to an intermediate binary library (e.g Assemblies in .NET)
- Implement a back-end compiler for converting the binary library to native code
- Prototype the micro-kernel with the minimum required to bootstrap the HelloWorld program

After hacking C# with CoreRT on a bare metal OS on the Raspberry Pi, I realized that the .NET ecosystem could help my experiment a lot more than I had planned when starting to work on Stark. Instead of trying to rebuild everything, **let's try to find and reuse components that could significantly boost this enterprise**:

<a class="btn btn-outline-info" style="text-align: left; display:block" href="/blog/2020/02/16/stark-language-frontend-compiler/" role="button">Part 1: Stark - Language And Frontend Compiler - Prototype 2019</a>

For the front-end compiler, instead of fully building bottom-up a [tokenizer](https://xoofx.com/blog/2017/02/06/stark-tokens-specs-and-the-tokenizer/)/parser/syntax analyzer/type inference/transform to IL, why not **starting from the Roslyn C# compiler instead**?

<a class="btn btn-outline-info" style="text-align: left; display:block" href="#" role="button">Part 2: Stark - Native Compiler - Prototype 2019</a>

For the back-end compiler responsible to generate native code, I originally thought that I could rely on CoreRT, but realized that the design of the compiler and runtime would be so different that I should proceed differently... and came to the conclusion that the most critical component I could reuse was the **RyuJIT compiler for the IL to native codegen part**. And I will explain more in details why.

<a class="btn btn-outline-info" style="text-align: left; display:block" href="#" role="button">Part 3: Melody - HelloWorld OS - Prototype 2019</a>

For the OS kernel part, I was initially expecting to write the kernel in Stark itself, but while searching about what it would take, **I discovered that the [seL4 micro-kernel](http://sel4.systems/) was exactly what I was looking for for a micro-kernel**, and I would have already plenty of work to do to build a proper OS on top of it. We will see why I'm very enthusiastic about it.
