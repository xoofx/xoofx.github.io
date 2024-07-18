var currentXoofxTheme = "light";

// Inspired by https://anduin.aiursoft.com/post/2020/3/27/bootstrap-dark-theme-minimum-style
// Handle theme change
const initXoofxTheme = function (e) {
    if (e.matches) {
        currentXoofxTheme = "dark";
        document.documentElement.setAttribute('data-bs-theme', 'dark')
        
        // Mermaid Init
        mermaid.initialize({
            securityLevel: 'loose',
            theme: 'dark',
        });        
    } else if (currentXoofxTheme == "dark") {
        document.documentElement.setAttribute('data-bs-theme', 'light')
        
        // Mermaid Init
        mermaid.initialize({
            securityLevel: 'loose',
            theme: 'neutral',
        });
    }
}
let colorSchemeQueryList = window.matchMedia('(prefers-color-scheme: dark)')
initXoofxTheme(colorSchemeQueryList);
colorSchemeQueryList.addListener(initXoofxTheme);

anchors.add();
var jstoc = document.getElementsByClassName("js-toc");
if (jstoc.length > 0)
{        
    tocbot.init({
        // Where to render the table of contents.
        tocSelector: '.js-toc',
        // Where to grab the headings to build the table of contents.
        contentSelector: '.js-toc-content',
        // Which headings to grab inside of the contentSelector element.
        headingSelector: 'h1, h2, h3, h4, h5',
        collapseDepth: 3,
        orderedList: true,
    });
}

var ghComment = document.getElementById("gh-comments");
if (ghComment !== null) {
    DoGithubComments(ghComment.dataset.ghcommentid);
}
