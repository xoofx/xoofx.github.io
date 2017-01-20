---
layout: post
title: Stark, Language Design Part I - The Tokens
tags:
 - Stark
 - C#
comments: true
---

After my introduction post about the [Stark Language Experiment](/blog/2017/01/17/the-stark-programming-language-experiment/), and before going deeper into the implementation of the lexer and parser, we definitely need to decide the overall syntax of the language, or at least some structural foundations. We don't need to go through every single tiny corner cases (macros for example are not critical, it is often not that difficult to integrate them afterwards) but we still have to figure-out some details that may affect usability or complicate parsing or may produce a grammar that is not even possible to parse easily...

Let's start by defining most of the language tokens necessary for developing the lexer (the lexer part will contain a more formal definition for matching tokens): 

- comments
- literals for primitive types (numbers, char, strings)
- identifiers
- operator, separators, punctuation characters
- end of statement/line convention, importance of spaces or not...etc

Though I will end this post with a special guest topic not related to the lexer: using prefix (e.g `int32 x = 5`) or postfix (e.g `let x : int32 = 5`) for type annotations? As this was asked by someone on Twitter, that's something we can talk early about here... as I may change to the later instead of the former notation I used in my previous introduction post of the Stark language. Let's find out why...

# Comments

We will use regular C# comments there. In my previous prototype I used the `#` for single line (e.g often used by shell scripts or python) and `##` for multiple lines... but, let's use instead a syntax that is more common and familiar in similar languages (C#, Rust, F#, Swift...):

- Single line comments starts by `//` until the end of the line.
- Multi-line comments starts by `/*` and must be closed by `*/`. Note that unlike C/C#/Java..etc. **Nested multi-line comments are supported** (like Rust do for example). It feels more intuitive to support them (most likely early C parsers didn't bother to handle nested, so it became the norm?) I have seen many people debating about this... like, some even considering that nested comments are evil and it is better to enclose them with `#if 0`...`#endif`, seriously... oO
- Documentation comments starts by `///` to generate a documentation for the following item.

In Rust, there was a need for a 3rd type of documentation comments `//!` to comment the parent type (and not the following item). Not sure if we may need this at some point, but we can refine this later...

# Literals and primitive types

If we take the C# or Java primitives, many of them have been influenced by C, like `char`, `int`, `long` - though this one is special because it is more `long long` in C++, `float`, `double`... Things are getting a bit weird because the associated typed struct for a `float` is called `Single`, where the associated type for a `int` is `Int32`... which can be confusing...

I don't think that these primitives are easy to grasp quickly and I prefer using a much more explicit convention using postfix bits that will make overall the language more coherent.

Rust for example is using `i32` for C# `int`, `f32` for C# `float`... it feels better, but that's one thing I'm a bit annoyed with Rust is its condensed syntax that at some point combined with other parts of the languages (generics + lifetime) can give a difficult time for a casual reader of the language. I like the C# approach of having a bit longer keywords to describe things, it is still important to have compact keywords for very common types. So we won't go to something like `integer32`...

We can adopt the following convention:

