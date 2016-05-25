---
layout: post
title: Inline IL ASM in C# with Roslyn
tags:
 - C#
 - Roslyn
 - .Net
comments: true
---

> **Source code for Roslyn changes is available on [github](https://github.com/xoofx/roslyn/tree/inline_il_asm)**
>
> Source code of the example program is available in this [gist](https://gist.github.com/xoofx/9d6a1522c642bbcfef7c420351b1d97d)
>

In the past years I have been using and abusing a lot patching assemblies for IL bytecode. It all started with [SharpDX](http://sharpdx.org) in this [old blog post](http://xoofx.com/blog/2010/10/19/managed-netc-direct3d-11-api-generated/) and I imported all these good recipes while developing [Xenko](http://xenko.com) (which has further exaggerated the usage with its [AssemblyProcessor](https://github.com/SiliconStudio/xenko/tree/master/sources/common/core/SiliconStudio.AssemblyProcessor)!)

The main approach for doing this was to rely on [Mono.Cecil](https://github.com/jbevain/cecil/) and perform some basic IL rewriting (See for example [InteropApp.cs](https://github.com/sharpdx/SharpDX/blob/master/Source/Tools/SharpCli/InteropApp.cs)) needed to access some IL instructions not available in C# but still very useful or sometimes even mandatory.

Just a few days ago, someone proposed to add support for ["compiler intrinsics" to Roslyn](https://github.com/dotnet/roslyn/issues/11475). I was pretty happy to see this coming, as It could potentially obviate the usage of IL repatching (which comes sometimes with lots of problems: Mono.Cecil sometimes messing up debug info, or an assembly that would no longer be certified/working on a specific .NET platform/runtime... etc.). 

While I'm enthusiastic about the general idea of this proposal, I was expecting a [simpler way](https://github.com/dotnet/roslyn/issues/11475#issuecomment-220964443) of bringing this feature to Roslyn, by **allowing to write almost directly IL ASM code in your program**, to make it a lot easier for a end-user (a user used to read or write IL ASM code). The main arguments against my proposal was that it would be complicated to implement, It would not feel enough C# friendly or it may not provide a good syntax analysis. 

Fair enough, but I still wanted to challenge the idea and prove that it is a lot less complicated than it sounds and that overall using in C# could be pretty cool or at least, a lot more appealing than the original proposal, for the IL casual end-user I am... 

In this blog post I will explain a bit the implementation details of a [prototype](https://github.com/xoofx/roslyn/tree/inline_il_asm) that allows to use a seamlessly integrated inline IL ASM syntax into C#, almost as it was a DSL!

# In which case?

As it is explained in the [Proposal: Compiler intrinsics #11475](https://github.com/dotnet/roslyn/issues/11475), there are some cases where we need to access some IL instructions, for example:

- sizeof of a blittable struct using generics (instead of calling the much more CPU consuming `Marshal.SizeOf`)   
- deref pointer manipulation with generics (deref a reference to a blittable struct to a void*)
- call an unmanaged function directly via the `calli` opcode (used a lot in SharpDX COM interop as well as in the MCG used to generate .NETNative interop code)

You can have a look at a typical usage of this kind of hacking in the [PtrUtils.il](https://github.com/joeduffy/slice.net/blob/master/src/PtrUtils.il) of Joe Duffy

Note that depending on the evolution of the language, we may not need some of these IL opcodes, but changing a language spec is not something easy, so if we could come if a viable solution that could bypass these language limitations, that would be great!

# The concept

So I was looking for a solution that provides:

- A user friendly syntax for whoever is used to read or write IL ASM syntax
- A DSL like integration that still allows Roslyn to perform syntax verification on arguments
- A non-breaking-changes approach that allows to use this feature without introducing a new keyword (as proposed)  

The following code excerpt shows the usage of this inline ASM:

```csharp
public static void Main(string[] args)
{
	// -----------------------
	// method call
	// -----------------------
	// Console.WriteLine(sizeof(Vector3) + 4)
	
	// IL_0000: nop
	// IL_0001: sizeof Program/Vector3
	// IL_0007: ldc.i4.4
	// IL_0008: add
	// IL_0009: call void [mscorlib]System.Console::WriteLine(int32)
	il(nop);  // just to show that we can output nop, not really instesting though!
	il(@sizeof, Vector3);  // use of @ as sizeof is a keyword
	il(ldc.i4_4);
	il(add);
	il(call, Console.WriteLine(default(int))); // we define the signature with a fake method call
}
```

As you can see, the syntax is pretty neat! But, where is the `il` function? Where are defined the `nop` or `ldc` opcodes?

Well, this is were the magic happens. In the same type, I simply define this function:

```csharp
// Ideally it should be extern, but for the prototype 
// it fails when loading the type without a DllImport, so we don't use it here 
[CompilerIntrinsic]
static void il(params object[] args) {}
```

Et voilà, you have the inline IL ASM function available right into your code when using my fork of Roslyn. 

The syntax is able to track usage of variables so that usage of `stloc` is marking used variable correctly so that we don't have any compilation errors about a variable being used without an assignment:

```csharp
// -----------------------
// store to local var
// -----------------------
int x;
il(@sizeof, Vector3);  // use of @ as sizeof is a keyword
il(stloc, x);
Console.WriteLine("sizeof&lt;Vector3> stored in local var: " + x); // Note: stloc implicitly mark x as used
```

In terms of error, the compiler extension is able to:

- Provides an error if the IL ASM does not exist
- Provides an error if an argument doesn't match the argument of the IL bytecode 

More checks would need to be included (like checking that instructions are well balanced and the stack is not corrupted and provide a meaningful error...etc.), but it's just a prototype.

The system supports almost all IL bytecode instructions, though I haven't taken the time for tested them (but it should even work with goto like instructions with labels!)

# The implementation

I won't go into all the dirty details about the implementation (here is a [full list of the changes](https://github.com/xoofx/roslyn/commit/d70bdaca3b23c79e4a45bf44afbab968c3d5398c)), but the main additions are in the following files:

- The [`ILInstruction`](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/Binder/ILInstruction.cs) class describes the supported instructions and what kind of arguments they expect
- The [`Binder.TryCompilerIntrinsic`](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/Binder/BinderILEmit.cs) method that performs the syntax verification of the IL instruction
- The [`CodeGenerator.EmitILEmitExpression`](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/CodeGen/EmitILEmit.cs) that emits the appropriate IL bytecode to the assembly. 

## Syntax verification

### Detecting an IL ASM intrinsic

In order to plug into the syntax verification, we have first to identify if a method is a IL intrinsic function:

- Must be extern (disabled for the prototype)
- Must have one parameter with `params object[]`
- Must have a attribute attached `System.Runtime.CompilerServices.CompilerIntrinsicAttribute` which can be directly declared as an internal class in the assembly 
- Must return void or must return the generic type parameter of the method (more about it below) 

This checks are performed when creating the [SourceMemberMethodSymbol at line 316](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/Symbols/Source/SourceMemberMethodSymbol.cs#L316)

I had to store the information about this `CompilerIntrinsic` as a MethodKind as there was no more space left in the method modifiers. This change was a bit annoying as It had to update in some places that were checking for a regular method call (`MethodKind.Ordinary`) and add also the case for (`MethodKind.CompilerIntrinsic`). That's just a detail, I could have added a boolean property in the end, that would have been easier!
 
There is also the support for two kinds of IL compiler intrinsic:

- one that doesn't return a value
- one that returns a value

What does it mean? When you want to retrieve the result of an IL inline instruction directly into a variable, you would like to have a C# method that allows this syntax, so instead of having only one compiler intrinsic, we have also this one:

```csharp
[CompilerIntrinsic]
static T il<T>(params object[] args) { return default(T); }  
```
(note again that the function should have `extern` keyword, but for the prototype we fill the body with an unused implem)

This can then be used handly with this kind of syntax, for example return the sizeof of a generic argument:

```csharp
public static int SizeOf<T>() where T : struct
{
	// sizeof with generic!
	return il<int>(@sizeof, T);
}
```

### IL ASM intrinsic method binding

Once we have the semantic for this IL instruction, we need to check each method call site for its usage.

This is almost all done part of the Binder process, in the method [`Binder.TryCompilerIntrinsic`](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/Binder/BinderILEmit.cs). This method is then called from the existing [Binder.BindInvocationExpression at line 165](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/Binder/Binder_Invocation.cs#L165).

The trick is to try to check if a method call is in fact our compiler intrinsic, if it is, we can process the arguments specifically (as it would fail with a regular BindMethod)

Then the `TryCompilerIntrinsic` will try to evaluate that it is a correct IL intrinsic:

- Check that the method call is an actual CompilerIntrinsic method as described above. Note that the implementation is suffering from scanning the method group even for regular calls. That's something that would require more thinking to speed up the process.
- The IL ASM argument is then a simple expression but we don't try to resolve it, so when we have the argument `nop` or `ldc.i4_4` we are just checking that it is a valid IL instruction, if it is, bingo, the IL ASM instruction is known. This is very neat, as we are almost achieving a **DSL for IL ASM opcodes**!
- Then if the instruction is valid, we are going to check any required arguments. 

Arguments are a bit tricky to parse, but in the end, I found that it was requiring not so much code to handle most of the use cases. Specifically, the argument binding allows to:

- Specify valid C# local variable/arguments for `ldloc/stloc` or `ldarg/starg`
- Specify C# Method group (if the method is alone): `il(call, TryBindMethod);`
- Specify C# Method call (if the method needs a specific overload: `il(call, Console.WriteLine(default(int)));`
- Specify valid C# labels for all goto operations

There was also a little detail about marking correctly opcode 'stloc' that the variable is actually used (in [DataFlowPass.cs VisitILEmit method at line 1388](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/FlowAnalysis/DataFlowPass.cs#L1388) so that Roslyn is able to detect that a proper opcode is actually writing to a variable (so that we avoid having errors like `variable is not initialized`)

## IL bytecode emission

Then the bytecode emission is quite simple to perform, all done in [`CodeGenerator.EmitILEmitExpression`](https://github.com/xoofx/roslyn/blob/inline_il_asm/src/Compilers/CSharp/Portable/CodeGen/EmitILEmit.cs).

You can see that it handles many cases, where a call should for example notify the state of the stack...etc.

# The sample

A working sample is available at this [gist](https://gist.github.com/xoofx/9d6a1522c642bbcfef7c420351b1d97d):

```csharp
using System;
using System.IO;
using System.Runtime.CompilerServices;

namespace System.Runtime.CompilerServices
{
    [AttributeUsage(AttributeTargets.Method)]
    internal class CompilerIntrinsicAttribute : Attribute { }
}

class Program
{
	[CompilerIntrinsic]
    static void il(params object[] args) {}  // cannot use extern for the prototype, as it fails when loading the type without a DllImport

	[CompilerIntrinsic]
    static T il<T>(params object[] args) { return default(T); }  // cannot use extern for the prototype, as it fails when loading the type without a DllImport
	
	struct Vector3
	{
		public float X;
		public float Y;
		public float Z;
	}
	
	public static int SizeOf<T>() where T : struct
	{
		// sizeof with generic!
		return il<int>(@sizeof, T);
	}
	
	public static void TryBindMethod(string[] args)
	{
		Console.WriteLine($"method call: TryBindMethod with {args.Length} arguments");
	}
	
	public static void Main(string[] args)
	{
		// -----------------------
		// method call
		// -----------------------
		// Console.WriteLine(sizeof(Vector3) + 4)
		
		// IL_0000: nop
		// IL_0001: sizeof Program/Vector3
		// IL_0007: ldc.i4.4
		// IL_0008: add
		// IL_0009: call void [mscorlib]System.Console::WriteLine(int32)
		il(nop);  // just to show that we can output nop, not really instesting though!
		il(@sizeof, Vector3);  // use of @ as sizeof is a keyword
		il(ldc.i4_4);
		il(add);
		il(call, Console.WriteLine(default(int))); // we define the signature with a fake method call
		
		// -----------------------
		// load from local var
		// -----------------------
		var myLocalArgs = args;
		il(ldloc, myLocalArgs);
		il(call, TryBindMethod);

		// -----------------------
		// store to local var
		// -----------------------
		int x;
		il(@sizeof, Vector3);  // use of @ as sizeof is a keyword
		il(stloc, x);
		Console.WriteLine("sizeof<Vector3> stored in local var: " + x); // Note: stloc implicitly mark x as used
		
		// -----------------------
		// sizeof with generic
		// -----------------------
		Console.WriteLine("Sizeof<T> with Vector3: " + SizeOf<Vector3>());
	}
}
```

If you compile and run this program with the fork inline_il_asm of Roslyn, you will be able to see:

```
C:\Code\dotnet>program "il asm helloworld!"
16
method call: TryBindMethod with 1 arguments
sizeof<Vector3> stored in local var: 12
Sizeof<T> with Vector3: 12
```

If you want to experiment things with my branch, simply clone, run the `Restore.cmd` command, open the solution `Compilers.sln`, set active project `csc` and add your program argument to your cs file in the project properties, that's all!

# Next?

This prototype demonstrates that making a DSL extension that supports IL ASM instruction is quite easy to do with Roslyn.

I can say that, as a casual user of IL ASM, I love a lot more the syntax of this prototype than the one originaly proposed. It makes things a lot more easier to use, you simply have 2 generic functions to use in your code and you are done, still C# friendly, magic!  

But in the end, this is of course source of debating and language designer friction, so I would not mind having a much more verbose alternative, if we at least get the feature of accessing some IL compiler instrinsics for real! ;)

Anyway, there is a new toy in town for C#, **inline IL ASM**, happy coding!