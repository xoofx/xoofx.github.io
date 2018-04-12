---
layout: post
title: Writing a Managed JIT in C# with CoreCLR
tags:
 - C#
 - .NET
 - CoreCLR
comments: true
---

As you may know, in .NET CoreCLR (and Mono), the JIT has been entirely written in C/C++. That's sometimes even a joke used by C++ developers to remind the enthusiastic C# developer crowd that their ecosystem is being actually ran by C++. And that's the story of any new language (including C), a simple chicken-egg story, that requires to use an existing, more primitive, language and compiler (and at the origin, sometimes you couldn't even, and you had to write directly assembly code using numbers! In the end, we all come from stars no? ;) ) to be able to create a new language and compiler... That being said, if you look at a few programming language stories, you will find that quite often, after bootstrapping a new language, their compiler is often re-written at some point in the language itself. Go compiler for example was originally written in C and was than later - around 2015 - written in Go itself. And this is something that has been always fascinating me... what if we could do the same thing for the .NET JIT by using C#?

While this blog post - and associated [GitHub repo](https://github.com/xoofx/ManagedJit) - shows a hack, not sustainable for many reasons - that I will give details at the end, I would like still to share this crazy idea and dig into how to hack this with C# and CoreCLR!

## The behind story

It all started last week while I was looking at some native code generated from .NET C# by using the amazing online [sharplab.io](https://sharplab.io) tool:

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr"><a href="https://twitter.com/ashmind?ref_src=twsrc%5Etfw">@ashmind</a> looking at this SharpLab issue <a href="https://t.co/5FELwBz6Tw">https://t.co/5FELwBz6Tw</a>  about getting asm from .NET Core... I think that I would come up with a quick working hack, would you be interested?</p>&mdash; Alexandre Mutel (@xoofx) <a href="https://twitter.com/xoofx/status/982512062541725696?ref_src=twsrc%5Etfw">April 7, 2018</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

Actually, by looking at the original issue, it reminded me that I could use a similar technique to a project I released on CodePlex around 10 years ago - in 2008! time flies - called [NetAsm](https://archive.codeplex.com/?p=netasm):

> NetAsm provides a hook to the .NET JIT compiler and enables to inject your own native code in replacement of the default CLR JIT compilation. With this library, it is possible, at runtime, to inject x86 assembler code in CLR methods with the speed of a pure CLR method call and without the cost of Interop/PInvoke calls. 

I wrote even a [full user guide](https://github.com/xoofx/ManagedJit/blob/master/netasm/src/Doc/NetAsm-UserGuide-1.0.pdf) - I was probably a bit crazy or really too optimistic about it! Anyway, it didn't last, as a small update to the .NET 3.5 Runtime at that time was able to break this little library. Unfortunately, NetAsm was mainly based on what we were able to know about the underlying runtime at this time, through the [Rotor/SSCLI 2.0 source code project released in 2006](https://blogs.msdn.microsoft.com/jasonz/2006/03/23/rotor-sscli-2-0-ships/), but we couldn't access to any updates made after this date...

But when looking at it, and the fact that CoreCLR is now OSS, the solution presented at this time is still completely workable. Note that this work was mainly based on a hacking idea taken from [_.NET Internals and Native Compiling_](http://www.ntcore.com/Files/netint_native.htm) done by Daniel Pistelli (though while searching for a link here, I found that he wrote also on CodeProject [_.NET Internals and Code Injection_](https://www.codeproject.com/Articles/26060/NET-Internals-and-Code-Injection) that looks even closer to what I did with NetAsm, though don't remember to have read this one...)  . He was a very prolific writer about .NET internals, he developed [CFF Explorer](http://www.ntcore.com/exsuite.php) that is a PE explorer that supports .NET metadata... I'm still using it after all these years!

At that time, I was not able to get a solution entirely in C#, so I used a C++ solution and as far as I know, all existing solutions around the net will use the same setup. Thankfully, with a bit more experience in the meantime, I finally found a workaround to get this running in C#, without any C++ code in the middle. That makes it maybe the first JIT implemented in C# for .NET?

Actually, while writing this lines, I found this post about [_Analyzing the nasty .NET protection of the Ploutus.D malware._](http://antonioparata.blogspot.fr/2018/02/analyzing-nasty-net-protection-of.html) and it seems that a  malware written in C# is hooking into a similar way that I'm going to describe here... Interesting!

So let's see how this is working.

## The sample

The simple following program from the repository [`ManagedJit`](https://github.com/xoofx/ManagedJit) shows how it is used in practice:

```c#
class Program
{
    static void Main(string[] args)
    {
        // Create our Managed Jit compiler
        using (var clrJit = ManagedJit.GetOrCreate())
        {
            // It will print `1 + 2 = 4!` instead of the expected 3
            var result = JitReplaceAdd(1, 2);
            Console.WriteLine($"{nameof(JitReplaceAdd)}: 1 + 2 = {result}!");
        }
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    public static int JitReplaceAdd(int a, int b) => a + b;
}
```

will actually print:

```
JitReplaceAdd: 1 + 2 = 4!
```

instead of `JitReplaceAdd: 1 + 2 = 3!`

All of this is done by hacking into the JIT compiler and not by using the well known other technique of post-patching the code via `RuntimeHelpers.PrepareMethod` and `MethodInfo.MethodHandle.GetFunctionPointer()` (though we will see that we are somewhat forced to post-patch at JIT time, more on that later)

## The `ICorJitCompiler`

CoreCLR is pretty modular, and the JIT is sitting into its own shared library called `clrjit.dll` (For .NET Framework, that was in `mscorjit.dll`)

In fact, the Jit is exposed through a simple exported symbol from the shared library [`getJit`](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corjit.h#L382):

```C#
extern "C" ICorJitCompiler* __stdcall getJit();
```

It returns a very minimalist interface [`ICorJitCompiler`](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corjit.h#L391) which contains a few pure C++ virtual methods (the `= 0` at the end of the method declaration, this is important to how we can hack into this), and most notably, the first method is the famous [`compileMethod`](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corjit.h#L394-L411) that is called ultimately by a typical `MethodDesc::MakeJitWorker` whenever it needs to JIT a managed method to native code:

```C#
class ICorJitCompiler
{
public:
    // compileMethod is the main routine to ask the JIT Compiler to create native code for a method. The
    // method to be compiled is passed in the 'info' parameter, and the code:ICorJitInfo is used to allow the
    // JIT to resolve tokens, and make any other callbacks needed to create the code. nativeEntry, and
    // nativeSizeOfCode are just for convenience because the JIT asks the EE for the memory to emit code into
    // (see code:ICorJitInfo.allocMem), so really the EE already knows where the method starts and how big
    // it is (in fact, it could be in more than one chunk).
    // 
    // * In the 32 bit jit this is implemented by code:CILJit.compileMethod
    // * For the 64 bit jit this is implemented by code:PreJit.compileMethod
    // 
    // Note: Obfuscators that are hacking the JIT depend on this method having __stdcall calling convention
    virtual CorJitResult __stdcall compileMethod (
            ICorJitInfo                 *comp,               /* IN */
            struct CORINFO_METHOD_INFO  *info,               /* IN */
            unsigned /* code:CorJitFlag */   flags,          /* IN */
            BYTE                        **nativeEntry,       /* OUT */
            ULONG                       *nativeSizeOfCode    /* OUT */
            ) = 0;
    ...
```

## Hacking into the JIT

So we know the entry point and how the JIT compiler method is exposed, but for the cautious reader, there is some kind of inception in this chicken-egg story... **how can we JIT in C# while we are being Jitted?**

### Detecting the JIT

The first step is to load this `clrjit.dll`, fetch the `getJit()` method... but also check that we will be able to work with the specific version loaded...

So in the static initializer of our [ManagedJit class](https://github.com/xoofx/ManagedJit/blob/master/ManagedJit/ManagedJit.cs):

- We iterate on the modules loaded by the process 
- Find a module named `clrjit.dll`
- Find the function `getJit` exported from it (The following code will only work on Windows, as we are using `GetProcAddress` and we don't have a portable way ot getting this from a module handle, though hopefully, this will come through this issue on corefx [_"Helper class for dealing with native shared libraries and function pointers "_](github.com/dotnet/corefx/issues/17135))
- Then we need to check the version via the method provided `ICorJitCompiler::getVersionIdentifier` that returns a `GUID` that is stored in the `corjit.h`. Why? Because the `ICorJitInfo` provided as a first parameter to `ICorJitCompiler::compileMethod` is being changed constantly, methods are being added to this interface, and as we are late binding on these methods via an index in the vtable, the index can change, so we need to verify that we bind to a known Jit version we can work with.


```C#
foreach (ProcessModule module in process.Modules)
{
    if (Path.GetFileName(module.FileName) == "clrjit.dll")
    {
        // This is the address of ICorJitCompiler
        // https://github.com/dotnet/coreclr/blob/bb01fb0d954c957a36f3f8c7aad19657afc2ceda/src/inc/corjit.h#L391-L445
        var jitAddress = GetProcAddress(module.BaseAddress, "getJit");
        if (jitAddress != IntPtr.Zero)
        {
            var getJit = (GetJitDelegate) Marshal.GetDelegateForFunctionPointer(jitAddress, typeof(GetJitDelegate));
            var jit = getJit();
            if (jit != IntPtr.Zero)
            {
                JitVtable = Marshal.ReadIntPtr(jit);

                // Check JitVersion
                var getVersionIdentifierPtr = Marshal.ReadIntPtr(JitVtable, IntPtr.Size * getVersionIdentifierVTableIndex);
                var getVersionIdentifier = (GetVersionIdentifierDelegate)Marshal.GetDelegateForFunctionPointer(getVersionIdentifierPtr, typeof(GetVersionIdentifierDelegate));
                getVersionIdentifier(jitAddress, out var version);
                if (version != ExpectedJitVersion)
                {
                    return;
                }

                // If version, ok, get CompileMethod
                DefaultCompileMethodPtr = Marshal.ReadIntPtr(JitVtable, IntPtr.Size * CompileMethodVTableIndex);
                DefaultCompileMethod = (CompileMethodDelegate) Marshal.GetDelegateForFunctionPointer(DefaultCompileMethodPtr, typeof(CompileMethodDelegate));
            }
        }
        break;
    }
}
```

You can see that we are fetching some Vtable information. If you are not familiar with this, let me explained a bit how C++ objects with pure virtual methods and single inheritance are exposed:

1) We get a pointer to the vtable of the instance of the returned `ICorJitCompiler`:

A vtable is simply an array of pointers to virtual methods implementations, unique for one implementation the `ICorJitCompiler`. As this is an interface (in the sense of C#), the implementation will be provided by another type (typically in CoreCLR, we have `CILJit` but also many "interceptors" JIT...etc.)

The implementation respects a vtable ABI to expose the methods of its interface (C++ compiler specific, but luckily, enough accepted that it is valid across compilers, and we can reason about from C#). This pattern is add the base of how COM objects are working, with the root interface `IUnknown` that provides basic lifecycling (reference count through AddReference/Release), but also extensibility by allowing through the `QueryInterface(GUID, IUnknown** outInterface)` to expose other interfaces from an existing IUnknown implementation.

```C#
             CILJit Instance
jit ->      +--------------+                  CILJit vtable
        [0] |  JitVtable   |  ---->     +-------------------------+
            +--------------+        [0] + compileMethodPtr        +     ----->  MyJitImplementation::compileMethod(...) {  .... }
        [8] | field0...    |        [8] + clearCachePtr           +
            | field1...    |        [_] + ...                     +
            | ...          |        [32]+ getVersionIdentifierPtr +
            +--------------+        [_] + ...                     +
                                        +-------------------------+

So with the following code:

```C#
JitVtable = Marshal.ReadIntPtr(jit);
```

We are simply loading the `JitVtable` pointer that is used later to fetch the `getVersionIdentifier` and `compileMethod` methods:

```C#
var getVersionIdentifierPtr = Marshal.ReadIntPtr(JitVtable, IntPtr.Size * getVersionIdentifierVTableIndex);
var getVersionIdentifier = (GetVersionIdentifierDelegate)Marshal.GetDelegateForFunctionPointer(getVersionIdentifierPtr, typeof(GetVersionIdentifierDelegate));
```

If you have already used A C# delegate to wrap a a native function, this is exactly what we are doing here by using `Marshal.GetDelegateForFunctionPointer`. The only difference is that our delegate takes the hidden this parameter of the object instance:

```C#
[UnmanagedFunctionPointer(CallingConvention.Cdecl)]
private delegate void GetVersionIdentifierDelegate(IntPtr thisPtr, out Guid versionIdentifier /* OUT */);
```

The `ExpectedJitVersion` in our `ManagedJit` class is a Guid directly extracted from [`corinfo.h`](https://github.com/dotnet/coreclr/blob/bb01fb0d954c957a36f3f8c7aad19657afc2ceda/src/inc/corinfo.h#L191-L221):

```C++
//////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE
//
// #JITEEVersionIdentifier
//
// This GUID represents the version of the JIT/EE interface. Any time the interface between the JIT and
// the EE changes (by adding or removing methods to any interface shared between them), this GUID should
// be changed. This is the identifier verified by ICorJitCompiler::getVersionIdentifier().
//
// You can use "uuidgen.exe -s" to generate this value.
//
// **** NOTE TO INTEGRATORS:
//
// If there is a merge conflict here, because the version changed in two different places, you must
// create a **NEW** GUID, not simply choose one or the other!
//
// NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////


#if !defined(SELECTANY)
    #define SELECTANY extern __declspec(selectany)
#endif


SELECTANY const GUID JITEEVersionIdentifier = { /* f00b3f49-ddd2-49be-ba43-6e49ffa66959 */
    0xf00b3f49,
    0xddd2,
    0x49be,
    { 0xba, 0x43, 0x6e, 0x49, 0xff, 0xa6, 0x69, 0x59 }
};
```

This is important to check this version, because the offset in the vtable will likely change on new versions of CoreCLR.

### Hacking the `compileMethod`

Ok, we got a pointer to the jit vTable and a delegate to the original `compileMethod`, now we need to plug our own C# method in-place of the existing.

So the basic approach, as described earlier with the vtable of `ICorJitCompiler` is to modify the first entry of `compileMethod` (for which we have already saved the pointer and create a managed delegate from it) to call our C# implemented `compileMethod`.

But in order to do this, this is where it gets a bit more tricky:

#### 1) Store `CompileMethodDelegate` of our `ManagedJit.CompileMethod` instance method

This is the very first step. We need to create a delegate `CompileMethodDelegate` that is going to be re-routed to an instance method `CompileMethod` of our `ManagedJit`:

```C#
// 1) Converts a reference to our compile method to a `CompileMethodDelegate`
_overrideCompileMethod = CompileMethod;
```

Why storing it? Because as we are going after to store an unmanaged reference to this delegate in the vtable, we need to make sure that the GC will not collect our delegate in the mean time! This is a very common pattern whenever you have to pass a Delegate as a function pointer from C# to C++.

#### 2) Create a trampoline delegate `CompileMethodDelegate` to simulate a native call to our managed delegate

You may wonder why we need to create another delegate indirection. This reflects the way C# managed delegates are exposed to C++.

When you create a C++ function pointer from an existing C# delegate with `Marshal.GetFunctionPointerForDelegate`, il will create a JIT trampoline, that once called, will be compiled to generate the actual code to handle the transition from C++ to managed. This transition requires typically to switch the GC from preemptive (in C++, a method can be interrupted at any time by the GC in order to quickly do its work) to cooperative (in C#/,NET the GC works closely with the program and will interrupt you only on know places).

I haven't looked into the implementation details, but the JIT is actually involved in this process. For example, in this great post from Matt Warren [How do .NET delegates work?](http://mattwarren.org/2017/01/25/How-do-.NET-delegates-work/), Matt is describing how the JIT is involved for standard delegates (or also delegates that end-up through a PInvoke) But in our case, we are exposing a C# delegate that is going to be called by native code, **often called reverse P/Invoke**. 

So this `Marshal.GetFunctionPointerForDelegate` will generate a reverse thunk function, but the JIT will still have to compile something on-demand when the delegate will be actually called by C++...

And you can understand now why we need this: If we don't try to force the compilation of this delegate, and we put our `_overrideCompileMethodPtr` directly in the vtable, the JIT will go into a recursive loop, while trying to access our delegate, it will try to compile it (because it is actually used in the "reversed" case, from C++ to managed) and this will just generate a StackOverflowException at some point. This is probably an error I got when I tried to do this with NetAsm and I end up doing this work in C++ instead.

So with this knowledge, what we need to do is to **simulate a reverse P/Invoke call to our delegate**, and this is where we are going to create a trampoline:

```C#
// 2) Build a trampoline that will allow to simulate a call from native to our delegate
_overrideCompileMethodPtr = Marshal.GetFunctionPointerForDelegate(_overrideCompileMethod);
var trampolinePtr = AllocateTrampoline(_overrideCompileMethodPtr);
var trampoline = (CompileMethodDelegate)Marshal.GetDelegateForFunctionPointer(trampolinePtr, typeof(CompileMethodDelegate));
```

So what does the magical `AllocateTrampoline`? It is some native code that will call our delegate. In x64, we simply create this trampoline like this:

``` C#
private static readonly byte[] DelegateTrampolineCode = {
    // mov rax, 0000000000000000h ;Pointer address to _overrideCompileMethodPtr
    0x48, 0xB8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // jmp rax
    0xFF, 0xE0
};

...

private static IntPtr AllocateTrampoline(IntPtr ptr)
{
    // Create an executable region of code in memory
    var jmpNative = VirtualAlloc(IntPtr.Zero, DelegateTrampolineCode.Length, AllocationType.Commit, MemoryProtection.ExecuteReadWrite);
    // Copy our trampoline code there
    Marshal.Copy(DelegateTrampolineCode, 0, jmpNative, DelegateTrampolineCode.Length);
    // Setup the delegate we want to call as part of a reverse P/Invoke call
    Marshal.WriteIntPtr(jmpNative, 2, ptr);
    return jmpNative;
}
```

Now that our trampoline is in place, we can call the trampoline that will call our delegate (in the meantime it will call the existing JIT to compile the reverse delegate) that will call ultimately our `ManagedJit.CompileMethod` method:

```C#
// 3) Call our trampoline
IntPtr value;
int size;
var emptyInfo = default(CORINFO_METHOD_INFO);
trampoline(IntPtr.Zero, IntPtr.Zero, ref emptyInfo, 0, out value, out size);
FreeTrampoline(trampolinePtr);
```

What we get with this calling sequence is that the Jit will compile the delegate, but also, will compile partially our Jit Method.

Note that in the code above, we are passing `IntPtr.Zero` to allow to call our `CompileMethod`, so we handle this gracefully in the code to early exit, as we know that it until our JIT is not hooked up, we don't need to proceed further:

```C#
    private int CompileMethod(
        IntPtr thisPtr,
        IntPtr comp, // ICorJitInfo* comp, /* IN */
        ref CORINFO_METHOD_INFO info, // struct CORINFO_METHOD_INFO  *info,               /* IN */
        uint flags, // unsigned /* code:CorJitFlag */   flags,          /* IN */
        out IntPtr nativeEntry, // BYTE                        **nativeEntry,       /* OUT */
        out int nativeSizeOfCode // ULONG* nativeSizeOfCode    /* OUT */
    )
    {
        // Early exit gracefully. We are entering this if when calling the trampoline
        // As our JIT is not yet compile, but we still want this method to be compiled by the 
        // original JIT!
        if (!_isHookInstalled)
        {
            nativeEntry = IntPtr.Zero;
            nativeSizeOfCode = 0;
            return 0;
        }
        ...
```

This is important to let also the existing JIT to compile our future JIT method, otherwise, we would end-up in the same chicken-egg problem as the reverse delegate. So by letting the JIT compile our `CompileMethod` before installing it, then, we are able to install it.

#### 3) Install our JIT

So we just need to patch the first pointer of the `JitVtable` that contains a pointer to the `compileMethod`:

```C#
// 4) Once our `CompileMethodDelegate` can be accessible from native code, we can install it
InstallManagedJit(_overrideCompileMethodPtr);
_isHookInstalled = true;

private static void InstallManagedJit(IntPtr compileMethodPtr)
{
    // We need to unprotect the JitVtable as it is by default not read-write
    // It is usually a C++ VTable generated at compile time and placed into a read-only section in the shared library
    VirtualProtect(JitVtable + CompileMethodVTableIndex, new IntPtr(IntPtr.Size), MemoryProtection.ReadWrite, out var oldFlags);
    Marshal.WriteIntPtr(JitVtable, CompileMethodVTableIndex, compileMethodPtr);
    VirtualProtect(JitVtable + CompileMethodVTableIndex, new IntPtr(IntPtr.Size), oldFlags, out oldFlags);
}
```

You can see that it is more convoluted than expected. The reason is that the JitVtable is originally read-only. If we try to write to this location, you will get an `AccessMemoryViolationException`. So here we are temporarily changing the protection of the memory in order to write our pointer to our delegate C# JIT compiler method. We restore the protection just after.


So, are we installed? Yes, after the call to `InstallManagedJit` any new method that has not been compiled will go into our `CompileMethod`, **our C# Managed JIT is now active!**

### Writing the ManagedJit.CompileMethod

So, this blog post is maybe a bit misleading, as we you don't expect me to write an entire JIT in C# right? Instead we are going to do a very simple hardcoded JIT that will be able to recognize our sample function `JitReplaceAdd` and provide a different native code.

But first, we need to sort out a few bits.

#### 1) Workaround to the JIT re-entrancy

Now that we have our JIT in C#, the code involved could go very deeply, spread on many classes that haven't been already JIT compiled... So we are in a similar situation where we need the original JIT to compile our JIT while it is being run (I told you, I should have called it InceptionJIT!)

What we can do is simply to use a counter to track when we enter our JIT (counter++) and when we leave from our method (counter--)

```C#
var compileEntry = _compileTls ?? (_compileTls = new CompileTls());
compileEntry.EnterCount++;
try
{
    // We always let the default JIT compile the method
    var result = DefaultCompileMethod(thisPtr, comp, ref info, flags, out nativeEntry, out nativeSizeOfCode);

    // If we are at a top level method to compile, we wil recompile it
    if (compileEntry.EnterCount == 1)
    {
        // Call our replace JIT method
    }
    else 
    {
        // Call the default  JIT compile the method
        result = DefaultCompileMethod(thisPtr, comp, ref info, flags, out nativeEntry, out nativeSizeOfCode);
    }

    return result;
}
finally
{
    compileEntry.EnterCount--;
}
```

This code is using a thread static local storage, as the JIT can be used from multiple thread, so we have basically a re-entrancy counter per thread.

- We increment the counter
- If the counter == 1, it means that it is a user method being compiled, so we can call our JIT
- Otherwise, it is a method of our C# JIT that needs to be compiled, and we let the original JIT handle it
- We decrement the counter

#### 2) Accessing `System.Reflection` from native information

If you look at the ICorJitCompiler::compileMethod, we have several parameters that gives us the context of the method to compile:

```C++
    virtual CorJitResult __stdcall compileMethod (
            ICorJitInfo                 *comp,               /* IN */
            struct CORINFO_METHOD_INFO  *info,               /* IN */
            unsigned /* code:CorJitFlag */   flags,          /* IN */
            BYTE                        **nativeEntry,       /* OUT */
            ULONG                       *nativeSizeOfCode    /* OUT */
            ) = 0;
```

- `ICorJitInfo` declared [here in `corjit.h` CoreCLR](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corjit.h#L459) is the interface provided by the EE to allow the JIT to query metadata for the method to compile. Typically, this is where you can ask a type, resolve a .NET metadata token, get the number of parameters of a method, get its name, get the name of its declaring class...etc. 
  But you can see that it actually derives from `ICorDynamicInfo` declared [in `corinfo.h` here](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corinfo.h#L2803) and that `ICorDynamicInfo` derives from `ICorStaticInfo` declared [in `corinfo.h` here](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corinfo.h#L1946)
  In total, we the inheritance, we have **more than 160+ methods in these interfaces!** That's a lot!
- `CORINFO_METHOD_INFO*` provides a pointer to a structure that gives some information of the method being compiled, declared [in `corinfo.h` here](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corinfo.h#L1194-L1206)
  ```C#
    struct CORINFO_METHOD_INFO
    {
        CORINFO_METHOD_HANDLE       ftn;
        CORINFO_MODULE_HANDLE       scope;
        BYTE *                      ILCode;
        unsigned                    ILCodeSize;
        unsigned                    maxStack;
        unsigned                    EHcount;
        CorInfoOptions              options;
        CorInfoRegionKind           regionKind;
        CORINFO_SIG_INFO            args;
        CORINFO_SIG_INFO            locals;
    };
  ```
- some flags, and pointers out for `nativeEntry` and `nativeSizeOfCode` that will contain executable native code generated by the JIT

This is very different from what we have in C# right? We don't have access to `System.Reflection`... and for the JIT this is important, because it requires to have access directly the the information in memory, without generating allocations or duplicating the information (what `System.Reflection` is doing basically), so that's why there is a need for this very low level interface.

Ok, but we are in C#, I would like to have access to the corresponding `MethodInfo` from `System.Reflection`, how does it work to get there? The idea is to use as less as possible `ICorJitInfo` because it is laborious to access it (as this work is not automated in this hack, but could be done easily with a proper C++ to C# codegen)

The steps are:

1. Get the .NET IL token of the method being compiled
   We can query this by using the method `ICorJitInfo::getMethodDefFromMethod` declared [in `corinfo.h` here](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corinfo.h#L2760-L2764)

   ```C#
    var vtableCorJitInfo = Marshal.ReadIntPtr(comp);

    var getMethodDefFromMethodPtr = Marshal.ReadIntPtr(vtableCorJitInfo, IntPtr.Size * ICorJitInfo_getMethodDefFromMethod_index);
    var getMethodDefFromMethod = (GetMethodDefFromMethodDelegate)Marshal.GetDelegateForFunctionPointer(getMethodDefFromMethodPtr, typeof(GetMethodDefFromMethodDelegate));
    var methodToken = getMethodDefFromMethod(comp, info.ftn);
   ```

2. We need to get the equivalent `System.Reflection.Assembly` for the method being compiled. Unfortunately, this part is a bit more convoluted, as I haven't found an easy to do this. 
   The idea is to query an assembly handle from `ICorJitInfo::getModuleAssembly` from the current IL module of the method. Than with this handle, we can iterate on the assemblies in the AppDomain, compare the name of the assembly, and if we can find it, we will store a reference to it.

   ```C#
    var getModuleAssemblyDelegatePtr = Marshal.ReadIntPtr(vtableCorJitInfo, IntPtr.Size * ICorJitInfo_getModuleAssembly_index);
    var getModuleAssemblyDelegate = (GetModuleAssemblyDelegate)Marshal.GetDelegateForFunctionPointer(getModuleAssemblyDelegatePtr, typeof(GetModuleAssemblyDelegate));
    var assemblyHandle = getModuleAssemblyDelegate(comp, info.scope);

    // Check if this assembly was not already found
    Assembly assemblyFound;

    // Map AssemblyHandle to the Managed Assembly instance
    // (use JitLock and MapHandleToAssembly, as the CompileMethod can be called concurrently from different threads)
    lock (JitLock)
    {
        if (!MapHandleToAssembly.TryGetValue(assemblyHandle, out assemblyFound))
        {
            var getAssemblyNamePtr = Marshal.ReadIntPtr(vtableCorJitInfo, IntPtr.Size * 44);
            var getAssemblyName = (GetAssemblyNameDelegate)Marshal.GetDelegateForFunctionPointer(getAssemblyNamePtr, typeof(GetAssemblyNameDelegate));
            var assemblyNamePtr = getAssemblyName(comp, assemblyHandle);

            var assemblyName = Marshal.PtrToStringAnsi(assemblyNamePtr);

            // TODO: Very inefficient way of finding the assembly
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                if (assembly.GetName().Name == assemblyName)
                {
                    assemblyFound = assembly;
                    break;
                }
            }

            // Register the assembly
            MapHandleToAssembly.Add(assemblyHandle, assemblyFound);
        }
    }   
   ```

3. Once we have the token and managed assembly, we can simply query for the `MethodBase` managed object:

   ```C#
    // Find the method with the token
    MethodBase method = null;
    if (assemblyFound != null)
    {
        foreach (var module in assemblyFound.Modules)
        {
            try
            {
                method = module.ResolveMethod(methodToken);
            }
            catch (Exception)
            {
            }
        }
    }
   ```
4. If we have found the method, we can call our method replacer:

   ```C#
    if (method != null)
    {
        ReplaceCompile(method, info.ILCode, info.ILCodeSize, nativeEntry, nativeSizeOfCode);
    }   
   ```


#### 3) Writing our actual JIT method replacer

This is our simple JIT that going to replace the method `JitReplaceAdd` with some custom code:

```C#
private void ReplaceCompile(MethodBase method, IntPtr ilCodePtr, int ilSize, IntPtr nativeCodePtr, int nativeCodeSize)
{
    if (method.Name != nameof(Program.JitReplaceAdd))
    {
        return;
    }

    // Instead of: public static int JitReplaceAdd(int a, int b) => a + b;
    // This code generates: a + b + 1

    // 0:  01 d1 add    ecx,edx
    // 2:  89 c8 mov    eax,ecx
    // 4:  ff c0        inc eax
    // 6:  c3 ret

    var instructions = new byte[]
    {
        0x01, 0xD1, 0x89, 0xC8, 0xFF, 0xC0, 0xC3
    };
    
    Marshal.Copy(instructions, 0, nativeCodePtr, instructions.Length);
}
```

As we have a static method, the first parameter `int a` is passed to `ecx` register, and `int b` is passed to `edx` (in the x64 calling convention of the CLR). Then we simply add the two, put the result in `eax` which is in the x64 ABI expected to be the result of the function, and we increment the `eax` value just to provide a feedback that it is our actual JIT code that is running.

I have used this handy online https://defuse.ca/online-x86-assembler.htm x86/x64 asm/disasm compiler to generate the code above.

#### 4) But and the GC?

You may wonder from the previous code something weird: We are actually not allocating the `nativeCodePtr` and `nativeCodeSize`, how can this work?

Well, this is a hack, and actually, not really sustainable, because in order to fully integrate into CoreCLR, we would need, not only to generate the native code, but also to provide GC information.

This is usually done by using some of the following `ICorJitInfo` methods:

- [`ICorJitInfo ::allocMem`](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corjit.h#L466-L475) to alocate JIT memory code (with support for hot/cold path, a cold path being for example typically a catch that should not happen often)
  ```C++
      virtual void allocMem (
            ULONG               hotCodeSize,    /* IN */
            ULONG               coldCodeSize,   /* IN */
            ULONG               roDataSize,     /* IN */
            ULONG               xcptnsCount,    /* IN */
            CorJitAllocMemFlag  flag,           /* IN */
            void **             hotCodeBlock,   /* OUT */
            void **             coldCodeBlock,  /* OUT */
            void **             roDataBlock     /* OUT */
            ) = 0;
  ```
- [`ICorJitInfo ::allocGCInfo`](https://github.com/dotnet/coreclr/blob/c51aa9006c035ccdf8aab2e9a363637e8c6e31da/src/inc/corjit.h#L525-L527) 
  ```C++
      virtual void * allocGCInfo (
            size_t                  size        /* IN */
            ) = 0;
  ```
- And more...

The problem with GCInfo is that it is a bit stream that is used currently by CoreCLR by using some dedicated C MACROS to write to it... I found that for a hack, going through exposing this in C# would be very cumbersome... 

So because we can't generate easily these GCInfo, which in the end, are used by the GC to know if a method has managed objects, where...etc. We still need to generate this information, otherwise I was getting this error while trying to run my method:

```
Assert failure(PID 10704 [0x000029d0], Thread: 10960 [0x2ad0]): pBuffer != NULL

CORECLR! BitStreamReader::BitStreamReader + 0x2E (0x00007ff9`557f7c4e)
CORECLR! GcInfoDecoder::GcInfoDecoder + 0x3B (0x00007ff9`5608962b)
CORECLR! EECodeManager::GetFunctionSize + 0x162 (0x00007ff9`55cd7ba2)
CORECLR! EEJitManager::JitTokenToMethodRegionInfo + 0x2FC (0x00007ff9`557ae90c)
CORECLR! EECodeInfo::GetMethodRegionInfo + 0x66 (0x00007ff9`557a5cc6)
CORECLR! ETW::MethodLog::SendMethodEvent + 0x6CA (0x00007ff9`55820eca)
CORECLR! ETW::MethodLog::MethodJitted + 0x20E (0x00007ff9`5581880e)
CORECLR! MethodDesc::MakeJitWorker + 0xB03 (0x00007ff9`55b1b063)
CORECLR! MethodDesc::DoPrestub + 0x1083 (0x00007ff9`55b16733)
CORECLR! PreStubWorker + 0x45A (0x00007ff9`55b1f1ba)
    File: c:\code\dotnet\coreclr\src\inc\gcinfodecoder.h Line: 240
    Image: C:\code\dotnet\coreclr\bin\Product\Windows_NT.x64.Debug\CoreRun.exe
``` 

You can see that the GC is expecting some GCInfo to be allocated and not empty! In my original code, I was just using `allocMem` and that was obviously not enough.

So... As this is just a hack, let's just use the original JIT to compile method, generates proper GCInfo, and then, we can replace the code with our native code (that's why I was talking earlier about the fact that this hack is actually post-patching at JIT time the code... so it is not entirely a full self contained JIT that can work alone on this). But by doing this, we can get the whole stuff running and replacing our code!

## Final words

A few years ago, when I prototyped the idea of implementing [gcix](https://github.com/xoofx/gcix) the GC Immix in C++ (and also in C#) from the paper [_"Immix: A Mark-Region Garbage Collector with
Space Efficiency, Fast Collection, and Mutator Performance ∗"_](http://www.cs.williams.edu/~dbarowy/cs334s18/assets/immix-pldi-2008.pdf) I was amazed to discover that they were using the JVM [Jikes RVM](http://www.jikesrvm.org) (I heard about it back in the days when I was working in Java, but it was not yet developed and alive), to implement the full VM, including the JIT and the GC in Java! I found this option very powerful and the fact that they were able to design a new advanced JIT based on this confirmed that it was able to open lots of opportunities...

Now, for the .NET ecosystem, that's not easy: The years of development on the existing JIT code, GC code...etc has been made in C++, and it is not because C# would be slow (contrary to a common naive belief), as as we are demonstrating with our work on the `burst` compiler at Unity that we can generate code even more efficient than C++... but because there is a huge legacy code that is already working there. The benefits to have a Managed JIT wouldn't be visible in shor-term or even medium-term while it could open many possibilities in the long run, but for a project of the - legacy - size of .NET, this is probably too much to ask. 

Is there any possible life beyond this prototype? Well, it would require some work to expose - automatically - the whole `ICorJitInfo` interface (and to be even more resilient to changes by supporting more dynamically the changes in the API), along also interfacing correctly with the GC. If I had free paid time, I would certainly quite enjoy developing a full managed C# JIT/AOT compiler, but maybe someone in the OSS and/or academic world will try to challenge this idea?!

Anyway, I find this whole hack very cool to develop, so in the meantime, you can also enjoy toying with this C# ManagedJit hack!

Happy coding!
