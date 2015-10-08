---
layout: post
title: A new stackalloc operator for reference types with CoreCLR and Roslyn
tags:
 - C#
 - Roslyn
 - CoreCLR
 - .Net
comments: true
---

In the sequel of my previous post adding [struct inheritance to C# with CoreCLR and Roslyn](/blog/2015/09/27/struct-inheritance-in-csharp-with-roslyn-and-coreclr/), I would like to share here a *proposal* and a *prototype* for a new `stackalloc` operator that **allow the allocation of a reference type on the stack instead of the heap**, all of this again integrated into CoreCLR and Roslyn! 

Before going into the details about how it can be used and how it is actually implemented, I would like to explain a bit more why this is an important feature, as it may be obvious for some, It is often something that is not well enough considered by programmers using managed languages like .NET

# Performance is *almost* all about memory

Performance of an application is related to **how well algorithm and data are designed to efficiently work together** or said differently *How much your process/data is in harmony with your data/process?*

No matter how much we optimize our code, if datas are not well organized and don't match the "way of thinking" of the code, the program will experience stalls and cache misses all around. While this can be quite easily spotted with an advanced profiler like Intel VTune Amplifier, it is quite often not easy to fix it afterwards. It may also be quite difficult to balance the way datas are organized, because of orthogonality mismatch: While we may have a generic set of input datas, we may have to organize differently these datas for a particular process, and differently for a sub-sequent process working either on the original set, or the result of the previous set, or a mix of the two. This is often what makes the process of optimization an exponential workload. 

This harmony between code and data is directly influenced by how the processor and memory are actually designed to process them efficiently:
 
1. How much the native generated code is optimized? (including things like pipelining, branch mis-prediction... etc.)
2. How much memory access is optimized? 

While the first point is obviously something that we tend to consider first, the second point has a much wider impact on *everything*. We often put lots of emphasis on the merit of "data-oriented" programming and this is absolutely what this is all about, even more if we are considering that code is always data for someone else (e.g machine instructions are data for processors)

So talking about memory, if we recall some famous figures that you have most likely already seen around like: "[Latency Numbers Every Programmer Should Know](http://www.eecs.berkeley.edu/~rcs/research/interactive_latency.html)" or from this [gist](https://gist.github.com/jboner/2841832): 

```
Latency Comparison Numbers
--------------------------
Register                                      0.1 ns             Added this one
L1 cache reference                            0.5 ns
Branch mispredict                             5   ns
L2 cache reference                            7   ns             14x L1 cache, 70x register
Mutex lock/unlock                            25   ns
Main memory reference                       100   ns             20x L2 cache, 200x L1 cache, 1000x register 
```
Considering that currently on a modern Intel Skylake processor:

- L1 cache 	64 KiB per core
- L2 cache 	256 KiB per core
- L3 cache 	8192 KiB shared
- L4 cache from 64 to 128Mo eDRAM on certain SKUs

If we think more about it, these numbers give vertigo: We have computer with GBytes of main memory, storing code and data, and sometimes a large part of it at some point should go through the pipes of the L1/L2/L# caches to ultimately end-up running at full speed using 128 bytes on a chip! (16 x 64 bits CPU registers on x64), not even talking of the terabytes floating around on hard drives, ready to jump into the RAM.

```
Memory Size Comparison Numbers
------------------------------
- CPU registers:    128 bytes
- CPU caches: 9,437,184 bytes    70,000x registers
- RAM:    8,589,934,592 bytes    900x L# caches, 6,000,000x registers

```
If we take both memory latency and size into regard, we can see immediately that a program performance is in the end **a problem of efficiently managing data locality**.

So back to our subject when we talk about "Managed Language" we are effectively talking about **a runtime/language that manages the memory for us**, in the ultimate **purpose of safety** while we realize that it doesn't necessarily imply the **purpose of locality**. 

Note that JIT is for example not a pure criteria of efficiency of a "Managed Language", as we have seen in recent years with the rise of native compilers for managed languages - starting with NGen, then .NETNative or the more recent and promising [LLILC](https://gitter.im/dotnet/llilc) initiative.

Incidentally, when I went to the MVP summit last year, I remember during a Q&A session with the .NET runtime team someone asking about any major GC improvements coming to .NET. While he didn't got any precise answers, because the GC in .NET is something already quite optimized... what I wanted to answer him - but didn't get a chance to - is that:

>  We need to get back to more **control on the way objects are allocated/layout/destroyed in memory** in order to
>  
>  - **improve locality** 
>  - **lower the pressure on the GC**. 

# Less Managed, More Control

If you are curious about how the GC in .NET is working, take a look at [the fundamentals of Garbage Collection in .NET](https://msdn.microsoft.com/en-us/library/ee787088%28v=vs.110%29.aspx)

So how can improve our control over memory and locality? For example, .NET has structs that are already a language feature backed that a runtime that allow us to control a bit this locality... but this is far from enough and there are several other trails to explore like:

1. Allocation on the stack of reference types
2. Embedded allocation of a reference type within another reference type (fat type)
3. Single Owner/Borrowed reference
4. Explicit management of GC regions instead of relying on a generic generational GC

In this post I will just focus on (1) but hopefully will give more details on other points in some next posts.

# Allocation on the stack

The stack is, by its nature, data locality friendly: whenever we call a method and push method arguments, or work on some local variables, all these datas will most likely be stored in a memory location (not only registers, starting from the Program Counter return address to the callee). Also the memory is growing/shrinking along the life of entering/exiting methods into a continous block of memory, so it is most of the time already in a cache line of the Lx caches. Nowadays, processors are also quite well equipped at prefetching main memory to cache lines when there is a predictible memory access pattern. 

In .NET, there are many cases where this would help a lot. Typically for example, with Linq, which is an API that I usually forbid for any critical runtime, mainly because whenever you need to perform this simple match on a list:

```C#
var matchElement = list.FirstOrDefault(t => t.Name == name);

``` 

This harmless code above actually generates 2 allocations on the heap (!): 

- A first one because of the non-duck-typing-ability of Linq: Because all Linq extension methods are declared with `this IEnumerable<T> collection`, they are forcing the boxing of the struct returned by the duck-typing method [GetEnumerator](http://referencesource.microsoft.com/#mscorlib/system/collections/generic/list.cs,563) on the `List<T>`, which is used for example when you perform a `foreach` directly on the list.
- A second because of the closure that is translated by the compiler to a class object capturing the parameter/variable/field name and instantiated on the heap

while this more verbose code would not generate any allocation:

```C#
foreach (var matchElement in list)
{
    if (matchElement.Name == name)
    {
        return matchElement;	
    }
}
return null;

``` 

I have seen for example a brilliant recursive descent parser that was using monads/generics in C#, unfortunately, performance wise, It was actually really bad, due to the allocations occurring at each methods just to feed the parser state. 

Even if allocation on the gen 0 is quite fast (at least, way faster than a memalloc), and the allocated object is temporary (not store in a field/property), it is still slower than a local allocation on the stack (which is almost free, apart for a zeroing of the memory, that is part of the method prolog in .NET). It will also force a GC.Collect() at some point, a "stop the world" that will have to scan references on the stack (to check if any objects allocated on the heap is referenced by a variable on the stack).

When we know for sure that the object that we are going to instantiate and use will only live for the life of the current method, we should be able to instruct the compiler and runtime to generate an optimized path in this case.

## Language specs

So in order to support this scenario, we need to define how this is going to work in the CLR and how this will be declared and used from the language (C#).

- This is done first by introducing a new keyword `transient` to identify variable that cannot be stored outside of the stack.
- Then we can revisit the `stackalloc` operator to support the actual allocation on the stack.

### The `transient` variable modifier

Lets start by defining the concept of a `transient` variable:

> 1. A `transient` variable can only be declared for a local method variable or parameter, and cannot be used on a ref/out parameter.
> 2. A `transient` variable can only be assigned to another `transient` variable.
> 3. A `transient` variable can receive a non transient variable as long as types matches

```C#
public void Runner(transient MyProcessor processor)
{
    (...)

	var myProcessor = processor;  // is equivalent to an explicit declaration of:
	transient MyProcessor myProcessor2 = processor; 

	// We can access any method/property/field on this transient object
	processor.Run(...);

	// But we cannot store the transient variable into a non transient avariable 
	MyProcessor test = processor;  // won't compile
	// or cannot store it in a field/property
	myProcessorField = processor;  // won't compile

    (...)
}
```

When compiling the `transient` keyword, it would only be stored to a `TransientAttribute` for method parameters while all local variables would just be statically verified at compile time. The compiler should only ensure the rules defined above, nothing more.

This is introducing a new keyword, something that the language team is not going to take easily for granted!

### New `stackalloc` operator
 
If you have never used the `stackalloc` operator, it allows to instantiate an array of blittable valuetypes on the stack:

```C#   
	unsafe {
        // Allocate an array of int
        int* pInts = stackalloc int[5];
        // Allocate an array of Vector3 struct (which cannot contain any reference type)
        Vector3* stackalloc Vector3[4]
    }
```

But we notice that:

- it requires an `unsafe` context
- it doesn't allocate a .NET array but actually return only a pointer to the first element of the allocated array. You don't have access to a `Length` property nor you could use this return value with code expecting regular managed arrays.

In I ideal world, I would replace completely this old operator by a new behaviour that would allow both allocation on class/reference type on the stack, as well as array of class/structs (and not only blittable structs, as it is today). This is what I have choosen for my prototype as I found it much cleaner and I don't have to introduce a new keyword.  

In order to use the `stackalloc` operator, you can only assign it to a `transient` variable, like this:

```C#
	// Create a new instance of MyProcessor on the stack
	transient MyProcessor processor = stackalloc MyProcessor(...);

	processor.Run(...);
```

In the case of the lambda above, I haven't work out how the syntax would be used. The compiler could allow an implicit `stackalloc` operator when the parameter of the method receiving the argument is transient. But we still need a way to define how a lambda is declared transient, like prefixing my transient may be fine (but haven't checked in terms of parsing coherency):

```C#
    // Assume that the lambda is allocated on the stack excplitely when 
    // it is marked as `transient` or prefixed by `stackalloc`? 
    var matchElement = list.FirstOrDefault(transient t => t.Name == name);
```

# Implementation in Roslyn

You will notice from the [list of commits](https://github.com/xoofx/roslyn/commits/stackalloc_for_class) for this feature as implemented in the prototype that they are relatively small. 

The reason is that I haven't taken the time to implement the full syntax verification of the rules above (e.g a transient variable can only be assigned to another transient variable), but just wanted to support at least the `transient` keyword and generate proper IL bytecode for the `stackalloc` operator. It means that you need to be careful to respect the rules of a transient variable when trying this with this custom Roslyn version!

Also, in terms of IL code gen, I wanted the changes to be very limited and avoid completely any new IL opcodes. While I'm starting to explain the changes done in Roslyn, in practice, I had to make changes first to the CLR, and then implement the convenient bits into Roslyn once I was sure that I could make it run into the runtime!

I will try to explain the changes with a simple program. Let's compile this little code using the regular `new` operator:

```C#
public class Program
{
    public void Run() {}

    public static void Main(string[] args)
    {
        var program = new Program();
        program.Run();
    }
}
```

The main method will be translated to the following IL bytecode:

```
.method public hidebysig static void  Main(string[] args) cil managed
{
  .entrypoint
  // Code size       15 (0xf)
  .maxstack  1
  .locals init ([0] class Program program)
  IL_0000:  nop
  IL_0001:  newobj     instance void Program::.ctor()
  IL_0006:  stloc.0
  IL_0007:  ldloc.0
  IL_0008:  callvirt   instance void Program::Run()
  IL_000d:  nop
  IL_000e:  ret
} // end of method Program::Main

```

If you are not familiar with IL, it is a set of very basic instructions using a stack-based IL (load variable, store variable, take address, push arguments, call virtual method... etc.). In the generated code above, you will see that the local variable `program` is declared as a `class` (on the slot 0).

IL code manipulation is something that I have [abused a lot at the very beginning of SharpDX](https://github.com/sharpdx/SharpDX/blob/master/Source/Tools/SharpCli/InteropApp.cs) to allow, for example, to take the pointer to a generic parameter or transform a method call to a calli instruction in order to support COM mehod call. As someone asked on Twitter, I should one day write a little bit about it...      

So, let's go back to our little program. Now, if we replace the `new` operator by our new (doh!) `stackalloc` operator:

```C#
        var program = stackalloc Program();  // NOTICE: stackalloc instead of new!
        program.Run();
```

It will generated the following IL bytecode:

```
.method public hidebysig static void  Main(string[] args) cil managed
{
  .entrypoint
  // Code size       26 (0x1a)
  .maxstack  2
  .locals init ([0] class Program program,
           [1] valuetype Program V_1)
  IL_0000:  nop
  IL_0001:  ldloca.s   V_1
  IL_0003:  initobj    Program
  IL_0009:  ldloca.s   V_1
  IL_000b:  dup
  IL_000c:  call       instance void Program::.ctor()
  IL_0011:  stloc.0
  IL_0012:  ldloc.0
  IL_0013:  callvirt   instance void Program::Run()
  IL_0018:  nop
  IL_0019:  ret
} // end of method Program::Main
```

First, the changes to the declaration of local variables:

```
  .locals init ([0] class Program program,
           [1] valuetype Program V_1)
```

We are introducing a shadow variable [1] declared as a `valuetype` but using a token that is actually a class (!). If you try to run this assembly with a regular CLR, It will generate an invalid error with "unexpected valuetype", but in CoreCLR, we will ensure that the IL code reader/importer will allow this syntax.

Then we are going to initialize the class on the stack, exactly the same way a struct would be initialized. Note that unlike the `newobj` IL opcode instruction, we are not passing constructor parameters. This bytecode ensure that the class allocated on the stack is actually zeroed:

```
  IL_0001:  ldloca.s   V_1
  IL_0003:  initobj    Program
```

Then we are calling the actual constructor for the class, and storing the pointer/reference to the class on the stack to the variable program (our now `transient` variable):

```
  IL_0009:  ldloca.s   V_1
  IL_000b:  dup
  IL_000c:  call       instance void Program::.ctor()
  IL_0011:  stloc.0     // store into program variable
```

Then we can just call a regular method exactly like for an object allocated on the heap:

```
  IL_0012:  ldloc.0
  IL_0013:  callvirt   instance void Program::Run()
```

Note that my requirements of not introducing a new IL opcode was mainly motivated by the fact that I was not confident about the implications in the CLR, so I wanted to rely on stuff already working. I had only to patch existing code paths in CoreCLR in order to allow class to pass on the stack. It may be relevant that a new opcode could be used with a more compact syntax.

While it is a basic support of the `stackalloc` operator (I haven't implemented anything for array allocation for example), that's all we need to do to generate IL bytecode for at least a simple usecase.

Again, this whole serie of prototypes should not be considered as fully tested or safe. They are just proof of concept!   

# Implementation in CoreCLR

As I expected from my previous post, and unlike struct inheritance that was requiring just a 2 line changes, bringing `stackalloc` for class to the CoreCLR required significantly more **trial and crash ** steps in order to progressively reach a stable runtime.

As I'm not familiar with the CoreCLR codebase, It took me a bit of time to figure out where I should actually make these changes. Someone from the CoreCLR team would have most likely done this a bit more cleanly (and even differently)

> In summary, I made the choice to initialize the class on the stack with the same layout than as It would have been on the heap: It means that the class is prefixed by the 8 bytes struct `ObjHeader` which is holding some information required by the GC (more about it later why it has been implemented like this). 

I'm gonna try to give a bit more details about [the commits](https://github.com/xoofx/coreclr/commits/stackalloc_for_class) to support this `stackalloc` operator, what are the main changes to CoreCLR and what kind of problems I have encountered. In all the code changes, I have tried to prefix them by a `ClassAsValue`  message (here is just an highlight of the commits, there are a bit more in the branch):

### 1) [Disable test if we are using a Class as a valuetype (for .locals) ](https://github.com/xoofx/coreclr/commit/2fd97abce113ccb125e752adb316002e1b6420a6)

First step was to get rid of the exception that is verifying that a local variable cannot be declared with a class token. This is not super clean to allow token class for valuetype in all circumstances (it may be an invalid code not related to stackalloc), but in my case I didn't bother about this.

### 2) [Add getMethodTable and getBaseSize to CorInfo](https://github.com/xoofx/coreclr/commit/381d422e4cadac50468b1d47c95ed8548bb74b97) 

This commit is modifying the `ICorStaticInfo` to introduce two methods that will be used later by the code.


```cpp
	// Gets the full size of a class (not valuetype), including the methodtable pointer
	virtual unsigned getBaseSize(
		CORINFO_CLASS_HANDLE        cls
		) = 0;

	// Gets the method table for a class (Not valid for valueType)
	virtual void* getMethodTable(CORINFO_CLASS_HANDLE cls) = 0;
```

Basically, we need to be able to:

1. retrieve the full size of a class via the method `getBaseSize`. There is another method `getClassSize` in this interface, but this method returns in fact the size of a pointer for a reference type.
2. Allow to retrieve the current method table for a particular class. This will be required to instantiate and initialize the class on the stack.


### 3) Some changes to the file `/src/jit/lclvars.cpp`

This is where we are starting to store the information about local variables declared as class on the stack:

- [Add ReferenceType and method table information to LclVarDsc (variable description)](https://github.com/xoofx/coreclr/commit/a5270f4e3837fd292afeefbecc0a6f152ad872ad)
- [Fill the VariableDescription ReferenceType and MethodTable in lvaSetStruct. Let the CEEInfo::getClassGCLayout working on class.](https://github.com/xoofx/coreclr/commit/a232a0d27de942c5e684ac752608a9624fde92d9)

### 4) [Handle codegen of methodtable initialization for class as valuetype](https://github.com/xoofx/coreclr/commit/92252c1326daeb1d1067df3444f0675486eb4304)

This is a first commit that is generating some x64 code in order to initialize the method table of the object.

It is a first step to generate a compliant class layout on the stack. A class is only differentiated by the presence of this methodtable pointer (or commonly called `vtable`) at the `offset 0`. This is through this pointer that we can find type information, perform cast, find and call virtual methods...etc.

Notice that in the generated code here, I still don't output the small `ObjHeader` that is required for a GC object. It required a bit more changes.

### 5) Changes made to the `ObjHeader`

The commit [265453c4fd](https://github.com/xoofx/coreclr/commit/265453c4fd26e83ee957952fd442f58524bf76a2) is making the following changes:

- Add objheader_common.h that contains SIZEOF_OBJHEADER and can be used from eveywhere (as it was previously not accessible from JIT for example).  
- Always use a 8 bytes ObjHeader and add extra bits for Class Allocated on stack. 
- Update codegen to identity allocation on the stack.

The idea here is that I wanted to store the information of whether this instance is allocated on the stack directly on the object. So I'm using the `ObjHeader` and using an unused part of it (on x64 platform, while on x86, it is only 4 bytes so we would have to expand it). If the lower bit is set to 1, this current object is actually on the heap.

This information is later used in [GCHeap::Promote and GCHeap::Relocate, in order to skip reference that are allocated on the stack when performing a Garbabe Collect cycle](https://github.com/xoofx/coreclr/commit/1a73dcb9b1ca5b6a6857ba7c99cca9287a2ffb64)

I'm also making sure that when the class is allocated on the stack, we are allocating the space for the `ObjHeader`, and setting the flag allocate on stack in this `ObjHeader`.

Then there are a couple of commits to make [object.Validate()](https://github.com/xoofx/coreclr/commit/9b06c90e7895b088a33e4f195a990bb364041b7b) working. Lots of these checks are done in debug mode, but we still don't want to crash here. I have made the choice to almost bypass everything, but their could be additional checks for an object allocated on the stack...

> Note about the `ObjHeader`:
> If I had to rebuild an `ObjHeader` and had an opportunity to create a new language, I would completely remove support for `lock(object)` in the language, as these things can be done with dedicated mutex objects. The fact is that the `ObjHeader` can generates a shadow object called the `syncblk` that will contains the `hashcode` (if it was requested by a method), the monitor on the object, some stuff related to COM...etc. While I don't mind to have metadatas associated to object instance, having a cluttered `ObjHeader` that is basically encoding a pointer to this `syncblk` is restricting some interesting optims for the GC (for example, when I implemented a basic Immix GC, I used the `ObjHeader` to store the size of the object in order to quickly scan them without having to go through the `MethodTable` for example)  


### 6) [Generate proper x64 code for `initobj` opcode for class](https://github.com/xoofx/coreclr/commit/48a3840b0f006f50f8d03b31e258004b3a25bb90)

This commit is mostly dealing with generating proper code for the `initobj` keyword. The change mostly consist in shifting the current address loaded for `initobj` (recall above the `ldloca.s`), as it is pointing to the start of the object (including the methodtable pointer), but we don't want the `initobj` to clear this methodtable that is setup just once at the prolog of the method. So in the case of a `initobj` performed on a class on stack, we are shifting by a pointer size the start of the zeroing. 

### 7) [Use `JIT_CheckedWriteBarrier` instead of `JIT_WriteBarrier`](https://github.com/xoofx/coreclr/commit/e16f85f350ad43ee490d92cbbd658a148ab3e68a)

This was my last commit in order to get something working correctly with the GC. The JIT_CheckedWriteBarrier is basically a small shell around the regular [WriteBarrier](http://www.iecc.com/gclist/GC-algorithms.html) (a write barrier is used in the context of generational GC: whenever an object is stored in the field of another object, the write barrier allow to store somewhere in a cardtable the reference to the object that is receiving the reference source object in order to quickly identify which object should be scan - the object receiver - and which source object is most likely to be promoted - in case of the gen0 allocation)

The code of the CheckedWriteBarrier is:

```
LEAF_ENTRY JIT_CheckedWriteBarrier, _TEXT
        ; When WRITE_BARRIER_CHECK is defined _NotInHeap will write the reference
        ; but if it isn't then it will just return.
        ;
        ; See if this is in GCHeap
        cmp     rcx, [g_lowest_address]
        jb      NotInHeap
        cmp     rcx, [g_highest_address]
        jnb     NotInHeap
        
        jmp     JIT_WriteBarrier

    NotInHeap:
        ; See comment above about possible AV
        mov     [rcx], rdx
        ret
```
 
It is basically ensuring that we are not going to use a write barrier if our pointer is not on the HEAP, and this is exactly what we want for our class instantiated on the stack. If we start to store a heap object to a field of an object allocated on the stack, we want to early exit (without it, it would try to flag a cardtable bit into an invalid memory location).

I haven't measure the performance impact of getting through this small shell (`JIT_CheckedWriteBarrier` is actually used for ref pointers, as we don't know if a ref is on the stack - ref to a field struct - or the heap, so it is less used than `JIT_WriteBarrier`) so it may be an issue, but considering all the code involved afterwards for the barrier itself, it is still small, so that might not be a big issue. 

**Woot, And that's all!** If you compile the CoreCLR on this branch, you will get a basic support for stackalloc for class!

# Results and Sample

This is the sample program I used to test the implementation of the stackalloc for class:

```C#
using System;

public abstract class HelloClassOnStackBase
{
    private int valueBase;
	private Random random;
    private object unusedButCheckForGC1;
    private object unusedButCheckForGC2;

    protected HelloClassOnStackBase(Random random)
    {
        this.random = random;
        valueBase = (byte)random.Next();
    }

    public virtual int Compute(int x)
    {
        return valueBase + x;
    }
}

public class HelloClassOnStack : HelloClassOnStackBase
{
    private int addValue;

    public HelloClassOnStack(Random random) : base(random)
    {
        addValue = (byte)random.Next();
    }

    public override int Compute(int x)
    {
        var result = base.Compute(x);
        result += 1;
        return result;
    }
}

public class Program2
{
    public unsafe static void Main(string[] args)
    {
        // Don't use Stopwatch as it is not in mscorlib.dll
        var startTime = DateTime.Now;
        Console.WriteLine("Mode: {0}{1}", args.Length == 0 ? "StackAlloc" : "HeapAlloc", args.Length == 0 ? " . To switch to HeapAlloc, simply pass an argument to this exe" : string.Empty);

        Console.WriteLine("[before] GC gen0 collect: {0}", GC.CollectionCount(0));
        Console.WriteLine("[before] GC gen1 collect: {0}", GC.CollectionCount(1));
        Console.WriteLine("[before] GC gen2 collect: {0}", GC.CollectionCount(2));

        var random = new Random(0);
        int result = 0;
        const int Count = 10000000;

        if (args.Length > 0)
        {
            for (int i = 0; i < Count; i++)
            {
                // Alloc class on heap
                var hello = new HelloClassOnStack(random);
                result += hello.Compute(i);
            }
        }
        else
        {
            for (int i = 0; i < Count; i++)
            {
                // Alloc class on stack
                var hello = stackalloc HelloClassOnStack(random);
                result += hello.Compute(i);
            }
        }

        Console.WriteLine("Result: {0}", result);

        Console.WriteLine("[after] GC gen0 collect: {0}", GC.CollectionCount(0));
        Console.WriteLine("[after] GC gen1 collect: {0}", GC.CollectionCount(1));
        Console.WriteLine("[after] GC gen2 collect: {0}", GC.CollectionCount(2));

        Console.WriteLine("Elapsed: {0}ms", (DateTime.Now - startTime).TotalMilliseconds);
    }
}
```

If you run this sample without any args, it will allocate on the stack, otherwise if you pass an argument, it will allocate on the heap.

So? What are the results of these changes? If you run the program above:

- **The stack version will run in 400ms with 0 GC collect** 
- The **heap version will run in 5000ms with 100+ GC collect**

I don't claim that using stackalloc is always going to give you 10x times performance, but it is just to demonstrate that allocation on the heap hurts more than you would think!

# Next?

> Note: Its getting late and I haven't taken the time to upload a proper repo with the instructions to build all of this. I will try to do this later this week! Sorry!

This prototype demonstrate that stackalloc for class is something that could become real for .NET CoreCLR and could bring lots of opportunities for optimizations!

As it is only a prototype, I don't expect it to be back ported to CoreCLR anytime soon as-is, though I will push this to a PR just to get some feedback about the things that might be problematic in this proposal.

I'm also very happy to be able to play with the CLR, such a pleasure to be able to experiement things like this! Even if you don't agree with the changes, take this serie of CoreCLR/Roslyn posts as educational, at least, it is the case for me.

Not sure I will prototype all the other features soon (like the embed in class), but at least that you can find interesting bits here and there! 

Anyway, there is again a new toy in town, stackalloc for class, happy coding!