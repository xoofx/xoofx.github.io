---
layout: post
title: Slow Visual Studio 2015 on large projects
tags:
 - Visual Studio 2015
 - Roslyn
comments: true
---

At work, we have switched to VS2015 and have been experiencing so far lots of "Visual Studio Not Responding" while editing the code. I first thought that it was ReSharper crawling VS. Then I tried to disable almost all extensions, but still while typing into a C# file, sometimes VS could get stuck for more than 10+ seconds!

Digging a bit more into this problem with xperf (with the shiny new WPR and WPA tools from Windows 10 SDK!) I discovered that it was mainly due to the GC (and maybe Roslyn) burning the CPU and the memory (If you are a C++ programmer, you can laugh at it, for sure). Here is a screenshot of the xperf report:

<a href="/images/VS2015_Roslyn_GC.jpg" title="Result of a xperf on a Visual Studio 2015 not responding" class="image-popup">
	<img src="/images/VS2015_Roslyn_GC.jpg">			
</a>

You can see on the diagram that the GC is blocked in a `gc_heap/gc1` phase, while there is no particular reason for that. Also when you look more closely at the diagram, it is occupying a full core for more than 20+ seconds.

I was wondering why the hell the GC is triggered even if I don't see to modify heavily the memory (even if Roslyn can be memory consuming, come on...), so I looked at the Roslyn repo to find out any explicit GC handling and found this code in [GCManager](https://github.com/dotnet/roslyn/blob/master/src/VisualStudio/Core/Def/Implementation/GCManager.cs#L61):

Every 5 seconds you stop typing into a file, this code is triggered:

```C#
    // hint to the GC that if it postponed a gen 2 collection, now might be a good time to do it.
    GC.Collect(2, GCCollectionMode.Optimized);
```

Basically, Roslyn is putting the GC in the `SustainedLowLatency` mode whenever you type a character/cut/paste modify the current document, and restore the normal GC mode after 5 seconds and perform this optimized collect. I was quite intrigued by this (and not sure about how the `GCCollectionMode.Optimized` is actually working internally...), but it turns out that you can disable this behaviour via a single registry key:

```
[HKEY_CURRENT_USER\Software\Microsoft\VisualStudio\14.0\Performance]
"SustainedLowLatencyDuration"=dword:00000000
``` 

I don't know if it is a placebo effect, but I'm getting a bit less "Not Responding" from VS2015 for the past few days. At least, I'm not completely stuck, as last Friday, It was impossible for me to work. But one of my co-worker that is having the same problem tried the registry trick but it didn't seem to make a difference... Sadly also, I tried to reproduce this issue with a plain C# app without any luck so... most likely because the memory scenario that is causing this GC slowness is not easily reproducible.

But it looks like there is a bug somewhere in Visual Studio 2015 with the GC... Incidentally, someone on the MVP mailing list was complaining about a bug in the GC of .NET 4.6 that was slowing down its app by a factor of x10, and I completely forgot this issue that I saw a couple of weeks ago : "[Gen2 free list changes in CLR 4.6 GC](http://blogs.msdn.com/b/maoni/archive/2015/08/12/gen2-free-list-changes-in-clr-4-6-gc.aspx)".

**Could it be that it is in fact the original bug that is making our VS2015 experience so painful and horrible?**

My wild guess: Roslyn Syntax Trees are more likely to end-up quickly in a Gen2 memory section, while editing a single file (or doing a refactoring on many different files), with the immutable architecture of Roslyn, would cause to sparsely un-reference some objects from Gen2... the GC could then hit the bug described above... Anyway, hope that the VS/CLR team can solve this quickly!

Are you experiencing this kind of issues as well? Let me know!

___

### Side notes about ReSharper and Roslyn
  
On a side note, I was not really happy to learn last year that ReSharper would not consider to rely on Roslyn to build their productivity tool, as I was afraid about the double of work.

It is quite confirmed by Visual Studio 2015: When using ReSharper, the memory goes from 500Mo VS2015 to a whopping 1.2Go on our project. The problem with the GC described above is getting worse in this scenario also.

ReSharper said that they didn't want to rewrite their whole code/tests for it, something that I can understand... But whenever someone will built powerful additions (navigation, refactor, code gen) on top of Roslyn (and it is now quite easier with it) I will most likely switch to it, as there is no doubt that it will save lots of memory and it will be faster.