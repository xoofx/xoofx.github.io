anchors.add();
var jstoc = document.getElementsByClassName("js-toc");
if (jstoc.length > 0)
{        
    console.log(jstoc);
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

var currentXoofxTheme = "light";

// Inspired by https://anduin.aiursoft.com/post/2020/3/27/bootstrap-dark-theme-minimum-style
// Handle theme change
const initXoofxTheme = function (e) {
    if (e.matches) {
        currentXoofxTheme = "dark";
        // dark mode
        $('.navbar-light').addClass('navbar-dark');
        $('.navbar-light').removeClass('navbar-light');
        $('body').addClass('bg-dark');
        $('body').removeClass('bg-white');
        $('.modal-content').addClass('bg-dark');
        $('.container-fluid').addClass('bg-dark');
        $('.list-group-item').addClass('bg-dark');
        $('.content-wrapper').addClass('bg-dark');
        $('.card').addClass('bg-dark');

        $('.bg-light').addClass('bg-dark');
        $('.bg-light').removeClass('bg-light');

        $('.bg-white').addClass('bg-black');
        $('.bg-white').removeClass('bg-white');

        $('.bd-footer').addClass('bg-dark');
        $('table').addClass('table-dark');
    } else if (currentXoofxTheme == "dark") {
        location.reload();
    }
}

let colorSchemeQueryList = window.matchMedia('(prefers-color-scheme: dark)')

initXoofxTheme(colorSchemeQueryList);
colorSchemeQueryList.addListener(initXoofxTheme);
