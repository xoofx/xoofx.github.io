---
layout: post
title: Implementing a Text Templating Language and Engine for .NET
tags:
 - C#
 - .Net
comments: true
---
{% raw %}
<a href="https://github.com/lunet-io/scriban"><img align="right" width="140px" height="140px" src="https://raw.githubusercontent.com/lunet-io/scriban/master/img/scriban.png"></a>

Last year, before developing [`markdig`](http://xoofx.com/blog/2016/06/13/implementing-a-markdown-processor-for-dotnet/), I spent a few weeks developing a brand new text templating language and engine called [`scriban`](https://github.com/lunet-io/scriban). 

Though, while I have received a few enthusiastic feedback on this project, I haven't taken the time to promote, polish and finish it to the level that I originally expected to push... Until the past weeks where I have finally put the last efforts to bring hopefully a solid stone to the Text Templating .NET OSS ecosystem

So today, I feel quite relieved and excited to **release the first 1.0.0 beta version of `scriban`**, and along the celebration of this release, I would like to share in this post a bit of the underlying decisions and implementation tricks that have been put into this project.

The post is organized like this:

- A [why?](#why) introduction where I explain why I decided to develop this new text templating language and engine
- The [requirements](#requirements) of the language and runtime
- The [language syntax](#language-syntax) of `scriban`
- The [engine details](#engine-details) will give some insights about the parsing and rendering parts of the engine.
- The [documentation and tests](#documentation-and-tests) part gives more detail about how the documentation was handled and how it contributes to the tests as well.
- The [benchmarks](#benchmarks) by comparing `scriban` with various existing solutions

# Why?

I have been always a strong user and developer of code/doc/build generation for the various projects since probably my first experience in a company where I developed an ActiveX/Java bridge back in the old days. That's a fascinating part in computer where you can work on meta work, that could significantly help your daily duties.

Specifically for text templating, in the footsteps of the `printf("%s"...)` or `string.Format("{0}", ...)` you may have never noticed that it is actually often powering parts of many products and scenarios: websites generation, documentation generation, code generation, email templating, project templating... etc.  

In .NET, I have been using text templating in the - non exhaustive - list of the following endeavors:

- [SharpDX](https://github.com/sharpdx/SharpDX) which was needed to generate all the automatic C# marshalling/interop code after parsing the DirectX C++ headers. When I started this project, I used at that time the Microsoft [T4 templating](https://msdn.microsoft.com/en-us/library/bb126445.aspx) and I wrote a [couple of templates](https://github.com/sharpdx/SharpDX/tree/master/Source/Tools/SharpGen/Templates) with it. 

  In order to simplify the deployment of the code generator, I had to use the [`Mono.TextTemplating`](https://github.com/mono/t4) (and actually, I end up copying/modifying a copy into the SharpDX repository itself). If you don't know T4 templating, you have probably used it indirectly, as it is the language that has been powering Visual Studio project generation (when you open a Wizard "New Project"). 
  
  Today, I would not use anymore such a solution - apart for the integrated tt/t4 templates to generate cs files for simple cases.  The compilation process of templates into assemblies is usually way too slow and the syntax is a bit cumbersome to work with (C# based).

- [SharpDoc](https://github.com/xoofx/SharpDoc) was also my attempt a few years ago to bring documentation generation for .NET. It was actually running a lot more faster than sandcastle, bringing more opportunities for overriding templates...etc. 

  I used it for SharpDX documentation of the API reference (which is no longer available online), and it was generating a cool reference API. Though, it is still used by [MonoGame for their documentation](http://www.monogame.net/documentation). It was actually powered by another very famous "statically compiled" templating system `Razor`! 
  
  For this project, I developed at that time [SharpRazor](https://github.com/xoofx/SharpRazor) which is the much more lightweight equivalent of [RazorEngine](https://github.com/Antaris/RazorEngine). It was actually pretty nice to be able to step into the templates with debugging (RazorEngine was not exposing this at that time, and it was a pain to bring this feature to it, mainly because the code was layered with tons of interfaces that were actually abstracting way too much the core Razor Engine). 
  
  Again, it is sharing many similarities with T4 (C# syntax for example) and specially the fact that the time to generate the assemblies for the templating was slowing down the iteration process.

- For this website itself, when I [migrated my blog](http://xoofx.com/blog/2015/06/15/migration-to-jekyll/) from blogger around two years ago to use instead [Jekyll and GitHub pages](https://jekyllrb.com/docs/github-pages/). It has been simplifying a lot the pain of updating this blog and giving me a lot more freedom to control the layout and templating of this website. 

  Static website generators have been here for years (if not decades) and departing from CMS solutions was a real liberation for me (which I unfortunately used for too many years with solutions like Joomla PHP) as much as it improved the editing workflow with git versioning...etc.
  
  With Jekyll, you have to use the [Liquid language templating](https://help.shopify.com/themes/liquid) which is a very simple templating language, not super powerful (and well, sometimes so under feature that you have to fight with tags/filters to simulate even simple things) , but actually "safe", in the sense that unlike T4/Razor, it is a templating language exposing a sand-boxed environment, and can even be used by end-users (most likely one of the key success of the Shopify solution)

Through these various experiences, early last year, I started an initiative to develop a new static website/doc generator called [lunet](https://github.com/lunet-io) which would bring many features that I couldn't find anywhere else... (you know, the kind of naive dream of every developers...)

But While checking for the .NET components that I could use for this project, I realized that *what makes static website/doc generator really powerful are* **the quality of its core components** (templating, markdown...etc) and how they are **carefully and tightly integrated** to provide the best integration experience. 

It turned out that for many parts, I couldn't find the solid core .NET components I was looking for. Hence, I decided that I would develop these core parts first - .i.e  `scriban`, `markdig`... - before even starting building the higher level parts. But that was of course way more work than I expected! 

# Requirements

As for `markdig`, I settled on a few key features I wanted to see in a text templating language and engine, both in terms of `language` and `runtime` requirements:

## Language requirements

- *Simple and lean syntax*, as a templating language is usually integrated into another text environment that can be also a language, it is important that the text templating language doesn't bring too much visual annoyance to the text you want to template
- Supporting *functional constructions* (like the cool liquid pipe calls syntax: `"this is an url" | upcase`)
- But also support almost all control flows and expressions that you can find usually in a higher level language, including:
  - ability to *declare objects/arrays* inside the language itself
  - ability to *declare custom functions* inside the language itself

At that time, I evaluated several language/syntax wise options:

- [Liquid](https://shopify.github.io/liquid/) templates using [DotLiquid](https://github.com/dotliquid/dotliquid): With my experience with liquid templates in Jekyll, while I liked the simplicity of the language, I felt also too many times frustrated by its limitations. It looked not built from the ground-up as a well-thought language, but more like a hack language, not really specified in many parts. I discovered also that it was actually so under specified that custom tag implementations would allow different syntaxes in the language (that would be incompatible with other liquid implems). I have described this in the [Known issues](https://github.com/lunet-io/scriban/blob/master/doc/liquid-support.md) of liquid support in `scriban` (you read this well, there is a compatibility mode to parse Liquid templates in `scriban`! More details further down!)

- [Mustache](https://mustache.github.io/) templates using [Nustache](https://github.com/jdiamond/Nustache): the "logic-less" philosophy of the language didn't resonate in me, so the lack of versatility of the language was a deal-breaker.

- [Handlebars.js](http://handlebarsjs.com/) templates using eventually [Handlebars.Net](https://github.com/rexm/Handlebars.Net), a derivative of Mustache, less stubborn about "logic-less", more practical, but still, Mustache based in too many ways...

- [Cottle](https://github.com/r3c/cottle) this one is probably a bit less popular but worth to consider, both in terms of language features and implementation... (not regex based) but I was maybe not enough happy with the syntax - being a bit too much noisy with `:` and other pipes like in `|elif` for continuation blocks, and in terms of runtime integration with .NET, I was also looking for a more simple and efficient integration.

I also looked a bit outside the .NET world at what other platforms were providing:

- [Hugo with Go's `html/template`](https://gohugo.io/templates/introduction/) has some interesting approaches, the language being quite simple and enough versatile (though no function declaration for example), but among a few things, I was quite disturbed by the implicit target of properties (`.MyTitle`) 

- [Jinja in Python](http://jinja.pocoo.org/) this one was probably the one I liked the most, and by looking at it again while writing this blog post, I have likely been influenced by it too when choosing the syntax for `scriban`. It has even quite a few features that I haven't put in `scriban` - thought some of them are a bit too much in my opinion (and it starts to make the language a big patchwork machinery language that could be too scary to consider...), so I might have some other opportunities in the future to improve `scriban`!

I got a even bit influenced also by Javascript... (nooooo!!!)... okay, only for the ability to create objects and functions directly into the language...

I didn't much consider Razor or T4, because they are using C# syntax which for example doesn't allow pipe expressions (like F# does) and it is so fresh to be able to use them in a template! But also, more importantly, the fact that they were mostly targeting compiled targets and the runtime couldn't be safe for end-users (you can have access to anything you want from these scripts)

## Runtime requirements

In terms of .NET runtime I was looking for a:

- *Very fast parser* (no regex), super *GC friendly*
- Very *lightweight* runtime, avoiding compilation step to IL/.NET assembly (but could be brought later) while still being competitive
- *Safe* runtime, typically to be able to host end-user scripts in a shared environment
- Providing a proper control on the *AST of the code*, eventually with the ability of *saving back the AST to original source code* (in order to be able to translate, or manipulate scripts programmatically)
- Easy to integrate with .NET objects (dictionary, array, lists, JSON or regular .NET struct/classes), .NET custom functions...etc.
- Relatively *extensible* with no static configurations

Language wise, as I didn't find the graal, I didn't look much further if any existing solutions in .NET were enough efficient. But looking quickly at the few options at that time, most of the implementations were often using regex based parsers (which are very slow) and their codebase were not carefully crafted to avoid GC allocations at parsing and rendering time.

# The language syntax

For the syntax, I wanted something very familiar (e.g liquid), simple to learn, so I didn't come up with something very different from what the others have been doing.

For this project, I took very seriously the need for a documentation, so you will find a lot more details in the `scriban` [language documentation](https://github.com/lunet-io/scriban/blob/master/doc/language.md#language).

Here is an example of the syntax (unfortunately, I don't have currently highlighting working for `scriban` in this blog post):

```html
<ul id='products'>
  {{~ for product in products ~}}
    <li>
      <h2>{{ product.name }}</h2>
           Price: {{ product.price }}
           {{ product.description | string.truncate 15 }}
    </li>
  {{~ end ~}}
</ul>
```

In the following sections, I will try to highlight a few key differences of `scriban` language over `liquid` templates

## Code blocks

In `liquid`, there is a concept of tags and filters:

- You enter a tag by opening with `{%` and closing with `%}`. Tags are typically used for control flows like `{% if myvar %}...{% endif %}`
- You enter a filter by opening with `{{` and closing with `}}`. Filters are typically used to display data `{{ myvar }}` and can be used with pipe calls `{{ myvar | truncate: 15 }}`

In `scriban`, we have more a traditional form of a language, with true statements and expressions (and thus, also expression statements). In that sense, there is no concepts of tags or filters, so I simply opted for the pair `{{` and `}}` to enter a code block.

The character `~`  used with `{{~` and `~}}` allow to strip whitespace characters and `scriban` is coming with [two modes](https://github.com/lunet-io/scriban/blob/master/doc/language.md#14-whitespace-control). In the example above, this mode would strip the entire line (trim space on the left and trim space on the right up to the first newline).

I have bring also a few practical stuffs in the language that I have been looking for a lot in `liquid`:

- You can have multiple line statements/expressions without having to constantly open/close code blocks:
  ```scriban-html
  {{
      value = 0
      for product in products
        value = value + product.price
      end
  }}
  ```
- But also, in case you want to have a very compact form, you can also separate statements/expressions by using a `;`
  ```scriban-html
  {{ value = 0; for product in products; value = value + product.price; end }}
  ```

## Control flows

In `liquid`, all control flows starts by a tag name `for` and are closed by the same tag name prefixed by `end`, so have `for` and `endfor`. 

```html
<ul id='products'>
  {% for product in products ~}}
  <!-- .... -->
  {% endfor %}
</ul>
```

In `scriban`, all control flows blocks are using the block termination `end`:

- `{{ for product in products }}`...`{{ end }}`
- `{{ while myvar }}` ... `{{ end }}`
- `{{ capture }}` ... `{{ end }}`

That's probably the main difference to highlight, otherwise the syntax is very similar to `liquid`. You will find more details for a comparison of `liquid` with `scriban` in the [liquid-support documentation](https://github.com/lunet-io/scriban/blob/master/doc/liquid-support.md))

## Custom functions

One limitation I hit quite often with liquid was its inability to declare local functions directly into the language to compact very simple expressions that you want to express with a single call. 

Suppose that you would want to make a function that would downcase a text, truncate to 15 characters and upper case the first letter and use it in multiple place in your template, in scriban you could declare a function to do this:

```scriban-html
{{
func pretty_compact
 $0 | string.downcase | string.truncate 15 | string.capitalize
end
}}
```

And using it is simply working the same way other functions are working:

```scriban-html
<p>This is an excerpt of this article: {{ post.content | pretty_compact }}></p>
```

I have pushed a bit further the concept of functions by allowing to pass a **function pointers**, simply by prefixing a function by the `@` alias. This allow to compose your functions in a very powerful ways! 

There are also **anonymous function expressions** with the `do...end` keyword allowing to practically to pass an inline function pointers as a parameter of an expression:

```scriban-html
{{ 
func my_compositor
    $0 "a" "b"  # This is effectively calling a function passed as a parameter and passing "a" and "b" strings to it
end
}}

{{my_compositor do}}
    This is a string with {{$0}} and {{$1}} arguments
{{end}}
```

The above statement will print `This is a string with a and b arguments`.

Of course, recursive functions are possible, and the runtime protects scripts from running too deeply with an exception reporting where a recursive call is exceeding the defined limit.

## Local variables

That's also something very annoying in `liquid` as whenever you assign a variable with `{% assign myvar = ... %}` it is always a global variable, even if you are working inside a page from an include where you don't want to modify the caller variables

In `scriban` you have the ability to use local variable by prefixing them with `$`, like `$myvar`

Typically, in the example above for the function pretty_compact, we used the special variable `$` which when used alone gives access to the arguments of the current function (or the current include page)

## Statements as arguments

In `scriban` there is the [`wrap` statement](https://github.com/lunet-io/scriban/blob/master/doc/language.md#98-wrap-function-arg1argn--end) that allow to execute a function and pass a block of statements to this function:

```scriban-html
{{
func wrapped
	for $i in 1..<$0
		$$   # This special variable evaluates the block pass 
             # to the wrap statement
	end
end

wrap wrapped 5
	$i + " -> This is inside the wrap!\r\n"
end
}}
```

will output

```
1 -> This is inside the wrap!
2 -> This is inside the wrap!
3 -> This is inside the wrap!
4 -> This is inside the wrap!
```

As you can notice, the local variable `$i` of the function `wrapped` is  actually made accessible from the inline statements of `wrap`

## Objects and arrays

This is also something that I was missing a lot in `liquid`:

```scriban-html
{{
    this_is_an_object = { a: "test", b: an_existing_var }
    this_is_an_array = [1, 2, 3]
}}
```

## Simple expressions

In `liquid` every time you want to do something as simple as adding two numbers, you have to go through pipe calls `{% assign z = x | plus: y %}` while in `scriban` it is straightforward:

```scriban-html
{{ z = x + y }}
```

## And more...

Check the [language documentation](https://github.com/lunet-io/scriban/blob/master/doc/language.md#language) to learn more about `scriban` language syntax.

I wrote also a [Scriban syntax colorizer for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=xoofx.scriban) so that you can enjoy a bit of syntax highlighting with scriban templates.

# Engine details

The power of `scriban` is not only defined by its flexible language but also by the efficiency of its runtime for both:

- the parsing infrastructure
- the rendering part

## Parsing

In `scriban` I have used the traditional approach of developing a full hand-written lexer and parser:

- The [lexer](https://github.com/lunet-io/scriban/blob/master/src/Scriban/Parsing/Lexer.cs) is the class responsible for transforming a flow of characters into a flow of language tokens (e.g an identifier, a string, a number, a raw string, a whitespace, a newline...etc.)
- The [parser](https://github.com/lunet-io/scriban/blob/master/src/Scriban/Parsing/Parser.cs) is the class responsible for transforming this flow of language tokens into a full [Abstract Syntax Tree](https://github.com/lunet-io/scriban/tree/master/src/Scriban/Syntax) (AST) of the original script template, a runtime representation of it.

### The lexer

In order to push the performance of the templating system, GC allocations have been carefully tracked. 

Typically for the lexer, we have a zero GC allocation lexer that is only producing a series of token (which is a struct) through a custom IEnumerable iterator (also a struct) so that we are able to get a very minimal memory footprint.

A [token](https://github.com/lunet-io/scriban/blob/master/src/Scriban/Parsing/Token.cs) is simply a struct with the following information:

- Type of the token (identifier, number...etc)
- Precise starting character offset from the source document, including also precise line and column.
- Precise ending character offset from the source document, including also precise line and column.

This is fundamental to record the precise line and column, because we are able later with the Parser to produce meaningful error with an exact location where the syntax error is occurring... but also, when rendering and there is typically a runtime exception, we are also able to **indicate precisely where the runtime error occurred in the original template**, and that's a big changer if you ask me when dealing with a templating system. 

Similar to [the StringSlice of markdig](http://xoofx.com/blog/2016/06/13/implementing-a-markdown-processor-for-dotnet/#stringslice-a-lightweight-string-part) we are also using the start/end information of the Token to avoid performing substrings on the original template code. That's important, because a template is mainly compose of strings that are going to be directly copied as-is from the input to the output.

### The parser

The Parser is then responsible to decode this flow of tokens into an AST.

Though there is a particularity of the `scriban` lexer and parser: There is a **mode to parse actual liquid templates directly into a scriban AST and runtime**

But also, cherry on the top of this, there is a mode in the parser to precisely keep all symbols parsed, and to **save the AST back to code**, meaning that `scriban` not only can execute `liquid` templates, but can also translate and save back `liquid` templates to `scriban` templates, allowing to transition your existing templates to `scriban` very easily.

This mode of saving back a `scriban` AST to text can open lots of opportunities, like the ability to **modify a `scriban` template programmatically and save it back to the disk**.

This round trip mode has been tested quite extensively in scriban, so that all scriban test templates (and liquid tests) are actually parsed, run, re-saved to code, re-parsed and re-run to check that:

1. we get almost the same code than the existing template. Almost because there are very few cases where the parser is still "compacting" the information (typically when you use the whitespace controls on both start and end, like in `-}}   {{-`, it will keep only one whitespace control, because the other is not relevant... otherwise it tries to keep everything consistent and identical.
2. we get the exact same output when running the template. Obviously, this one, we want a strict correspondence and not an almost!

To my knowledge, at least in the .NET ecosystem, **`scriban` is the only text templating language and engine that allows such a scenario of modifying the AST in memory and saving it back to the disk**, in the addition to support `liquid` templates as-is and translate them to a new more powerful runtime.

## Rendering

Once the AST is in memory, we can interpret each syntax node. This is one of the easiest part of the engine, as all the information has been largely processed by the parser, so we just have to execute instructions as they are listed in each syntax node.

Each node in an AST implements the following method:

```c#
/// <summary>
/// Evaluates this instance with the specified context.
/// </summary>
/// <param name="context">The template context.</param>
public abstract object Evaluate(TemplateContext context);
```
The `TemplateContext` being the class associated to the rendering of a template (or multiple templates if we are in an indirect include).

Though, compared to Razor, a `scriban` template (similar a `liquid` template) can bring a bit more practical helpers to help you write templates. For example, typically a `for` loop provides many builtin variables accessible from the loop:

| Name                | Description
| ------------------- | -----------
| `{{for.index}}`     | The current `index` of the for loop
| `{{for.rindex}}`    | The current `index` of the for loop starting from the end of the list
| `{{for.first}}`     | A boolean indicating whether this is the first step in the loop
| `{{for.last}}`      | A boolean indicating whether this is the last step in the loop
| `{{for.even}}`      | A boolean indicating whether this is an even row in the loop
| `{{for.odd}}`       | A boolean indicating whether this is an odd row in the loop
| `{{for.changed}}`   | A boolean indicating whether a current value of this iteration changed from previous step

### Built-in functions and pre-computed delegates

The runtime comes with [**90+ builtin functions**](https://github.com/lunet-io/scriban/blob/master/doc/builtins.md#builtins) and in order to make these functions as fast as possible, I have pre-computed the delegates that are calling these functions to avoid using `System.Reflection`

In the repository, there is a program `Scriban.CodeGen` that will take the `Scriban` assembly and generates all the relevant marshalling delegates:

For example, if we have a method with a signature `static bool MyMethod(string a, string b)`, it will generate a [proper optimized delegate](https://github.com/lunet-io/scriban/blob/74867d0cd544571f88415759d211f19d953e8698/src/Scriban/Runtime/CustomFunction.Generated.cs#L124-L187) to handle this call.

By generating these delegates, we are able to provide roughly a 20% boost while rendering when using these builtin functions. Any end-user functions having similar parameters will also benefit from these, otherwise, the runtime will fallback to a more generic - and slightly slower - route for handling these calls.

### Automatic import of .NET objects

When working with .NET objects, the runtime is able to pass .NET objects almost as-is to the template, as long as it is made accessible explicitly to the `TemplateContext`.

You can still control how the .NET objects are exposed through a:

1. [`MemberRenamerDelegate`](https://github.com/lunet-io/scriban/blob/master/doc/runtime.md#member-renamer) that gives you control over the naming convention used for naming fields/properties exposed.
2. [`MemberFilterDelegate`](https://github.com/lunet-io/scriban/blob/master/doc/runtime.md#member-filter) that allows to filter members of a type being exposed

### And more...

You can check the [runtime documentation](https://github.com/lunet-io/scriban/blob/master/doc/runtime.md#runtime) to have more details about how to use the engine.

# Documentation and tests

For `scriban`, I finally took the time to write more documentation than I did in my previous OSS projects. That was frankly not the most exciting part, but I fully understand that to strengthen the adoption of a new language and runtime, you need to provide enough confidence, so that people can quickly jump into this library without too much fear.

I have provided the following core documents:

* See the [Language](https://github.com/lunet-io/scriban/blob/master/doc/language.md) document for a description of the language syntax.
* See the [Built-in functions](https://github.com/lunet-io/scriban/blob/master/doc/builtins.md) document for the list of the built-in functions.
* See the [Runtime](https://github.com/lunet-io/scriban/blob/master/doc/runtime.md) document for a description of the .NET runtime API to compile and run templates.
* See the [Liquid support](https://github.com/lunet-io/scriban/blob/master/doc/liquid-support.md) document for more details about the support of liquid templates.

Most of the tests are done through input text files (scriban templates) and expected output files. This has been quite easy to work with such a setup. Maybe the one thing I'm not super happy is the fact that I have put sometimes a bit too more tests into a single file, instead of having more finer grained tests...

Also, after implementing the tests for `markdig`, that are actually driven by markdown specifications files, If I had to redo it today, I would most likely opt for this option, as it makes your documentation and tests nicely integrated together.

There is one exception where I have used C# documentation to generate markdown documentation and tests. It is for the builtin functions:

- All C# documentation of builtin functions are written actually in XML, but with a Markdown content (frankly, I would love to do this for regular C# code as well). For example, the function `string.append` is defined like this in C#:

  ```C#
    /// <summary>
    /// Concatenates two strings
    /// </summary>
    /// <param name="text">The input string</param>
    /// <param name="with">The text to append</param>
    /// <returns>The two strings concatenated</returns>
    /// <remarks>
    /// ```scriban-html
    /// {{ "Hello" | string.append " World" }}
    /// ```
    /// ```html
    /// Hello World
    /// ```
    /// </remarks>
    public static string Append(string text, string with)
    {
        return (text ?? string.Empty) + (with ?? string.Empty);
    }
  ```
- There is a tool in the repository `Scriban.DocGen` that is extracting the markdown XML documentation. For the `string.append` function, we can generate directly the following [markdown documentation](https://github.com/lunet-io/scriban/blob/master/doc/builtins.md#stringappend).
- But also, we are able to verify that the example provided by this function is actually running and correct. So the unit tests are parsing back the generated markdown document and extracting the relevant input scriban template (above `{{ "Hello" | string.append " World" }}`) and the expected output (above `Hello World`). Using this setup, it was really easy to find any problems with the samples!

# Benchmarks

The benchmark was performed on two aspects of the libraries:

- The [**Parser Benchmark**](#parser-benchmarks): How long does it take to parse a template to a runtime representation? How much memory is used?
- The [**Rendering Benchmark**](#rendering-benchmarks): How long does it take to render a template with some input datas? How much memory is used?

Libraries used in this comparison:

- Scriban (1.0.0-beta-001), Syntax: Scriban
- [Fluid](https://github.com/sebastienros/fluid/) (Fluid.Core.1.0.0-beta-9334), Syntax: Liquid based
- [DotLiquid](https://github.com/dotliquid/dotliquid) (2.0.200), Syntax: Liquid based
- [Stubble](https://github.com/StubbleOrg/Stubble) (1.0.42-alpha17), Syntax: Mustache+ based
- [Nustache](https://github.com/jdiamond/Nustache) (1.16.0.4), Syntax: Mustache based
- [Handlebars.NET](https://github.com/rexm/Handlebars.Net) (1.9.0), Syntax: Handlebars based
- [Cottle](https://github.com/r3c/cottle) (1.4.0.4), Syntax: Cottle

I have also added [Razor](https://github.com/aspnet/Razor) (2.0.0), Syntax: Razor/C#, not in the charts but in the raw results. This is not a relevant comparison for the fact that it a not a "end-user" text templating engine (not safe) but it gives some insights about the best raw performance you can achieve with it for the rendering part, as it is generating very raw pre-compiled C# code that is basically issuing a bunch of `WriteLiteral(text_as_is)`, so you can't really do better than Razor in terms of performance.

For benchmarking, we are using the fantastic [BenchmarkDotNet](https://github.com/dotnet/BenchmarkDotNet)

See the [Scriban.Benchmark/Program.cs](https://github.com/lunet-io/scriban/blob/master/src/Scriban.Benchmarks/Program.cs) for details of the benchmark implementation.

## Parser Benchmarks

The methodology is to compile the following Scriban script:

```html
<ul id='products'>
  {{ for product in products }}
    <li>
      <h2>{{ product.name }}</h2>
           Only {{ product.price }}
           {{ product.description | string.truncate 15 }}
    </li>
  {{ end }}
</ul>
```

Or the equivalent Liquid script

```html
<ul id='products'>
  {% for product in products %}
    <li>
      <h2>{{ product.name }}</h2>
           Only {{ product.price }}
           {{ product.description | truncate: 15 }}
    </li>
  {% endfor %}
</ul>
```

Or the pseudo-equivalent Mustache script:

```html
<ul id='products'>
  {{#products}}
    <li>
      <h2>{{ name }}</h2>
           Only {{ price }}
           {{#truncate}}{{description}}{{/truncate}}
    </li>
  {{/products}}
</ul>
```

Or the pseudo-equivalent Cottle script:

```html
<ul id='products'>
  { for product in products:
    <li>
      <h2>{ product.Name }</h2>
           Only { product.Price }
           { string.truncate(product.Description, 15) }
    </li>
  }
</ul>
```

The raw results of the benchmarks are:

```
// * Summary *

BenchmarkDotNet=v0.10.9, OS=Windows 10.0.16299
Processor=Intel Core i7-7700K CPU 4.20GHz (Kaby Lake), ProcessorCount=8
  [Host]     : .NET Framework 4.7 (CLR 4.0.30319.42000), 32bit LegacyJIT-v4.7.2556.0
  DefaultJob : .NET Framework 4.7 (CLR 4.0.30319.42000), 32bit LegacyJIT-v4.7.2556.0

                Method |         Mean |       Error |       StdDev |   Gen 0 |   Gen 1 |  Gen 2 |  Allocated |
---------------------- |-------------:|------------:|-------------:|--------:|--------:|-------:|-----------:|
       'Scriban-Parser'|     12.74 us |   0.0427 us |    0.0399 us |  0.6561 |       - |      - |    2.72 KB |
     'DotLiquid-Parser'|     71.24 us |   0.2168 us |    0.2028 us |  2.1973 |       - |      - |    9.47 KB |
       'Stubble-Parser'|     12.09 us |   0.0884 us |    0.0827 us |  1.6327 |       - |      - |    6.74 KB |
      'Nustache-Parser'|     53.35 us |   0.0965 us |    0.0806 us |  4.0894 |       - |      - |   16.84 KB |
'Handlebars.NET-Parser'|  1,009.46 us |  17.2727 us |   16.1569 us | 25.3906 |  1.9531 |      - |  106.81 KB |
        'Cottle-Parser'|     13.51 us |   0.1446 us |    0.1352 us |  1.7090 |       - |      - |    7.02 KB |
         'Fluid-Parser'|     27.41 us |   0.2426 us |    0.2151 us |  3.8147 |       - |      - |   15.63 KB |
         'Razor-Parser'| 14,517.78 us | 455.0174 us |1,341.6292 us |471.2500 |269.6875 |76.2500 | 2524.49 KB |

// * Legends *
  Mean      : Arithmetic mean of all measurements
  Error     : Half of 99.9% confidence interval
  StdDev    : Standard deviation of all measurements
  Gen 0     : GC Generation 0 collects per 1k Operations
  Gen 1     : GC Generation 1 collects per 1k Operations
  Allocated : Allocated memory per single operation (managed only, inclusive, 1KB = 1024B)
  1 us      : 1 Microsecond (0.000001 sec)
```

About the results, we couldn't include Handlebars.NET in the following chart, as it is compiling to IL so it takes a lot more time to compile a template.

![BenchMark Parser Time and Memory](https://raw.githubusercontent.com/lunet-io/scriban/master/img/benchmark-parsing.png)

## Rendering Benchmarks

The methodology is to use the previously compiled script and use it with a list of 500 Products to output a final string

```
     Method |        Mean |      Error |     StdDev |     Gen 0 |   Gen 1 |   Gen 2 |   Allocated |
----------- |------------:|-----------:|-----------:|----------:|--------:|--------:|------------:|
    Scriban |  1,490.0 us |  17.650 us |  16.509 us |   62.6302 | 25.3906 | 25.3906 |   254.55 KB |
  DotLiquid |  7,707.7 us | 140.868 us | 131.768 us |  703.1250 | 54.6875 | 15.6250 |  2923.88 KB |
    Stubble |  3,273.2 us |  60.054 us |  56.174 us |  613.2813 | 58.5938 | 19.5313 |  2538.35 KB |
   Nustache | 21,855.4 us | 427.661 us | 457.592 us | 3750.0000 |       - |       - | 15460.25 KB |
 Handlebars |  3,391.3 us |  66.125 us |  78.718 us |  187.5000 | 41.9271 | 19.5313 |   782.18 KB |
     Cottle |  2,162.3 us |  22.151 us |  20.720 us |  175.0488 | 98.1445 | 22.9492 |   890.75 KB |
      Fluid |  1,794.1 us |  30.251 us |  28.297 us |  314.5559 | 66.8174 | 25.3906 |  1287.47 KB |
      Razor |    326.1 us |   3.023 us |   2.680 us |   64.4531 | 34.1146 | 22.4609 |   264.66 KB |
 ```

Note that for Stubble, It was not possible to match the behavior of the other engines, so it is including the parsing time (which is anyway insignificant compare to the rendering time in this particular case)

![BenchMark Rendering Time and Memory](https://raw.githubusercontent.com/lunet-io/scriban/master/img/benchmark-rendering.png)

## Overall results

For the parser part:

- **Scriban parser is 3x to 6x times** faster compared to liquid based templating parsers
- **Scriban parser takes 3x to 40x times less memory** compared to other templating parsers

If you look at Razor (which is again, not really fair), `scriban` is roughly 1000x times faster than Razor for parsing a template. Which is perfectly normal, as Razor is involving the full Roslyn/C# compiler here. It is taking a lot more memory...etc (and not counting here the JIT time required by Razor) but it is generating an ultra efficient renderer.

For the rendering part:

- **Scriban is 1.2x to x14 times faster** than other templating engines
- **Scriban takes 3x to x65 times less memory** compared to other templating engines

In comparison to Razor, `scriban` is only 4-5 times slower than Razor, which is fairly honorable, considering how much raw is a compiled Razor template.

# Final words

I was not actually expecting to [write this post soon](https://twitter.com/xoofx/status/903616672002711552), but the fact that I started `scriban` almost 2 years ago, without giving it the final touch that it deserved, I felt guilty - and hold back - to let this project in an unbalanced state. So I'm glad that I have come to a polished milestone and be able to move on!

Overall, the project was really fun to code, both in terms of designing the language and providing a lightweight interpreter for it.

I don't know if I will ever have the time and courage to further prototype `lunet`, but I will be glad if `scriban` can contribute to your project. So, if you are looking for a liquid compatible engine, give it a try. If you are looking also to use a more shiny language, give it a try too!

I'm going to keep the 1.0.0-beta-xxx for a few weeks, before stamping it to a final 1.0.0, so if you have any issues using this library, let me know directly on the [scriban](https://github.com/lunet-io/scriban) GitHub issues.

Happy Coding!
{% endraw %}