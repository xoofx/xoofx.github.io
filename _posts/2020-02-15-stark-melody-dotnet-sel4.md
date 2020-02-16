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

Though, apart [sharing my progess on Twitter](https://twitter.com/search?q=%23starklang&src=typed_query&f=live), I haven't taken the time so far to explain what this is all about... So before continuing further this experiment, It is time for me to share more about this project in a proper blog post, and more specifically:

- Give more details about the "why?" of this project
- How was built this first milestone prototype?
- Where is it going?

## Foundations

### Stark - The language

I have realized that I never took the time to write down the requirements and goals of this language. They might have changed slightly since I wrote ["Going Native 2.0, The future of WinRT"](https://xoofx.com/blog/2012/08/08/going-native-20-future-of-winrt/) or more recently about [stark](https://xoofx.com/blog/2017/01/17/the-stark-programming-language-experiment/), but in the end, they are tactical tradeoffs between the 3 following pillars:

- [Safe](#safe)
- [Efficient](#efficient)
- [Productive](#productive)

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
                <li>Detect at compile time contracts on e.g method arguments that would not be fullfil.</li>
                <li>Otherwise run these contracts at runtime which could lead to a program abort.</li>
            </ul>
        </td>
      </tr>      
      <tr>
         <td>Allow unsafe (in the safe section? Are you crazy?)</td>
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
                <li>Compiled code should contain all configuration paths (e.g depending on CPU target). No preprocessor #ifdef techniques but use instead selectors per config.</li>
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

### Melody - The Operating System

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












