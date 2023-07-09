---
title: 10x Performance with SIMD Vectorized Code in C#/.NET
subtitle: Use your CPU at its full width!
ghcommentid: 12
tags:
 - C#
 - .NET
 - x86
 - assembler
comments: true
---

In the middle of my holidays, I was browsing my Mastodon feed and found an [interesting challenge](https://mastodon.social/@denisio@dotnet.social/110644302160625267), small enough that I don't have to spend days to figure this out, but also interesting because even such small problem is leading to some "tricky" usages of Intel SSE/AVX instructions - that I keep rediscovering (When getting older, I tend to forget these details! 😅 ).

The bulk of the challenge can be summarized as:

> How to find efficiently a specified `int` from an `int[]` using x86-64 SIMD instructions ?

I won't claim that the version described in this blog post is the fastest on earth, and so the goal of this blog post is more educational and about SIMD empowering: if you are not familiar with SIMD code or you feel intimidated about using them, please don't! They are fun to use and they can often give this satisfaction of the 10x performance benefit!

So let's look at the challenge...

## The Scalar version

The scalar code of this version is pretty simple:

```C#
static int FindSimple(ReadOnlySpan<int> data, int value)
{
    for (var i = 0; i < data.Length; i++)
        if (data[i] == value)
            return i;
    return -1;
}
```

I'm using the excellent [Disasmo](https://github.com/EgorBo/Disasmo/) Visual Studio Extension from Egor Bogatov to quickly grab the output assembly for such functions, just a `ALT+SHIFT+D` keyboard away, and boom! 😎


```nasm
; Assembly listing for method BenchFind.BenchmarkFinder:FindSimple_(System.ReadOnlySpan`1[int],int):int
; Emitting BLENDED_CODE for X64 CPU with AVX - Windows
; optimized code
; rsp based frame
; fully interruptible
; No PGO data
; 0 inlinees with PGO data; 1 single block inlinees; 0 inlinees without PGO data

G_M000_IG01:                ;; offset=0000H
 
G_M000_IG02:                ;; offset=0000H
       488B01               mov      rax, bword ptr [rcx]
       8B4908               mov      ecx, dword ptr [rcx+08H]
       4533C0               xor      r8d, r8d
       85C9                 test     ecx, ecx
       7E11                 jle      SHORT G_M000_IG04
                            align    [0 bytes for IG03]

; <<<<<<<<<<<<<< Loop - Starts here
G_M000_IG03:                ;; offset=000DH
       458BC8               mov      r9d, r8d
       42391488             cmp      dword ptr [rax+4*r9], edx
       740E                 je       SHORT G_M000_IG06
       41FFC0               inc      r8d
       443BC1               cmp      r8d, ecx
       7CEF                 jl       SHORT G_M000_IG03
; <<<<<<<<<<<<<< Loop - Ends here

G_M000_IG04:                ;; offset=001EH
       B8FFFFFFFF           mov      eax, -1
 
G_M000_IG05:                ;; offset=0023H
       C3                   ret      
 
G_M000_IG06:                ;; offset=0024H
       418BC0               mov      eax, r8d
 
G_M000_IG07:                ;; offset=0027H
       C3                   ret      
 
