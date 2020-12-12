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