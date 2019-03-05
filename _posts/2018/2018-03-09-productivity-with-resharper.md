---
layout: post
title: Productivity with ReSharper
tags:
 - Visual Studio
 - Visual Studio 2015
 - Roslyn
comments: true
---
I have been using ReSharper for around 10 years now and it has been my number one productivity tool when developing in C#. When Visual Studio 2015 switched to Roslyn I was very annoyed by the massive slow down occurring when using ReSharper and Roslyn together on large solutions. Things have been improving, but still using ReSharper feels more and more heavy with Roslyn and I'm sometimes annoyed by the UI freezes that can happen, when loading a big solution or after working several hours on a project. Simply looking at the task manager shows that when ReSharper is on, the memory is going very high. But there are reasons for that - caching useful data...

So for a few days this week, I tried to disable ReSharper (only in VS2017, I kept it for my day work VS2015 instance)... and the result is that... **Roslyn is not yet anywhere near to the experience of ReSharper**, I'm loosing too much productivity compare to the more lightweight - on all aspects - Roslyn VS experience I'm getting...

I have selected in this post a few examples on two very common usages:

- Smart completion
- Code navigation

My apologize If I'm not covering all the methods for completion or navigation or even all the other features provided by ReSharper. ReSharper typically comes with a lot more features than what is described here... but by looking at the very minimal experience here that you get, I can firmly say that **ReSharper still provides the best coding experience** and I'm ready to pay the extra money, RAM and the few GC cycles lost into UI slowdown during a coding day If it can improve dramatically my overall productivity.

# Smart Completion

The smart completion in ReSharper is way beyond what we have with Roslyn, mainly on two aspects:

- ReSharper is providing a **true context sensitive and smart completion**, taking into account the context (and I believe things also like what you have used mostly recently...etc.). It is maintaining a cache of every symbols in your project and these symbols are carefully selected and used to popup in your code as soon as you type:
  - Common types and idioms
  - Relevant constructors
  - Static method factory are coming to create an instance when no constructor are available
  - ...etc.
- ReSharper allows to type **very few keystrokes** to get this done

Let's see how it works with a few selected example:

- Type completion 
- Method call completion
- Delegate completion
- Static variable completion

And yet, I have just selected a few cases here...

## Type completion

In an empty file, we simply want to access `System.Collection.Generics.List<T>`, so we naturally start to type `List`:

| ReSharper  | Roslyn
| ---------- | ------
| ![case1-smart-completion-type-resharper](/images/2018-03-09-productivity-with-resharper/case1-smart-completion-type-resharper.png)  In this first step, we can already see that ReSharper is providing the right type out-of-the-box just after typing the first letter `L`!. Not only it provides a list of everything that could be accessed even outside of your namespace our class (including static fields, properties, methods, types) but also it weights the usage by providing the most common completion (and `List` is a super common usage) | ![case1-smart-completion-type-roslyn](/images/2018-03-09-productivity-with-resharper/case1-smart-completion-type-roslyn.png) Here Roslyn doesn't provide anything useful for our case
| **ReSharper**  | **Roslyn**
| ![case1-smart-completion-type-resharper1](/images/2018-03-09-productivity-with-resharper/case1-smart-completion-type-resharper1.png) Press `<TAB>` And we get everything: namespace imported, enclosing `<` and `>`, cursor correctly positioned, documentation popup| ![case1-smart-completion-type-roslyn1](/images/2018-03-09-productivity-with-resharper/case1-smart-completion-type-roslyn1.png) Obviously pressing `<TAB>` doesn't help so we have to press `<ALT>+<ENTER>` to bring the the namespace import helper. What we don't see in this screenshot is that after typing `List` you have the feeling to wait more than 1s for the namespace import tooltip to appear, which is way too long...
|   | **Roslyn**
|  | ![case1-smart-completion-type-roslyn2](/images/2018-03-09-productivity-with-resharper/case1-smart-completion-type-roslyn2.png) We press `<ENTER>` to validate the import but we still don't get a meaningful completion, only the namespace import.
|   | **Roslyn**
|  | ![case1-smart-completion-type-roslyn3](/images/2018-03-09-productivity-with-resharper/case1-smart-completion-type-roslyn3.png) We type `<` and we finally get what we got in ReSharper with a single `<TAB>`

As we can see we have to type - and wait! - a lot more when typing with Roslyn and I'm having this typing situation hundreds of times per day!

## Method completion