; Total bytes of code 40
```

Firstly, you will notice that I have slightly change the challenge from an `int[]` to use instead a `ReadOnlySpan<int>`. This is mainly to make the method usable with any runtime data layout: native buffer, managed buffer or stackalloc. 

> **Rule 1**: All .NET compute intensive code these days should use `ReadOnlySpan`/`Span` instead of arrays in order to allow more data input layout scenarios.

Secondly, you can also see that the generated ASM code above by the .NET JIT (`net7.0` version) is quite good enough, almost identical to the [generated C++ version](https://godbolt.org/z/njWKK33Gq). It is expected, as the .NET JIT is nowadays generating competitive code as long as inlining of critical functions is well performed and the register pressure is low (e.g you don't see registers being spilled out on the stack via the `rsp` register in critical loops)..

Thirdly, a cautious reader would suggest that this loop could be slightly more optimized with scalar CPU instructions by testing e.g 4 elements instead of only 1 per loop items, and that would be correct! But let's keep the scalar version as simple as it is, we will have more fun with the SIMD version. 🙂

## Generic SIMD Version

One of the cool addition to .NET 7 are generic SIMD code through via the namespace `System.Runtime.Intrinsics` that allows you to write SIMD code without dealing with specific CPU instructions, as long as the code stays simple and you can use the [various existing methods available](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.intrinsics.vector256?view=net-7.0#methods).

This is pretty cool because we can translate the previous scalar loop to a vectorized/SIMD loop with a generic SIMD code that is very simple and easy to follow.

Here is the generic `Vector128<int>` version that is able to process 4 ints per loop:

```c#
static int Find_Generic_128_(ReadOnlySpan<int> data, int value)
{
    // In theory we should check for Vector128.IsHardwareAccelerated and dispatch
    // accordingly, in practice here we don't to keep the code simple.
    var vInts = MemoryMarshal.Cast<int, Vector128<int>>(data);

    var compareValue = Vector128.Create(value);
    var vectorLength = Vector128<int>.Count;

    // Batch <4 x int> per loop
    for (var i = 0; i < vInts.Length; i++)
    {
        var result = Vector128.Equals(vInts[i], compareValue);
        if (result == Vector128<int>.Zero) continue;

        for (var k = 0; k < vectorLength; k++)
            if (result.GetElement(k) != 0)
                return i * vectorLength + k;
    }

    // Scalar process of the remaining
    for (var i = vInts.Length * vectorLength; i < data.Length; i++)
        if (data[i] == value)
            return i;

    return -1;
}
```

And the generic `Vector256<int>` version that is able to process 8 ints per loop:

```c#
static int Find_Generic_256_(ReadOnlySpan<int> data, int value)
{
    // In theory we should check for Vector256.IsHardwareAccelerated and dispatch
    // accordingly, in practice here we don't to keep the code simple.
    var vInts = MemoryMarshal.Cast<int, Vector256<int>>(data);

    var compareValue = Vector256.Create(value);
    var vectorLength = Vector256<int>.Count;

    // Batch <8 x int> per loop
    for (var i = 0; i < vInts.Length; i++)
    {
        var result = Vector256.Equals(vInts[i], compareValue);
        if (result == Vector256<int>.Zero) continue;

        for (var k = 0; k < vectorLength; k++)
            if (result.GetElement(k) != 0)
                return i * vectorLength + k;
    }

    // Scalar process of the remaining
    for (var i = vInts.Length * vectorLength; i < data.Length; i++)
        if (data[i] == value)
            return i;

    return -1;
}
```

The results of the benchmark are:

|                  Method |    N |         Mean |      Error |     StdDev |       Median | Ratio | RatioSD |
|------------------------ |----- |-------------:|-----------:|-----------:|-------------:|------:|--------:|
|             **Find_Simple** |   **32** |     **9.497 ns** |  **0.2087 ns** |  **0.2993 ns** |     **9.555 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |   32 |     4.572 ns |  0.0025 ns |  0.0020 ns |     4.572 ns |  0.48 |    0.01 |
|           Find_Generic_256 |   32 |     7.308 ns |  0.5040 ns |  1.4861 ns |     7.455 ns |  0.78 |    0.17 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |   **64** |    **16.557 ns** |  **0.3431 ns** |  **0.4580 ns** |    **16.622 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |   64 |     8.531 ns |  0.0269 ns |  0.0238 ns |     8.543 ns |  0.52 |    0.01 |
|           Find_Generic_256 |   64 |     6.626 ns |  0.0900 ns |  0.0752 ns |     6.589 ns |  0.41 |    0.01 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |  **128** |    **35.024 ns** |  **0.3709 ns** |  **0.3097 ns** |    **35.064 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |  128 |    15.533 ns |  0.0437 ns |  0.0341 ns |    15.546 ns |  0.44 |    0.00 |
|           Find_Generic_256 |  128 |    10.098 ns |  0.0235 ns |  0.0208 ns |    10.096 ns |  0.29 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |  **256** |    **64.626 ns** |  **1.1894 ns** |  **1.1126 ns** |    **64.496 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |  256 |    35.388 ns |  0.0965 ns |  0.0855 ns |    35.392 ns |  0.55 |    0.01 |
|           Find_Generic_256 |  256 |    16.866 ns |  0.0433 ns |  0.0384 ns |    16.881 ns |  0.26 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |  **512** |   **120.302 ns** |  **1.6310 ns** |  **1.5256 ns** |   **119.891 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |  512 |    63.086 ns |  0.1117 ns |  0.1044 ns |    63.058 ns |  0.52 |    0.01 |
|           Find_Generic_256 |  512 |    39.328 ns |  0.8087 ns |  2.3845 ns |    38.056 ns |  0.33 |    0.02 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** | **1024** |   **232.160 ns** |  **1.9791 ns** |  **1.8512 ns** |   **232.436 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 | 1024 |   119.290 ns |  0.2275 ns |  0.2017 ns |   119.350 ns |  0.51 |    0.00 |
|           Find_Generic_256 | 1024 |    65.283 ns |  0.1176 ns |  0.1100 ns |    65.236 ns |  0.28 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** | **4096** |   **894.287 ns** |  **3.6022 ns** |  **3.0080 ns** |   **894.541 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 | 4096 |   454.083 ns |  0.3423 ns |  0.3035 ns |   454.020 ns |  0.51 |    0.00 |
|           Find_Generic_256 | 4096 |   234.391 ns |  2.5310 ns |  2.1135 ns |   234.057 ns |  0.26 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** | **8192** | **1,796.290 ns** | **13.4828 ns** | **12.6118 ns** | **1,792.636 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 | 8192 |   901.999 ns |  1.8796 ns |  1.7582 ns |   902.707 ns |  0.50 |    0.00 |
|           Find_Generic_256 | 8192 |   465.352 ns |  5.0166 ns |  4.6925 ns |   462.971 ns |  0.26 |    0.00 |

The `Vector128.Equals(vInts[i], compareValue)` and `Vector256.Equals(vInts[i], compareValue)` generates a mask (int `-1`/`0xFFFF_FFFF`) when the value is equal, or zero otherwise.

We haven't optimized more than using just plain generic SIMD instructions, and this is already giving a **nice performance boost from 2x to 4x**. 😎

## CPU SIMD Optimized version

That's great, but if you are looking for performance, we can still go a bit further by using CPU specific SIMD intrinsics instructions with Intel x86-64. Let's have a look!

But first, what is wrong with the previous generic SIMD versions? If we look at the generated assembly for the SIMD 128 bit version, we will quickly find something suspicious:

```nasm
; Assembly listing for method BenchFind.BenchmarkFinder:Find_Generic_128_(System.ReadOnlySpan`1[int],int):int
; Emitting BLENDED_CODE for X64 CPU with AVX - Windows
; optimized code
; rsp based frame
; fully interruptible
; No PGO data
; 0 inlinees with PGO data; 8 single block inlinees; 1 inlinees without PGO data

G_M000_IG01:                ;; offset=0000H
       4883EC38             sub      rsp, 56
       C5F877               vzeroupper 
       33C0                 xor      eax, eax
       4889442428           mov      qword ptr [rsp+28H], rax
       4889442430           mov      qword ptr [rsp+30H], rax
 
G_M000_IG02:                ;; offset=0013H
       488B01               mov      rax, bword ptr [rcx]
       8B4908               mov      ecx, dword ptr [rcx+08H]
       448BC1               mov      r8d, ecx
       49C1E002             shl      r8, 2
       49C1E804             shr      r8, 4
       4981F8FFFFFF7F       cmp      r8, 0x7FFFFFFF
       0F8790000000         ja       G_M000_IG15
       C4E1796EC2           vmovd    xmm0, edx
       C4E27958C0           vpbroadcastd xmm0, xmm0
       4533C9               xor      r9d, r9d
       4585C0               test     r8d, r8d
       7E3F                 jle      SHORT G_M000_IG07
 
G_M000_IG03:                ;; offset=0043H
       458BD1               mov      r10d, r9d
       49C1E204             shl      r10, 4
       C4A179760C10         vpcmpeqd xmm1, xmm0, xmmword ptr [rax+r10]
       C4E27917C9           vptest   xmm1, xmm1
       7423                 je       SHORT G_M000_IG06
 
G_M000_IG04:                ;; offset=0057H
       4533D2               xor      r10d, r10d
       660F1F440000         align    [6 bytes for IG05]
 
G_M000_IG05:                ;; offset=0060H
       C4E179114C2428       vmovupd  xmmword ptr [rsp+28H], xmm1
       468B5C9428           mov      r11d, dword ptr [rsp+4*r10+28H]
       4585DB               test     r11d, r11d
       7547                 jne      SHORT G_M000_IG13
       41FFC2               inc      r10d
       4183FA04             cmp      r10d, 4
       7CE6                 jl       SHORT G_M000_IG05
 
G_M000_IG06:                ;; offset=007AH
       41FFC1               inc      r9d
       453BC8               cmp      r9d, r8d
       7CC1                 jl       SHORT G_M000_IG03
 
G_M000_IG07:                ;; offset=0082H
       41C1E002             shl      r8d, 2
       443BC1               cmp      r8d, ecx
       7D1B                 jge      SHORT G_M000_IG09
       0F1F440000           align    [5 bytes for IG08]
 
G_M000_IG08:                ;; offset=0090H
       443BC1               cmp      r8d, ecx
       7332                 jae      SHORT G_M000_IG16
       458BC8               mov      r9d, r8d
       42391488             cmp      dword ptr [rax+4*r9], edx
       7412                 je       SHORT G_M000_IG11
       41FFC0               inc      r8d
       443BC1               cmp      r8d, ecx
       7CEA                 jl       SHORT G_M000_IG08
 
G_M000_IG09:                ;; offset=00A6H
       B8FFFFFFFF           mov      eax, -1
 
G_M000_IG10:                ;; offset=00ABH
       4883C438             add      rsp, 56
       C3                   ret      
 
G_M000_IG11:                ;; offset=00B0H
       418BC0               mov      eax, r8d
 
G_M000_IG12:                ;; offset=00B3H
       4883C438             add      rsp, 56
       C3                   ret      
 
G_M000_IG13:                ;; offset=00B8H
       438D048A             lea      eax, [r10+4*r9]
 
G_M000_IG14:                ;; offset=00BCH
       4883C438             add      rsp, 56
       C3                   ret      
 
G_M000_IG15:                ;; offset=00C1H
       E8AA7BC35F           call     CORINFO_HELP_OVERFLOW
       CC                   int3     
 
G_M000_IG16:                ;; offset=00C7H
       E81480C35F           call     CORINFO_HELP_RNGCHKFAIL
       CC                   int3     
 
; Total bytes of code 205
```

The ASM code starts with `sub rsp, 56` which indicates that there is some stack spilling going on. It's not always a bad thing for long method, but for such a short compute intensive code, it might start to be a red flag, especially if the stack spilling occurs within a tight loop.

What is requiring this stack spill?

We can see it in the middle of the ASM code:

```nasm
G_M000_IG05:                ;; offset=0060H
       C4E179114C2428       vmovupd  xmmword ptr [rsp+28H], xmm1
       468B5C9428           mov      r11d, dword ptr [rsp+4*r10+28H]
       4585DB               test     r11d, r11d
       7547                 jne      SHORT G_M000_IG13
       41FFC2               inc      r10d
       4183FA04             cmp      r10d, 4
       7CE6                 jl       SHORT G_M000_IG05
```       

and this code is actually associated with the following C# code:


```c#
        // Will generate stack spilling!
        for (var k = 0; k < vectorLength; k++)
            if (result.GetElement(k) != 0)
                return i * vectorLength + k;
```                

D'oh! So this very inoffensive code is generating a back and forth from memory in order to check which int component in the `Vector128<int>` is actually matching! 😱

The stack spilling is not that terrible because this code only runs once we have a match, but for small input, it might adds up.

Ok, so let's optimize the SIMD version with some unsafe tricks, MOAR SIMD per loop and CPU specific intrinsics:

```C#
public static int Find_AVX_256_Optimized(ReadOnlySpan<int> data, int value)
{
    // Our data cursor
    ref var pv = ref MemoryMarshal.GetReference(data);

    var compareValue = Vector256.Create(value);
    nint length = data.Length;

    // Process 32 int (8 * 4) per loop (128 bytes)
    nint bound1024 = length & ~(Vector256<int>.Count * 4 - 1);
    nint i = 0;
    for (; i < bound1024; i += Vector256<int>.Count * 4)
    {
        var r1 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i)), compareValue);
        var r2 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i + Vector256<int>.Count)), compareValue);
        var r3 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i + Vector256<int>.Count * 2)), compareValue);
        var r4 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i + Vector256<int>.Count * 3)), compareValue);

        var r5 = r1 | r2 | r3 | r4;
        if (r5 != Vector256<int>.Zero)
        {
            // r12 = pack 32 to 16 of r1/r2
            var t = Avx2.Permute2x128(r1, r2, 0b_0010_0000);
            r2 = Avx2.Permute2x128(r1, r2, 0b_0011_0001);
            r1 = t;
            Vector256<short> r12 = Avx2.PackSignedSaturate(r1, r2).AsInt16();

            // r34 = pack 32 to 16 of r3/r4
            t = Avx2.Permute2x128(r3, r4, 0b_0010_0000);
            r4 = Avx2.Permute2x128(r3, r4, 0b_0011_0001);
            r3 = t;
            Vector256<short> r34 = Avx2.PackSignedSaturate(r3, r4).AsInt16();

            // pack 16 to 8 of r12/r34
            var t1 = Avx2.Permute2x128(r12, r34, 0b_0010_0000);
            r34 = Avx2.Permute2x128(r12, r34, 0b_0011_0001);
            r12 = t1;
            Vector256<sbyte> r = Avx2.PackSignedSaturate(r12, r34);

            // Get the mask from <8 x byte>
            var idx = Avx2.MoveMask(r);
            return (int)(i + BitOperations.TrailingZeroCount(idx));
        }
    }

    // Process 8 int per loop (32 bytes)
    nint bound256 = length & ~(Vector256<int>.Count - 1);
    for (; i < bound256; i += Vector256<int>.Count)
    {
        var r1 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i)), compareValue);
        if (r1 != Vector256<int>.Zero)
        {
            // Get the mask from <8 x int> to byte
            var rByte = Avx.MoveMask(r1.AsSingle());
            // And get the local index
            var idx = BitOperations.TrailingZeroCount((uint)rByte);
            return (int)(i + idx);
        }
    }

    // Process remaining
    for (; i < length; i++)
    {
        if (Unsafe.Add(ref pv, i) == value)
            return (int)i;
    }

    return -1;
}
```

And this code gets translated to the following optimized ASM code:

```nasm
; Assembly listing for method BenchFind.BatchFinder:Find_AVX2_256_Optimized(System.ReadOnlySpan`1[int],int):int
; Emitting BLENDED_CODE for X64 CPU with AVX - Windows
; optimized code
; rsp based frame
; fully interruptible
; No PGO data
; 2 inlinees with PGO data; 3 single block inlinees; 0 inlinees without PGO data

