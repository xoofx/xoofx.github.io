---
layout: post
title: Stark and Melody
subtitle: Prototyping a language and OS with the help of the .NET ecosystem and the seL4 micro-kernel
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
  - Dynamic loading of code should be disallowed.
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

### Overview

After hacking C# with CoreRT on a bare metal OS on the Raspberry Pi, I realized that the .NET ecosystem could help my experiment a lot more than I had planned when starting to work on Stark. Instead of trying to rebuild everything, **let's try to find and reuse components that could significantly boost this enterprise**:

1. For the front-end compiler, instead of fully building bottom-up a [tokenizer](https://xoofx.com/blog/2017/02/06/stark-tokens-specs-and-the-tokenizer/)/parser/syntax analyzer/type inference/transform to IL, why not **starting from the Roslyn C# compiler instead**?
2. For the back-end compiler responsible to generate native code, I originally thought that I could rely on CoreRT, but realized that the design of the compiler and runtime would be so different that I should proceed differently... and came to the conclusion that the most critical component I could reuse was the **RyuJIT compiler for the IL to native codegen part**. And I will explain more in details why.
3. For the OS kernel part, I was initially expecting to write the kernel in Stark itself, but while searching about what it would take, **I discovered that the [seL4 micro-kernel](http://sel4.systems/) was exactly what I was looking for for a micro-kernel**, and I would have already plenty of work to do to build a proper OS on top of it. We will see why I'm very enthusiastic about it.

### Development of the language syntax and front-end compiler

Changing Roslyn to create a new language is very challenging for several reasons:

- The codebase is huge, years of development, with 2 languages C# and VB.
- The repository is itself compiled with preview of Roslyn fetched from internal NuGet feeds.
- The projects have lots of dependencies over the VisualStudio SDK and again preview versions.
- Projects have lots of dependencies, one change in a core project might lead to change 1000+ references in the entire codebase.
- The codebase is evolving, new features, bug fixes coming upstream. Even if the public API doesn't change much, the internals can.
- Some design decisions made very early in the development of Roslyn are making changes a lot more laborious. Example:
  - ref types are not represented by a proper type, so a ref kind has to be propagated all over the places along its associated type
  - Nullable types are put in a thin struct wrapper around real types. They are also not a proper types in the system.

In order to make some progress for prototyping a new language, I had to cut lots of existing code and take hard decisions:

- I had to remove VB to avoid having to maintain the changes I was making on the C# and core parts of the compiler.
- I had to rename namespaces (e.g `CSharp` => `Stark`)
- After a few months trying to [keep the fork](https://github.com/stark-lang/stark-roslyn) up-to-date with upstream, I made a [hard fork](https://github.com/stark-lang/stark/commit/d74fe898c3babb5cf4b407aa53edd7c576cad50c)
  - Because I was also making changes to `System.Reflection.Metadata` which was in the CoreFx repository, the sync was becoming impossible.
  - The hard fork allowed me to remove the internal NuGet feeds and complex build pipeline of Roslyn by using a regular .NET Standard 2.0 project without any custom NuGet packages.
  - After trying to maintain Visual Studio Roslyn Integration, I also removed it: This was a tough decision, but this part is too difficult to keep-up with, and it brings a complexity that I couldn't maintain on my own. I decided that providing a good integration with `Visual Studio Code` would be much easier for the project in the medium term.
- I removed all the existing tests: This was also too difficult to maintain while prototyping a new syntax. I decided that I would use during the beginning the runtime of stark as a "testing suite". For this reason, the runtime is maintained in the same repository under `src/runtime` folder
  - A change to the syntax is now sync with the change to the runtime. It makes iteration vastly easier.
  - Tests will be re-introduced later once the syntax is a bit more stable. Nonetheless, that will be a huge work and some help will be much welcome!

The front-end compiler and runtime of Stark are hosted on <https://github.com/stark-lang/stark>

#### Leaner syntax

Most of the early changes concerned only `LanguageParser.cs` (the lexer/parser) in Roslyn codebase and it was the easiest place to start with and to see how difficult it would be to change the syntax.

As I discovered and explained in my previous posts about the Stark Language syntax, a lean syntax here might be appealing for some but not for others. It highly depends on your personal taste and experience with languages, how long have you been using some particular syntaxes, if you have been navigating between multiple languages and different paradigm (e.g functional vs imperative)...etc. There is no such thing as "natural" programming syntax but there are lots of religion and way of thinking around existing programing languages. So by no surprise, Stark syntax is mostly colored by my personal relation with programing languages and by what I have seen during my career.

Typically, one of the very first change I made was to remove the need for semi-colon `;` (as Swift Language did for example) but I have kept braces `{` and `}`, while I also removed the need for using parenthesis with control flows. 

Originally for Stark, I had a plan to use space sensitive language (like python or F#), but realized that it would be too painful to retrofit in Roslyn and by the fact also that braces can allow compact syntaxes (specially with closures) that are difficult to express without.

Then I started to bring some more important syntax changes:

- Use of `import` keyword instead of `using` to import namespaces 
- Introduction of modules like in F# (static class in C#) but they would work the same way with `import` (no need to say `import static`)
  ```stark
  // Import namespace core
  import core
  // Import module core.runtime
  import core.runtime
  
  // Declare an empty module
  public module my_module { }
  ```
  The introduction of module as first class construction is important to make also functions first class.

- Only one `namespace` per file, namespace would not require braces and should come first in the file. This is similar to Java for instance.
  ```stark
  namespace core

  public virtual class Object {
      private unsafe let _type : Type
      public constructor() {
      }
  }
  ```
- Use of a simple [naming convention](https://github.com/stark-lang/stark/blob/master/doc/naming-conventions.md) derived from Rust:
  - Using `UpperCamelCase` for "type-level" constructs (class, struct, enum, interface, union, extension)
  - And `snake_case` for "value-level" constructs  
  <br>

  | Item | Convention |
  | ---- | ---------- |
  | Package | `snake_case` (but prefer single word) |
  | Namespace | `snake_case` (but prefer single word) |
  | Module | `snake_case` (but prefer single word) |
  | Types: class, struct, interface, enum, union | `UpperCamelCase` |
  | Union cases | `UpperCamelCase` |
  | Functions | `snake_case` |
  | Local variables | `snake_case` |
  | Static variables | `SCREAMING_SNAKE_CASE` |
  | Constant variables | `SCREAMING_SNAKE_CASE` |
  | Enum items | `SCREAMING_SNAKE_CASE` |
  | Type parameters | concise `UpperCamelCase`, prefixed by single uppercase letter: `T` |
- Use of a more uniform naming for primitive types, following the syntax of Rust:
  
  | C# | Stark |
  | ---- | ---------- |
  | `bool` | `bool` |
  | `byte` | `u8` |
  | `sbyte` | `i8` |
  | `short` | `i16` |
  | `ushort` | `u16` |
  | `int` | `i32` |
  | `uint` | `u32` |
  | `long` | `i64` |
  | `ulong` | `u64` |
  | `System.IntPtr` | `int` |
  | `Systme.UIntPtr` | `uint` |
  | `float` | `f32` |
  | `double` | `f64` |
  | `object` | `object` |
  | `string` | `string` |
  
  <br>You will notice that `int` and `uint` represents actually native integers (e.g an `int` is an `i32` or `i64` depending if the target CPU 32 or 64 bits). In Stark, they are first class types and are for example used as the default type for array/collection size/indexers.
- Use of `implements` interface inheritance/prototype contracts and `extends` for sub-classing, similar to Java.

  ```stark
  namespace core
  public abstract class Array implements ISizeable {}
  ```
  ```stark
  namespace core
  import core.runtime
  
  /// Base class for an exception
  public abstract immutable class Exception extends Error {
      protected constructor() {
      }
  }
  ```
- Use of `virtual` on class definition to specify that they can be sub-classed. They are `sealed` (in C# terminology) by default.
- Use of only one syntax for `for` which would be equivalent of the `foreach` syntax in C#

  ```stark
  public static func sun_range(range: Range) -> int {
      var result : int = 141
      for x in range {
          result += x
      }
      return result
  }
  ```
  For iterating other an integer range (e.g `for(int i = 0; i < array.size; i++)`) the equivalent in Stark is to use the Range syntax as a Range in Stark is iterable:

  ```stark
  public static func sun_range(array: []u8) -> int {
      var result : int = 0
      for i in 0..<array.size {
          result += array[i]
      }
      return result
  }
  ```    
- Mandatory braces `{` and `}` for all control flows
- Left to right syntax, to simplify parsing and to make reading "left to right" matching what you are actually writing in the code (similar to Go lang):
  - A function declaration is: `public func myfunction() {}`
  - A variable declaration is `var x = 5`
  - A variable declaration with single assignment is `let y = "test"`
  - An array of unsigned 8 bits is `[]u8`
  - An optional object `?object`
  - An optional array of optional string is `?[]?string`
 - Make parameters declaration name first and then type, separated by a `:` colon 
  ```stark
  public static func process_elements(array: []u8, offset: int, length: int) -> int {
      // ...
  }
  ```       

#### test3

- Departure from ECMA-335
- Fork of Roslyn
- Fork of dnspy
- Fork of System.Reflection.Metadata

Details:

- Implementation of for instead of foreach
- Remove inheritance of ValueType from object
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


### Development of the native compiler

- Using RyuJIT
- CoreRT like
- LibObjectFile
- Iced

### Integration with a micro-kernel


### Feedback


## Next phases

### Overall schedule


### The language


### The front-end compiler


### The native compiler


### The operating system












