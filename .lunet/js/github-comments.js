// credits: http://donw.io/post/github-comments/
// use of ajax vs getJSON for headers use to get markdown (body vs body_htmml)
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

    $(document).ready(function ()
    {
        $.getJSON(api_issue_url, function(data) {
            NbComments = data.comments;
        });

        $.ajax(api_comments_url, {
            headers: {Accept: "application/vnd.github.v3.html+json"},
            dataType: "json",
            success: function(comments, textStatus, jqXHR) {

                // Add post button to first page
                if (page_id == 1)
                    $("#gh-comments-list").append("<div class='gh-comment-link'><a href='" + url + "#new_comment_field' rel='nofollow' class='gh-comment-link-add'>Post a comment on Github</a> <span style='font-size: x-small;'>(it will appear below automatically)</span></div>");

                // Individual comments
                $.each(comments, function(i, comment) {

                    var date = new Date(comment.created_at);

                    var t = "<div class='gh-comment'><div class='gh-comment-head'>";
                    t += "<img src='" + comment.user.avatar_url + "' class='github-comment-img-avatar' >";
                    t += "<b><a href='" + comment.user.html_url + "'>" + comment.user.login + "</a></b>";
                    t += " posted at ";
                    t += "<em>" + date.toUTCString() + "</em></div>";
                    t += "<div class='gh-comment-body'>";
                    t += comment.body_html;
                    t += "</div></div>";
                    $("#gh-comments-list").append(t);
                });

                // Setup comments button if there are more pages to display
                var reslinks = jqXHR.getResponseHeader("Link");
                var nextLinkDisplayed = false;
                if (reslinks)
                {
                    var links = ParseLinkHeader(reslinks);
                    if ("next" in links)
                    {
                        $("#gh-load-comments").attr("onclick", "DoGithubComments(" + comment_id + "," + (page_id + 1) + ");");
                        $("#gh-load-comments").show();
                        nextLinkDisplayed = true;
                    }
                }
                if (!nextLinkDisplayed)
                {
                    $("#gh-load-comments").hide();
                }
            },
            error: function(xhr) {
                $("#gh-comments-list").append("Comments are not open for this post yet." + xhr.status);
            }
        });
    });
}