G_M000_IG01:                ;; offset=0000H
       C5F877               vzeroupper 
 
G_M000_IG02:                ;; offset=0003H
       488B01               mov      rax, bword ptr [rcx]
       C4E1796EC2           vmovd    xmm0, edx
       C4E27D58C0           vpbroadcastd ymm0, ymm0
       8B4908               mov      ecx, dword ptr [rcx+08H]
       4863C9               movsxd   rcx, ecx
       4C8BC1               mov      r8, rcx
       4983E0E0             and      r8, -32
       4533C9               xor      r9d, r9d
       4D85C0               test     r8, r8
       7E45                 jle      SHORT G_M000_IG04
                            align    [0 bytes for IG03]
 
G_M000_IG03:                ;; offset=0025H
       4D8BD1               mov      r10, r9
       49C1E202             shl      r10, 2
       C4A17D760C10         vpcmpeqd ymm1, ymm0, ymmword ptr[rax+r10]
       C4A17D76541020       vpcmpeqd ymm2, ymm0, ymmword ptr[rax+r10+20H]
       C4A17D765C1040       vpcmpeqd ymm3, ymm0, ymmword ptr[rax+r10+40H]
       C4A17D76641060       vpcmpeqd ymm4, ymm0, ymmword ptr[rax+r10+60H]
       C4E175EBEA           vpor     ymm5, ymm1, ymm2
       C4E155EBEB           vpor     ymm5, ymm5, ymm3
       C4E155EBEC           vpor     ymm5, ymm5, ymm4
       C4E27D17ED           vptest   ymm5, ymm5
       7571                 jne      SHORT G_M000_IG14
       4983C120             add      r9, 32
       4D3BC8               cmp      r9, r8
       7CBB                 jl       SHORT G_M000_IG03
 
