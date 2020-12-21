---
title: Generate automatically async/await code from sync code with Roslyn
ghcommentid: 4
tags:
 - C#
 - .NET
 - Roslyn
comments: true
---

This is a quick post to give you some feedback about an experiment I just made with the [Scriban Text Templating Library](http://xoofx.com/blog/2017/11/13/implementing-a-text-templating-language-and-engine-for-dotnet/) to add support for async/await automatically from the existing synchronous code, all of this done by using Roslyn.

If you have an existing code base that works beautifully in a synchronous manner, but you would like also to provide a path for async/await patterns, you don't want to rewrite your entire code base to the async/await pattern, or to drop synchronous code for async/await only. It would either be a huge burden to maintain two code paths doing almost the same thing, or the use async/await only would actually perform significantly worse than the synchronous version, even if you are using the recently introduced `ValueTask<T>`

For Scriban, I wanted to have all this async/await version of the library entirely generated, so that whenever I update the synchronous code, I can automatically generate the async/await version. While implementing this, I found an old GitHub issue on Roslyn [_"Automatically create non-async methods from async methods"_](https://github.com/dotnet/roslyn/issues/12931) and that it was also experimented on the project [npgsql](https://github.com/npgsql/npgsql) via [AsyncRewriter](https://github.com/roji/AsyncRewriter) done by Shay Rojansky (Hey Shay!). The method used by AsyncRewriter was a bit different from what I was looking for, specifically that I didn't want to modify my existing code with attributes but let the codegen find the relevant methods transitively with just a few bootstrap hints.

It's an interesting challenge and can be a very common point of library design issue (Should I maintain async/await only, or have both? How can I maintain them?), so let's see how that was done.

## Identifying async/await methods

The first step was to identify in the existing codebase where async/await can be actually used. There are mainly two end usages:

- The interface `IScriptOutput` is a tiny abstraction used by the engine to write a string to an output, that can be implemented by a StreamWriter, or a StringBuilder, or whatever. This interface has mainly a method `Write(string text, int offset, int count)`
- The interface `IScriptCustomFunction` providing user custom functions/delegates that can be used within the template scripts. This interface has mainly a method `object Invoke(TemplateContext context, ScriptNode callerContext, ScriptArray arguments, ScriptBlockStatement blockStatement);`

Because the code was also using some virtual/abstract methods for the model of the syntax tree, I had to help finding the methods by telling that I also wanted to compile all the method inheriting from `ScriptNode.Evaluate`

This first selection of methods was very easy to express with Roslyn:

```csharp
var workspace = MSBuildWorkspace.Create();

var solution = await workspace.OpenSolutionAsync(@"..\..\..\..\scriban.sln");
var project = solution.Projects.First(p => Path.GetFileName(p.FilePath) == "Scriban.csproj");
var compilation = await project.GetCompilationAsync();
var models = compilation.SyntaxTrees.Select(tree => compilation.GetSemanticModel(tree)).ToList();

var methods = new Stack<IMethodSymbol>();
var visited = new HashSet<IMethodSymbol>();

// ----------------------------------------------------------------------------------
// 1) Collect origin methods from IScriptOutput.Write and all ScriptNode.Evaluate methods
// ----------------------------------------------------------------------------------
foreach (var model in models)
{
    foreach (var methodDeclaration in model.SyntaxTree.GetRoot().DescendantNodes().OfType<MethodDeclarationSyntax>())
    {
        if (methodDeclaration.Parent is InterfaceDeclarationSyntax)
        {
            var interfaceDecl = (InterfaceDeclarationSyntax) methodDeclaration.Parent;

            var interfaceType = model.GetDeclaredSymbol(interfaceDecl);
            if (interfaceType != null && interfaceType.ContainingNamespace.Name == "Runtime" && (interfaceType.Name == "IScriptOutput" || interfaceType.Name == "IScriptCustomFunction"))
            {
                var method = model.GetDeclaredSymbol(methodDeclaration);
                if (visited.Add(method))
                {
                    methods.Push(method);
                }
            }
        }
        else
        {
            var methodModel = model.GetDeclaredSymbol(methodDeclaration);
            if (!methodModel.IsStatic && methodModel.Name == "Evaluate" && methodModel.Parameters.Length == 1 && methodModel.Parameters[0].Type.Name == "TemplateContext" && InheritFrom(methodModel.ReceiverType, "Syntax", "ScriptNode"))
            {
                while (methodModel != null)
                {
                    if (visited.Add(methodModel))
                    {
                        methods.Push(methodModel);
                    }
                    methodModel = methodModel.OverriddenMethod;
                }
            }
        }
    }
}
```

## Building a graph of method calls

Once we have this first set of mandatory async/await methods, we want to go through all their usages, and tag transitively all methods being "infected" by these async/await methods.

In our case, we are navigating through these methods using the `SymbolFinder.FindCallersAsync`. I originally tried to use the Syntax Tree but I as actually having a problem storing these in a hashmap, asking this on stackoverflow [_"How to collect all MethodDeclarationSyntax transitively with Roslyn?"_](https://stackoverflow.com/q/53866637/1356325) and it turns out that I could work entirely with `IMethodSymbol` (the semantic model) instead of bouncing between the syntax tree and semantic model (Thanks Marius for the tip!)

```csharp
// ----------------------------------------------------------------------------------
// 2) Collect method graph calls
// ----------------------------------------------------------------------------------
var methodGraph = new Dictionary<IMethodSymbol, HashSet<ITypeSymbol>>();
var classGraph = new Dictionary<ITypeSymbol, ClassToTransform>();

visited.Clear();
while (methods.Count > 0)
{
    var method = methods.Pop();
    if (!visited.Add(method))
    {
        continue;
    }

    HashSet<ITypeSymbol> callerTypes;
    if (!methodGraph.TryGetValue(method, out callerTypes))
    {
        callerTypes = new HashSet<ITypeSymbol>();
        methodGraph.Add(method, callerTypes);
    }

    var finds = await SymbolFinder.FindCallersAsync(method, solution);
    foreach (var referencer in finds.Where(f => f.IsDirect))
    {
        var callingMethodSymbol = (IMethodSymbol)referencer.CallingSymbol;
        methods.Push(callingMethodSymbol);

        // Push the method overriden
        var methodOverride = callingMethodSymbol;
        while (methodOverride != null && methodOverride.IsOverride && methodOverride.OverriddenMethod != null)
        {
            methods.Push(methodOverride.OverriddenMethod);
            methodOverride = methodOverride.OverriddenMethod;
        }

        if (callingMethodSymbol.MethodKind == MethodKind.StaticConstructor)
        {
            continue;
        }

        var callingSyntax = referencer.CallingSymbol.DeclaringSyntaxReferences[0].GetSyntax();
        var callingMethod = (MethodDeclarationSyntax)callingSyntax;
        

        foreach (var invokeLocation in referencer.Locations)
        {
            var invoke = callingMethod.FindNode(invokeLocation.SourceSpan);
            while (invoke != null && !(invoke is InvocationExpressionSyntax))
            {
                invoke = invoke.Parent;
            }
            Debug.Assert(invoke is InvocationExpressionSyntax);

            var declaredSymbol = callingMethodSymbol.ReceiverType;

            if (declaredSymbol.Name != "TemplateRewriterContext" && callingMethodSymbol.Parameters.All(x => x.Type.Name != "TemplateRewriterContext" && x.Type.Name != "TemplateRewriterOptions")
                && (declaredSymbol.BaseType.Name != "DynamicCustomFunction" || declaredSymbol.Name == "GenericFunctionWrapper"))
            {
                ClassToTransform classToTransform;
                if (!classGraph.TryGetValue(callingMethodSymbol.ReceiverType, out classToTransform))
                {
                    classToTransform = new ClassToTransform(callingMethodSymbol.ReceiverType);
                    classGraph.Add(callingMethodSymbol.ReceiverType, classToTransform);
                    callerTypes.Add(callingMethodSymbol.ReceiverType);
                }

                // Find an existing method to transform
                var methodToTransform = classToTransform.MethodCalls.FirstOrDefault(x => x.MethodSymbol.Equals(callingMethodSymbol));
                if (methodToTransform == null)
                {
                    methodToTransform = new MethodCallToTransform(callingMethodSymbol, callingMethod);
                    classToTransform.MethodCalls.Add(methodToTransform);
                }

                // Add a call site
                methodToTransform.CallSites.Add((InvocationExpressionSyntax)invoke);
            }
        }
    }
}
```            

Here, we are just building a list of `ClassToTransform` with each class to transform having a list of `MethodCallToTransform` and then each having a list of call sites `InvocationExpressionSyntax` to change (that we would require to transform from sync to await calls)

## Transforming the code

Once we have our graph, we just need to iterate through the syntax tree, duplicate it and modify the methods:

- Change the signature of the method from `XXX(...)` to `XXXAsync(...)`

  ```csharp
  // Rename method with `Async` postfix
  method = method.WithIdentifier(Identifier(method.Identifier.Text + "Async"));
  ```

- Add the keyword `async` to these methods:

  ```csharp
  // Add async keyword to the method
  method = method.WithModifiers(method.Modifiers.Add(Token(SyntaxKind.AsyncKeyword).WithTrailingTrivia(Space)));
  ```

- Change the return type from `void` to `Task` or from `MyTypeXXX` to `Task<MyTypeXXX>`

  ```csharp
  TypeSyntax asyncReturnType;
  if (methodModel.ReturnsVoid)
  {
      asyncReturnType = IdentifierName("ValueTask").WithTrailingTrivia(Space);
  }
  else
  {
      var trailingTrivia = method.ReturnType.GetTrailingTrivia();
  
      asyncReturnType = GenericName(
              Identifier("ValueTask"))
          .WithTypeArgumentList(
              TypeArgumentList(
                  SingletonSeparatedList(method.ReturnType.WithoutTrailingTrivia()))).WithTrailingTrivia(trailingTrivia);
  }
  
  method = method.WithReturnType(asyncReturnType);
  ```

- Update classes being modified to add the keyword partial and save the changes at the end (note that I didn't handle nested classes):

  ```csharp
  if (typeDecl.Modifiers.All(x => x.Text != "partial"))
  {
      var rootSyntax = typeDecl.SyntaxTree.GetRoot();
      var originalDoc = solution.GetDocument(rootSyntax.SyntaxTree);
  
      var previousDecl = typeDecl;
      typeDecl = typeDecl.WithModifiers(typeDecl.Modifiers.Add(Token(SyntaxKind.PartialKeyword).WithTrailingTrivia(Space)));
  
      rootSyntax = rootSyntax.ReplaceNode(previousDecl, typeDecl);
  
      originalDoc = originalDoc.WithSyntaxRoot(rootSyntax);
      solution = originalDoc.Project.Solution;
  }
  ```

- Update all call sites replacing synchronous code with `await` expressions with the proper usage of ConfigureAwait (I'm not including all the cases but it mostly boils down to the following):

  ```csharp
  method = method.ReplaceNodes(callingMethod.CallSites, (callSite, r) =>
  {
      // We have other cases in the transform (`MemberBindingExpressionSyntax`, `IdentifierNameSyntax`...)
      var m = (MemberAccessExpressionSyntax)newCallSite.Expression;
      var newExpression = m.WithName(IdentifierName(m.Name.ToString() + "Async"));
      newCallSite = newCallSite.WithExpression(newExpression);
  
      var awaitCall = AwaitExpression(InvocationExpression(
                  MemberAccessExpression(
                      SyntaxKind.SimpleMemberAccessExpression,
                      newCallSite,
                      IdentifierName("ConfigureAwait")))
              .WithArgumentList(
                  ArgumentList(
                      SingletonSeparatedList<ArgumentSyntax>(
                          Argument(
                              LiteralExpression(
                                  SyntaxKind.FalseLiteralExpression))))))
          .WithAwaitKeyword(Token(leadingTrivia, SyntaxKind.AwaitKeyword, TriviaList(Space)));
      return awaitCall;
  });
  ```
- A specific case for `IScriptOutput.WriteAsync` to accept a last parameter `CancellationToken` and to flow this argument from (`TemplateContext.CancellationToken`) to this method. I was surprised when updating the code that `TextWriter` doesn't expose actually async methods with `CancellationToken` to later find that there is an issue on corefx [_"Add CancellationToken to StreamReader.Read* methods"_](https://github.com/dotnet/corefx/issues/17670) 


An example of the code generated is like this:

```csharp
    public partial class ScriptReturnStatement
    {
        public override async ValueTask<object> EvaluateAsync(TemplateContext context)
        {
            context.FlowState = ScriptFlowState.Return;
            return await context.EvaluateAsync(Expression).ConfigureAwait(false);
        }
    }
```

while the original method was like this:

```csharp
        public override object Evaluate(TemplateContext context)
        {
            context.FlowState = ScriptFlowState.Return;
            return context.Evaluate(Expression);
        }
``` 

All the generated code is saved to a file [ScribanAsync.generated.cs](https://github.com/scriban/scriban/blob/master/src/Scriban/ScribanAsync.generated.cs) and as you can see, it is in the end significant amount of code!

## Performance with ValueTask\<T\>

I started the codegen using `Task<T>` but running a benchmark with the synchronized version, to was unsurprisingly generating a huge amount of allocations. I switched easily the codegen to use `ValueTask<T>` and I was able to divide by 5 the amount of allocations. 

For a library like Scriban that is mostly synchronous, it makes a lot more sense to use `ValueTask<T>`

Compared to the synchronous code, the `async`/`await` version is **still 3x slower**, but considering that it is not necessarily the common usage of Scriban, and that I can keep around the same good old synchronous code, I'm fine with the results (benchmark done with love with BenchmarkDotNet, as always!)

```
       Method |     Mean |     Error |    StdDev | Gen 0/1k Op | Gen 1/1k Op | Gen 2/1k Op | Allocated Memory/Op |
------------- |---------:|----------:|----------:|------------:|------------:|------------:|--------------------:|
      Scriban | 1.458 ms | 0.0037 ms | 0.0033 ms |     83.9844 |     17.5781 |     17.5781 |           370.53 KB |
 ScribanAsync | 5.067 ms | 0.0618 ms | 0.0516 ms |    132.8125 |           - |           - |            645.5 KB |
```

## Next?

I can say that I was really surprised and happy with the results of this work. Bringing async/await to an existing library without having to manually duplicate the code is a huge time/bug/maintenance saver. 

Having Roslyn is also what made this experiment possible, and this is just amazing. Though, I must say that the immutable nature of the Roslyn API is quite laborious to work with. I made several mistakes when forgetting to reuse a tree I just modified or incorrectly mixing an old and new tree. But that was really fine, the final code of the codegen being just a few hundred lines of code for generating roughly 1600 lines of code, it was worth to do it and of course, a lot more future proof in case I have to update the async/await code.

I was also surprised to not find many resources related to this particular subject, while I found it quite common, so I'm glad to share it here!

Happy coding!
