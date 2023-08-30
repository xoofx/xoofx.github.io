// credits: http://donw.io/post/github-comments/
// Change from initial code to use modern JavaScript await/async instead of ajax.
// todo: pages, configure issue url, open in new window?

var CurrentPage = 0;

function ParseLinkHeader(link)
{
    var entries = link.split(",");
    var links = { };
    for (var i in entries)
    {
        var entry = entries[i];
        var link = { };
        link.name = entry.match(/rel=\"([^\"]*)/)[1];
        link.url = entry.match(/<([^>]*)/)[1];
        link.page = entry.match(/page=(\d+).*$/)[1];
        links[link.name] = link;
    }
    return links;
}


function DoGithubComments(comment_id, page_id)
{
    var repo_name = "xoofx/xoofx.github.io";

    if (page_id === undefined)
        page_id = 1;

    var api_url = "https://api.github.com/repos/" + repo_name;
    var api_issue_url = api_url + "/issues/" + comment_id;
    var api_comments_url = api_url + "/issues/" + comment_id + "/comments" + "?page=" + page_id;

    var url = "https://github.com/xoofx/xoofx.github.io/issues/" + comment_id;


    async function GitHubReady(fn) {
        if (document.readyState !== 'loading') {
            await fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn, false);
        }
    }

    GitHubReady(async function ()
    {
        const gh_fetch_options = { headers: { Accept: "application/vnd.github.v3.html+json" } };
        const rsp = await fetch(api_issue_url, gh_fetch_options);
        const issueData = await rsp.json();
        if (issueData.comments <= 0) return;
        
        const response = await fetch(api_comments_url, gh_fetch_options);

        const gh_comments_list = document.querySelector("#gh-comments-list");

        if (!response.ok) {
            gh_comments_list.insertAdjacentHTML("beforeend", "Comments are not open for this post yet. Status: " + response.status);
            return;
        }

        const comments = await response.json();
        
        // Add post button to first page
        if (page_id == 1) {
            gh_comments_list.insertAdjacentHTML("beforeend", "<div class='gh-comment-link'><a href='" + url + "#new_comment_field' rel='nofollow' class='gh-comment-link-add'>Post a comment on Github</a> <span style='font-size: x-small;'>(it will appear below automatically)</span></div>");
        }

        // Individual comments
        comments.forEach(comment => {
            var date = new Date(comment.created_at);

            var t = "<div class='gh-comment'><div class='gh-comment-head'>";
            t += "<img src='" + comment.user.avatar_url + "' class='github-comment-img-avatar' >";
            t += "<b><a href='" + comment.user.html_url + "'>" + comment.user.login + "</a></b>";
            t += " posted at ";
            t += "<em>" + date.toUTCString() + "</em></div>";
            t += "<div class='gh-comment-body'>";
            t += comment.body_html;
            t += "</div></div>";
            gh_comments_list.insertAdjacentHTML("beforeend", t);
        });

        // Setup comments button if there are more pages to display
        var reslinks = response.headers.get("Link");
        var nextLinkDisplayed = false;

        const gh_load_comments = document.querySelector("#gh-load-comments");

        if (reslinks)
        {
            var links = ParseLinkHeader(reslinks);
            if ("next" in links)
            {
                gh_load_comments.SetAttribute("onclick", "DoGithubComments(" + comment_id + "," + (page_id + 1) + ");");
                gh_load_comments.style.display = '';
                nextLinkDisplayed = true;
            }
        }

        if (!nextLinkDisplayed)
        {
            gh_load_comments.style.display = 'none';
        }
    });
}