G_M000_IG04:                ;; offset=006AH
       4C8BC1               mov      r8, rcx
       4983E0F8             and      r8, -8
       4D3BC8               cmp      r9, r8
       7D20                 jge      SHORT G_M000_IG06
       66660F1F840000000000 align    [10 bytes for IG05]
 
G_M000_IG05:                ;; offset=0080H
       C4A17D760C88         vpcmpeqd ymm1, ymm0, ymmword ptr[rax+4*r9]
       C4E27D17C9           vptest   ymm1, ymm1
       7531                 jne      SHORT G_M000_IG12
       4983C108             add      r9, 8
       4D3BC8               cmp      r9, r8
       7CEA                 jl       SHORT G_M000_IG05
 
G_M000_IG06:                ;; offset=0096H
       4C3BC9               cmp      r9, rcx
       7D13                 jge      SHORT G_M000_IG08
       0F1F440000           align    [5 bytes for IG07]
 
G_M000_IG07:                ;; offset=00A0H
       42391488             cmp      dword ptr [rax+4*r9], edx
       7411                 je       SHORT G_M000_IG10
       49FFC1               inc      r9
       4C3BC9               cmp      r9, rcx
       7CF2                 jl       SHORT G_M000_IG07
 
G_M000_IG08:                ;; offset=00AEH
       B8FFFFFFFF           mov      eax, -1
 
