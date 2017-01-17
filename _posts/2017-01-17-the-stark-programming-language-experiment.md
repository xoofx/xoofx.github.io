---
layout: post
title: The Stark Programming Language Experiment
tags:
 - Stark
 - Compiler
 - LLVM
 - C#
 - .Net
comments: true
---

<img src="/images/stark.png" style="width:150px; height: 150px; float: right;"/>

In the past years, while using intensively C# for developing game engines and various libraries, I have been struggling with many limitations of the language and runtime and tried to mitigate these by using whatever unsafe/IL/native code could help, but of course, there are many things you can't just solve with basic workarounds... 

A few years ago, when I first read the paper [Uniqueness and Reference Immutability for Safe Parallelism](http://joeduffyblog.com/2012/10/28/uniqueness-and-reference-immutability-for-safe-parallelism/) and later the blog post of Joe Duffy about [C# for System Programming](http://joeduffyblog.com/2013/12/27/csharp-for-systems-programming/) While I tried to contact him with my colleague to give our hands/help to make it possible to release it... we didn't get a response :) but I was really excited about it and immediately started to sketch a few ideas about what this language could be. My original sketches didn't go far: I wrote mainly a parser prototype with an ANTLR parser, digged a bit into the memory models (things like [Region based Memory SubSystem for SSCLI](http://www.academia.edu/3300138/A_Region_Memory_Subsystem_for_SSCLI)), Rust was already under heavy development so it was interesting to watch this language evolving...incidentally, at that time, they announced to [remove GC from Rust](http://pcwalton.github.io/blog/2013/06/02/removing-garbage-collection-from-the-rust-language/). I wrote a [prototype of an Immix Garbage Collector](https://github.com/xoofx/gcix) in C++, so in the end, nothing finished, nothing fancy... but I kept this strong taste of excitement of trying to build a new language and runtime that better fits my needs...

In the meantime of my quest to improve things there, I played with some language and runtime experiments in C# with [struct inheritance](http://xoofx.com/blog/2015/09/27/struct-inheritance-in-csharp-with-roslyn-and-coreclr/) or [stack allocation for  reference types](http://xoofx.com/blog/2015/10/08/stackalloc-for-class-with-roslyn-and-coreclr/)... Of course, developing a new language and runtime is a huge daunting task, but it is even harder to try to evolve an existing language, runtime and ecosystem: I remember I asked at a MVP summit one or two years ago if C#/.NET could evolve significantly without introducing breaking changes... but legacy is legacy, at some point you can't really overcome the structural foundations of it that was built many years ago in the early footsteps of Java...

So back to the ring, instead of going full submarine on this, I would like instead to re-start this journey as a big tutorial series on building a "modern" language and runtime from scratch... From the language specs, parser&compiler, intermediate bytecode representation, LLVM backend compilation... I will try to implement a prototype of this new language and post the dirty details of the process as a blog post series. It is going to be certainly impossible, but let's just dream, it doesn't hurt and I will most likely learn many things while trying it... and hopefully, 

Let's call this language design experiment **Stark**, a name I used for my previous prototype, pun intended, with a bit of geeky reference and the intended point to get something "bare" or "simple" yet powerful...

# Why?

"Why not using XXX language instead?"... the whole purpose of this experiment is to feel into my body-brain the pain and the joy of designing and developing a language and runtime... so you can't really replace this adventure by anything else...

Even though I have been following a bit a language like Rust, I haven't been satisfied by the syntax or the cumbersome constraint of using the memory ownership system coupled with lifetime...

Also, I don't have the pretention to bring anything massively new into this experiment... so be indulgent, this is going to be a playground journey, influenced by the few languages I have used or seen in my life... a subtile patchwork of things already done elsewhere! Among others, I will try to bring many ideas that the Midori team implemented in there language, relying largely on the fantastic blog post series of Joe Duffy.

# Stark, a Language Overview at 10,000 feet

Let's try to draw a dream wish list with an emphasis balance between performance and productivity. It doesn't mean that this whole tutorial series will cover all of them!

## About the language

- Syntax familiar to a C# developer, with some cosmetic changes:
  - make primitives more coherent (`int32`, `uint32`, `int16`, `uint16` ...etc.)
  - No need for most of trailing ';'
  - Without parenthesis in `if`, `while`... etc.

    ```csharp 
    // Variable are immutable by default
    int32 x = 5
    // Similar to var in C# (but immutable)
    let y = 6
    // Specify mutable before the variable name
    let mutable z = 7
    // Remove ( )
    if x >= 5
    {
        z++
    }
    ```
- `class` (reference type) and `struct` (value type)

  ```csharp
  // Always contains a vtable and a memory management flags, by default not heritable
  // Use of virtual to allow inheritance
  virtual class SimpleObjectBase { }

  // sealed class by default
  class SimpleObject : SimpleObjectBase { }

  // Simple struct (no vtable)
  struct Vector2(float32 x, float32 y)

  ```
- `trait` instead of interfaces (trait type) to allow a better extensibility story via `extends`

  ```csharp
  // Example of Iterator
  // Inspired by Jared Parson blog post "Rethinking IEnumerable: http://blog.paranoidcoding.com/2014/08/19/rethinking-enumerable.html
  trait Iterator<T, TState> 
  {
      TState iteratorStart { get }
      T? tryGetNext(ref TState state)
  }

  // Provides an iterator for all classes implementing IList<T>
  extends IList<T> with Iterator<T, uintz>
  {
      uintz iteratorStart => 0

      T? tryGetNext(ref uintz index) => if index < length some(this[index]) else none
  }

  // Allow to use a trait directly by inheritance
  class MyClassWithIterator<T> : Iterator<T, int32>
  {

  }
  ```
- builtin syntax for `tuple` (valuetypes) with deconstructors

  ```csharp
  let a = (1, "value")
  let x = a.0  // get 1
  let str = a.1 // get "value"
  let (y, str2) = a // deconstruct tuple into variables
  ```
- `enum sum-type`/discriminated unions with the cool pattern matching

  ```csharp
  // The type behind T?
  enum Option<T>
  {
      none,
      some(T)
  }
  ```
- Try to fix The Billion Dollar Mistake a 1 Million mistake by having a `null` safe language

  ```csharp
  process(string name, string? valueMayBe)
  {
      // name is not null
      // valueMayBe may not have a value
      if let val ?= valueMayBe
      {
          list.add(name, val)
      }
      else
      {
          // ...
      }
  }
  ```
- modules/namespaces, global functions, export type aliases

  ```csharp
  // By default, namespace will be deduced from folder hierarchy
  // So most files in a project won't have to declare any namespaces
  namespace myNamespace::mySubNamespace
  {
      public let x = 5

      public int32 increment(int32 val) => val++
  }
  ```

- builtin `contracts`: for pre and post conditions via `requires` and `ensures`

  ```csharp
  public virtual class List<T>
  {
      unsafe T[] array;  // unsafe because the array cannot be initialized with non null values

      public uintz length { get }

      // requires that index < length, it is used for:
      // - compiler optimizations
      // - compiler errors
      // - runtime fatal error
      public T this[uintz index] requires index < length 
      {
          get readonly 
          {
              unsafe { 
                  return array[index]
              }
          }
          set
          {
              unsafe {
                array[index] = value
              }
          }
      }
  }
  ```

- Better **control on memory** and **locality**: allow class on the stack. via `fixed` for arrays/class inlined in class or struct. These variables can only be passed via `transient` locals/parameters. The default would be that the `new` keyword is only used when allocating on the heap (either GC managed or not)... otherwise it will be a normal constructor call (e.g `let x = Vector2(1, 2)` ). There will be also a single ownership allocation that will allow allocate on the heap but without having the GC to track these references (would be tracked by single ownership and destruction on last owner disposed)

  ```csharp
  // struct allocated on the stack 
  // or static global if declared at a namespace level
  let vec2 = Vector2(1, 2) 

  // struct allocated on the heap
  let vec2 = new Vector2(1, 2) 
  // new T of a struct return a new instance of class Box<T>
  Box<Vector2> vec2 = new Vector2(1, 2)

  // Creates a list object on the stack (the array behind is still on the heap)
  let list = List<int32>() {1, 2, 3, 4}
  // Allocate on the heap
  let list2 = new List<int32>() {1, 2, 3, 4}

  // Allocate array on the stack
  let array = int32[] {1, 2, 3, 4}
  fixed int32[] array = int32[] {1, 2, 3, 4}

  // Call a function with this stack allocated array
  processArray(array)

  public processArray(transient int32[] array)
  {
      // ...
  }
  ```
- **UTF8 string**, so a char is a unicode (int), declared as immutable

  ```csharp
  // static string literal (not creating any GC object)
  let mystr = "mystring" 

  mystr[1] // compilation error, no indexers

  // string allocated on the stack
  let mystr2 = string("string stack")
  // Declaration equivalent to:
  fixed string mystr2 = string("string stack")

  // string allocated on the heap
  let mystr3 = new string("string heap")
  ```
- support for slice over array/native memory (syntax yet to be defined)
- **custom operators**

  ```csharp
  // Equivalent to the pipe forward operator
  public TResult operator<T,TResult>(T v "|>" function TResult f(T)) => f(v)
  ```
- **generics with higher-kinded types** and template parameters (so yes, more templates than generics actually)

  ```csharp
  trait Functor<F<_>> // _ means any type
  {
      F<B> map<A, B>(F<A> fa, function B f(A))
  }

  // integer passed to templates
  class List<T, int32 defaultSize>
  {

  }

  let list = new List<int32, 16>()
  ```
  
- **permissions** on type/methods/generics: `immutable`, `mutable`, `readonly`
- **concurrency**/controlled side effects: `isolated`, no static mutable allowed, pure constructors (no storing of this). Basically what has been done by Midori team. Check the blog post [15 years of concurrency](http://joeduffyblog.com/2016/11/30/15-years-of-concurrency/)
- No more built-in `lock` but usage of synchronization primitives (because they monopolize valuable bits for the memory flags attached to a reference type)
- "Modern" **error model**: panic/fatal for programmer errors, checked exceptions for other cases with `throws` and `try` semantic (note that implementation details doesn't mean real exceptions)
- `defer`: allow to defer code execution at the end of a scoped (TBD, still need to figure out the syntax, RAI struct or not...etc.)
- `async`/`await` (with any types as async result), similar to the way C# implements it
- `macros` as compiler extensions, similar to what Rust has been providing
- `annotations` on types/members, but also on code IR. **conditionnal compilation/config features** (to disable part of some code/types...etc.) ala Rust

  ```csharp
  ## noinline
  public int32 increment(int32 val) => val++
  ```
- `partial` types/methods
- `unsafe`/pointers code only in unsafe region allowed only by a compiler switch
- **Easy native interop** (ala `DllImport`), also allow to link with static libs
- **Minimalist RTTI** only used for checking inheritance/type but no `System.Reflection`, no string `Type.Name`...etc. Prefer using code generation (e.g for property updater/binder, serialization...etc.)
- Compiler will generate xplat IR modules (and native single exe or module DLLs if AOT is used)
- Supports for SIMD types

## About the runtime

- **Designed primarily for AOT**, may allow JIT for fast iteration
- Use **LLVM for the compiler backend** infrastructure
- While many instances will be instantiated on the stack or on static immutable section in the shared library, standard **Reference type will be using a Garbage Collector** but that doesn't mean that it will necessarily a tracing GC, but could use at the beginning bohem like conservative first, CoreCLR GC/conservative after, immix/immix+rc later... once LLVM has statepoint fully working in scenarios supported by the languages (similar constraints than CoreRT with stack maps, value types...etc.)
- The whole **runtime should be implemented in the language itself**: No C/C++ runtime (apart for calling existing kernel functions or well established native libraries)
- **trait types will be handled as a double pointers** (trait implem vtable + this)
- immutable static data instances loaded directly from readonly sections (no runtime init cost)

  ```csharp
  // implictly immutable global static variable
  // allocated directly into a readonly section  
  immutable let globalList = List<int32>() { 1, 2, 3, 4}
  ```

# Next?

This is a glimpse of the gigantic work that I would love to be able to bring (note the conditionnal all around), but more presumably, will at least try to implement most of the challenging bits... maybe some enthusiastic folks will be interested in helping this work.

In the next blog posts, I will try to code the early part of this project that will be available on github [https://github.com/stark-lang/stark](https://github.com/stark-lang/stark)

For the ease of development, most of the code will be developed in C#.

I plan to iterate first over a small but functional HelloWorld prototype working on a subset of the grammar and the features described above, while still trying to get everything working and connected from the parser, compiler, IR format and the LLVM back-end compiler to generate effectively a final `exe`

You can prepare your popcorns, lots of suspense and tears ahead!
