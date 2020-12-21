---
title: Implementing a Markdown Engine for .NET
tags:
 - C#
 - Markdown
 - Markdig
 - .Net
comments: true
---

<img align="right" width="160px" height="160px" src="https://raw.githubusercontent.com/xoofx/markdig/master/img/markdig.png">

> **Update 16 June 2016**: Added a [Benchmarks](#benchmarks) section


Earlier this year, for two intensive months, I have spent all my spare time implementing [Markdig](https://github.com/xoofx/markdig), a new Markdown processor for .NET. In this post, I will report back about the quirks and pitfalls I have found while coding this as well as the performance and design considerations I had to balance with.

The post is organized like this:

- A [Why?](#why) introduction where I explain why the need for a new .NET Markdown parser
- The challenges of Markdown and the [CommonMark specs](#the-commonmark-specs)
- The challenges of developing [an efficient extension system](#implementing-an-efficient-extension-system)
- [Performance is in the details](#performance-is-in-the-details), where I visit the noticeable C# tricks and code I had to use to achieve good performance

# Why?

First, you may wonder why another Markdown processor for .NET? The simplicity of Markdown is so delightful (I don't see any competitors as simple and readable as Markdown) and since 2011, I have seen it growing steadily, started from github and recently getting even more traction (by Microsoft documentation, language workbooks - for R, for C# by Xamarin - or with Rust/Swift language code comments...etc.), a format becoming as important as HTML, here to stay for a long, long time. And finally a format for which I have plenty of ideas to use it in some upcoming projects... (hence the reason of my direct personal interest! ;)

So for such an important format, we need a rock solid library for .NET! 
 
And there is actually not so many packages for .NET (compare to in Ruby, or Php, or JavaScript). But I was also specifically looking for an implementation that was:

- Super fast (no regex) and GC friendly 
- [CommonMark](http://commonmark.org/) compliant
- Providing an extensible plugin architecture, including to be able to change the behaviour of the core parser 
- Builtin with many extensions (like pipe tables...etc.)
- Supporting .NET Core (though this one is easy to add to any existing library)

I evaluated the following existing libraries:

- [MarkdownSharp](https://blog.stackoverflow.com/2009/12/introducing-markdownsharp/) and a fork on [github](https://github.com/hey-red/markdownsharp): Used (or at least developed) by StackOverflow, port mainly based on the original PERL implementation, Regex based, no much extensions.
- [Marked.NET](https://github.com/T-Alex/MarkedNet), port of [Marked](https://github.com/chjj/marked) from JavaScript, Regex based, few extensions.
- [MarkdownDeep](https://github.com/toptensoftware/markdowndeep): Full parser, code repo is a bit rough though, some extensions.
- [CommonMark.NET](https://github.com/Knagis/CommonMark.NET): Full parser, port of [cmark](https://github.com/jgm/cmark), no extensions (on master)

Among the existing .NET library, two of them were out of the crowd: MarkdownDeep and CommonMark.NET, but they were still lacking what I was looking for:

<div class="table-responsive">
  <table class="table" style="font-size: 1.4rem">
      <tr>
         <th>Features       </th>
         <th> Markdig (<strong>New!</strong>) </th>
         <th> CommonMark.NET  </th>
         <th> MarkdownSharp </th> 
         <th> MarkdownDeep  </th>
         <th> Marked.NET    </th>
      </tr>
      <tr>
         <td>Based       </td>
         <td> <strong>new</strong></td>
         <td> Port of cmark (master<sup>1</sup>)</td>
         <td> Perl </td>
         <td> new </td>
         <td> JS </td>
      </tr>
      <tr>
         <td>Tech based  </td>
         <td> <strong>Full Parser</strong></td>
         <td> Full Parser    </td>
         <td> Regex         </td>
         <td> Full Parser  </td>
         <td> Regex        </td>
      </tr>
      <tr>
         <td>CPU Friendly</td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i></td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i> </td>
         <td> <i class="fa fa-star"></i> </td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i> </td>
         <td> <i class="fa fa-star"></i> </td>
      </tr>
      <tr>
         <td>GC Friendly </td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i> </td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i></td>
         <td> <i class="fa fa-star"></i> </td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i> </td>
         <td> <i class="fa fa-star"></i> </td>
      </tr>
      <tr>
         <td>Extensions </td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><br><strong>20+</td> extensions</strong></td>
         <td> no (master<sup>1</sup>)</td>
         <td> no </td>
         <td> <i class="fa fa-star"></i><i class="fa fa-star"></i> </td>
         <td> <i class="fa fa-star"></i> </td>
      </tr>
      <tr>
         <td>Plugin Architecture </td>
         <td> <strong>yes</strong></td>
         <td> no (master<sup>1</sup>)</td>
         <td> no   </td>
         <td> no    </td>
         <td> no </td>
      </tr>
      <tr>
         <td>Remove/Change builtin features     </td>
         <td> <strong>yes</strong></td>
         <td> no </td>
         <td> no   </td>
         <td> no    </td>
         <td> no </td>
      </tr>
  </table>
</div>

<sup>1</sup>: For CommonMark.NET, there is a full rewrite of the parser in a [pipe_tables](https://github.com/AMDL/CommonMark.NET/tree/pipe-tables) branch, not yet official, not finished? I also took the time to evaluate a bit more this one, but I was not really convinced by some design decisions (e.g: [using only composition over a simple inheritance scheme for the syntax tree](https://github.com/Knagis/CommonMark.NET/issues/78)) and a plugin architecture that was not enough versatile for what I was looking for... Still, overall, CommonMark.NET is a pretty solid library, perf and code quality wise. To boostrap the development, I have re-used some of their decoding primitives for Markdig (e.g [HTML Entity decoding](https://github.com/xoofx/markdig/blob/master/src/Markdig/Helpers/EntityHelper.cs))

So I started to challenge if I could write a full CommonMark compliant parser with all the features and dreams I had in mind...

# The CommonMark specs

Luckily, the [CommonMark specs](http://spec.commonmark.org/) done by [John Mac Farlane](http://johnmacfarlane.net/) are **amazing** and frankly, without them, I wouldn't have even started this colossal work, because if the code was laborious and sometimes tricky, the specs are much more involving...

So what is exactly difficult with parsing Markdown? The first thing you will notice is that Markdown doesn't give you any syntax errors. Everything you type is somewhat valid (not what you may want to do, but it is still valid). If you are used to write parsers (or you remember your compiler class!), you won't find a [formal grammar for Markdown](http://roopc.net/posts/2014/markdown-cfg/) and the reason is that some constructs can be ambiguous. Emphasis handling in Markdown is one example. But even with the CommonMark specs, while developing it, I came across some cases where it was still not clear: 

Typically a link followed by a setText heading:

```md
[foo]: 
  /url
  "title"
Test
====

[foo]
```

You can have a look at the differences of this [example on babelmark3](https://babelmark.github.io/?text=%5Bfoo%5D%3A+%0A++%2Furl%0A++%22title%22%0ATest%0A%3D%3D%3D%3D%0A%0A%5Bfoo%5D) (A service I released recently, check-it out!). Obviously, it is not well handled. It is not surprising then that there is even a CommonMark compliant processor that is giving a different result...

While coding this specific case, I had for example to plug the handling of link definitions and setText heading into the ParagraphBlock parser:

- Link definitions when closing the parsing of a paragraph block (See [here](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Parsers/ParagraphBlockParser.cs#L46))
- setText heading when continuing parsing a paragraph block (See [here](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Parsers/ParagraphBlockParser.cs#L36))

The good thing is the CommonMark specs still come with an [appendix "a parsing strategy"](http://spec.commonmark.org/0.25/#appendix-a-parsing-strategy) that helped a lot (even though I didn't follow exactly the recommended approach for handling emphasis, which is the trickiest part)

Basically the parsing is done in two steps:

- **block parsing** time: It identifies the paragraph, block quotes, headings, fenced code blocks...etc.
- **inline parsing** time: It identifies syntax inside a block like emphasis, links...etc.

Things like spaces, tabs, blank lines have their importance in Markdown. You cannot ignore them and put them aside.

There are also some lazy continuation rules. For example, a paragraph can continue on a following line and will be considered as part of the previous line (so in our case, as part of the block quote that is still pending)

[Example on babelmark3:](https://babelmark.github.io/?text=%3E+This+is+a+paragraph%0Athat+continues+on+a+second+line%0A)

```md
> This is a paragraph
that continues on a second line
```

This kind of rules make it nearly impossible in a formal grammar, even with an infinite look-ahead parser.

So, needless to say, this was laborious to go through all the CommonMark specs examples (more than 600+) and get all them working properly. On my way to the 100% complete, I was of course striken all around by regressions, when finishing one feature and realizing that I have broken something I did the previous day! But wow, this is where I realized more than in any previous projects that **tests are pure gold for a project, more important than the code itself**.

In the end, it took me around two weeks (working early in the morning and in the evening) to build the core parsing part of CommonMark. But the fact is that implementing the core specs is not enough, you obviously want to have all the useful extensions (like pipe tables), automatic identifiers...etc. And this part brought in its own other challenges... and I spent the rest of the 1.5 months coding all the extensions, polishing the code and the performance, and that was not an easy part as well...

# Implementing an efficient extension system

There are currently no real specifications for extensions in CommonMark, as they are waiting for the core part to be stabilized before proceeding further. So I had to leverage on many useful discussions on the [CommonMark forum](https://talk.commonmark.org/)

The first one I tried was pipe tables: for this, I relied on the behaviour of some of the best implems out there ([PHP Markdown Extra](https://michelf.ca/projects/php-markdown/extra/) by Michel Fortin or [Pandoc](http://pandoc.org/) my John Mac Farlane) to integrate the behaviour in Markdig. But it turned out that I had to [relax the parsing strategy](https://talk.commonmark.org/t/parsing-strategy-for-tables/2027/1) above (two steps, blocks first, then inlines) in order to handle them correctly. 

Typically the following should be a table ([example on babelmark3](https://babelmark.github.io/?text=%60Column1+%7C%60+%7C+Column2%0A-----------+%7C+-------%0A0+++++++++++%7C+1)):

```
`Column1 |` | Column2
----------- | -------
0           | 1
```

But this should not ([example on babelmark3](https://babelmark.github.io/?text=%60Column1+%7C%60+Column2%0A0+++++++%60%7C%60+1%0A)):

```
`Column1 |` Column2
0       `|` 1
```

While performance has been on the radar quite early while developing Markdig, implementing the 20+ extensions has put lots of pressure on the design of Markdig. And they were both sometimes fighting against each other. Because I wanted Markdig to be fully customizable (at some degree of course), I had to insert many pluggable entry points in the API to make it possible. Doing so, I had to face many optimization and/or design challenges.

Typically on the design part, when I added support for [grid tables](http://pandoc.org/README.html#extension-grid_tables) ([example on babelmark3](https://babelmark.github.io/?text=%3A+Sample+grid+table.%0A%0A%2B---------------%2B---------------%2B--------------------%2B%0A%7C+Fruit+++++++++%7C+Price+++++++++%7C+Advantages+++++++++%7C%0A%2B%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%2B%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%2B%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%3D%2B%0A%7C+Bananas+++++++%7C+%241.34+++++++++%7C+-+built-in+wrapper+%7C%0A%7C+++++++++++++++%7C+++++++++++++++%7C+-+bright+color+++++%7C%0A%2B---------------%2B---------------%2B--------------------%2B%0A%7C+Oranges+++++++%7C+%242.10+++++++++%7C+-+cures+scurvy+++++%7C%0A%7C+++++++++++++++%7C+++++++++++++++%7C+-+tasty++++++++++++%7C%0A%2B---------------%2B---------------%2B--------------------%2B)) it required the parser to support nested block parsing: A cell in a table is considered as a sub "Document" part (with its own lines), so the parser had to be able to spawn itself in a mode where it could handle such cases.

For the performance part, Markdown is challenging because you need to handle efficiently character sequences, and unlike a conventional Markdown parser that use a standard switch case for handling cases, you cannot do that with a pluggable architecture. Every "token" characters can be pluggable, and they may affect multiple parts in the pipeline.

So instead of having something like this (as seen in [cmark](https://github.com/jgm/cmark/blob/25429c96f6554ffac415f9d865934b1183f3398e/src/inlines.c#L976)):

```cpp
switch (c)
{
  case '\r':
  case '\n':
    new_inl = handle_newline(subj);
    break;
  case '`':
    new_inl = handle_backticks(subj);
    break;
  case '\\':
    new_inl = handle_backslash(subj);
    break;
  case '&':
    new_inl = handle_entity(subj);
    break;
[...]
```

you need to handle *each incoming character* like [this](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Parsers/InlineProcessor.cs#L115
):

```csharp
var parsers = Parsers.GetParsersForOpeningCharacter(c);
if (parsers != null)
{
    for (int i = 0; i < parsers.Length; i++)
    {
        text = textSaved;
        if (parsers[i].Match(this, ref text))
        {
            goto done;
        }
    }
}
parsers = Parsers.GlobalParsers;
if (parsers != null)
{
    for (int i = 0; i < parsers.Length; i++)
    {
        text = textSaved;
        if (parsers[i].Match(this, ref text))
        {
            goto done;
        }
    }
}
```

Each block and inline parsers in Markdig defines a set of **OpeningCharacters**. Here for [example for a BlockQuote](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Parsers/QuoteBlockParser.cs#L20), it is simply define as `OpeningCharacters = new[] {'>'};` but for handling regular emphasis (like `**...**`) and all additional emphasis (strikeout, del, insert...etc.), you need to [dynamically adapt the list of Opening Characters](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Parsers/Inlines/EmphasisInlineParser.cs#L51) based on what is registered.

Things gets worse handling inlines inside a paragraph block. For instance, if you look at the beginning of this phrase, there is no characters that could be interpreted as inline elements (e.g a pair of `*` for an emphasis), so when you want to efficiently handle this line, you want to eat characters with a bulk method. You don't want to go through the `Parsers.GetParsersForOpeningCharacter(c);` and subsequent loop to handle each single character. So in that case, the InlineParser, which is responsible of processing a sequence of literal text (that don't have any other meaning for inlines), has to be optimized.

Example of [InlineParser.cs](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Parsers/Inlines/LiteralInlineParser.cs#L37) with bulk parsing:

```csharp
var nextStart = processor.Parsers.IndexOfOpeningCharacter(text, slice.Start + 1, slice.End);
```

Here, we try to find in the coming characters any characters that *could be* an opening characters of another inline construct. Behind the scene, this method is optimized only to iterate quickly on the string and doing nothing else than checking if the character is an opening character.

Because any new extension may come with a new character that may be interpreted differently, you need to have a **pluggability at the character level**. One reason why you cannot really express such an efficient pluggable Markdown parser with just a set of regexp or a *fixed* switch matching pipeline.

An example of such constraint is when I have added support for additional ordered list with starting letters (supporting `a)` `b)` `c)` and `i)` `ii)` `iii)`), you need to quickly identify if we are in front of a list starting `a)` or `a paragraph starting by the letter b, or c or a-z!`. Without an efficient lookup method, this single extension would have killed the performance of Markdig (though this has still a non negligible impact even with proper optims)  

Also I wanted to be able to change the behaviour of the core parsing of CommonMark (or disable some parts, like HTML parsing). You may need (?) for instance to test a different type of heading starting by a `@` instead of `#`... This requirement forced to consider the core CommonMark parsers as plugins as well.

At the beginning, without the extensions, with still a relatively pluggable architecture, Markdig was as fast as CommonMark.NET(master), which is only 15% slower than the C implementation. But once I finished building the **20+ extensions** (while often checking the performance regressions carefully), I had to admit that I couldn't achieve the same amount of performance with a more pluggable architecture. 

That was the price to pay. Though, three remarks I would like to emphasis (even if they are obvious, it is not bad to recall them, starting for myself!):

- The first is that **pluggability has usually a negative impact on the performance** no matter how hard you try to mitigate this
- The second is: **don't expect a plugin system to be universal**, there is no such thing! The Unknown cannot be known in advance... Someone may come one day with a new plugin requirement that could shake the foundation of your library (no less!)
- Lastly, make your **plugin system simple!** Otherwise nobody will want (or know how) to develop a plugin. If it is laborious to develop or too much convoluted, burden under tons of interfaces, abstractions, layered compositions, indirections, you will have a beautiful plugin system but nobody on earth will tell you this! Though, I will still have to challenge this for Markdig once I have written the documentation for it... ;)

The good thing is that I was able to put Markdig performance as efficient in terms of GC pressure, and among the best for CPU, but this required many little tricks and discipline in the code to achieve such a goal...

# Performance is in the details

Very early in the development, I have measured regularly the performance of the parser, both in terms of GC and CPU time. I have been quite pleased at some point to switch to the amazing [BenchMarkDotNet](https://github.com/PerfDotNet/BenchmarkDotNet) which helped to quickly setup many small tests for the various performance cases I wanted to improve. In the meantime, they have added support for GC events, which is a **must** to measure (and better explain) the performance advantage of a method over another (Though there is a [pending issue](https://github.com/PerfDotNet/BenchmarkDotNet/issues/133) to make it fully reliable in BenchMarkDotNet).

Since then I have been using systematically BenchMarkDotNet for various bench tests and It is of great help, as being able to easily setup a benchmark in seconds help to actually not being too lazy with performance!

First, there are some general hints that you are most likely already aware of:

- Don't use Linq in any critical part of a your code paths, at it allocates memory (for both the lambda instance and the cast to IEnumerable)
- Prefer using `List<T>` or `Dictionary<TKey, TValue>` instead of using `IList<T>`, for the same reason for the `IEnumerable`, as you would force the boxing of the `IEnumerable` which are usually implemented as structs and exposed via duck typing on concrete types.

Most of the techniques used here are to lower GC pressure, improve locality and help to reduce CPU footprint.

## 1) StringSlice, a lightweight string part

In the case of Markdown, a large part of a document is composed of small strings that will end-up written directly to the output when converting to HTML. In this case, and this is also often true for text templating system, you don't want to perform any `substrings` on the original full Markdown document. You just want to work with slices/views of it without the burden of allocating additional objects.

Hence, in Markdig, there is a [`StringSlice`](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Helpers/StringSlice.cs) type for handling such a case.

It has basically 3 fields:

- the original string (the full Markdown text)
- a start position within a string
- an end position within a string (or the length)

Note that I declared also this type as a **struct**, as It is critical to avoid allocating slices on the heap, otherwise it would have been basically be the same as performing `substrings`.

So for instance, if you load the full Markdown document to process into a single string, and work with `StringSlice` on this string, it will generate around 30% less allocations rather then reading the source document with a TextReader line by line (allocating a string for each line).

For this case, I wanted to use a dedicated optimized slice for strings (with useful attached method that cannot be put as extension methods, as we don't have yet implicit ref for them!). Otherwise, I can suggest also [Slice.net](https://github.com/joeduffy/slice.net) by Joe Duffy for a generic version of it.

## 2) Use custom struct List\<T\>

Any time I had to use a `List<T>` as an internal object state to store a variable array of items, I have replaced it with a version handling directly the array.

For instance, the StringSlice can be organized in a [`StringSliceGroup`](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Helpers/StringLineGroup.cs), this type is again a struct. We save the cost of the `List<T>` object which is a wrapper around `T[]`

## 3) Object pooling

Pooling is one regular technique to reduce GC pressure. Specially with `StringBuilder` which allocates chunks of memory behind the scene!

In Markdig there is a generic [`ObjectCache<T>`](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Helpers/ObjectCache.cs) along a specialized [`StringBuilderCache`](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Helpers/StringBuilderCache.cs)

A notable addition to the `StringBuilderCache` is a Thread Static Local (TLS) for accessing a local [`StringBuilder`](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Helpers/StringBuilderCache.cs#L15) from *almost* anywhere inside a method. Instead of having to pass around an `ObjectCache` to each method signature, I could use just `StringBuilderCache.Local()` whenever I needed, without also having to release it. Note that such a class you need to make sure that there is no nested usage of it in a nested method call stack.

```csharp
public class StringBuilderCache : DefaultObjectCache<StringBuilder>
{
    /// <summary>
    /// A StringBuilder that can be used locally in a method body only.
    /// </summary>
    [ThreadStatic]
    private static StringBuilder local;

    /// <summary>
    /// Provides a string builder that can only be used locally in a method. This StringBuilder MUST not be stored.
    /// </summary>
    /// <returns></returns>
    public static StringBuilder Local()
    {
        var sb = local ?? (local = new StringBuilder());
        if (sb.Length > 0)
        {
            sb.Length = 0;
        }
        return sb;
    }
```

## 4) Gentle StringBuilder allocations on changes only

It is quite common that you need to substitute from a string some elements (which requires more than a Replace parsing method) and return a new string. Most of the time, a naive implementation is to create a new `StringBuilder` and start to process the original string. In the end, if nothing was really changed, we have still allocated two objects for nothing! (The `StringBuilder` and its `StringBuilder.ToString()`), and if this could be the most common case, that would hurt the perf!

## 5) string.IndexOf() and string.IndexOfAny()

If there is a need to scan for a particular character in a string and process things afterwards from this position, you may think that a custom `string.IndexOf` would be better, but it is actually implemented in the CoreCLR as almost an intrinsic, much faster than whatever you could come with a managed and unsafe equivalent, so trust `IndexOf`, it is fast!

On the other hand, if you need to check for many characters, the `string.IndexOfAny` is not that fast, and for matching opening characters in Markdig, I had to write a dedicated version, assuming that you know in advance the characters to match and can build pre-computation tables for them.

The class [`CharacterMap<T>`](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Helpers/CharacterMap.cs) was extensively used in Markdig to pre-compute maps between a `char` and an associated data instance. First used as a pluggable replacement for `switch/case`, but also for `IndexOfAny`, the following method [`IndexOfOpeningCharacter`](https://github.com/xoofx/markdig/blob/58f797533180357518dbb8a101235545474de237/src/Markdig/Helpers/CharacterMap.cs#L118) was then used as a faster replacement:

```csharp
public unsafe int IndexOfOpeningCharacter(string text, int start, int end)
{
    var maxChar = isOpeningCharacter.Length;
#if SUPPORT_FIXED_STRING
    fixed (char* pText = text)
#else
    var pText = text;
#endif
    fixed (bool* openingChars = isOpeningCharacter)
    {
        if (nonAsciiMap == null)
        {
            for (int i = start; i <= end; i++)
            {
                var c = pText[i];
                if (c < maxChar && openingChars[c])
                {
                    return i;
                }
            }
        }
        else
        {
            for (int i = start; i <= end; i++)
            {
                var c = pText[i];
                if ((c < maxChar && openingChars[c]) || nonAsciiMap.ContainsKey(c))
                {
                    return i;
                }
            }
        }
    }
    return -1;
}
```

## 5) TextReader.ReadLine() fast but...

I started the implementation by using `TextReader.ReadLine()` when reading the input Markdown document. The great thing about the implementations of this method is that they are usually enough fast.

The [`StreamReader.ReadLine`](https://github.com/dotnet/coreclr/blob/6cd92b2da7b3aac86598e7b8d7b6fad063239b6b/src/mscorlib/src/System/IO/StreamReader.cs#L728)  for example is well optimized, using internally a pool of `StringBuilder`

The [`StringReader.ReadLine`](https://github.com/dotnet/coreclr/blob/6cd92b2da7b3aac86598e7b8d7b6fad063239b6b/src/mscorlib/src/System/IO/StringReader.cs#L116) is also performing only a fast scan of newline character and `substring` on the original string.

My only grip with these methods is that you are loosing the critical information of the new line character (was it a `\r` or `\r\n` or `\n`?), hence loosing the offset in the stream if you want to provide an accurate position within the original stream.

Markdig is no longer using these methods but instead is loading the full Markdown document into a string and is working with `StringSlice`, as I realized that it was more efficient to load the document once into a string instead of loading each line in a new string. This method provides also a much better handling of precise source code position (e.g for syntax highlighting).

Also one thing that was a bit frustrating when trying to squeeze out some performance from string handling was the internal accessibility of the [`FastAllocateString`](https://github.com/dotnet/coreclr/blob/6cd92b2da7b3aac86598e7b8d7b6fad063239b6b/src/mscorlib/src/System/String.cs#L1554) which allows to allocate a string on the heap without zeroing it, very useful, used in [many places in the .NET framework](https://github.com/dotnet/coreclr/search?utf8=%E2%9C%93&q=FastAllocateString) but inaccessible for us, unfortunately... :(

## 6) List\<T\> or T[] instead of Dictionary\<string, T\>

This is also not something new, but for small Dictionary (last time I checked, I guess it was for less than 10 elements, may be around 7-8), an array gives actually a faster access and also is much cheaper in terms of memory. This is used in Markdig to store attached [HtmlAttributes](https://github.com/xoofx/markdig/blob/c80ac89e9645e5b4da55d1fe85957fe3afcb3b3a/src/Markdig/Renderers/Html/HtmlAttributes.cs) to each syntax tree and it helped to save a few mega bytes when you have hundred of thousands of instances all around when parsing large documents!

On average, even if you replace internally a `Dictionary<XXX,TTT>` by a `List<T>` (assuming that T contains an access to the key), you will see **4x to 5x times better performance** (just for the allocating/feeding part, access perf also better when number of elements are < 10). See this [gist](https://gist.github.com/xoofx/c517e0c1770d9bdf1d3fa0dea832935b) for more details.

# Benchmarks

This is an early preview of the benchmarking against various implementations:

**C implementations**:

- [cmark](https://github.com/jgm/cmark) (version: 0.25.0): Reference C implementation of CommonMark, no support for extensions
- [Moonshine](https://github.com/brandonc/moonshine) (version: : popular C Markdown processor

**.NET implementations**:

- [Markdig](https://github.com/xoofx/markdig) (version: 0.5.x): itself
- [CommonMark.NET(master)](https://github.com/Knagis/CommonMark.NET) (version: 0.11.0): CommonMark implementation for .NET, no support for extensions, port of cmark
  - [CommonMark.NET(pipe_tables)](https://github.com/AMDL/CommonMark.NET/tree/pipe-tables): An evolution of CommonMark.NET, supports extensions, not released yet
- [MarkdownDeep](https://github.com/toptensoftware/markdowndeep) (version: 1.5.0): another .NET implementation
- [MarkdownSharp](https://github.com/Kiri-rin/markdownsharp) (version: 1.13.0): Open source C# implementation of Markdown processor, as featured on Stack Overflow, regexp based.
- [Marked.NET](https://github.com/T-Alex/MarkedNet) (version: 1.0.5) port of original [marked.js](https://github.com/chjj/marked) project
- [Microsoft.DocAsCode.MarkdownLite](https://github.com/dotnet/docfx/tree/dev/src/Microsoft.DocAsCode.MarkdownLite) (version: 2.0.1) used by the [docfx](https://github.com/dotnet/docfx) project

**JavaScript/V8 implementations**:

- [Strike.V8](https://github.com/SimonCropp/Strike) (version: 1.5.0)  [marked.js](https://github.com/chjj/marked) running in Google V8 (not .NET based)

### Analysis of the results:

- Markdig is roughly **x100 times faster than MarkdownSharp**, **30x times faster than docfx**
- **Among the best in CPU**, Extremelly competitive and often faster than other implementations (not feature wise equivalent) 
- **15% to 30% less allocations** and GC pressure

Because Marked.NET,  MarkdownSharp and DocAsCode.MarkdownLite are way too slow, they are not included in the following charts:

![BenchMark CPU Time](https://raw.githubusercontent.com/xoofx/markdig/master/img/BenchmarkCPU.png)

![BenchMark Memory](https://raw.githubusercontent.com/xoofx/markdig/master/img/BenchmarkMemory.png)


### Performance for x86:

```
BenchmarkDotNet-Dev=v0.9.7.0+
OS=Microsoft Windows NT 6.2.9200.0
Processor=Intel(R) Core(TM) i7-4770 CPU 3.40GHz, ProcessorCount=8
Frequency=3319351 ticks, Resolution=301.2637 ns, Timer=TSC
HostCLR=MS.NET 4.0.30319.42000, Arch=32-bit RELEASE
JitModules=clrjit-v4.6.1080.0

Type=Program  Mode=SingleRun  LaunchCount=2
WarmupCount=2  TargetCount=10

                     Method |      Median |    StdDev |Scaled |  Gen 0 | Gen 1|    Gen 2|Bytes Allocated/Op |
--------------------------- |------------ |---------- |------ | ------ |------|---------|------------------ |
                    Markdig |   5.5316 ms | 0.0372 ms |  0.71 |   56.00| 21.00|    49.00|      1,285,917.31 |
     CommonMark.NET(master) |   4.7035 ms | 0.0422 ms |  0.60 |  113.00|  7.00|    49.00|      1,502,404.60 |
CommonMark.NET(pipe_tables) |   5.6164 ms | 0.0298 ms |  0.72 |  111.00| 56.00|    49.00|      1,863,128.13 |
               MarkdownDeep |   7.8193 ms | 0.0334 ms |  1.00 |  120.00| 56.00|    49.00|      1,884,854.85 |
                      cmark |   4.2698 ms | 0.1526 ms |  0.55 |       -|     -|        -|                NA |
                  Moonshine |   6.0929 ms | 0.1053 ms |  1.28 |       -|     -|        -|                NA |
                  Strike.V8 |  10.5895 ms | 0.0492 ms |  1.35 |       -|     -|        -|                NA |
                 Marked.NET | 207.3169 ms | 5.2628 ms | 26.51 |    0.00|  0.00|     0.00|    303,125,228.65 |
              MarkdownSharp | 675.0185 ms | 2.8447 ms | 86.32 |   40.00| 27.00|    41.00|      2,413,394.17 |
Microsoft DocfxMarkdownLite | 166.3357 ms | 0.4529 ms | 21.27 |4,452.00|948.00|11,167.00|    180,218,359.60 |
```

### Performance for x64:

```
BenchmarkDotNet-Dev=v0.9.6.0+
OS=Microsoft Windows NT 6.2.9200.0
Processor=Intel(R) Core(TM) i7-4770 CPU @ 3.40GHz, ProcessorCount=8
Frequency=3319351 ticks, Resolution=301.2637 ns, Timer=TSC
HostCLR=MS.NET 4.0.30319.42000, Arch=64-bit RELEASE [RyuJIT]
JitModules=clrjit-v4.6.1080.0

Type=Program  Mode=SingleRun  LaunchCount=2
WarmupCount=2  TargetCount=10

               Method |    Median |    StdDev |  Gen 0 |  Gen 1 | Gen 2 | Bytes Allocated/Op |
--------------------- |---------- |---------- |------- |------- |------ |------------------- |
          TestMarkdig | 5.5276 ms | 0.0402 ms | 109.00 |  96.00 | 84.00 |       1,537,027.66 |
    TestCommonMarkNet | 4.4661 ms | 0.1190 ms | 157.00 |  96.00 | 84.00 |       1,747,432.06 |
 TestCommonMarkNetNew | 5.3151 ms | 0.0815 ms | 229.00 | 168.00 | 84.00 |       2,323,922.97 |
     TestMarkdownDeep | 7.4076 ms | 0.0617 ms | 318.00 | 186.00 | 84.00 |       2,576,728.69 |
```



# Final words

Though this has been quite laborious to develop, I have enjoyed quite a lot developing Markdig. It was so exciting to see the number of tests passing increasing days after days of hard labour.

And with all the effort and love I have put in this library, Markdig is most likely the best Markdown engine in town for .NET, and probably one of the best around language apart, both feature and performance wise (doh, no less?!), so spread the words folks! :D

I hope it will open opportunities in your projects as I hope it will do for my own... Happy coding!