G_M000_IG09:                ;; offset=00B3H
       C5F877               vzeroupper 
       C3                   ret      
 
G_M000_IG10:                ;; offset=00B7H
       418BC1               mov      eax, r9d
 
G_M000_IG11:                ;; offset=00BAH
       C5F877               vzeroupper 
       C3                   ret      
 
G_M000_IG12:                ;; offset=00BEH
       C5FC50C1             vmovmskps yrax, ymm1
       F30FBCC0             tzcnt    eax, eax
       4103C1               add      eax, r9d
 
G_M000_IG13:                ;; offset=00C9H
       C5F877               vzeroupper 
       C3                   ret      
 
G_M000_IG14:                ;; offset=00CDH
       C4E37546C220         vperm2i128 ymm0, ymm1, ymm2, 32
       C4E37546D231         vperm2i128 ymm2, ymm1, ymm2, 49
       C5FC28C8             vmovaps  ymm1, ymm0
       C4E36546C420         vperm2i128 ymm0, ymm3, ymm4, 32
       C4E36546E431         vperm2i128 ymm4, ymm3, ymm4, 49
       C5FD6BC4             vpackssdw ymm0, ymm0, ymm4
       C5F56BCA             vpackssdw ymm1, ymm1, ymm2
       C4E37546D020         vperm2i128 ymm2, ymm1, ymm0, 32
       C4E37546C031         vperm2i128 ymm0, ymm1, ymm0, 49
       C5ED63C0             vpacksswb ymm0, ymm2, ymm0
       C5FDD7C0             vpmovmskb eax, ymm0
       F30FBCC0             tzcnt    eax, eax
       4103C1               add      eax, r9d
 
G_M000_IG15:                ;; offset=010CH
       C5F877               vzeroupper 
       C3                   ret      
 
; Total bytes of code 272
```

So in order to further optimize our code, we have followed a few very simple rules and used some specific Intel instructions:

* Using a `ref` data cursor instead of `ReadOnlySpan`.
* Using `nint` instead of `int` indexer.
* Using more batches.
* Using specific Intel intrinsics tricks.

Let's have a look at them.

### Using ref

Firstly, we are going to use a `ref` data cursor instead of accessing the `ReadOnlySpan<int>`, this is done with the first instruction:

```c#
    // Our data cursor
    ref var pv = ref MemoryMarshal.GetReference(data);
```

The benefit of doing this is that it will remove all bounds checks that you can still see around in the generic version (because some patterns are not fully detected). We are using a `ref` instead of an unsafe `*` pointer for the reason that we still want our code to be GC friendly. Using a `ref` here allows the GC to update this pointer if necessary (if the pointed data is being moved by the GC) while a fixed/pinned statement would block the GC for moving this data around.

### Using nint

Secondly, we need to return an index to the data, so we are declaring the variable `nint i = 0;` at the beginning that we will keep between the different batch groups. Now you might wonder why using `nint` instead of a `int`? `nint` is a shorthand for `System.IntPtr` and matches the CPU register size. It helps the compiler to avoid generating many up-casting from int32 to int64 in various places (`movsxd` instructions). In the generic `ReadOnlySpan<int>` SIMD version, you won't see this `movsxd` instructions, because the compiler is able to detect such pattern, but because in our case we are keeping a single variable across the different batch groups (next section), the compiler won't notice this and will generate these spurious `movsxd`.

### Using more batches

Thirdly, we want to increase the batch, so that the cost of the loop is reduced compared to the code doing the actual computation. In the previous generic `Vector128<int>` version, the compute intensive loop is like this and there is almost as much code to run the loop than to perform the actual computation:

```nasm
G_M000_IG03:                ;; offset=0043H
       458BD1               mov      r10d, r9d
       49C1E204             shl      r10, 4
       ; <<<<<<< Actual computation code - starts
       C4A179760C10         vpcmpeqd xmm1, xmm0, xmmword ptr [rax+r10]
       C4E27917C9           vptest   xmm1, xmm1
       7423                 je       SHORT G_M000_IG06
       ; >>>>>>> Actual computation code - ends

