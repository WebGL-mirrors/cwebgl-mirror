/*
Copyright (c) 2011 Cimaron Shanahan

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


var glsl = (function(ARB) {

	/**
	 * Local Scope
	 */
	var glsl, initialized;

	/**
	 * parse_state object
	 */
	function parse_state(target) {
		this.es_shader = true;
		this.language_version = 110;
		this.translation_unit = [];
		this.symbols = new glsl.symbol_table();
		this.target = target;
		this.scanner = glsl.lexer;
	};

	/**
	 * Get next token from lexer
	 *
	 * @param   object    Reference to array to store token in
	 * @param   object    Reference to array to store location of token in source file
	 * @param   object    Unused
	 *
	 * @return  boolean
	 */
	function next_token(yylval, yylloc, scanner) {
		lexer.yylval = {};
		var result = lexer.lex();
		if (result == 1) {
			result = 0; //YYEOF	
		}
		yylval[0] = lexer.yylval;
		yylloc[0] = lexer.yylloc;
		return result;
	}

	/*IF DEBUG
	function print_token_value(yyoutput, yytoknum, yyvaluep) {
		glsl.fprintf(2, JSON.stringify(yyvaluep).replace(/"/g, ''));
	}
	*/

	/**
	 * Store parse error
	 *
	 * @param   object    Location of error
	 * @param   object    Unused
	 * @param   object    Error string
	 */
	function print_error(yylloc, state, error) {
		glsl.errors.push(error + " at line " + yylloc.first_line + " column " + yylloc.first_column);
	}

	/**
	 * Compiler object
	 */
	glsl = {

		/**
		 * Compilation mode enumerations
		 */
		mode : {
			vertex : 1,
			fragment : 0
		},

		/**
		 * Compilation results
		 */
		errors : [],

		//expose to lexer/parser
		token : null,
		parseError : function(str, hash) {
			yyerror(lexer.yylloc, state, str);
		},

		initialize : function() {

			//lexer
			this.lexer.yy = this;

			//parser
			this.parser.yy = this;

			this.parser.yylex = next_token;
			this.parser.yyerror = print_error;
			/*IF DEBUG
			this.parser.YYPRINT = print_token_value;
			*/
			//this.parser.initialize_types = initialize_types;

			this.token = this.parser.yytokentype;
			this.symbols = null;
		},
		
		prepareSymbols : function() {
			var symbols, i, symbol, sym;

			symbols = {
				uniforms : [],
				attributes : []
			};

			for (i in this.state.symbols.table) {
				
				symbol = this.state.symbols.get_variable(i);
				if (!symbol || !symbol.qualifier) {
					continue;
				}

				sym = {
					name : i,
					type : symbol.type,
					slots : glsl.type.slots[symbol.type],
					components : glsl.type.size[symbol.type] / glsl.type.slots[symbol.type]
				};

				switch (symbol.qualifier) {
					case glsl.ast.type_qualifier.flags.attribute:
						symbols.attributes.push(sym);
						break;
					case glsl.ast.type_qualifier.flags.uniform:
						symbols.uniforms.push(sym);
						break;
				}
			}

			return symbols;			
		},

		getSymbols : function(source, target) {
			var symbols, i, symbol, sym;

			if (!initialized) {
				this.initialize();
				initialized = true;
			}

			//reset output
			this.output = null;
			this.errors = [];
			this.state = new parse_state(target);

			//preprocess
			source = this.preprocess(source, this.state);
			if (!source) {
				return false;
			}

			//scan/parse
			lexer.setInput(source);
			//need to get errors here
			if (this.parser.yyparse(this.state) != 0) {
				return false;
			}

			if (!this.generate_ir(this.state)) {
				return false;	
			}

			this.symbols = this.prepareSymbols();

			return this.symbols;
		},

		compile : function(source, target) {
			var status, irs;

			if (!initialized) {
				this.initialize();
				initialized = true;
			}

			//reset output
			this.output = null;
			this.errors = [];
			this.symbols = null;
			this.state = new parse_state(target);

			//preprocess
			source = this.preprocess(source, this.state);
			if (!source) {
				return false;
			}

			//scan/parse
			lexer.setInput(source);
			//need to get errors here
			if (this.parser.yyparse(this.state) != 0) {
				return false;
			}

			//generate IR code
			irs = this.generate_ir(this.state);
			if (!irs) {
				return false;
			}

			//optimize
			//@todo:

			//generate ARB code
			this.output = this.generate_arb(irs, this.state);

			this.symbols = this.prepareSymbols();

			status = (this.output ? true : false)
			return status;
		}
	};

	return glsl;
}(ARB));

include('glsl/symbol.js');
include('glsl/preprocessor.js');
include('glsl/lexer.js');
include('glsl/lexer_extern.js');
include('glsl/parser.js');
//include('glsl/parser_debug.js');
include('glsl/builtin.js');
include('glsl/ast.js');
include('glsl/type.js');
include('glsl/ir.js');
include('glsl/ir_generator.js');
include('glsl/ir_generator_tables.php');
include('glsl/generator.js');

include('glsl/linker/linker.js');

