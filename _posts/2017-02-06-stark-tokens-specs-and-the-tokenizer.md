---
layout: post
title: Stark - Tokens specification and Tokenizer implementation
tags:
 - Stark
 - C#
comments: true
---

In my previous post [Language Design Part I - The Tokens](/blog/2017/01/20/stark-language-design-part-1-the-tokens/), I discussed about the kind of tokens, but also how would look primitive types and some thoughts on prefix vs postfix type annotation for the [Stark Language Experiment](/blog/2017/01/17/the-stark-programming-language-experiment/)

In this post, we are going to go through the implementation of the language tokenizer, which is the first, most basic and simplest part of a compiler pipeline, yet fundamental. I couldn't resist also to include some benchmarks between a handwritten tokenizer and the equivalent ANTLR generated lexer, so that this post will not just look plain theoretical.

It might sounds like putting the cart before the horse, as in order to specify tokens, we need usually to know somehow the grammar of the language. While I have been already starting to sketch some grammar syntaxes, I would like also to implement as much as I can upfront for this experiment and so, let the tokens and the tokenizer as generic as possible, without any strong semantic reference to the grammar. Instead, we will stick to some basic token concepts that we described previously:

- comments
- identifier
- numbers
- characters
- strings
- symbols

I will most likely have to tweak the tokenizer once we will get into the details of the syntax, but changing the tokenizer afterwards should not affect its fundamentals.

Oh, I forgot, why tokens? (if you are not familiar with language parsers): this is a first step in a compiler pipeline to extract basic group of chars. It is a higher level of chars and simplifies later the process of matching higher level grammar syntax. Basically you get this flow:

```
Character sequences -> Token sequences -> Abstract Syntax Tree
```

Though this is only the "climbing" part of a compiler. In the end, we ultimately transform all of this to a sequence of bytes in pure assembler code and data:

```
Abstract Syntax Tree -> Intermediate Representation bytecode -> bytes (data and machine assembly instructions)
```

But that will be for a much later post! Today, let's just start by defining more formally the tokens. We will then dive into how the tokenizer was developed in `C#`.

# The Tokens Specification