; [...] skipping some lines

G_M000_IG06:                ;; offset=007AH
       41FFC1               inc      r9d
       453BC8               cmp      r9d, r8d
       7CC1                 jl       SHORT G_M000_IG03
```

So, we are breaking our code into 3 loops:

* A first loop that can process `4` x `Vector256<int>`, so 128 bytes per loop item
* A remaining loop that can process `1` x `Vector256<int>`, so 32 bytes per loop item
* And the remaining scalar loop

Another trick is to minimize the computation when we haven't found an item, even in the case of the `4` x `Vector256<int>`. The trick here is to generate a single branch for checking if we have a match by `OR|`ing the `4` comparisons and only check the result of the `OR|`ing:

```c#
        var r1 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i)), compareValue);
        var r2 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i + Vector256<int>.Count)), compareValue);
        var r3 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i + Vector256<int>.Count * 2)), compareValue);
        var r4 = Vector256.Equals(Unsafe.As<int, Vector256<int>>(ref Unsafe.Add(ref pv, i + Vector256<int>.Count * 3)), compareValue);

        var r5 = r1 | r2 | r3 | r4;
        if (r5 != Vector256<int>.Zero)
        {
            // .... We have found something!
        }
```        

And here is how our loop looks like now:

```nasm
G_M000_IG03:                ;; offset=0025H
       4D8BD1               mov      r10, r9
       49C1E202             shl      r10, 2
       C4A17D760C10         vpcmpeqd ymm1, ymm0, ymmword ptr[rax+r10]
       C4A17D76541020       vpcmpeqd ymm2, ymm0, ymmword ptr[rax+r10+20H]
       C4A17D765C1040       vpcmpeqd ymm3, ymm0, ymmword ptr[rax+r10+40H]
       C4A17D76641060       vpcmpeqd ymm4, ymm0, ymmword ptr[rax+r10+60H]
       C4E175EBEA           vpor     ymm5, ymm1, ymm2
       C4E155EBEB           vpor     ymm5, ymm5, ymm3
       C4E155EBEC           vpor     ymm5, ymm5, ymm4
       C4E27D17ED           vptest   ymm5, ymm5
       7571                 jne      SHORT G_M000_IG14
       4983C120             add      r9, 32
       4D3BC8               cmp      r9, r8
       7CBB                 jl       SHORT G_M000_IG03
```

It shows that we are doing more compute work than the loop machinery (`add r9, 32`, `cmp r9, r8`...etc.) and it helps to lower its cost. Compared to the generic version, we have now multiple instructions involved that are processing **4 times more data per loop**! 

### Using CPU intrinsics

Now, how can we avoid the stack spilling by not using `Vector256<T>.GetElement(index)`? By using specific SSE/AVX instructions!

For the first `4` x `Vector256<int>` batch, we are using the following code to compute the index of the first element found without using any branches:

```
if (r5 != Vector256<int>.Zero)
{
    // r12 = pack 32 to 16 of r1/r2
    var t = Avx2.Permute2x128(r1, r2, 0b_0010_0000);
    r2 = Avx2.Permute2x128(r1, r2, 0b_0011_0001);
    r1 = t;
    Vector256<short> r12 = Avx2.PackSignedSaturate(r1, r2).AsInt16();

    // r34 = pack 32 to 16 of r3/r4
    t = Avx2.Permute2x128(r3, r4, 0b_0010_0000);
    r4 = Avx2.Permute2x128(r3, r4, 0b_0011_0001);
    r3 = t;
    Vector256<short> r34 = Avx2.PackSignedSaturate(r3, r4).AsInt16();

    // pack 16 to 8 of r12/r34
    var t1 = Avx2.Permute2x128(r12, r34, 0b_0010_0000);
    r34 = Avx2.Permute2x128(r12, r34, 0b_0011_0001);
    r12 = t1;
    Vector256<sbyte> r = Avx2.PackSignedSaturate(r12, r34);

    // Get the mask from <8 x byte>
    var idx = Avx2.MoveMask(r);
    return (int)(i + BitOperations.TrailingZeroCount(idx));
}
```

So we have `4` x `Vector256<int>` registers in `r1`, `r2`, `r3`, `r4`, and what we are going to do is to downcast these `32` x `int` to `32` x `byte`, so a single `Vector256<byte>` register, and from there, there is an instruction (`movemask`) from generating a mask for each byte.



I'm always using the [Intel Intrinsics Guide](https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html) to look at these functions. If you look at the comment of the functions, you will see the CPU instruction name `VPERM2I128`:

```c#
    /// <summary>
    ///   <para>__m256i _mm256_permute2x128_si256 (__m256i a, __m256i b, const int imm8)</para>
    ///   <para>VPERM2I128 ymm, ymm, ymm/m256, imm8</para>
    /// </summary>
    /// <param name="left" />
    /// <param name="right" />
    /// <param name="control" />
    public new static Vector256<int> Permute2x128(
      Vector256<int> left,
      Vector256<int> right,
      byte control)