| ReSharper  | Roslyn
| ---------- | ------
| ![case2-smart-completion-method-resharper1](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-resharper1.png) | ![case2-smart-completion-method-roslyn1](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-roslyn1.png)
| ![case2-smart-completion-method-resharper2](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-resharper2.png) Press `<TAB>` and we get everything, from enclosing `(` and `)` to `;` with the cursor correctly positioned between the parenthesis! | ![case2-smart-completion-method-roslyn2](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-roslyn2.png) Pressing `<TAB>` doesn't do anything
|   | **Roslyn**
|   | ![case2-smart-completion-method-roslyn3](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-roslyn3.png) We press `(` and then we start to have the closing `)`. Something also that I actually dislike a lot with Roslyn is the fact that we don't see all the methods in the tooltip popup, we have to press the arrows `<UP>` and `<DOWN>` in order to see them. With ReSharper, it is very compact and we see them immediately.
| **ReSharper**  | **Roslyn**
| ![case2-smart-completion-method-resharper3](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-resharper3.png) We start to type the arguments. Look at the `bool` argument, what ReSharper is providing is a super smart list: `Equals` => returning a `bool`, `true`/`false` obviously, `bool.Parse`, but also the other parameters for `int`, because we have an overload. That's just super useful | ![case2-smart-completion-method-roslyn4](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-roslyn4.png) We start to type the arguments but we don't get any feedback apart that we moved to the 2nd arguments that is a `bool` or maybe something else...
| **ReSharper**  | **Roslyn**
| ![case2-smart-completion-method-resharper4](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-resharper4.png) We continue on the last argument, again with a completion list that can be useful. | ![case2-smart-completion-method-roslyn5](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-roslyn5.png) Nothing more than the previous argument. We are on our own here. 
|  | **Roslyn**
|  | ![case2-smart-completion-method-roslyn6](/images/2018-03-09-productivity-with-resharper/case2-smart-completion-method-roslyn6.png) Not finished yet, you still need to move to the right after `)` by pressing `<RIGHT ARROW>` and add the proper missing `;`

## Delegate completion

| ReSharper  | Roslyn
| ---------- | ------
| ![case3-smart-completion-method-delegate-resharper](/images/2018-03-09-productivity-with-resharper/case3-smart-completion-method-delegate-resharper.png) We starts with basically the same experience, minus the final `;` provided by ReSharper. | ![case3-smart-completion-method-delegate-roslyn](/images/2018-03-09-productivity-with-resharper/case3-smart-completion-method-delegate-roslyn.png)
| **ReSharper**  | **Roslyn**
| ![case3-smart-completion-method-delegate-resharper2](/images/2018-03-09-productivity-with-resharper/case3-smart-completion-method-delegate-resharper2.png) Pressing `<CTRL>+<SPACE>` and we get the smart completion we deserve, super super useful. | ![case3-smart-completion-method-delegate-roslyn2](/images/2018-03-09-productivity-with-resharper/case3-smart-completion-method-delegate-roslyn2.png) Here Pressing `<CTRL>+<SPACE>` doesn't bring anything useful. Worst when you have to type a lambda/delegate call with multiple arguments, it is really really not fun!
| **ReSharper**  | **Roslyn**
| ![case3-smart-completion-method-delegate-resharper3](/images/2018-03-09-productivity-with-resharper/case3-smart-completion-method-delegate-resharper3.png) Press `<ENTER>` optionally `<CTRL>+<SPACE>` to get another round of smart completion and you are ready to go | In Roslyn, you just have to type everything. And in this example, that's a simple delegate, but imagine the amount of typing with a delegate with multiple arguments (with potentially `ref`, `out`...etc.)

## Static variable completion

| ReSharper  | Roslyn
| ---------- | ------
| ![case4-smart-completion-static-resharper1](/images/2018-03-09-productivity-with-resharper/case4-smart-completion-static-resharper1.png) Initializing a static variable is immediately providing the proper completion right after pressing `=`, away from one `<ARROW-DOWN>` | ![case4-smart-completion-static-roslyn1](/images/2018-03-09-productivity-with-resharper/case4-smart-completion-static-roslyn1.png)
| **ReSharper**  | **Roslyn**
| ![case4-smart-completion-static-resharper2](/images/2018-03-09-productivity-with-resharper/case4-smart-completion-static-resharper2.png) Selecting the `new Dictionary<string,int>()` line and we are done, cursor properly located into the initializer with the trailing `;` | ![case4-smart-completion-static-roslyn2](/images/2018-03-09-productivity-with-resharper/case4-smart-completion-static-roslyn2.png) Here we need to type `new` + `<SPACE>` to get the proper completion... but it is not even finished here!
|  | **Roslyn**
|  | ![case4-smart-completion-static-roslyn3](/images/2018-03-09-productivity-with-resharper/case4-smart-completion-static-roslyn3.png) We press `<ENTER>` and we are not yet there
| | **Roslyn**
|  | ![case4-smart-completion-static-roslyn4](/images/2018-03-09-productivity-with-resharper/case4-smart-completion-static-roslyn4.png) We have to press `(` to finally get the parameter list, but yet, we will have to press another `<ARROW_RIGHT>` and type `;` to fully complete the line