This part describes the tokens used for parsing the Stark Programming Language. I have included this document in the repo as [specs/tokens.md](https://github.com/stark-lang/stark/blob/9c89dbbf2e611c53e6b26069192be49ba2424c47/specs/tokens.md) though in this post I have added some comments that would not fit well a "pure" spec (note also that this URL is fixed so that if the location of the document change, it won't be lost, but don't take it necessarily as the latest one!)

The syntax used to define the tokens is [ANTLR 4](http://www.antlr.org/). This is pretty convenient to use ANTLR 4 because we can get a generated lexer from the specs and it provides a solid basis to formalize the syntax. If you are not familiar with ANTLR 4 syntax, a very short introduction:

- a parsing rule XXX is defined like this `XXX:  <parsingRule>;`
- the parsing rule is very similar to a regex matching pattern:
  - an element of a parsing rule can be either:
    - a string to match `'this is a string'`
    - a character range using `[` `...` `]` like `[a-zA-Z]` (and prefixed by `~` to invert the match)
    - another parsing rule to use `YYY` or `yyy` (note that we don't need to be all uppercase. Though, by convention for the token specs, I will use uppercase)
    - a group pattern of elements enclosed by parenthesis`(` `...`  `)` to embrace other parsing rules.
  - quantifiers applied to the previous element with `?` (optional), `*` (0 or more), `+` (1 or more)
  - the `or` pattern `|` to describe alternatives between elements (group or strings to match)
  

The ANTLR syntax stored in the `tokens.md` document is automatically extracted from it to generate an ANTLR `g4` file. From this ANTLR `g4` file, we will be able to generate a Lexer `C#` file that we will use to test against the manual tokenizer developed to parse the language. Its is great because it gives us a way to verify the tokenizer and to check its performance.

> Note that the tokens don't describe how the language is going to use or store them (e.g a string token might be stored/used in the context of a `UTF-8` or `UTF-16` string, a float literal might be used as a `float32` or a `float64`)

## Whitespace and new line

We separate here a new line from whitespace, as a new line has a special meaning in Stark, as it will enable ending a statement/declaration automatically but it will not when for example parsing embracing parenthesis, brackets or braces...

See [Appendix: Fragments](#appendix-fragments) for the details about the `Whitespace` fragment.

```antlr
SPACES: Whitespace+;

NEW_LINE
        : '\r\n' | '\r' | '\n'
        | '\u0085' // <Next Line CHARACTER (U+0085)>'
        | '\u2028' //'<Line Separator CHARACTER (U+2028)>'
        | '\u2029' //'<Paragraph Separator CHARACTER (U+2029)>'
        ;
```

You can see that ANTLR specification is able to manage either a single `\r` (yes, alone, it is a valid newline on some old Mac text files) or a `\r\n` as well as other non common EOL characters.

## Comments

As we talked in the previous post, we will have 3 different kinds of comments:


1. We allow single line comment:

```antlr
COMMENT:            '//' ( ~[/\r\n] ~[\r\n]* )?;
``` 

2. Comment used for documenting the following language element:

```antlr
COMMENT_DOC:        '///' ~[\r\n]*;
``` 

3. Multi-line comments with support for nested multi-line comments:

```antlr
COMMENT_MULTI_LINE: '/*' (COMMENT_MULTI_LINE | .)*? '*/';
``` 

> We may introduced another type of comment doc for documenting the parent language element.

## Identifiers

An identifier is defined by using the ["Unicode Identifier and Pattern Syntax" (Unicode® Standard Annex #31)](http://www.unicode.org/reports/tr31/)

It is composed of characters `XID_Start` and `XID_Continue` that can be extracted from the [Unicode DerivedCoreProperties database](http://unicode.org/Public/UNIDATA/DerivedCoreProperties.txt). I have developed a small program that extract all these identifiers to generate some ANTLR code or `C#` code.

The main difference here is that we allow the character underscore `_` to be used as a `XID_Start`

> Note that because of a restriction of ANTLR not supporting correctly `UTF-32`, the extracted `XID_Start` and `XID_Continue` does not contain `UTF-32` code points above `0xFFFF` (while the manual parser does)

```antlr
IDENTIFIER: ('_'|XID_Start) XID_Continue*;
```

Note that we are introducing also a special identifier to match an identifier composed only of the character underscore `_`

```antlr
UNDERSCORES: '_'+;
```

## Integer Literals

Integer digits `[0-9]` can be separated by an underscore `_` but they must contain at least one digit.


```antlr
INTEGER:        [0-9] [0-9_]*;
```

There are also dedicated tokens for other integer declarations:

- hexadecimal (e.g `0x1234FF00`)
- octal  (e.g `0o117`)
- binary (e.g `0b11110101`)

```antlr
INTEGER_HEXA:   '0' [xX] '_'* [0-9a-fA-F] [0-9a-fA-F_]*;
INTEGER_OCTAL:  '0' [oO] '_'* [0-7] [0-7_]*;
INTEGER_BINARY: '0' [bB] '_'* [0-1] [0-1_]*;
```

All digits can be separated by underscore `_`. The previous rules also enforce that we will have at least one digit `[0-9]` and not only underscores.

## Float Literals

A floating-point number literal requires a digit followed at least by either:

- a `.` followed by one or more digits
- an exponent `e` followed by an optional `+|-` and one or more digits

All digits can be separated by underscore `_`

```antlr
FLOAT: [0-9][0-9_]* ( ([eE] [-+]? [0-9][0-9_]*) | '.' [0-9][0-9_]* ([eE] [-+]? [0-9][0-9_]*)?);
```

## Characters

A character is enclosed by a single quote `'`

```antlr
CHAR:       '\'' (~['\\\r\n\u0085\u2028\u2029] | CommonCharacter) '\'';

fragment CommonCharacter
    : SimpleEscapeSequence
    | HexEscapeSequence
    | UnicodeEscapeSequence
    ;
```

The character `\` is used for escaping the following control characters:

```antlr
fragment SimpleEscapeSequence
    : '\\\''
    | '\\"'
    | '\\\\'
    | '\\0'
    | '\\a'
    | '\\b'
    | '\\f'
    | '\\n'
    | '\\r'
    | '\\t'
    | '\\v'
    ;
```

The escape `\` character is also used to input special characters:

- Hexadecimal character (e.g `\xFF`)
- Unicode UTF-16 character (e.g `\u12AC`)
- Unicode UTF-32 character (e.g `\U00012345`)

```antlr
fragment HexEscapeSequence
    : '\\x' [0-9a-fA-F]
    | '\\x' [0-9a-fA-F][0-9a-fA-F]
    | '\\x' [0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]
    | '\\x' [0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]
    ;

fragment UnicodeEscapeSequence
    : '\\u' [0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]
    | '\\U' [0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]
            [0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]
    ;   
```

## Strings

The main difference with a character is that a string contains more than one character. Also we have the special raw or verbatim string ala `C#` using the prefix `@` character (e.g `@"this is an escaped \n"`)

```antlr
STRING_RAW: '@"' (~'"' | '""')* '"';
STRING:     '"'  (~["\\\r\n\u0085\u2028\u2029] | CommonCharacter)* '"';
```

## Symbols

The symbols are used by the grammar in different scenarios, like separating an identifier from its type or in expression with operators.

We do not define composed tokens here (e.g `>>` instead we have two consecutive `>` `>`) to allow the language parser to handle general and custom operators in an uniform manner (we will dig into this in the next posts about the language syntax)

We also don't attach a particular semantic to the symbols, as a symbol might be used in different scenarios (e.g `*` for operator multiplication but also for pointer declaration and dereferencing), so I took the plain ASCII signification:

```antlr
EXCLAMATION: '!';
NUMBER: '#';
DOLLAR: '$';
PERCENT: '%';
AMPERSAND: '&';


OPEN_PARENTHESIS: '(';
CLOSE_PARENTHESIS: ')';

ASTERISK: '*';
PLUS: '+';
COMMA: ',';
MINUS: '-';
DOT: '.';
SLASH: '/';
COLON: ':';
SEMI_COLON: ';';
LESS_THAN: '<';
EQUAL: '=';
GREATER_THAN:'>';
QUESTION: '?';
AT: '@';

OPEN_BRACKET: '[';
BACKSLASH: '\\';
CLOSE_BRACKET: ']';

CARET: '^';
GRAVE_ACCENT: '`';

OPEN_BRACE: '{';
PIPE: '|';
CLOSE_BRACE: '}';

TILDE: '~';
```

As you may notice, we are actually listing all printable, non letters/non digits symbols present in the ASCII characters, all the characters that should be accessible straight from the keyboard (sometimes combined with a SHIFT key).

## Appendix: Fragments

```antlr
fragment Whitespace
    : UnicodeClassZS //'<Any Character With Unicode Class Zs>'
    | '\u0009' //'<Horizontal Tab Character (U+0009)>'
    | '\u000B' //'<Vertical Tab Character (U+000B)>'
    | '\u000C' //'<Form Feed Character (U+000C)>'
    ;

// http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3AZS%3A%5D&g=&i=
fragment UnicodeClassZS
    : '\u0020' // SPACE
    | '\u00A0' // NO_BREAK SPACE
    | '\u1680' // OGHAM SPACE MARK
    | '\u2000' // EN QUAD
    | '\u2001' // EM QUAD
    | '\u2002' // EN SPACE
    | '\u2003' // EM SPACE
    | '\u2004' // THREE_PER_EM SPACE
    | '\u2005' // FOUR_PER_EM SPACE
    | '\u2006' // SIX_PER_EM SPACE
    | '\u2007' // FIGURE SPACE
    | '\u2008' // PUNCTUATION SPACE
    | '\u2009' // THIN SPACE
    | '\u200A' // HAIR SPACE
    | '\u202F' // NARROW NO_BREAK SPACE
    | '\u205F' // MEDIUM MATHEMATICAL SPACE
    | '\u3000' // IDEOGRAPHIC SPACE
    ;
```

# The Tokenizer

First step in the compiler pipeline, while not being usually the most consuming part, the tokenizer/lexer should still be developed with performance in mind, as it could become a real bottleneck, if not correctly implemented.

For this tokenizer, I would like it to be:

- fast
- zero allocation
- non destructive with precise source location
- Full unicode UTF-32 identifier support
- Support reading from plain managed string or from UTF-8 byte array

## Real support for unicode characters

When using strings in `C#`, it is pretty common to iterate on characters. You should know that [`C#` strings are composed of UTF-16 characters](http://blog.coverity.com/2014/04/09/why-utf-16) (one reason they are also very costly when you are dealing mostly with characters that would fit into the ASCII range and where UTF-8 strings are a lot more appealing there... but anyway...). A less known fact is that some unicode characters cannot be represented by a single UTF-16 char but need actually 2. A unicode characters can cover more than 128,000 characters (the highest code point is `(2^21bits)-1 = 0x001FFFFF`) and this is where in `C#` you need to deal carefully with them by checking if a first character c1 is a high surrogate (`char.IsHighSurrogate(c1)`) and is followed by a character c2 low surrogate (`char.IsLowSurrogate(c)`) from which you can recover the final UTF-32 character (`char.ConvertToUtf32(c1, c2)`)

As I'm using the `XID_Start`/`XID_Continue` unicode characters specification for identifiers, I need to support a larger range of the character stream than usually supported by many programming language. It means that instead of using a plain `char` in the Tokenizer, I have opted to use a small struct [`char32.cs`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/char32.cs) to type and reflect the usage of real UTF-32 characters when parsing the document. 


```csharp
/// <summary>
/// A UTF-32 character ala Stark.
/// </summary>
public struct char32
{
    /// <summary>
    /// Initializes a new instance of the <see cref="char32"/> UTF-32 character.
    /// </summary>
    /// <param name="code">The UTF-32 code character.</param>
    public char32(int code)
    {
        Code = code;
    }

    /// <summary>
    /// Gets the UTF-32 code.
    /// </summary>
    public int Code { get; }

    /// <summary>
    /// Performs an implicit conversion from <see cref="char32"/> to <see cref="System.Int32"/>.
    /// </summary>
    /// <param name="c">The c.</param>
    /// <returns>The result of the conversion.</returns>
    public static implicit operator int(char32 c)
    {
        return c.Code;
    }

    /// <summary>
    /// Performs an implicit conversion from <see cref="System.Int32"/> to <see cref="char32"/>.
    /// </summary>
    /// <param name="c">The c.</param>
    /// <returns>The result of the conversion.</returns>
    public static implicit operator char32(int c)
    {
        return new char32(c);
    }

    public override string ToString()
    {
        return char.ConvertFromUtf32(Code);
    }
}
```

Note, if everything goes as far as I would love to be able to achieve in this experiment, I expect to convert at some point the compiler into the Stark language itself... so this choice of using a `char32` fits well with Stark, because by default, the UTF-8 `string8` (I have currently opted for this syntax for string, but will get back to this in the next post) will provide an iterator returning `char32` characters... 

Also, in order to iterate over the characters of a string, I wanted to use a similar iterator than the one I would have in Stark, so I have added a simple `C#` interface [`Iterator.cs`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Collections/Iterator.cs) (a trait in Stark) that provides mainly:

```csharp
/// <summary>
/// Iterator ala Stark.
/// </summary>
/// <typeparam name="TElement">The type of an element of the iteration.</typeparam>
/// <typeparam name="TState">The type of the state of the iteration.</typeparam>
public interface Iterator<TElement, TState> where TElement : struct 
// Note that in Stark, we would not have a struct constraint on TElement
// as TElement? would be possible
{
    /// <summary>
    /// Gets the start state for the iteration.
    /// </summary>
    TState Start { get; }

    /// <summary>
    /// Tries to get the next element in the iteration.
    /// </summary>
    /// <param name="state">The state.</param>
    /// <returns>none if no element, or an element</returns>
    TElement? TryGetNext(ref TState state);
}
```

This iterator is generic, so we need to have a dedicated type [`CharacterIterator`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/CharacterIterator.cs) for characters:

```csharp
/// <summary>
/// (trait) CharacterIterator ala Stark
/// </summary>
// ReSharper disable once InconsistentNaming
public interface CharacterIterator : Iterator<char32, int>
{
}
``` 

The nice thing about this `CharacterIterator` is that it can work with any kind of inputs, e.g:

- a `UTF-8` string (that would be a `byte[]` in `C#`)
- a `UTF-16` string (a plain `C#` string)

For now, I have just added a basic [`StringCharacterIterator`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/StringCharacterIterator.cs) implementation to iterate over a UTF-16 string in memory:

```csharp
public struct StringCharacterIterator : CharacterIterator
{
    private readonly string _text;

    public StringCharacterIterator(string text)
    {
        this._text = text;
    }

    public int Start => 0;

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public char32? TryGetNext(ref int position)
    {
        if (position < _text.Length)
        {
            var c1 = _text[position];
            position++;

            // Handle surrogates
            return char.IsHighSurrogate(c1) ? NextCharWithSurrogate(ref position, c1) : c1;
        }

        position = _text.Length;
        return null;
    }

    private int NextCharWithSurrogate(ref int position, char c1)
    {
        if (position < _text.Length)
        {
            var c2 = _text[position];
            position++;
            if (char.IsLowSurrogate(c2))
            {
                return char.ConvertToUtf32(c1, c2);
            }
            throw new CharReaderException("Unexpected character after high-surrogate char");
        }
        throw new CharReaderException("Unexpected EOF after high-surrogate char");
    }
}
```

You can notice also that we are using here a `struct` for this character iterator and not a `class`. This is important because this struct will be used as a generic parameter of the [`Tokenizer`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/Tokenizer.cs):

```csharp
/// <summary>
/// Tokenizer enumerator that generates <see cref="Token"/>, to be used from a foreach.
/// </summary>
public class Tokenizer<TReader> : IEnumerable<Token> where TReader : struct, CharacterIterator
{
...
}
``` 

And because the JIT is able to generate a dedicated JIT code when using parametrized generics with struct, we ensure that the character reader will be efficiently inlined (though comparing to the rest of the code, it might not make a significant difference...)

## Decoding characters to Tokens

The method [`NextToken`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/Tokenizer.cs#L78) in the Tokenizer is responsible to decode each incoming characters:

```csharp
private void NextToken()
{
    var start = _position;
    switch (_c)
    {
        case '\u0085': // next line
        case '\u2028': // line separator
        case '\u2029': // paragraph separator
        case '\n':
            _token = new Token(TokenType.NewLine, start, _position);
            NextChar();
            break;
        case ';':
            _token = new Token(TokenType.SemiColon, start, _position);
            NextChar();
            break;
        case '\r':
            NextChar();
            // case of: \r\n
            if (_c == '\n')
            {
                _token = new Token(TokenType.NewLine, start, _position);
                NextChar();
                break;
            }
            // case of \r
            _token = new Token(TokenType.NewLine, start, start);
            break;
        case ':':
            NextChar();
            _token = new Token(TokenType.Colon, start, start);
            break;

            ....
``` 

As you can see, for most of the symbol characters, it is pretty straightforward, as one character leads to one token. But for other tokens (comments, numbers, characters, strings, identifiers) it requires a bit more logic.

But one important implementation detail: **for the tokens, we use a `struct`** (unlike for example ANTLR which by default creates a `class`). Every lexers should do this, as it is a requirement in order to achieve **zero allocations**.

It means for example that our [`Token.cs`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/Token.cs) doesn't even slice the original string to provide a matched text. Instead, it stores only position from the original stream:

```csharp
/// <summary>
/// A lightweight token struct to avoid GC allocations.
/// </summary>
public struct Token : IEquatable<Token>
{
    public static readonly Token Eof = new Token(TokenType.Eof, TextPosition.Eof, TextPosition.Eof);

    /// <summary>
    /// Initializes a new instance of the <see cref="Token"/> struct.
    /// </summary>
    /// <param name="type">The type.</param>
    /// <param name="start">The start.</param>
    /// <param name="end">The end.</param>
    /// <exception cref="System.ArgumentOutOfRangeException"></exception>
    public Token(TokenType type, TextPosition start, TextPosition end)
    {
        if (start.Offset > end.Offset) 
            throw new ArgumentOutOfRangeException(nameof(start), $"[{nameof(start)}] index must be <= to [{nameof(end)}]");
        Type = type;
        Start = start;
        End = end;
    }

    /// <summary>
    /// The type of token.
    /// </summary>
    public readonly TokenType Type;

    /// <summary>
    /// The start position of this token.
    /// </summary>
    public readonly TextPosition Start;

    /// <summary>
    /// The end position of this token.
    /// </summary>
    public readonly TextPosition End;

    ...
}
```

Each the [TokenType.cs](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/TokenType.cs) is a plain enum representing the token. A syntax parser is usually later only using this enum to efficiently parse the token stream.

## Example: Matching comments

Typically, for comments, it starts by [matching the first `/`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/Tokenizer.cs#L147): 

```csharp
        case '/':
            NextChar();
            if (_c == '/' || _c == '*')
            {
                ReadComment(start);
                break;
            }
            _token = new Token(TokenType.Slash, start, start);
            break;
```

but matching the actual comments (either line, or multi-line or doc) is a bit more involving (method [ReadComment](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/Tokenizer.cs#L606)):

```csharp
private void ReadComment(TextPosition start)
{
    var end = _position;
    // Read single line comment
    if (_c == '/')
    {
        // Skip second /
        NextChar();
        // Check if we have a ///
        // TODO: Add support for //!
        bool isDocComment = _c == '/';
        // Read until the end of the line/file
        while (_c != Eof && _c != '\r' && _c != '\n')
        {
            end = _position;
            NextChar();
        }
        _token = new Token(isDocComment ? TokenType.CommentDoc : TokenType.Comment, start, end);
    }
    else
    {
        // Skip second *
        NextChar();
        _nestedMultilineCommentCount++;
        // Read until the end of the line/file
        while (_c != Eof)
        {
            if (_c == '/')
            {
                NextChar();
                if (_c == '*')
                {
                    _nestedMultilineCommentCount++;
                    NextChar();
                }
            }
            else if (_c == '*')
            {
                NextChar();
                if (_c == '/')
                {
                    _nestedMultilineCommentCount--;
                    if (_nestedMultilineCommentCount == 0)
                    {
                        end = _position;
                        NextChar(); // skip last /
                        _token = new Token(TokenType.CommentMultiLine, start, end);
                        return;
                    }
                    NextChar();
                }
            }
            else { 
                end = _position;
                NextChar();
            }
        }
        AddError("Invalid multi-line comment. No matching */ for start /*", start, start);
        _token = new Token(TokenType.Invalid, start, end);
    }
}
```

As you can see, compare to the original ANTLR short rules, we need to carefully handle the nested cases, EOF...etc.

## Matching numbers

For matching numbers, implementing the parser by hand allow us to have a single method that handle all the cases (from integer, to hexa to floats). The generated ANTLR Lexer doesn't work like this (usually it is using a [DFA table](https://en.wikipedia.org/wiki/State_transition_table)) and can be less efficient than our code (due to some implicit backtracking that the lexer may introduce when trying to match a rule doesn't work...)

Also, we have one case here where the handwritten parser has to peek an extra character after a dot `.` to make sure that it is not followed by a `.` (because if Stark, the `..` will be used for ranges).

For example, the [part](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/Tokenizer.cs#L401) that is decoding the digits after the `.` is making sure that we don't try to parse after the `.` if is followed by another `.`:

```csharp
    // Read any number following
    var hasRange = false;
    if (_c == '.')
    {
        // If the next char is a '.' it means that we have a range iterator, so we don't touch it
        if (PeekChar() != '.')
        {
            end = _position;
            NextChar(); // Skip the dot .

            // We expect at least a digit after .
            if (!CharHelper.IsDigit(_c))
            {
                AddError("Expecting at least one digit after the float dot .", _position, _position);
                _token = new Token(TokenType.Invalid, start, end);
                return;
            }

            isFloat = true;
            while (CharHelper.IsDigit(_c) || _c == '_')
            {
                end = _position;
                NextChar();
            }
        }
        else
        {
            // If we have a range, we don't expect to parse anything after
            hasRange = true;
        }
    }
```

## Matching chars and strings 

For strings and characters, we are able to factorize the code for decoding escaped character and reuse this method [`ReadChar`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/Tokenizer.cs#L518) to decode a a single character or multiple charaters of a string.

## Matching identifiers

Because characters allowed for identifiers cover a large range of characters, It required a more dedicated code to handle them efficiently.

Basically, we split the decoding into:

- an early fast path that check against regular ASCII character ranges `_` `a-z`, `A-Z`, `0-9`, for checking the XID_Start character in [`CharHelper.IsIdentifierStart`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/CharHelper.cs#L14)

  ```csharp
  public static bool IsIdentifierStart(char32 c)
  {
      // Extracted from http://unicode.org/Public/UNIDATA/DerivedCoreProperties.txt with XIDStartContinueGen
      // Test regular ASCII characters first before going to a more costly binary search on XID_Start
      if (c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))
      {
          return true;
      }
      return CharacterRangeContains(XID_Start_CharacterRanges, c);
  }
  ```
- a slower path `CharacterRangeContains` that performs a binary search on a large character range database for `XID_Start` and `XID_Continue`

  ```csharp
  private static bool CharacterRangeContains(CharacterRange[] range, char32 c)
  {
      int lo = 0;
      int hi = range.Length - 1;
      while (lo <= hi)
      {
          int mid = lo + ((hi - lo) >> 1);
          var dir = range[mid].CompareTo(c);
          if (dir == 0)
          {
              return true;
          }
          if (dir < 0)
          {
              lo = mid + 1;
          }
          else
          {
              hi = mid - 1;
          }
      }
      return false;
  }
  ```

The `XID_Start_CharacterRanges` and `XID_Continue_CharacterRanges` are stored in a separate big file [`CharHelper.CharacterRange.cs`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler/Parsing/CharHelper.CharacterRanges.cs) that was generated by extracting the data from the unicode database.

Note that currently, a keyword in the language (e.g `for` or `if`) is parsed as an identifier, but we may later slightly change the decoding of the identifiers in the tokenizer to integrate a fast path for decoding keywords as part of the identifier matching. But for now, we don't

## Precise source location

Another important aspect of a tokenizer is to always track precisely the positions of the tokens relative to the character input stream. The position implies:

- the offset from beginning of the stream
- a line and a column

Without this, we could not recover the original string data and we could not also provide a precise and meaningful error message at the next parsing stage.

The Tokenizer should not be destructive but should provide an **enhanced view on the character stream**.

## Differences with Roslyn

Roslyn is a huge compiler, and for example, its [lexer](https://github.com/dotnet/roslyn/blob/master/src/Compilers/CSharp/Portable/Parser/Lexer.cs) is way more involving than the simplistic tokenizer that we have developed here. But still we obviously need to parse the character stream, and the method [`ScanSyntaxToken(ref TokenInfo info)`](https://github.com/dotnet/roslyn/blob/master/src/Compilers/CSharp/Portable/Parser/Lexer.cs#L409) with a switch case on the current character is very similar to the one we described above.

Though there are a couple of differences:

- When scanning numeric literals, Roslyn is going to decode the postfix (`L`...etc.) but I explained in my previous post that I would like to perform this at a later stage and not at the tokenizer stage. Also, Roslyn is actually decoding the string into an actual binary `float` or `double` when parsing the string, a logic that I prefer to let to the syntax parser instead (related to the postfix handling)
- When scanning doc comments, Roslyn is going to decode the XML stream to extract meaningful tokens inside the comments themselves which contributes for a large part of the lexer (so yes, basically, their lexer embeds also a basic XML lexer). We do not have this yet in our Tokenizer. I still don't know where this will be performed. Note that **in Stark, we will use Markdown comments for documentation**, so it will be different and I'm happy also that it will give an opportunity to use [`Markdig`](https://github.com/lunet-io/markdig/)!
- Roslyn has directive tokens (preprocessors) and requires some special paths in their lexer

So overall, the Roslyn lexer is performing a lot more than our rudimentary tokenizer.

## The tests

Every part of the compiler pipeline should be carefully tested, and so the lexer requires many small tests to ensure that we are actually decoding characters correctly. 

We have to test in our [`TestTokenizer.cs`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler.Tests/TestTokenizer.cs) class that:

- all symbols, tokens are correctly decoded
- error cases are correctly reported (there are a few cases where the Tokenizer reports directly token errors)
- accurate source position for tokens

Also, as I explained in the preamble, we have a reference ANTLR lexer generated from our tokens.md specs that we can check against. So it is pretty convenient also to have this test path, as we can directly parse a document with many different tokens, and check that our tokenizer and ANTLR lexer reports the exact same tokens and source positions. This is performed by the method [`VerifyAgainstANTLRLexer`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler.Tests/TestTokenizer.cs#L428) against the file [`StarkTokenTests.sk`](https://github.com/stark-lang/stark/blob/d34f4bfcb628afe333323f52532d52a75622e9dc/src/compiler/Stark.Compiler.Tests/StarkTokenTests.sk)

# Benchmarks

I couldn't resist to check the difference between our handwritten tokenizer and the ANTLR lexer, so I decided to benchmark both (with again the excellent [BenchmarkDotNet](https://github.com/dotnet/BenchmarkDotNet))

And the results using .NET CLR are:

```
// * Summary *

BenchmarkDotNet=v0.10.1, OS=Microsoft Windows NT 6.2.9200.0
Processor=Intel(R) Core(TM) i5-6600K CPU 3.50GHz, ProcessorCount=4
Frequency=3421879 Hz, Resolution=292.2371 ns, Timer=TSC
  [Host]     : Clr 4.0.30319.42000, 32bit LegacyJIT-v4.6.1586.0
  DefaultJob : Clr 4.0.30319.42000, 32bit LegacyJIT-v4.6.1586.0


            Method |        Mean |    StdDev | Scaled | Scaled-StdDev |  Gen 0 | Allocated |
------------------ |------------ |---------- |------- |-------------- |------- |---------- |
     'ANTLR Lexer' | 116.3042 us | 0.4845 us |   1.00 |          0.00 | 1.0417 |  19.78 kB |
 'Stark Tokenizer' |  31.4979 us | 0.2129 us |   0.27 |          0.00 |      - |     121 B |

// * Diagnostic Output - MemoryDiagnoser *
Note: the Gen 0/1/2 Measurements are per 1k Operations
```

So basically, our lexer is roughly **x3 to x4 faster** than the generated ANTLR lexer, which is not highly surprising but still good! 

Also we can see that in terms of memory pressure, we have achieved our goal of a **zero allocation lexer** (unlike ANTLR default)


# Next?

So we have now a specification for the tokens and a functional tokenizer. Before going to implement the syntax parser, we are going back to the blackboard or the white-paper, as the next parts are going to be a lot more challenging.

Obviously, as you can realize, the tokenizer is a very small part of a compiler pipeline. While developing it, I have been also playing a lot with the syntax and concepts of the language, and the more I dig into all the details, the more I can already feel all the dirty and daunting tasks ready to jump-in into this experiment. Sometimes, It makes me feel about just quitting... :D but let's not look too much at the top of the mountain while we are still just in the valley. No worries if we can't make it to the top, but hopefully, step by step, I will try to climb a bit more at my pace...

The next part should start to visit the language syntax and concepts. We will most likely come back to the primitive types first but we will also go through some of the fundamentals (modules vs namespaces, statement vs expressions...etc)

Stay tuned!