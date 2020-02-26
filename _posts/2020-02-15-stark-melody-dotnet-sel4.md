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
- Use of the keyword `constructor` for declaring a constructor.
- Use of a simple [naming convention](https://github.com/stark-lang/stark/blob/master/doc/naming-conventions.md) derived from Rust:
  - Using `UpperCamelCase` for "type-level" constructs (class, struct, enum, interface, union, extension)
  - And `snake_case` for "value-level" constructs 
  - A departure from C# is that modules and namespaces are following `snake_case`
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
  {: .table }

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
  {: .table }
  
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
- Casting between types is using the `as` syntax:
  ```stark
  var a_float = 123 as f32
  var an_int = 1.5 as int
  ```
- Add if/then/else expression instead of C# ternary `cond ? value_true : value_false`:
  ```stark
  // if in an expression
  var result = if cond then 1 else 2

  // If as a statement
  if cond then {
    // ...
  } else {
    // ...
  }
  ```
- Attribute syntax is following the Java attributes prefixed by `@`. You can still have multiple attributes but they don't need to be enclosed within brackets and separated by commas.
  ```stark
  @AttributeUsage(AttributeTargets.PARAMETER)
  @ThisIsAnotherWithoutParenthesis
  public class MyAttribute extends Attribute {
      public constructor() {}
  }
  ```

#### Remove boxing and object default methods

In Stark, boxing a value-type automatically to a managed object is no longer possible. You can't cast an `int` to an `object`, so you can't allocate accidentally on the heap.

The collateral effect of this change is also that you can't cast a struct to an interface even if that struct implements that interface. If you need to call a struct through an interface, it has to go through a generic constraint call.

Also consequently, all the default virtual methods inherited by all objects were removed from `object` class definition: 
- `~object()` destructor
- `bool Equals(object)`
- `int GetHashCode()`
- `string ToString()`

It should help to have a smaller footprint for runtime metadata for reference types. The VTable for objects in Stark would be empty by default.

An important benefit of these changes is that pointers can now be used as generic arguments:

```stark
var list = new List<*u8>() // declare a list of pointer to u8
``` 

(Because in regular ECMA-335, pointers are not inheriting from `System.ValueType` and so they cannot be boxed)

> You may wonder why it is important to have that support: It can be useful if you are developing low level parts in a kernel OS where you don't have yet a GC running but you still want to use container classes to manipulate kernel objects and structures.

#### Remove Array co-variance

This is one of the big legacy design decision that is now possible to revisit in Stark.

In C#, Arrays are co-variant, meaning that this is possible:

```c#
var array_of_string = new string[] { "a", "b" };
var array_of_object = (object[])array_of_string;
array_of_object[0] = 1; // will result in a runtime cast error
```

Not only it can be error prone but it has a cost at runtime, as an array write access can lead to perform a type cast check.

In Stark, this will not be possible.

> Note: This is not yet implemented in the front-end compiler but should not be much trouble to bring.

#### The error model

In order to differentiate non-recoverable programming errors from OS/user exceptions (e.g IO), the error model of Stark is following the feedback from [Midori - The Error Model](http://joeduffyblog.com/2016/02/07/the-error-model/)

- Aborts are non-recoverable errors that can be either:
  - Generated errors by contract at compile time
  - Runtime errors when it is not possible to detect this at compile time
  - Explicit aborts via runtime asserts
- Checked exceptions for OS/user exceptions (e.g IO)

```stark
namespace core
import core.runtime

public interface IArray<T> extends ISizeable, MutableIterable<T, int> {
    /// ref indexer #2, not readable
    func operator [index: int] -> ref T 
        requires index >= 0 && index < size { 
          get 
    }
}
```

> Note that while the parser is currently accepting this syntax, the work to fully support this has not been done yet
>
> It will require to store the IL instructions for the `requires` clause, as well as having a simplified interpreter at compile time and fallback to a runtime error if not possible.

And for checked exceptions, the syntax is following the Java syntax:

```stark
    // Valid (throws declared)
  public static func throw_my_exception() throws MyException {
      throw new MyException()
  }

  // Calling a method that throws without `try method()` is invalid
  public static func call_a_method_which_throws_invalid() {
      throw_my_exception() // generates a compiler error
  }

  // Valid (try with method throwing an exception)
  public static func try_a_method_which_throws() throws Exception {
      try throw_my_exception()
  }

  // Catching an exception does not require throws on method
  public static func try_a_method_which_throws_but_is_caught() {
      try {
          try throw_my_exception()
      } catch (MyException ex) {          
          // We don't rethrow  
      }
  }
```

Exceptions need to be caught or declared on the method. Later Stark will also support `try` expression with `Result<T>` which will allow to perform pattern matching on it, to extract the exception or the result value of a method call.

#### Unsafe IL

Even if a language provides high-level constructs and safety, it requires often unrestricted access in order to provide safety (!) or more efficient code. These unsafe usages can still be abstracted and wrapped.

In C#, there is no easy support for that, so these days, you need to either:

- Use `System.Runtime.CompilerServices.Unsafe` though you can't do everything and it is bound to what is exposed
- Use a solution like [Fody](https://github.com/Fody/Fody) coupled with [InlineIL.Fody](https://github.com/ltrzesniewski/InlineIL.Fody)

In the F# code library, the F# compiler is allowing to inline IL with the syntax `(# ... #)` and it is [used internally](https://github.com/fsharp/fsharp/blob/6819e1c769269edefcea2263c98f993e90b623e2/src/fsharp/FSharp.Core/prim-types.fs#L400-L467) to unlock some low level parts that cannot be expressed in F#. In the past it was even allowed for user library, but I have read somewhere that it is no longer possible (which is fine).

In the CoreRT compiler, they had to develop IL post processing (similar to Fody) to [patch some methods like Unsafe utility methods](https://github.com/dotnet/corert/blob/3c58e6d6a41a64d8742535c653088a7629ce879c/src/Common/src/TypeSystem/IL/Stubs/UnsafeIntrinsics.cs#L13-L90).

In Stark, I have decided to bring back to life the old prototype [Inline IL ASM in C# with Roslyn](https://xoofx.com/blog/2016/05/25/inline-il-asm-in-csharp-with-roslyn/) and improved its integration by allowing a new `unsafe il` syntax:

```stark
public func operator [index: int] -> ref T
    requires index as uint < tSize as uint
  { 
    get {
        unsafe il {
            ldarg.0
            ldarg.1
            sizeof T
            conv.i
            mul
            add
            ret
        }
    } 
}
```

#### UTF8 String by default

A [String in Stark](https://github.com/stark-lang/stark/blob/master/src/runtime/core/String.sk) is UTF8 by default. It is even just a sequence of byte and the string type is actually a small struct wrapping this byte buffer:

```stark
namespace core

/// A string is a struct wrapping an array of u8
/// Can be mutable or immutable/readable and sharing
/// the same interface as arrays
public struct String implements IArray<u8> {
    private let _buffer : []u8

    public constructor(size: int)
        requires size >= 0 {
        _buffer = new [size]u8
    }

    public constructor(buffer: []u8) {
        _buffer = buffer
    }

    // ...
}
``` 

This is very similar to what has been adopted for [strings in GoLang](https://blog.golang.org/strings).

The type `char` has been also replaced by the type `rune` which has the size of an `i32` (unicode codepoint).

#### Generic Literals

In C#, generic parameters are only meant to be Type definitions. You can't easily design something like `SmallList<T, 5>` where the implementation would store 5 consecutive T elements or overflow to a managed array if there is not enough room.

Generic literals are very important to introduce more efficient algorithms usually for performance reasons (e.g specialized codegen) and to improve locality (e.g fixed amount of co-located data).

In Stark, I have introduced the possibility to declare that a generic parameter is expecting a const literal primitive (e.g `const int`). For example, a fixed array in Stark is declared like this:

```stark
namespace core
import core.runtime

public struct FixedArray<T, tSize> implements IArray<T> where tSize: is const int
{
    // The array cannot be initialized by using directly this class
    private constructor() {}

    // size is readable
    public func size -> int => tSize

    // ...
}
```

It is then possible to use fixed array with the following syntax:

```stark
public class PlayFixedArray {
    // Declare a field with a fixed size array
    public var field_table: [4]int

    // Fixed size array of objects
    public var field_table_of_objects: [3]object
}

public module fixedarray_playground {
    public static func play_with_fixed(cls: PlayFixedArray, 
                                       fixed_array_by_ref: ref [2]int) -> int {
        // Fixed size array access
        return cls.field_table[0] + fixed_array_by_ref[1]
    }
}    
```

This type can then be reused in higher level containers (e.g `SmallList<T, tSize>`)

The `FixedArray` type is also a special case for the native compiler. As you can see above, the struct doesn't contain any field declarations, but the native compiler will generate them when the struct is being used.

There are still challenges ahead related to how far we will allow to create const literals from const expressions:

```stark
public struct HalfFixedArray<T, tSize>  where tSize: is const int {
    // Some challenge ahead to store this computation at IL level
    public var field_table: [tSize / 2 + 1]T
}

```

#### Iterators

In .NET, the `IEnumerable<T>` is a pattern to iterate on a sequence of elements and mostly relevant when used in conjunction with the `foreach` syntax. In [Rethinking Enumerable](https://blog.paranoidcoding.com/2014/08/19/rethinking-enumerable.html) Jared Par explained what is wrong with `IEnumerable<T>` and explored a different way of iterating on elements.

For the same reasons, Stark is departing from .NET `IEnumerable<T>` by introducing `Iterable<T, TIterator>`, where `TIterator` contains the state of the iteration:

```stark
namespace core

/// Base interface for iterable items
public interface Iterable<out T, TIterator>
{
    /// Starts the iterator
    readable func iterate_begin() -> TIterator

    /// Returns true if the iterable has a current element
    readable func iterate_has_current(iterator: ref TIterator) -> bool 

    /// Returns the current element
    readable func iterate_current(iterator: ref TIterator) -> T

    /// Moves the iterator to the next element
    readable func iterate_next(iterator: ref TIterator)

    /// Ends the iterator
    readable func iterate_end(iterator: ref TIterator)
}
```

And it's usage in Stark is no different than in C# with `foreach`:

```stark
public static func sum(indices: List<int>) -> int {
    var result : int = 0
    for x in indices {
        result += x
    }
    return result
}
```

In the case of `List<int>` the iterator state is simply an integer, the index of the element.

The generated code under the wood is doing something like this:

```stark
public static func sum(indices: List<int>) -> int {
    var result : int = 0
    var iterator = indices.iterate_begin()
    while indices.iterate_has_current(ref iterator) {
        var x = indices.iterate_current(ref iterator)
        result += x
        indices.iterate_next(ref iterator)
    }
    indices.iterate_end(ref iterator)

    return result
}
```

The implementation for `List<T>` would inherit from `Iterable<T, int>` with the methods:

```stark
    readable func Iterable<T, int>.iterate_begin() -> int => 0

    readable func Iterable<T, int>.iterate_has_current(index: ref int) -> bool => index < size

    readable func Iterable<T, int>.iterate_current(index: ref int) -> T => this[index]

    readable func Iterable<T, int>.iterate_next(index: ref int) => index++

    readable func Iterable<T, int>.iterate_end(state: ref int) {}
```

The major benefits of using such a pattern:

- The iterator state is separated and can be a value-type
- The generated code doesn't box (in C# you would have to create duck typing GetEnumerator() method to workaround it)
- The implementation is simple and straightforward, no need for an extra-type (e.g the Enumerator). Many iterators on indexed containers can use the iterator state `int`
- Implementing `Linq` over this iterator should allow to generate efficient inlined code.

#### Ranges

#### Slices

#### Others

- RuntimeExport/RuntimeImport symbol binding
- Parameter less constructor for structs
- CallerArgumentExpression

#### Departure from ECMA-335

A change like "remove boxing of value type" required a departure from [ECMA-335](https://www.ecma-international.org/publications/standards/Ecma-335.htm) as a struct is identified at the IL level when it inherits `System.ValueType` which is a reference type. The following changes were applied to the standard:

In **II.23.1.15 Flags for types [TypeAttributes]** in the table, at the section _Class semantics attributes_:

| Flag |  Value | Description |
|-|-|-|
|`ClassSemanticsMask` | `0x00000060` (changed) | Use this mask to retrieve class semantics information.
|`Class` | `0x00000000` | Type is a class
|`Interface` | `0x00000020` | Type is an interface
|`Struct` | `0x00000040` (new) | Type is a struct
{: .table }

It's not the sole change that I had to make. For example:

- I have also added an `Alignment` field to `ClassLayout` in order to specify custom alignment of types (e.g SIMD vector types can require 16 bytes or more)
- And modified a couple of flags to (e.g `Intrinsics` attribute would translate to a flag on `[MethodImplAttributes]`)

I'm trying to keep these changes documented in [changes-to-ecma-335.md](https://github.com/stark-lang/stark/blob/master/doc/changes-to-ecma-335.md).

More changes will have to come for other language features:

- `requires` contract on methods
- Checked exceptions
- Immutability/Readable/Isolated concepts

#### Fork of dnSpy

In order to check if the compiler was generating valid IL, I wanted to verify this with a tool like ILSpy or dnSpy. Because I had to make changes to ECMA-335/IL Format, I had also to make similar changes to an IL inspector.

I have been maintaining a [fork of dnSpy](https://github.com/stark-lang/stark-dnSpy) for Stark:

<img src="/images/stark-dnSpy.png" class="mx-auto" style="display: block"/>

I made the choice of dnSpy mostly because it was possible to inspect raw metadata as well.

#### Fork of System.Reflection.Metadata

Another consequence of the change to ECMA-335 is that I had to fork `System.Reflection.Metadata` which has been renamed to `StarkPlatform.Reflection.Metadata`.

This library is used by the Stark front-end compiler (e.g Roslyn for C#) to read and write assemblies but also by the native code compiler.



Details:

- Implementation of checked exceptions
- Implementation of unsafe IL
- Implementation of literal generic context
- Implementation of ranges
- Implementation of new iterator pattern
- Implementation of slices
- String are UTF8
- Pointers in generics
- 
- RuntimeExport/RuntimeImport symbol binding
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












