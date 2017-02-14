---
layout: post
title: Stark - Language Design Part 2 - Packages and Modules
tags:
 - Stark
 - C#
 - Rust
comments: true
---

May be surprisingly, my first post about language design for Stark (beyond tokens for the grammar part) is not going to walk through the type system, statements or expressions... But instead focus on how to organize the code of a project/library, how to distribute it (though will not much give details about this) and how to consume it from another project (or from the same project). But obviously, the way you structure your type system has an impact on the way you are going to organize your code. So I'm going to make some assumptions here about our future type system and try to design an organization frame from these.

Languages like C#, Java or C++ are typically providing the concept of `namespace` to organize your code. While I haven't thought much about the usage of `namespace` until recently, I liked their simplicity, their natural open-ness (e.g add a type to an existing namespace), their implicit import of outer scopes... indeed, very convenient... but at some point, after years of using them inside libraries that are redistributed through some package manager (like NuGet for C#), I have found `namespace` to be actually too much permissive... causing sometimes trouble and annoyance...

So in this post, we are going to re-visit the concept of `namespace` in C#, check what others are doing by making a small dive into the Rust Crates and Modules system (I could have taken F#, but I found Rust to be a bit more different and appealing for a comparison purpose), and lastly, we will try to sketch a proposal for Stark.  

# C# Namespaces, easy and dirty

In C#, namespaces come with *lots* of freedom:

- you can declare multiple namespaces (and nested) into a single file via `namespace MyNameSpace { ... }`. Though, it is more common to declare a single namespace inside a file.
- the disk folder/directory structure doesn't matter, though usually you use the same directory name for your namespace, but there is nothing that enforce this so you can organize things  vastly differently...
- Usage of nested types and namespaces path are not differentiated in the code. If you are using a type `XXX.YYY.ZZZ`, you can't know from this if XXX and YYY are namespaces or types.
- you can externally "pollute" whatever namespaces you want with your own types. There are no restrictions. Nobody owns a namespace. Though usually, you tend to assume that everybody is going to work relatively isolated from each other.
- from a same assembly, all types from other namespaces are visible. If you need some privacy, you will use nested types for this. But if you need to share a "private" type between two types in your namespace, you are a bit more in trouble...
- when working from a namespace, every outer/englobing namespace is automatically imported/visible/accessible without any prefixing.
- when you import a namespace (e.g `using System.Runtime;`), it imports all the types defined in that namespace. You can't import a single type or a list of selected types (note for example that in Java, you can import a single type)
- if you have added multiple assemblies/libraries to your project, when using a type through using/importing a particular namespace, you can't tell for sure from where the type is coming.
- you can publish NuGet packages with same namespaces
- Anyone can publish a NuGet package with the same "root" name, as long as sub part names are different (e.g with a nuget package `core` published, someone can publish a `core.mycode`)
- the package id doesn't have to match any of the namespaces exposed by this package 
- with a namespace, you can't easily tell from which nuget package is actually providing it (as it may be provided by many different packages)

To be clear, none of the above have been making namespaces awfully impractical. Redistribute-able Assembly/.NET packages thanks to NuGet came much after C#/.NET was introduced. But after years of using both (namespaces and NuGet packages), I have realized that many of the small disturbances described above are increasingly becoming more and more annoying...

# Rust Crates and Modules, too powerful?

