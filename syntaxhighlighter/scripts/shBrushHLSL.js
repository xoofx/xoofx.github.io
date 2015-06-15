/**
 * SyntaxHighlighter
 * http://alexgorbatchev.com/
 *
 * SyntaxHighlighter is donationware. If you are using it, please donate.
 * http://alexgorbatchev.com/wiki/SyntaxHighlighter:Donate
 *
 * @version
 * 2.1.364 (October 15 2009)
 * 
 * @copyright
 * Copyright (C) 2004-2009 Alex Gorbatchev.
 *
 * @license
 * This file is part of SyntaxHighlighter.
 * 
 * SyntaxHighlighter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * SyntaxHighlighter is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with SyntaxHighlighter.  If not, see <http://www.gnu.org/copyleft/lesser.html>.
 */
SyntaxHighlighter.brushes.HLSL = function()
{
	var datatypes =	'int double float string ' +
					'bool bool1 bool2 bool3 bool4 ' +
					'int1 int2 int3 int4 uint1 uint2 uint3 uint4 ' +
					'half1 half2 half3 half4 float1 float2 float3 float4 ' +
					'double1 double2 double3 double4 vector ' +
					'float1x1 float1x2 float1x3 float1x4 float2x1 float2x2 float2x3 float2x4 ' +
					'float3x1 float3x2 float3x3 float3x4 float4x1 float4x2 float4x3 float4x4 matrix';

	var keywords =	'break buffer cbuffer const continue discard do else extern ' +
					'false for if in inline inout namespace nointerpolation out return register ' +
					'shared stateblock stateblock_state static struct switch tbuffer ' +
					'texture texture1d texture1darray texture2d texture2darray texture2dms ' +
					'texture2dmsarray texture3d texturecube texturecubearray true typedef uniform void volatile while';
	             				
	var intrinsic =	'abs acos all any asfloat asin asint asuint atan atan2 ' +
					'ceil clamp clip cos cosh cross ddx ddy degrees determinant distance dot exp exp2 ' +
					'faceforward floor fmod frac frexp fwidth isfinite isinf isnan ldexp length lerp lit log log10 ' +
					'log2 max min modf mul noise normalize pow radians reflect refract round rsqrt saturate ' +
					'sign sin sincos sinh smoothstep sqrt step tan tanh ' +
					'tex1D tex1Dbias tex1Dgrad tex1Dlod tex1Dproj tex2D tex2Dbias tex2Dgrad ' +
					'tex2Dlod tex2Dproj tex3D tex3Dbias tex3Dgrad tex3Dlod ' +
					'tex3Dproj texCUBE texCUBEbias texCUBEgrad texCUBElod texCUBEproj transpose trunc';
            
	var keywords_ex = 'sampler samplerstate SamplerComparisonState blendstate compile '+
						'depthstencilstate depthstencilview geometryshader pass pixelshader '+
						'rasterizerstate rendertargetview technique technique10 vertexshader'; 
						
						
	var reserved = 'SV_ClipDistance SV_ClipDistance1 SV_ClipDistance2 SV_ClipDistance3 '+
					'SV_ClipDistance4 SV_ClipDistance5 SV_ClipDistance6 SV_ClipDistance7 '+
					'SV_ClipDistance8 SV_ClipDistance9 SV_ClipDistance10 SV_ClipDistance11 '+
					'SV_CullDistance SV_CullDistance1 SV_CullDistance2 SV_CullDistance3 '+
					'SV_CullDistance4 SV_CullDistance5 SV_CullDistance6 SV_CullDistance7 '+
					'SV_CullDistance8 SV_CullDistance9 SV_CullDistance10 SV_CullDistance11 '+
					'SV_Coverage SV_Depth SV_DispatchThreadID SV_DomainLocation SV_GroupID '+
					'SV_GroupIndex SV_GroupThreadID SV_GSInstanceID SV_InsideTessFactor SV_IsFrontFace '+
					'SV_OutputControlPointID SV_Position SV_RenderTargetArrayIndex SV_SampleIndex '+
					'SV_Target0 SV_Target1 SV_Target2 SV_Target3 SV_Target4 SV_Target5 SV_Target6 '+
					'SV_Target7 SV_TessFactor SV_ViewportArrayIndex SV_InstanceID SV_PrimitiveID '+
					'SV_VertexID BINORMAL BINORMAL0 BINORMAL1 BINORMAL10 BINORMAL11 BINORMAL2 '+
					'BINORMAL3 BINORMAL4 BINORMAL5 BINORMAL6 BINORMAL7 BINORMAL8 BINORMAL9 '+
					'BLENDINDICES BLENDINDICES0 BLENDINDICES1 BLENDINDICES10 BLENDINDICES11 '+
					'BLENDINDICES2 BLENDINDICES3 BLENDINDICES4 BLENDINDICES5 BLENDINDICES6 BLENDINDICES7 '+
					'BLENDINDICES8 BLENDINDICES9 BLENDWEIGHTS BLENDWEIGHTS0 BLENDWEIGHTS1 BLENDWEIGHTS10 '+
					'BLENDWEIGHTS11 BLENDWEIGHTS2 BLENDWEIGHTS3 BLENDWEIGHTS4 BLENDWEIGHTS5 BLENDWEIGHTS6 '+
					'BLENDWEIGHTS7 BLENDWEIGHTS8 BLENDWEIGHTS9 COLOR0 COLOR1 COLOR10 COLOR11 COLOR12 '+
					'COLOR13 COLOR14 COLOR15 COLOR2 COLOR3 COLOR4 COLOR5 COLOR6 COLOR7 COLOR8 COLOR9 '+
					'DIFFUSE DIFFUSE0 DIFFUSE1 DIFFUSE10 DIFFUSE11 DIFFUSE2 DIFFUSE3 DIFFUSE4 DIFFUSE5 '+
					'DIFFUSE6 DIFFUSE7 DIFFUSE8 DIFFUSE9 FOG NORMAL NORMAL0 NORMAL1 NORMAL10 NORMAL11 '+
					'NORMAL2 NORMAL3 NORMAL4 NORMAL5 NORMAL6 NORMAL7 NORMAL8 NORMAL9 POSITION POSITION0 '+
					'POSITION1 POSITION10 POSITION11 POSITION2 POSITION3 POSITION4 POSITION5 POSITION6 '+
					'POSITION7 POSITION8 POSITION9 PSIZE PSIZE0 PSIZE1 PSIZE10 PSIZE11 PSIZE2 PSIZE3 '+
					'PSIZE4 PSIZE5 PSIZE6 PSIZE7 PSIZE8 PSIZE9 SPECULAR SPECULAR0 SPECULAR1 SPECULAR10 '+
					'SPECULAR11 SPECULAR2 SPECULAR3 SPECULAR4 SPECULAR5 SPECULAR6 SPECULAR7 SPECULAR8 '+
					'SPECULAR9 TANGENT TANGENT0 TANGENT1 TANGENT10 TANGENT11 TANGENT2 TANGENT3 TANGENT4 '+
					'TANGENT5 TANGENT6 TANGENT7 TANGENT8 TANGENT9 TESSFACTOR TESSFACTOR0 TESSFACTOR1 '+
					'TESSFACTOR10 TESSFACTOR11 TESSFACTOR2 TESSFACTOR3 TESSFACTOR4 TESSFACTOR5 TESSFACTOR6 '+
					'TESSFACTOR7 TESSFACTOR8 TESSFACTOR9 TEXCOORD TEXCOORD0 TEXCOORD1 TEXCOORD10 TEXCOORD11 '+
					'TEXCOORD12 TEXCOORD13 TEXCOORD14 TEXCOORD15 TEXCOORD19 TEXCOORD2 TEXCOORD3 TEXCOORD4 '+
					'TEXCOORD5 TEXCOORD6 TEXCOORD7 TEXCOORD8 TEXCOORD9 VFACE VPOS';
						
						
	this.regexList = [
		{ regex: SyntaxHighlighter.regexLib.singleLineCComments,	css: 'comments' },			// one line comments
		{ regex: SyntaxHighlighter.regexLib.multiLineCComments,		css: 'comments' },			// multiline comments
		{ regex: SyntaxHighlighter.regexLib.doubleQuotedString,		css: 'string' },			// strings
		{ regex: SyntaxHighlighter.regexLib.singleQuotedString,		css: 'string' },			// strings
		{ regex: /^ *#.*/gm,										css: 'preprocessor' },
		{ regex: new RegExp(this.getKeywords(datatypes), 'gm'),		css: 'color1 bold' },
		{ regex: new RegExp(this.getKeywords(intrinsic), 'gm'),		css: 'intrinsic bold' },
		{ regex: new RegExp(this.getKeywords(keywords), 'gm'),		css: 'keyword bold' },
		{ regex: new RegExp(this.getKeywords(keywords_ex), 'gm'),		css: 'keyword_ex bold' },
		{ regex: new RegExp(this.getKeywords(reserved), 'gm'),		css: 'reserved bold' }		
		];
};

SyntaxHighlighter.brushes.HLSL.prototype	= new SyntaxHighlighter.Highlighter();
SyntaxHighlighter.brushes.HLSL.aliases	= ['hlsl', 'vsh', 'psh', 'fx'];