```      
 
Which expands to this manual [here](https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html#text=VPERM2I128&ig_expand=4962). 

It gives a description `Shuffle 128-bits (composed of integer data) selected by imm8 from a and b, and store the results in dst.` but this is too vague to really understand how this intruction works. But the good thing is that we have the details of the instructions defined via a pseudo microcode:

```
__m256i _mm256_permute2x128_si256 (__m256i a, __m256i b, const int imm8)

DEFINE SELECT4(src1, src2, control) {
	CASE(control[1:0]) OF
	0:	tmp[127:0] := src1[127:0]
	1:	tmp[127:0] := src1[255:128]
	2:	tmp[127:0] := src2[127:0]
	3:	tmp[127:0] := src2[255:128]
	ESAC
	IF control[3]
		tmp[127:0] := 0
	FI
	RETURN tmp[127:0]
}
dst[127:0] := SELECT4(a[255:0], b[255:0], imm8[3:0])
dst[255:128] := SELECT4(a[255:0], b[255:0], imm8[7:4])
dst[MAX:256] := 0
```

So we are using it like this:

```c#
    var t = Avx2.Permute2x128(r1, r2, 0b_0010_0000);
    r2 = Avx2.Permute2x128(r1, r2, 0b_0011_0001);
    r1 = t;
```

The first `0b_0010_0000` is going to translate to:
* `imm8[3:0] = 0`
* `imm8[7:4] = 2`
while the second `0b_0011_0001` is translating to:
* `imm8[3:0] = 1`
* `imm8[7:4] = 3`

And basically, this instruction with these control byte are packing the low and high 128 bits part together of the two r1/r2 registers:

![vperm2i128](/images/vperm2i128.drawio.svg)

Why are we performing such swap? Because most of the AVX2 SIMD instructions are working on interleaved SIMD 128 lanes, and the instruction `PackSignedSaturate(Vector256<int> left, Vector256<int> right)` which is the instrinsic [VPACKSSDW/_mm256_packs_epi32](https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html#text=_mm256_packs_epi32&ig_expand=4962,4892) is defined like this:

```
__m256i _mm256_packs_epi32 (__m256i a, __m256i b)

dst[15:0] := Saturate16(a[31:0])          ; a[127:0]
dst[31:16] := Saturate16(a[63:32])
dst[47:32] := Saturate16(a[95:64])
dst[63:48] := Saturate16(a[127:96])

dst[79:64] := Saturate16(b[31:0])         ; b[128:0]
dst[95:80] := Saturate16(b[63:32])
dst[111:96] := Saturate16(b[95:64])
dst[127:112] := Saturate16(b[127:96])

dst[143:128] := Saturate16(a[159:128])    ; a[255:128]
dst[159:144] := Saturate16(a[191:160])
dst[175:160] := Saturate16(a[223:192])
dst[191:176] := Saturate16(a[255:224])

dst[207:192] := Saturate16(b[159:128])    ; b[255:128]
dst[223:208] := Saturate16(b[191:160])
dst[239:224] := Saturate16(b[223:192])
dst[255:240] := Saturate16(b[255:224])
dst[MAX:256] := 0
```

Notice that the function is first processing `a[127:0]`, then `b[128:0]`, then `a[255:128]` and then `b[255:128]`!

That's why we need to swap the 128 parts around in order to keep the order of the data.

We further reduce from `int` to `short`, and from `short` to `byte`.

The last SIMD instruction `Avx2.MoveMask(Vector256<byte>)` (intrinsic [_mm256_movemask_epi8](https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html#text=_mm256_movemask_epi8&ig_expand=4962,4635)) is compressing the 32 bytes into 32 bits.

```
int _mm256_movemask_epi8 (__m256i a)

FOR j := 0 to 31
	i := j*8
	dst[j] := a[i+7]
