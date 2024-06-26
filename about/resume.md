---
layout: simple
title: Resume
section: about
url: /resume/
---
<img width="196px" src="/images/xoofx-2023.jpg" style="float: right;border-radius: 50%" alt="Avatar"/>

Name: *Alexandre MUTEL*  
Age: *Born in 1973*  
Situation: *Married, 2 children*  
Location: *Grenoble, France*  
Email: *alexandre_mutel at live.com* \
Social medias: [@xoofx](https://mastodon.social/@xoofx) on Mastodon \
GitHub: https://github.com/xoofx/ \
***Latest update: May 20th, 2024***

___

With over 30 years of passionate software development experience, I have consistently excelled in challenging projects across diverse technologies, including low-level coding, server-side applications, language parsers, compilers, and game engines. My expertise lies in leading complex systems, enhancing their designs, and empowering users through strong technical leadership. I am dedicated to improving direction, performance, quality, extensibility, maintainability, simplicity, and usability in all projects.

In recent years, I have successfully led larger teams, both technically and from a management perspective, establishing good engineering practices and fostering a respectful and empathetic work environment.

I'm currently working at [Unity Technologies](https://unity3d.com).

___

# Experience

## Director, Software Engineering
***Oct 2021 - Present (2 years 8 months)*** \
Company: _Unity Technologies_ \
Location: _Remote, Grenoble Area, France_

**Key Responsibilities:**

- Led the C#/.NET Tech Group, integrating multiple teams (C# Compilation, Scripting, .NET Runtimes & Integration, IL2CPP, Burst Native Compiler) to standardize and innovate with .NET technologies within the Unity platform.
- Managed 2-3 teams, each with a manager, comprising a total of 25-30 software engineers.
Collaborated with principal and staff engineers, defining the strategy and direction for the group's future.
- Worked closely with the Technical Program Manager to improve team planning and the Product Manager to enhance product approaches.
- Oversaw the execution of major technical stack evolutions, negotiated team resourcing, and presented progress to key stakeholders (VP, SVP). Wrote Objective Key Results (OKR) for the group.
- Established and maintained team rituals, organized bi-weekly .NET Group All Hands meetings, and led a team-building event in Copenhagen.
- Conducted weekly 1-1 meetings with direct reports and skip-level meetings, engaged in bi-annual internal engagement survey reviews, and evaluated yearly compensation cycles.


## Senior Engineering Manager
***Sep 2020 - Oct 2021 (1 year 2 months)*** \
Company: _Unity Technologies_ \
Location: _Remote, Grenoble Area, France_

**Key Responsibilities:**

- Led the Scripting and Burst Teams, focused on C# Compilation, .NET Runtime Integration, and Burst Native Compiler.
- Managed 2 teams of 10-12 engineers, defining directions and clarifying scopes.
- Improved planning, documentation, and engineering practices, set up team rituals and 1-1 meetings, and conducted quarterly performance reviews.
- Collaborated with the Technical Program Manager on JIRA setup, hired new engineers, and facilitated feedback sessions.
- Developed key talents into new technical/management positions, engaged with stakeholders, and evaluated yearly compensation cycles.
- Prepared the formation of the .NET Tech Group by integrating several teams.

## Technical Lead
***Nov 2016 - Sep 2020 (3 years 11 months)*** \
Company: _Unity Technologies_ \
Location: _Remote, Grenoble Area, France_

**Key Responsibilities:**

- Designed, developed, and shipped the Burst compiler to translate .NET/C#/IL code into efficient native code using the LLVM compiler.
- Led the full design and development of the compiler, collaborating with the [SLEEF OSS project](https://github.com/shibatch/sleef/) for deterministic floating point support, for example [here](https://github.com/shibatch/sleef/issues/187)
- Expanded compiler functionality to major platforms (Desktops, Mobile, Consoles), mentored and hired engineers, and built a cohesive team.
- Organized development priorities, 1-1 meetings, knowledge-sharing sessions, and annual reviews.
- Presented Burst technology at conferences (Unite 2019, DotNext 2019 - video [here](https://youtu.be/LKpyaVrby04?si=0M6IObrPDLFb7rME))
- Authored comprehensive internal documentation and user documentation, and contributed to blog posts on Burst compiler updates ([1](https://blog.unity.com/technology/optimize-your-projects-with-burst-compiler-1-3),[2](https://blog.unity.com/engine-platform/bursting-into-2021-with-burst-1-5)).


## Lead Developer of several OSS projects
***September 2010 - Today (14 years)***  
Technologies: *`C#`, `C/C++`, `Direct3D11`, `MsBuild`, `ASP.NET`, `HTML+JavaScript`*  
Platforms: *`Windows`*  

For the past years and during my spare time, I have been the author and developer of several open-source projects:

- [SharpDX](http://sharpdx.org) is **the .NET Wrapper for the full DirectX API**, first released in November 2010, .NET API generated directly from C++ DirectX headers, using a "sophisticated" IL rewriting at that time, and one of the largest code generator from C++ to C# developed so far. This project has been used in hundreds of commercial projects and games.
- [Markdig](https://github.com/xoofx/markdig) **A Markdown processor for .NET**, a fully extensible implementation of the [CommonMark](http://commonmark.org/) standard with excellent performance, both in terms of speed, and GC pressure. This is one of the best Markdown processor, all languages combined, that is implemented with a genuine extensible architecture and provides excellent performance. I'm also a contributor of the [Markdown Editor for Visual Studio](https://github.com/madskristensen/MarkdownEditor).
- [babelmark 3](https://babelmark.github.io/) A website I developed to compare different Markdown implementations (including Markdig)
- [NUglify](https://github.com/xoofx/NUglify) I forked the project Microsoft Ajax Minifier, ported it to the .NET Core/Standard platform, and developed a full **HTML5 parser and minifier** for it.
- [Scriban](https://github.com/scriban/scriban) I developed a fast, powerful and lightweight **text templating language and engine for .NET** with the goal to use it for a static website generator. 
- [SharpScss](https://github.com/xoofx/SharpScss) I developed a **small pinvoke .NET wrapper around libsass** to convert SCSS to CSS
- [GitRocketFilter](https://github.com/xoofx/GitRocketFilter) I developed this super fast alternative to `git-filter-branch`, powerful command line tool to **rewrite git commit and branches** powered by Roslyn and LibGit2Sharp, 100x times faster than the original `git-filter-branch`
- [SharpYaml](https://github.com/xoofx/SharpYaml/) A YAML parser (this is a fork) with focus on adding better platform support, performance and a versatile override system. This project was used in Xenko as the **main serialization infrastructure for design time assets**.
- [SharpDiff](https://github.com/xoofx/SharpDiff) A diff library for .NET with **added support for a diff3 ways on .NET object graph**. This project was used in Xenko to develop the templating/prefab system.
- [SharpRazor](https://github.com/xoofx/SharpRazor) A simple wrapper around the templating Razor Engine 
- [SharpCLABot](https://github.com/SharpCLABot/SharpCLABot) An ASP.NET application providing CLA bot for github projects, hostable on Azure
- [SharpDoc](https://github.com/xoofx/SharpDoc) A documentation generator for .NET, that was used to generate early version of SharpDX and Xenko .NET API documentation.

## Lead Software Architect on a Game Engine
***June 2011 - April 2016 (5 years)***  
Company: *Silicon Studio, R&D*  
Location: *Tokyo, Japan*  
Technologies: *`C#`, `C/C++`, `HLSL/GLSL`, `Direct3D11`, `GCN/PS4`, `ASP.NET`, `HTML+JavaScript`, `PHP`*  
Infrastructure: *`MsBuild`, `git`, `svn`, `Jira`, `Confluence`, `TeamCity`*  
Platforms: *`Windows`, `Android`, `iOS`, `PS4`*  
Team Size: *5-10 people*  

I have been prototyping, designing and developing a C# game engine called [xenko](http://xenko.com)
My work spanned from diversified aspects of the development of this product, including:

- **Co-design and development of a powerful object oriented shading language based on HLSL** providing class inheritance, composition, and automatic varying attributes detection across GPU pipeline stages.
- **Development of an extensible HLSL parser** and **semantic analysis**
- Development of a **HLSL to GLSL converter** used as part of the SDK of a major console maker
- **General project gardening** including bug fixes and code reviews
- **Mentoring developers** in the team
- **Maintenance and development of several satellite open source projects** that has been used by the engine (SharpDX, SharpYaml, SharpDiff...)
- Design and implementation of the **initial Graphics api** ported from SharpDX toolkit
- **Overall optimizations** on many parts of the engine (e.g entity components system, .NET assembly IL rewriting...etc), including build optimizations (e.g execution server for accelerating assets compilation)
- Development of the **msbuild infrastructure** for the whole project
- Development of multiple **shading effects used in different demos showed at the GDC** (volumetric light shafts, heat shimmering, GPU particle sorting...)
- Design and implementation of a **core post effect system** including dev of some specifics fx (tone mapping, bloom...)
- Design and development of a **full Direct3D11 emulation layer written in C++ around the PS4 GCN API** to facilitate the porting of Yebis post effect to the PS4
- Development of a **gamma correct full asset pipeline**, from texture assets handling to rendering on the screen.
- Design and development of a **Physically based material system**, supporting layered materials with multi-BRDF (pluggable)
- Design and implementation of the **scene graphics compositor** to render a scene graph into multiple render targets
- Design and implementation of the **asset management system**, storage (including fork of yaml parser/serializer SharpYaml), compilation, **asset templating**, **advanced/nested prefabs** and diff 3 ways on an object graph, package system.
- Design and implementation of the **full packaging, distribution and installer of the engine using nuget** for the infrastructure
- Design and implementation of the **metric system**, with an ASP.NET server to collect the data
- Design and development of an **ASP.NET server to handle user CLA on github**
- Development of the web servers (CMS joomla and migration to Jekyll), **main writer of the 2 first original websites**
- Writing many parts of the **user documentation**
- **Management, deployment of all our ASP.NET servers** on a dedicated machine and port to the Azure platform
- Participation to the **communication** to the management about the progress on the project, the technical problems and challenges ahead...etc.
- Participation to the **planning** of the project

## Software Architect, Project Leader, Developer and Support
***June 1997 - June 2006 (9 years)***  
Company: *Societe Generale - IT Equity Derivatives Trading Markets*  
Location: *Paris, France*  
Technologies: *`Java`, `J2EE`, `C/C++`, `Corba`, `SQL`, `Sybase Database`, `Sybase EventBroker`, `Tibco`, `Oracle OLAP Database`, `HTTP`, `HTML`, `Perl`, `Unix shells`*  
Infrastructure: *`MsBuild`, `git`, `rcs`, `clearcase`, `perforce`*  
Platforms: *`Windows`, `Sun Solaris`, `Linux`*  

I have been a lead developer on numerous challenging projects.

### Software Architect: Prototyping new technologies
***December 2005 - June 2007 (1.5 years)***  
Team Size: *15*  

During this period, I have contributed to study the integration of several technologies for frontend applications, including the challenge to aggregate efficiently trading positions using an Oracle OLAP Database.

### Software Architect: redesigning of the Profit&Loss application for the J2EE Platform  
***April 2003 - December 2004 (1.5 years)***  
Team Size: *15*  

Part of a large project (120+ people) aiming at redesigning key components around the Profit&Loss application, I was directly involved in:

- Designing the migration from a legacy C++ application to a new Java J2EE infrastructure, working with an external J2EE Business solution called JRisk.
- Technical follow up and mentoring with the team to ensure that implementation details and problems are retro-feedback to the global design of the migration
- Coordination with other architects and teams, participating to technical committees

### Senior Software Developer for the integration of CFD products
***October 2002 - March 2003 (6 months)***  
Team Size: *8*  

Lead developer to incorporate an external solution called Calypso (Java application) and develop the integration of a financial product called CFD (Contract For Difference). Integration with existing legacy systems (front-office, middle office, back office).

### Project Leader / Software Architect for a distributed data system
***April 1999 - September 2002 (3.5 years)***  
Team Size: *5-8*  

Started as a prototype in a project where the code was mostly a large C/C++ application handling the Profit&Loss, Risk Analysis for the Equity derivatives. The goal of the project was to provide a distributed data system on top of an existing central database, to allow local and faster data access to different applications. The service had to run 24h/365 and was deployed around the world (Paris, NY, London, Tokyo). I have received feedback that this system was still in production in 2015.

- Early prototype of a Java server using Corba as a middleware
- Design and development of a system to synchronize the output of the replication of a Sybase database, plugged into an EventBroker to notify asynchronously the Java data server to update their cache (A Sybase representative told me that It was the first time a team was pushing such an advanced technique with their product)
- In order to notify the servers with updates, we have evaluated different low level network methods (UDP multicasting) and have opted for Tibco RendezVous as our lightweight network messaging system.
- Development of an ActiveX plugin automatically generated from Java code in order to provide a end-user control accessible from Excel. The generator was also able to generate a full HTML/CHM documentation from Java source files. This technology was much more efficient than the existing solutions provided by Sun at this time.
- Provide assistance to other applications to use this service.
- Management of the project and technical follow-up with the team.

### 1st Level Support - Trading Floor
***January 1998 - April 1999 (1.5 years)***  
Company: *Societe Generale - IT Equity Derivatives Trading Markets*  
Location: *New-York, US*  

As part of my duty for the French military service, I had an opportunity to work in New-York as a 1st level support of a critical application for traders, working directly with them on the trading floor. The application consisted of multiple client side applications and a centralized database with various pricing servers running located in Paris. I was also responsible to provide local IT support (e.g debugging network printers on a Sun servers) and development for the traders (advanced excel macros, specially for basket trading)

### 1st Level Support and Developer
***June 1997 - December 1997 (6 months)***  
Company: *Societe Generale - IT Equity Derivatives Trading Markets*  
Location: *Paris, France*  

Before going to New-York, I had to train and learn all the different applications and system I would have to support there and I have also been able to actively participate to many development fronts:

- Part of the development effort to bring a large C++ application into production for regulatory purposes (Value At Risk 99)
- Full port of a Solaris Pricing server to the Windows NT Platform, actively used after by the Exotic desks
- Design and development of a monitoring server with an HTML front-end to provide health dashboard of the different database, replication services and pricing servers running.

## Developer (internship)
***May 1996 - September 1996 (5 months)***  
Company: *IBM*  
Location: *La Gaude, France*  
Technologies: *`C++`, `ISDN Protocols`, `HTTP servers`, `HTML`*  

I joined a team that was actively developing the ISDN network stack for the IBM 2220 Nways Broadband Switch. I have developed an application to perform checks of the protocol. The application was producing a HTML report with a web server to easily verify visually the correctness of the protocol implementation. With this tool, I have been able to identify some problems and helped the team to debug and fix some bugs.

___

# Personal Projects

## Demomaking - PC
***June 2007 - June 2010 (3 years)***  
Technologies: *`C/C++`, `Assembly x86`*  
Platform: *`Windows`*  
 
I got caught back into my early passion when I was a teenager. I participated to the demogroup [Frequency](http://frequency.fr) where I gave a bit of my spare time and experience to help in the making of some intros.

I developed a 4k intro called [Ergon](https://www.youtube.com/watch?v=i_feg-bpqTY), using the raymarching technique. This intro finished 3rd place at Breakpoint 2010.

## Backpacking World Tour
***January 2004 - November 2004 (11 months)***  

While working at Societe Generale, I took a sabbatical year to do a backpacking trip around the world, all on my own. I spent 11 months in Africa (Burkina Faso, Mali, Benin, Togo, Ghana), South-America (Peru, Bolivia, Argentine, Chili), Isla de Pasqua, Tahiti, Australia, Indonesia, Singapore, Thailand, Nepal and India. While traveling I was actively writing and updating my website [diteoo.com](http://diteoo.com) (In French, it means *"Where are you?"*)  
This travel has considerably transformed my vision of life.

## Realtime 3D visualization - EDHEC sailing cup 
***November 1995 - April 1996***  
Technologies: *`Watcom C++`, `dos4/gw` `Assembly x86`*  

With a group of enthusiast computer and electronic students at INSA de Lyon, we built a project to track GPS position of boats in a sailing cup and display them in 3D real-time. I was the lead developer of the 3D renderer that was using the popular BSP rendering and texture mapping technique at this time.

## Demomaking - Amiga
***1989 - 1992 (3 years)***  
Technologies: *`GFA Basic`, `Assembler 68000`*  
Platform: *`Amiga`*  

I spent my spare time learning democoding and developed several dozens of effects (3D, sprites, bspline rendering, plasma/copper bar, character animation...) I joined the french demoscene group IRIS and released 1 intro and 2 demos ([SpaceDepths](http://www.pouet.net/prod.php?which=2893) and the [Olympia Demo](http://www.pouet.net/prod.php?which=52813)). As I was living in the country side of France, It was really difficult at this time to get access to relevant technical documentations about how to use the hardware, so I had often to disassemble existing demos to learn from the best coder's techniques. It is also a period where I have written most assembly code in my life.
I composed also many musics on this platform.

___

# Awards

- I have been awarded as a **Microsoft Most Valuable Professional** for C#/.NET/Visual Studio (2014 - Present, for 10 years)

___

# Articles

In the recent years, I have published many technical posts on my [blog](http://xoofx.github.io/blog), most recently:

- 2020: [Stark - Native Compiler - Prototype 2019](https://xoofx.github.io/blog/2020/03/21/stark-native-compiler/), Development of an AOT native compiler using RyuJIT
- 2020: [Stark - Language And Frontend Compiler - Prototype 2019](https://xoofx.github.io/blog/2020/03/06/stark-language-frontend-compiler/), Syntax of the language and the development of the front-end compiler
- 2020: [The Odyssey of Stark and Melody](https://xoofx.github.io/blog/2020/03/05/stark-melody-dotnet-sel4/), Prototyping a new language and OS with the help of the .NET ecosystem and seL4 micro-kernel
- 2016: [Implementation of Markdig](http://xoofx.github.io/blog/2016/06/13/implementing-a-markdown-processor-for-dotnet/), a Markdown Engine for .NET
- 2016: [Inline .NET IL ASM](http://xoofx.github.io/blog/2016/05/25/inline-il-asm-in-csharp-with-roslyn/) in C# by modifying Roslyn.
- 2015: [Stack allocation of .NET classes](http://xoofx.github.io/blog/2015/10/08/stackalloc-for-class-with-roslyn-and-coreclr/) to improve locality and performance of .NET apps, including the modification of Roslyn and the CoreCLR Runtime and GC to allow such a prototype.
- 2015: [Struct Inheritance for .NET](http://xoofx.github.io/blog/2015/09/27/struct-inheritance-in-csharp-with-roslyn-and-coreclr/) by tweaking Roslyn and the CoreCLR Runtime.

___

# Diplomas

- **Social/Specialized Educator**, IRTS Marne La Vallee (2006 - 2009, 3 years)  
  After my world tour, I took a break of my computer activities and enrolled into a school
  to learn social education and got a diploma of specialized educator.
  After this diploma, I worked part-time for one year in a small structure helping kids in a neighborhood in Paris, but my passion in software development got back and I had to stop working there as I was not enough focused on this difficult job.
- **Software Engineer**, INSA Lyon (1992 - 1997, 5 years)
- **Baccalaureat Mathematics and Physics**, with honors, Lycee Francois-Arago, Perpignan (1992)

___

# Interests
- **Hiking**, many during my world tour, at least one hike every month since then.
- **Guitar classic/folk** (learned for few years during my 5 years in Software Engineering)
- **Music composition on computers** with musictracker: composed many musics on Amiga back in the 1990's and more recently 
  several [unfinished musics](https://soundcloud.com/xoofx) around 2003 with Renoise.
- **Philosophy**, read many authors after my world tour. One of my favorite philosopher is [Henry Bergson](https://en.wikipedia.org/wiki/Henri_Bergson)
- **Swimming**, with many competitions when I was younger and now more a casual swimmer