Modules in Rust are very powerful and yet quite difficult to grasp. It is said that they have been inspired by JavaScript modules which were inspired from Racket/Scheme ([1](https://www.reddit.com/r/rust/comments/24n5q2/crates_and_the_module_system/ch9lf58/))

As I haven't used Rust intensively, I will try to re-transcript what I have understood from their Module system. The documentation ["Crates and Modules"](https://doc.rust-lang.org/book/crates-and-modules.html) is quite informative, but it still doesn't express all the implications of their system.

For the declaration part of the modules:

- a `crate` is a package that can contain a library (and sometimes along an exe) with multiple modules
  - the name of the `crate` defines the name of the implicit root module of this crate (a `crate` called `yoyo` is making the module `yoyo` top level englobing all the nested modules in the crate)
  - you can't create a `mod`/module with a name outside of the scope of the root module (e.g `yoyo`, `yoyo::nested_module` but not `another_top_module`)
- a `mod` contains functions/types/constants for this module and nested modules.
  - it can be declared inlined by using `mod module_name {...}`
  - or it can be declared using `mod module_name;`, in that case it expects either:
    - A file named `module_name.rs` at the same level where the module is declared
    - A file named `module_name/mod.rs` in a sub-directory
  - What is important here to understand is that the source code is defining what is part of your module (in C#, it would be the `csproj`) while in Rust, the compiler will fetch the dependant modules from the source code directly.
  - a `module` can be defined only once and cannot be extended/modified from outside where it is defined (it means you cannot have the same name for an inline module and module stored in a separate file)
  - a `module` is by default `private` to the crate where it is defined but still visible inside this crate from other modules
  - a `module` can be declared `pub mod module_name;` - public and thus is made accessible outside of the `crate`
  - each function/type/constant inside a `module` can either be private (the default, not accessible outside this module, even for other modules in the same crate) or `pub` - public (accessible for other modules, and accessible outside the crate if the module itself is public)
- `extern crate mymodule_package` allows to declare a dependency to an external crate (the version is not defined here but defined in a build/config TOML file)
  - `pub extern crate mymodule_package` allows to export an external `crate` (more on this below)
  - you can alias the implicit import of a crate by using the `extern crate mymodule_name as my_newmodule_name;` 
- the metadata associated to a crate is defined in a `toml` file (where you define for example the name of the `crate`, vs the name of the root `module`, the library version, author...etc.)

For the `use`/import part of a module, the syntax to use a module is `use module_path;` where module_path is a list of plain identifiers separated by `::` (e.g `core::module::separated::by`)

- the module_path to import is always relative to the implicit crate root module 
- you import a module with `use module_path;` a module path is composed of `module_name` separated by `::`
  - note that importing just a module make the module accessible where the `use` occurs, though you still need to prefix by last part of the module name to access it: typically `use greetings::english;` you import the module `english`, and you can access code/types inside this module in your code by prefixing the type/code with `english::function1` for example
  - the `use` directive can import directly the whole content of a module into the current scope using the wildcard `*` (e.g `use module::path::sub_module::*`)
  - the `use` directive can also selectively import module/types/functions using `{` `}` (e.g `use module::path::sub_module::{module1, type1, function1}`)
  - As for crates, you can also re-alias a module name with `as`
- you can [re-export a module](https://doc.rust-lang.org/book/crates-and-modules.html#re-exporting-with-pub-use) with `pub use module_name;`
- the `use` directive allows to import (or even re-export) with a different name `use mymodule as mynewmodule;` 

Now compare to C# and the namespaces, we can highlight the following differences:

- The declared modules define which source code to include into your library. Unlike C# that has to rely on an external system (e.g msbuild `csproj`) to define this, Rust integrates the code dependencies directly into the language.
- `module` are usually a lot more finer grained than namespaces, because Rust does not have nested types, modules are often used to isolate a single type, its trait implementations and its internal types. You will see many modules in Rust foundation crates (e.g core or std).
- even in nested modules, you don't inherit the scope of outer module, you still need to use/import them. In C#, working in `MySystem.MySubSystem` (types in MySubSystem will see eveything defined in `MySystem`)
- as said earlier, you can't inject new types/submodules outside its original declaration. In C#, you can create a new assembly an use any namespace you want.
- in Rust, a visibility can be defined on a module. In C#, you can't define a visibility for a namespace but only at a type level.
- in Rust, because you can re-export modules (and types within a module), you can replicate types of another module into your own module hierarchy and expose it as `public`. In C#, you can't.

While very powerful, Rust crates and modules are also often confusing many people. While looking for criticism about the Rust approach, I found some instructive feedback:

- _Rust's Modules are Weird_ ([post](https://gist.github.com/DanielKeep/470f4e114d28cd0c8d43), [reddit](https://www.reddit.com/r/rust/comments/2he9xi/rusts_modules_are_weird_another_explanation_of/) )
- _Crates and the module system_ ([reddit](https://www.reddit.com/r/rust/comments/24n5q2/crates_and_the_module_system/))
- _I love rust, but one thing about modules is aweful!_ ([forum](https://users.rust-lang.org/t/i-love-rust-but-one-thing-about-modules-is-aweful/2930))
- _I always get a little confused when trying to use its module system_ ([post](http://blog.thiago.me/notes-about-rust-modules/))
- _The Rust module system is too confusing_ ([post](https://withoutboats.github.io/blog/rust/2017/01/04/the-rust-module-system-is-too-confusing.html), [news](https://news.ycombinator.com/item?id=13372963))

Maybe the last post gives some interesting insights about why Rust modules are difficult to manage. I will give my own appreciation here (again maybe not accurate as I'm not a Rust expert):

- `use`/import inside a library is always relative to the crate root module. If your crate is `tada`, all modules imported in your code will end up inside `tada::...` 
- A syntax like `extern crate mymodule_package` is implicitly importing the root module of the crate where the extern crate directive was defined. If you perform this at the bottom of your library/crate, you are "lucky" because you will be able to do a `use mymodule_package` at whatever sub modules in your code without trouble. But because of the relativeness of the `use` directive, if you perform an `extern crate mymodule_package` in a sub modules of your own crate, you will have to reference this `mymodule_package` with something like `use self::mymodule_package`, a way to bypass the absolute module path (again relative to crate root) and reference the current module (self) where the crate was imported. Typically, I have seen some Rust libraries that actually didn't understand quite well this and the `extern crate mycrate` was replicated at many sub modules levels but they were still using a plain `use mycrate;`, that was luckily working because it was also imported at the top level.
- 3 different ways to define a module (and import it implicitly where the `module` directive is declared):
  1) inlined (e.g `module my_module { ... }` )
  2) stored in one file `module my_module;` => will try to import `my_module.rs`
  3) stored in one directory+special file `module my_module;` will also try to import `my_module/mod.rs`
  Overall, these choices make sense in the way Rust's Type System is structured (e.g no nested types). But it gives an opportunity for coding styles discrepancies. Typically, in many core Rust library, they are using lots of nested private modules (usually not inlined) and they are re-exporting them (sometimes in a different crate, like many types defined in `core` are actually publicly [re-exported in `std`](https://github.com/rust-lang/rust/blob/81bd2675eaf96396e363d63aa068b0a462ec5a6d/src/libstd/lib.rs#L361)). But I have also seen in many users libraries different coding styles, like using a big top level `lib.rs` file defining all traits, types of the library, which I find quite annoying from a source control perspective, as you end-up having big files that won't fit well into a versioning workflow with concurrent workers. A common pattern I have seen for inlined modules is to use them for tests.
- As you can attach a visibility (i.e a re-export semantic) to a module and you can also attach a visibility to a `use`/import (so re-export via a `use`/import directive ), it can make the re-export semantic confusing (e.g why use one or the other, in which case) 
- Because a crate cannot be a module path (`mylib::mysublib::xxx`) but only (and implicitly) mapped to a single module root (`mylib`), many Rust libraries authors are actually using a root crate like `mylib` (with a root module `mylib` for example), and another crate like `mylib_module1` (with a root module `mysublib`), and they are performing an `pub extern crate mylib_module1` inside `my_lib`, in order to make the types of the module `mysublib` (coming from mylib) appearing below the `mylib` module (e.g `mylib::mysublib`). But if you start to use `mylib_module1` directly (i.e `mysublib` module), you won't find the `mylib` top level module but only `mysublib` module.

# Stark Packages and Modules, Draft 1

I would like to find a middle ground, between my experience using namespace/nuget packages in C#, and inspiration from Rust. This is going to be an opinionated design (like almost many choices) though I'm going to try to describe as much as possible the why here...

Let's try to define for Stark some overall concepts:

- A `package` in Stark is a re-distributable library (or executable, or both) that can contains a library with one root module, optional associated content/resource files and executable tools. It is very similar to a NuGet package or a crate (it has the relevant metadata to identify a package, its version, authors, project URL...etc.)
- A `library` contains one root module.
- An `executable` is a library with a special executable entry point
- A `module` contains the declaration and definition of types/functions/constants and nested modules.

In the following parts, we are not only going to define the grammar of the language for modules but also what is going to be the folder/directory/files structure.

We will cover the following declarations:

- The `module` declaration
- The `package` declaration
- How to use/`import` an existing `module`
- How to use/`import` an existing `package`

## Declare a `module`

In Stark, a module is declared from the code like this:

```fsharp
module mymodule
```

The ANTLR syntax for parsing this declaration will be something around this (TODO: Add a link to the ANTLR G4 file on github)

```antlr
ModuleDirective: 'public'? 'module' ModuleName Eod;

ModuleName: IDENTIFIER;

ModulePath: (ModuleName '::')+
          | 'this' '::' (ModuleName '::')+     // used by import directive but not when declaring a module
          | ('base' '::')+ (ModuleName '::')*  // idem
          ;

ModuleFullName: ModulePath ModuleName
              | ModuleName
              ;
```

A **module will map to a directory** on the disk. It means that if you declare `module mymodule` in a module file, in the same directory, it will contain a directory named `mymodule`

Assuming that the top level file of a package is in `src/library.sk` and that it contains `module mymodule`, we will have the following file/folder structure:

```
src/
  library.sk
  mymodule/
    module.sk
```

All types, functions, traits and implementations for a module will reside along the `module.sk` file in whatever file organization that may fit your module (but at the same folder level):

```
src/
  library.sk
  mymodule/
    MyType1.sk
    MyType2AndTraits.sk
    SomeFunctions.sk
    ...
    module.sk
```

All types, functions, traits files will not have to re-specify the module. It will be defined by the directory (and the original `module mymodule` declaration from `src/library.sk`). You can't override the module name or declare nested/hidden modules inside your types/functions/traits files.

The file `mymodule/module.sk` is not mandatory but it will be parsed first before parsing other files in the same folder. 

This `module.sk` will provide a way to:

- pre-define some required custom operators that are used in this module (this is speculative from my early design thoughts, we will see in a much later post about expressions why we may need this)
- define the default imports, aliases, that will be shared between all the types, functions, traits files inside this module/folder: if you import `import std::core::*`, it will make all types inside `std::core` accessible to all types into `mymodule`), If you perform an `import base::*` it will make all types from the outer scope accessible to the current module.
- define the sub modules (via `module xxx_my_sub_module`)

An important restriction is that you can't declare a module outside a `module.sk` or a top level `library.sk` (note that the name of `library.sk` can be redefined in the package description) 

The root module of the library is defined by the `package` (see below). All Stark files on the side of `library.sk` will be treated as types/functions/traits as part of this root module.

By default, a module is made private to the library/package it is declared, accessible from all modules inside the package. But you can **export a module outside a package**:

```fsharp
public module mymodule // make visible mymodule outside the current package
```

With the import declaration, we will see also that while a module can be private, we can still make its content public and export its content.

The **root module is public** and its visibility cannot be changed.

## Declare a `package`

A package is not declared from a Stark source code but it will use meta declaration from a data-oriented language (e.g `TOML`, `JSON`... etc.).

Unlike Rust or C# NuGet, a package has the name of the root module exposed by this package: if we declare the package with the name `mymodule`, it will make explicit that the root module exposed by this package is `mymodule`. A difference with Rust is that we will allow to declare the root module of a package directly with sub a sub module path (e.g `mymodule::sub1::sub2`).

When a package is pushed to a registry, the root module is reserved and you are not only the owner of this module, but also of all sub-modules prefixed by this module that could be published later. 
It means that if you publish a package `mymodule`, you will be later able to publish a module `mymodule.sub1` and nobody else will be able to do this. You have basically the ownership on the entire module sub namespace (similar to when you own a DNS domain name)

When a package is pushed, the system will exactly know which modules are exported by this package. As you can't have duplicated modules inside the registry, a module will be only accessible from a single package. It means that if you published a first package `mymodule` containing 2 modules `mymodule` and `mymodule.sub1`, you will not be able to publish `mymodule.sub1` as a separate package, until it is removed from the `mymodule` package. There is still some thoughts to put into how to do this with some package update transactions - e.g update `mymodule` and push `mymodule.sub1` together and allow an auto redirect/package upgrade to this new package when referencing only the `mymodule` package.

We will detail much later how a package will declare and embed additional resources.

## `import` a `module`

When declaring a `module`, it is imported implicitly from the module where it is declared. An import means that you can refer to a type inside this module in the code by prefixing by the module name (e.g `mymodule::mytype`)

Note that while a `module` name is a simple identifier, a full module name is separating identifiers by `::` (e.g `mymodule::sub1::sub2`)

The reason to use `::` instead of `.` is to better spot what is a module path and what is a type path. Because we will support nested types that will be accessible through dot `.` I prefer to make a clear distinction between a module path and a type path.

The ANTLR specification of the import directive would be like this:

```antlr
ImportDirective: 'public'? 'import' ImportPath Eod;

ImportPath: ModulePath ASTERISK
          | ModulePath OPEN_BRACE ImportNameOrAlias (COMMA ImportNameOrAlias)* CLOSE_BRACE
          | ModulePath? ImportNameOrAlias
          ;

// The ImportName can either be a module name or a type name
ImportName: IDENTIFIER;
ImportNameOrAlias: ImportName ('as' ImportName)?;
```

So typically, you can import a module, multiple types, or a selected types:

```java
// Make the collections module accessible into the current scope where the import directive is done
import std::collections   

// Imports all types into the current scope
import std::collections::*  

// Imports selected types into the current scope
import std::collections::{List, Iterator}
``` 

You can also alias a module to a different name when importing it:

```java
import std::collections as collections2
``` 

Note that by default, **the module path of an import is absolute** (e.g `std::collections`). Unlike in Rust for example where the module path is relative to the root module of a crate (Package in Stark).

If your package/root module is `mymodule` and you are in the sub module `mymodule::sub1::sub2`, if you want to import the content of the root module, you need to specify it `import mymodule`

In order to import relatively, you can use:
- `this` prefix module to import from the current module path
- multiple `super` prefix to import from the parent module path


For example, If we  are in a type in the module `mymodule::sub1::sub2` and there is an existing `sub3` module inside `sub2`

```java
// importing types from sub module sub3 from sub2
import this::sub3::*
// is equivalent to
import mymodule::sub1::sub2::*

// Import from parent of parent
import base::base::*
// equivalent to
import mymodule::*
```

By default, inside a module, only the sub modules are always imported (but not their content). For example, if you are inside the module `mymodule` and declare `module sub1`, `sub1` will be accessible in the code.

Types, functions and constants inside a module have a visibility:

- `public` will make the type public outside the module (and outside the package if the module is also `public`)
- `internal` will make the type accessible from outside the module inside the same package (but not outside it)
- `private` (implicit and default) will make the type only accessible for the module it is declared 

An important aspect of the import directive is that it can be used to re-export a module or the content of a module by using the `public` modifier on the import.

For example, suppose that we have an internal module `mymodule::hidden` and we want to export its content at `mymodule` so that from the outside, we will see all types of `hidden` sub modules under `mymodule`:

```java
// Make all types/functions/constants of private sub module hidden 
// accessible from mymodule
public import this::hidden::*
```

Note also that we could export a module with a different name `public import this::hidden as sub1` 

The difference with Rust here is that we typically forbid to export a type/module of another module that is already public/exported. It restricts cases like this:

- you cannot re-export to a different module the content of a existing public module (either coming from your package or an external package)
- you cannot re-export the content of another external package/module (a module that you don't own and is already public)
- you cannot re-export a type from a private module into multiple modules

This is important because we can guarantee some invariants:

- a public type is declared only in a specific public module
- a public module is declared only in a specific package

## Declare an `extern package`

The `extern package` directive allows to explicit in the code the dependencies to a specific package. Note that it doesn't say which version of the package we are looking for (this will be stored in the package descriptions)

The ANTLR specifications of an extern package is like this:

```antlr
ExternPackageDirective: 'extern' 'package' Package ('as' Package) Eod;

// note that this:: or base:: modules are not supported for a Package
Package: ModuleFullName;
```

This is primarily a **linking directive**. But this provides also an **import accessibility**. The package can be imported from any sub modules from the same package that reference it:

```c#
// We are linking with mymodule2 package
extern package mymodule2

// we can import and use the mymodule with the import directive
import mymodule2
```

It is important to understand here that `extern package` is scoped to the module it is declared. It means that you cannot import a module of a package that has not been declared as `extern package` from the current module or a parent module.

Typically, if we are inside the module `mymodule::sub1::sub2` and we declared `extern package mymodule2`, we can only access `import mymodule2` from `sub2` or any sub modules below `sub2` (but inside the same package)

This is different here from Rust where `extern crate` link and import into the module scope the root module of the crate, as in Stark:

- `extern package mymodule2` is a linking directive and defines an import accessibility for sub modules where the extern package directive is issued. The path of the root module of the package is still absolute, but its import visibility is restricted to where the `extern package` was issued.
- you still need an explicit `import mymodule2` to effectively import the root module (or a sub module of the package). This import can only be issued where an `extern package` has been declared from the current module or a parent module from the same package.

## Differences with C# and Rust

Let's try to recap and highlight some of the major differences with Rust crates/modules and C# namespaces/assembly/nugets.

- you have a single and explicit layout of a module on the disk and a single way to declare a module
- a type inside a module (folder) is automatically part of this module and cannot be part of another module 
- a module declare its nested modules (in .NET, you don't declare namespace but you declare the types in the `csproj`)
- import is explicit: there is no implicit import of outer scope module
- you can't modify the content of the module outside of its original folder/content
- you can have a visibility on a module (`public` or `private`) in addition to the visibility on types/functions/constants
- types/functions/constants can be `private` inside a module (not accessible outside), `internal` (accessible from other modules from the same package) or `public` (accessible from any modules)
- you can re-export a private module to a different public module
- you can re-export a public type of a private module to a different public module
- you declare your package dependencies from the code through `extern package`
- import paths are absolute (like namespace in C# but not like Rust that is relative to the current crate)
- the root module of a package in a registry serves as a domain entry that you own. Any sub package/modules using the same root module are part of this package tree (and are owned by a single entity).
- From the same registry, a module can only be declared once from a single package
- the root module of a package published to a registry can be a nested module (e.g `mymodule::sub1::sub2`)

# Next?

While it departs substantially from some existing namespace/modules handling, I'm wondering how much the explicit layout of a module on the disk is going to be a controversy. Let me know what you think overall, that's a first draft!

Now that I have specified the module, I will probably start to write the syntax parser just to bootstrap a little bit the work there.

In the meantime, the following posts will continue to dive into the language design parts, with lots of work and pain ahead! Still not sure which part I will cover first, but most likely to start with functions/variable/struct/class declarations...

Stay tuned!
