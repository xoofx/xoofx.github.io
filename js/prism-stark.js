Prism.languages.stark = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true,
			greedy: true
		}
	],
	'string': [
        {
            pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
            greedy: true
        },
        {
            pattern: /@("|')(?:\1\1|\\[\s\S]|(?!\1)[^\\])*\1/,
            greedy: true
        },
        {
            pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*?\1/,
            greedy: true
        }
    ],
	'class-name': [
        {
            pattern: /((?:class|module|struct|interface|extends|implements|instanceof|new)\s+)[A-Za-z_]\w*/,
            lookbehind: true,
            inside: {
                'punctuation': /\./
            }
        },
		{
			// @Foo
			pattern: /(\@)[a-z_A-Z]\w*(?:\.\w+)*\b/,
			lookbehind: true,
			inside: {
				punctuation: /\./
			}
		}
    ],
	'keyword': /\b(?:abstract|alias|as|async|await|base|bool|break|case|catch|class|const|constructor|continue|default|do|else|enum|extends|extension|extern|f32|f64|false|fatal|fixed|for|func|get|has|i16|i32|i64|i8|if|immutable|implements|implicit|import|in|int|interface|internal|is|instanceof|isolated|let|match|module|mutable|namespace|new|null|object|operator|operator|out|override|params|partial|private|protected|public|readable|ref|requires|retainable|return|rune|sealed|set|sizeof|static|string|struct|then|this|throw|throws|transient|true|try|typeof|u16|u32|u64|u8|uint|union|unsafe|value|var|virtual|where|while|with|yield)\b/,
	'boolean': /\b(?:true|false)\b/,
	'function': /\w+(?=\()/,
	'number': /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
	'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]|>>=?|<<=?|[-=]>|([-+&|?])\1|~|[-+*/%&|^!=<>]=?/,
	'punctuation': /\?\.?|::|[{}[\];(),.:]/    
};

// Prism.languages.insertBefore('stark', 'class-name', {
// 	'generic-method': {
// 		pattern: /\w+\s*<[^>\r\n]+?>\s*(?=\()/,
// 		inside: {
// 			function: /^\w+/,
// 			'class-name': {
// 				pattern: /\b[A-Z]\w*(?:\.\w+)*\b/,
// 				inside: {
// 					punctuation: /\./
// 				}
// 			},
// 			keyword: Prism.languages.stark.keyword,
// 			punctuation: /[<>(),.:]/
// 		}
// 	},
// 	'preprocessor': {
// 		pattern: /(^\s*)#.*/m,
// 		lookbehind: true,
// 		alias: 'property',
// 		inside: {
// 			// highlight preprocessor directives as keywords
// 			'directive': {
// 				pattern: /(\s*#)\b(?:define|elif|else|endif|endregion|error|if|line|pragma|region|undef|warning)\b/,
// 				lookbehind: true,
// 				alias: 'keyword'
// 			}
// 		}
// 	}
// });


Prism.languages.sk = Prism.languages.stark;