- **Boolean**: We will keep `bool` type that can declare a value that is `true` or `false`
- **Integers**: uint/int with a bit postfix 8/16/32/64 for integers: so we will have `int8`/`uint8`, `int16`/`uint16`, `int32/uint32`, `int64`/`uint64`
  They can be declared in multiple ways:

  ```csharp
  120 // A plain integer int32 by default
  0xff // An hexadecimal number 
  0o777 // An octal number
  0b1111_1111 // a binary number
  ```
  Note that the integer `-15` is actually parsed as a prefix minus expression with an integer. Typically, the lexer will return 2 tokens there...

  For visual convenience, digit can be separated by a `_`

  There is also what kind of postfix a literal should have to force it to an actual type.
  Typically in C#, we use `var i = 15u` for an `uint` (and if the value is bigger, it would be an `ulong`, and there is more with [L and UL together](https://msdn.microsoft.com/en-us/library/aa664674))

  So I'm thinking that we should just postfix with the type like:

  ```csharp
  let a = 15uint32
  let b = 16float32
  ```

  The idea behind this is that it could work for a generalized [unit of measure system like in F#](https://docs.microsoft.com/en-us/dotnet/articles/fsharp/language-reference/units-of-measure). I haven't digged into this idea, so once we get further into the type system, we may revisit this back.

- **Floats**: floating point numbers with a bit postfix 32/64: `float32` or `float64`. The literals should be similar to C#, nothing fancy.
- **Characters**: We will keep `char` as it is good enough. Note that unlike C#, it won't be a 16bits character but a *[unicode scalar value](http://www.unicode.org/glossary/#unicode_scalar_value) except high-surrogate and low-surrogate code points. It is an unsigned integer in the ranges of integers 0 to `0xD7FF` and `0xE000` to `0x10FFFF` inclusive*. Like for operations on numbers that can cause overflow, we will have yet to define later how this range is going to be enforced (at compilation time, for sure, at runtime also?). Question is: Do we want to have a `char32` (for UTF-32) and `char16` instead? It is not highly critical for now to choose, we can change this a bit later.

  A `char` literal would be enclosed between `'` like `'\n'` or `'a'` or `'\u12f2'` or ``\x20`

- **Strings**: the `string` type will not be a real primitive (as it is a reference type, using class with a vtable...etc.) but a string literal will be encoded like in C# for normal strings: `"This is a string"` and raw strings `@"This is a raw string"`. The exact supported escape characters will be specified in my next post when developing the lexer. String interpolation (in C# `$"My string {name}"`) will come much later if we have advanced enough into the development of the language, as this is mainly convenient and less fundamental. The string type will be later defined as a real `class string` backed into the core library.

- What about the `decimal` type in C#? As it doesn't fit anything real into a register processor, I will let that for later as a good exercise to add a new type of number with associated operations (and literals with units...etc.)...

- **Native Integers**: the native pointer size type is an integer of the size of a pointer (e.g On a 64bit machine, it is a 64bit integer). We will use `intz` and `uintz`. The `z` would be for the `int`(si)`z`(e)... not sure it is a super good idea... Rust is using `usize` and `isize`... maybe it is better named, easier to understand? This type is actually important because unlike C#, I plan to make all the default indexer on arrays, lists...etc. using the type `uintz`. It brings type safety/natural checking and reflects more correctly the range limit access to the memory. Let me know what you think about this one (not critical to decide early for it)

- **Pointer types**: the pointer type `intptr` and `uintptr` similar to C# 


I still don't know how these primitives will be declared in the language. Typically in C#, you have for a primitive like `int` associated with an equivalent struct `Int32` that declares some variables/constant and operations for it (like Minimum, Maximum, TryParse()...etc.)

I would love to see if I can achieve to declare `int32` explicitly in the core library like this:

```csharp
##nativeType  // instruct the compiler that the following struct is a native type
public struct int32 : ...
{
    // ...
    static 
    {
        let minValue = -2147483648
        let maxValue = 2147483647
    }
}
```

While it requires still a strong cooperation with the compiler (for the example annotation `##nativeType`, special treatment behind because you can't easily declare in the language itself how to perform a `+` operation for example, or because literals need to map to them at some point), I like the idea that even primitive types are not marked as keywords but actual defined types. While developing a HLSL parser in the past, I discovered that forcing keywords for things like `float4x4` was actually more annoying than it is (and I had actually to reroute these types to something like `vector<float, 4>`)

Note that as I will explain a bit more in my next post about the lexer, why these `int32`, `char`...etc will not be considered as specific tokens for the lexer...

# Identifiers

Nothing crazy there, it is quite similar to C# with a starting `[_a-zA-Z]` followed by `[_a-zA-Z0-9]*`. The slight difference here is that the special case where an identifier is only composed of `_` may generate a different token (underscore only) instead of a token identifier. This may be used as a way to differentiate the any type `_` that we plan to use for higher kind types. Plus, I find quite confusing to allow a variable composed only of `_` or `_______` or `_____` (C# typically allows this!)

Note also that I'm not introducing anything about special identifiers prefixed by `$` for example (e.g used for a macro processing)... We will see later how we need to deal with them. Most likely for macros as far as I can predict... but let's not hold this for granted, because the macro syntax might require a more subtile way of handling special identifiers substitution/expansion...

# Operator, separator, punctuation characters

Many punctuation characters are used by a programming language like `[` `]` `{` `}` `(` `)` `:` `=` `;` ...etc.

Punctuation strings are often matched by a lexer like `<<` `>>` `&&`... Though as we will see, it is sometimes quite annoying to have the lexer starting to group tokens like `<<` as a single token, because then we need to be careful when handling a simple class generic instantiation like `List<List<int>>` here the trailing `>>`. We would start naively to match the starting `<` with a single token but we could have a trailing `<<` that would effectively close 2 at once... and believe or not, but many C++ compiler didn't handle always that well...

# End of statement and End Of Line

Despite my long habit of using C/Java/C# like languages, I still don't like many of their unnecessary character verbosity...

Typically the case of the trailing `;` at the end of a statement like `var i = 5;` 

In Stark, I would like to remove its mandatory usage, though you could still have them around if you want, or if you have a case where putting a complex declaration  on a single line separated by `;` makes more sense. Then it means that the EOL characters (`\r` or `\r\n` or `\n`) would be significant.

Last year, I developed a [Scriban, a quite powerful text templating language and runtime for .NET](https://github.com/lunet-io/scriban/blob/master/doc/language.md), similar to Liquid or Handlebars, but imho, more powerful :D (and I haven't been able to take the time promote it in whatever ways, as I used it primarily to develop lunet, a prototype of a static website generator...)... but when developing this small language, I enjoyed a lot to introduce the non mandatory `;`... it makes the syntax very clean. I know that some people may miss it, but I believe that it is not as structural as, e.g a language using `{` `}` for delimitating blocks vs a language using spaces (like python)... 

Speaking of which, as a fun fact, in my previous prototype, I developed everything, including the ANTLR proto, with a space aware language... I know that there are strong opinions on it, I don't have any but... I switched back to a "familiar" `{`/`}` instead, because they do allow compact syntaxes when you need them... (specially for closures as parameters...etc.)... F# made the chose to support somewhat both... why not, but don't think I'm going to follow this (I know more people around me would be annoyed of having a language using significant whitespace so...)

Lastly, all spaces will be parsed by the lexer and forwarded to the parser as well. I don't expect many cases where I need to have a space information, but it can be very useful in some cases. Like Roslyn, I expect the parser to keep all tokens around in case of source round-trip manipulations...

# Guest topic: The case of prefix and postfix type annotation

<blockquote class="twitter-tweet" data-conversation="none" data-lang="en"><p lang="en" dir="ltr"><a href="https://twitter.com/xoofx">@xoofx</a> how about postfix type annotation like in typescript?</p>&mdash; Ivan Milutinović (@milutinovici) <a href="https://twitter.com/milutinovici/status/821662755476402179">January 18, 2017</a></blockquote>
<script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

When declaring a local variable:

- Postfix type annotation: `let i : int32 = 5`
- Pre-fix type annotation: `int32 i = 5`

When declaring a function parameters:

- Postfix: `processData(data: List<int32>) -> int32 { ... }`
- Pre-fix: `int32 processData(List<int32> data) { ... }`

Members of a struct or a class:

- Postfix:

  ```csharp
  struct Vector2
  {
      x: float32
      y: float32
  }
  ```
- Prefix:

  ```csharp
  struct Vector2
  {
      float32 x
      float32 y
  }
  ```

Let's check some opinions on that: [Why does the type go after the variable name in modern programming languages?](http://softwareengineering.stackexchange.com/questions/316217/why-does-the-type-go-after-the-variable-name-in-modern-programming-languages)

Actually, in addition to many old, many recent "modern" languages have been adopting the postfix type annotation (Swift, Rust, Typescript to name a few...). And again, incidentally, in my previous prototype, I was using them, but in my previous post, I didn't and the syntax was closer to what we have with C#

While the prefix syntax looks more compact, there is a lot more to favour a postfix syntax:

- The variable/method name comes first. Reading from left to right feels more natural (this is my function name, here is its 1st parameter and its type, here is the return type of the function). Member names of a struct/class are more naturally aligned whatever return parameter they have...
- It makes possible to use implicit type inference more easily. Typically in F# you can write something like this:

  ```fsharp
  let inline (>>) f g = g(f)
  ``` 
  instead of a more verbose equivalent if I had to express it in the hypothetical Stark syntax using plain generics:

  ```csharp
  operator<TInput, TResult>(TInput f ">>" func TResult g(TInput f) ) => g(f)
  ``` 

  instead with type inference, we could declare:

  ```csharp
  operator(f ">>" g) => g(f)
  ``` 
  note I don't yet if we will end up with automatic type inference like this... but for sure, it looks a lot more appealing

- Possibly less potential problems of running into a context sensitive grammar. This happens typically when using pointers `int32* x`: is it a variable `int32` multiplied by `x`? I could fix this by requiring the pointer to be prefix but then... I don't know how Roslyn typically handle this, but I'm afraid that it requires to defer the interpretation of such a simple statement... and for a parser, that's bad... and it is also most likely bad for a human reader unfamiliar with pointers

My main argument so far for prefix is that it gives a more compact form (and the syntax is closer to C/C#/Java)... but there is actually more arguments in favour of a postfix version...

So as I feel more potential future for this syntax, **Stark will use postfix type annotation instead**... 

# Next?

So we have informally defined the basic tokens that we will use to parse our language. I think it is important to explain why we are choosing a particular syntax against another... instead of giving a "here is the syntax, eat it".

I still need to formalize parsing a bit more using a standard notation (like [EBNF](https://en.wikipedia.org/wiki/Extended_Backus%E2%80%93Naur_form)... though it seems many are using simpler syntax)... so that overall it will feel more solid and help to catch potential grammar problems earlier.

We will see that when translating this formal description to a handwritten parser, we may parse things slightly differently (and sometimes more efficiently than a generated parser)

The next part should cover the development of the Stark Lexer (good name for a bad guy in a Superman movie), with hopefully some code pushed to the [Stark github repo](https://github.com/stark-lang/stark)... we will get back to a whitepaper after and start formalizing basic control flows, type declarations...etc.