ENDFOR
```

We can then extract the local position within these 32 bytes by using `BitOperations.TrailingZeroCount(int)`.

Similarly, the loop processing `1` x `Vector256<int>` is using the `Avx2.MoveMask(Vector256<float>)` to compute this index per int directly from the `Vector256<int>` result of the comparison. As you can see, the signature is using a float (!) while it does work on a 32 int as well, which is super convenient. There are plenty of instructions like this in SSE/AVX that looks like they are only relevant for floating point while they do work also for integer types.

## Results

And the results of the benchmark is giving a significant boost for the optimized version, **from 4x to 10x** performance boost!

|                  Method |    N |         Mean |      Error |     StdDev |       Median | Ratio | RatioSD |
|------------------------ |----- |-------------:|-----------:|-----------:|-------------:|------:|--------:|
|             **Find_Simple** |   **32** |     **9.497 ns** |  **0.2087 ns** |  **0.2993 ns** |     **9.555 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |   32 |     4.572 ns |  0.0025 ns |  0.0020 ns |     4.572 ns |  0.48 |    0.01 |
|           Find_Generic_256 |   32 |     7.308 ns |  0.5040 ns |  1.4861 ns |     7.455 ns |  0.78 |    0.17 |
| Find_AVX2_256_Optimized |   32 |     2.398 ns |  0.0085 ns |  0.0075 ns |     2.397 ns |  0.25 |    0.01 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |   **64** |    **16.557 ns** |  **0.3431 ns** |  **0.4580 ns** |    **16.622 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |   64 |     8.531 ns |  0.0269 ns |  0.0238 ns |     8.543 ns |  0.52 |    0.01 |
|           Find_Generic_256 |   64 |     6.626 ns |  0.0900 ns |  0.0752 ns |     6.589 ns |  0.41 |    0.01 |
| Find_AVX2_256_Optimized |   64 |     2.936 ns |  0.0161 ns |  0.0143 ns |     2.935 ns |  0.18 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |  **128** |    **35.024 ns** |  **0.3709 ns** |  **0.3097 ns** |    **35.064 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |  128 |    15.533 ns |  0.0437 ns |  0.0341 ns |    15.546 ns |  0.44 |    0.00 |
|           Find_Generic_256 |  128 |    10.098 ns |  0.0235 ns |  0.0208 ns |    10.096 ns |  0.29 |    0.00 |
| Find_AVX2_256_Optimized |  128 |     5.223 ns |  0.0132 ns |  0.0117 ns |     5.221 ns |  0.15 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |  **256** |    **64.626 ns** |  **1.1894 ns** |  **1.1126 ns** |    **64.496 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |  256 |    35.388 ns |  0.0965 ns |  0.0855 ns |    35.392 ns |  0.55 |    0.01 |
|           Find_Generic_256 |  256 |    16.866 ns |  0.0433 ns |  0.0384 ns |    16.881 ns |  0.26 |    0.00 |
| Find_AVX2_256_Optimized |  256 |    10.103 ns |  0.0524 ns |  0.0491 ns |    10.131 ns |  0.16 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** |  **512** |   **120.302 ns** |  **1.6310 ns** |  **1.5256 ns** |   **119.891 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 |  512 |    63.086 ns |  0.1117 ns |  0.1044 ns |    63.058 ns |  0.52 |    0.01 |
|           Find_Generic_256 |  512 |    39.328 ns |  0.8087 ns |  2.3845 ns |    38.056 ns |  0.33 |    0.02 |
| Find_AVX2_256_Optimized |  512 |    15.840 ns |  0.0257 ns |  0.0215 ns |    15.842 ns |  0.13 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** | **1024** |   **232.160 ns** |  **1.9791 ns** |  **1.8512 ns** |   **232.436 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 | 1024 |   119.290 ns |  0.2275 ns |  0.2017 ns |   119.350 ns |  0.51 |    0.00 |
|           Find_Generic_256 | 1024 |    65.283 ns |  0.1176 ns |  0.1100 ns |    65.236 ns |  0.28 |    0.00 |
| Find_AVX2_256_Optimized | 1024 |    28.667 ns |  0.0405 ns |  0.0359 ns |    28.656 ns |  0.12 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** | **4096** |   **894.287 ns** |  **3.6022 ns** |  **3.0080 ns** |   **894.541 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 | 4096 |   454.083 ns |  0.3423 ns |  0.3035 ns |   454.020 ns |  0.51 |    0.00 |
|           Find_Generic_256 | 4096 |   234.391 ns |  2.5310 ns |  2.1135 ns |   234.057 ns |  0.26 |    0.00 |
| Find_AVX2_256_Optimized | 4096 |   113.839 ns |  0.5868 ns |  0.5489 ns |   113.575 ns |  0.13 |    0.00 |
|                         |      |              |            |            |              |       |         |
|             **Find_Simple** | **8192** | **1,796.290 ns** | **13.4828 ns** | **12.6118 ns** | **1,792.636 ns** |  **1.00** |    **0.00** |
|            Find_Generic_128 | 8192 |   901.999 ns |  1.8796 ns |  1.7582 ns |   902.707 ns |  0.50 |    0.00 |
|           Find_Generic_256 | 8192 |   465.352 ns |  5.0166 ns |  4.6925 ns |   462.971 ns |  0.26 |    0.00 |
| Find_AVX2_256_Optimized | 8192 |   183.790 ns |  0.8620 ns |  0.8063 ns |   183.384 ns |  0.10 |    0.00 |

## Final words

Nowadays, large and small processing of data is requiring going full width on the CPU in order to achieve optimal performance - before going wider on the CPU cores. It is no surprise that the .NET Teams have been optimizing already the .NET Base Class Libraries (BCL) for several years with such intrinsics. See all the .NET Performance blog posts from Stephen Toub for [.NET 5](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-5/), [.NET 6](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-6/) and [.NET 7](https://devblogs.microsoft.com/dotnet/performance_improvements_in_net_7/)), it will give you a - huge! - glimpse of what is happening there. Simple functions like `string.IndexOf(char)` are using these intrinsics under the hood and are able to be completely implemented in C# without the need to a fallback to C++.

This simple case shows also that C++ compiler won't be able to optimize (here, auto-vectorize) such case without specific compiler pattern matching (and I haven't seen any implementing this one in particular), and so, in that case, it makes sense to implement such optimized loops with .NET Vector intrinsics and CPU intrinsics to deliver the best performance.

More specifically, Intel intrinsics can be involved in more algorithm tricks than their ARM counterparts, and that's the cool and fun part of this: Figuring out how to best use them!

Happy coding! 🤗