# Code navigation

Code navigation is another aspect where ReSharper is still leading by providing many useful and well presented navigation methods and popups.

Again, selecting a few cases here, while ReSharper comes with more navigation methods.

## Type Inheritance

- In ReSharper just hit `<ALT>+<END>` on the inherited type
- In Roslyn just hit `<CTRL>+<F12>`

| ReSharper  | Roslyn
| ---------- | ------
| ![case5-navigation-inheritance-resharper1](/images/2018-03-09-productivity-with-resharper/case5-navigation-inheritance-resharper1.png) `<ALT>+<END>` In this particular case, ReSharper smartly propose to navigate to whoever is implementing `Dictionary<string, int>` or even the generic version `Dictionary<TKey, TValue>`! | Roslyn doesn't provide this case. We could say, "hey look Roslyn wins, fewer keystrokes", but no, imo, ReSharper here is providing a right contextual way of looking at inheritance.
| **ReSharper**  | **Roslyn**
| ![case5-navigation-inheritance-resharper2](/images/2018-03-09-productivity-with-resharper/case5-navigation-inheritance-resharper2.png) Selecting the generic instance, we get the full list popup where I'm typing/reading the code | ![case5-navigation-inheritance-roslyn](/images/2018-03-09-productivity-with-resharper/case5-navigation-inheritance-roslyn.png) `<CTRL>+<F12>` Roslyn here is going to open a bottom full pane which is very wide. Unlike ReSharper, the content is not focused on the screen, where I'm actually looking at. Also the super annoying thing about the selector is that it is using the code preview, so if you try to scroll down the types, it will start to open different files on the screen, while you absolutely don't want this (at least me) and unfortunately, you can't disable this by an obvious settings (frankly, I haven't tried to look further... the experience was already so unpleasant that I didn't have the courage to continue further)

## Overrides

Got a `virtual` method and want to know who is overriding it? Same keystrokes than for Type Inheritance.

| ReSharper  | Roslyn
| ---------- | ------
| ![case6-navigation-method-override-resharper1](/images/2018-03-09-productivity-with-resharper/case6-navigation-method-override-resharper1.png) `<ALT>+<END>` on a virtual method implemented just once in your codebase and ReSharper will go straight to it | ![case6-navigation-method-override-roslyn1](/images/2018-03-09-productivity-with-resharper/case6-navigation-method-override-roslyn1.png) Roslyn will open the same unpleasant big navigation pane.
| **ReSharper**  | **Roslyn**
| ![case6-navigation-method-override-resharper2](/images/2018-03-09-productivity-with-resharper/case6-navigation-method-override-resharper2.png) Adding another override and now we will get a straight popup. Look at the bold case on `Yip` saying that it is a direct inheritance, valuable information here right in this popup. | ![case6-navigation-method-override-roslyn2](/images/2018-03-09-productivity-with-resharper/case6-navigation-method-override-roslyn2.png) Same navigation pane, no additional hints about the type of overrides (direct or indirect?)
| **ReSharper**  | **Roslyn**
| Want to navigate from a base method to a parent method? With ReSharper, you can see that they provide some "hint" icons on the left side of the text editor but they provide also direct keystrokes for this: ![case6-navigation-method-override-resharper3](/images/2018-03-09-productivity-with-resharper/case6-navigation-method-override-resharper3.png) `<ALT>+<HOME>` on an override method and you will get immediately the base methods | Afaik, there are no equivalent in Roslyn for navigating to a base method

# Next?

I'm going to **re-install ReSharper on my Visual Studio 2017 instance**. Sure I could live with a stripped-down coding experience by using only Roslyn, but I can immediately feel the productivity loss and this is something I will not trade easily, unless ReSharper becomes really unusable at all (which is not the case). 

While **Roslyn** have been certainly improving in the recent releases, I can't say that it can replace what ReSharper has been providing for years.

Still, as I mentioned around on my twitter feed two years ago about the slowdown of ReSharper, I strongly believe that ReSharper should have moved very early to adopt Roslyn as soon as possible, as part of a broader vision on the future of the product and its viability. 
