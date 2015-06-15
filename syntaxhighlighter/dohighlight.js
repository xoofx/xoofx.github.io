// This little snippet gets tagged onto the end of the SyntaxHilighter code.
// Its job is to actually start the syntax highlighting process.
function doHighlight(){
	SyntaxHighlighter.config.bloggerMode = true;
	SyntaxHighlighter.defaults["auto-links"]=false;
	SyntaxHighlighter.defaults["quick-code"]=false;
	SyntaxHighlighter.highlight();
}
doHighlight();
