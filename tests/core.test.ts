import { describe, expect, test } from 'vitest';
import { ParserCore } from '../src/parserCore';

describe('Core Parser Tests', () => {
  test('One row', () => {
    const actual = new ParserCore({}).parse('A,b,c');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'b', 'c']]);
    // expect(actual.meta).toMatchObject({ delimiter: ',', renamedHeaders: null });
  });

  test('Two rows', () => {
    const actual = new ParserCore({}).parse('A,b,c\nd,E,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['A', 'b', 'c'],
      ['d', 'E', 'f'],
    ]);
  });

  test('Three rows', () => {
    const actual = new ParserCore({}).parse('A,b,c\nd,E,f\nG,h,i');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['A', 'b', 'c'],
      ['d', 'E', 'f'],
      ['G', 'h', 'i'],
    ]);
  });

  test('Whitespace at edges of unquoted field', () => {
    // Extra whitespace should graciously be preserved
    const actual = new ParserCore({}).parse('a,	b ,c');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', '	b ', 'c']]);
  });

  test('Quoted field', () => {
    const actual = new ParserCore({}).parse('A,"B",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'B', 'C']]);
  });

  test('Quoted field with extra whitespace on edges', () => {
    const actual = new ParserCore({}).parse('A," B  ",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', ' B  ', 'C']]);
  });

  test('Quoted field with delimiter', () => {
    const actual = new ParserCore({}).parse('A,"B,B",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'B,B', 'C']]);
  });

  test('Quoted field with line break', () => {
    const actual = new ParserCore({}).parse('A,"B\nB",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'B\nB', 'C']]);
  });

  test('Quoted fields with line breaks', () => {
    const actual = new ParserCore({}).parse('A,"B\nB","C\nC\nC"');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'B\nB', 'C\nC\nC']]);
  });

  test('Quoted fields at end of row with delimiter and line break', () => {
    const actual = new ParserCore({}).parse('a,b,"c,c\nc"\nd,e,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c,c\nc'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Quoted field with escaped quotes', () => {
    const actual = new ParserCore({}).parse('A,"B""B""B",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'B"B"B', 'C']]);
  });

  test('Quoted field with escaped quotes at boundaries', () => {
    const actual = new ParserCore({}).parse('A,"""B""",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', '"B"', 'C']]);
  });

  test('Unquoted field with quotes at end of field', () => {
    // The quotes character is misplaced, but shouldn't generate an error or break the parser
    const actual = new ParserCore({}).parse('A,B",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'B"', 'C']]);
  });

  test('Quoted field with quotes around delimiter', () => {
    // For a boundary to exist immediately before the quotes, we must not already be in quotes
    const actual = new ParserCore({}).parse('A,""",""",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', '","', 'C']]);
  });

  test('Quoted field with quotes on right side of delimiter', () => {
    // Similar to the test above but with quotes only after the comma
    const actual = new ParserCore({}).parse('A,",""",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', ',"', 'C']]);
  });

  test('Quoted field with quotes on left side of delimiter', () => {
    // Similar to the test above but with quotes only before the comma
    const actual = new ParserCore({}).parse('A,""",",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', '",', 'C']]);
  });

  test('Quoted field with 5 quotes in a row and a delimiter in there, too', () => {
    // Actual input reported in issue #121
    const actual = new ParserCore({}).parse('"1","cnonce="""",nc=""""","2"');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['1', 'cnonce="",nc=""', '2']]);
  });

  test('Quoted field with whitespace around quotes', () => {
    // The quotes must be immediately adjacent to the delimiter to indicate a quoted field
    const actual = new ParserCore({}).parse('A, "B" ,C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', ' "B" ', 'C']]);
  });

  test('Misplaced quotes in data, not as opening quotes', () => {
    // The input is technically malformed, but this syntax should not cause an error
    const actual = new ParserCore({}).parse('A,B "B",C');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['A', 'B "B"', 'C']]);
  });

  test('Quoted field has no closing quote', () => {
    const actual = new ParserCore({}).parse('a,"b,c\nd,e,f');
    expect(actual.errors).toEqual([
      {
        type: 'Quotes',
        code: 'MissingQuotes',
        message: 'Quoted field unterminated',
        row: 0,
        index: 3,
      },
    ]);
    expect(actual.data).toEqual([['a', 'b,c\nd,e,f']]);
  });

  test('Quoted field has invalid trailing quote after delimiter with a valid closer', () => {
    // The input is malformed, opening quotes identified, trailing quote is malformed.
    // Trailing quote should be escaped or followed by valid new line or delimiter to be valid
    const actual = new ParserCore({}).parse('"a,"b,c"\nd,e,f');
    expect(actual.errors).toEqual([
      {
        type: 'Quotes',
        code: 'InvalidQuotes',
        message: 'Trailing quote on quoted field is malformed',
        row: 0,
        index: 1,
      },
    ]);
    expect(actual.data).toEqual([['a,"b,c'], ['d', 'e', 'f']]);
  });

  test('Quoted field has invalid trailing quote after delimiter', () => {
    // The input is malformed, opening quotes identified, trailing quote is malformed.
    // Trailing quote should be escaped or followed by valid new line or delimiter to be valid
    const actual = new ParserCore({}).parse('a,"b,"c\nd,e,f');
    expect(actual.errors).toEqual([
      {
        type: 'Quotes',
        code: 'InvalidQuotes',
        message: 'Trailing quote on quoted field is malformed',
        row: 0,
        index: 3,
      },
      {
        type: 'Quotes',
        code: 'MissingQuotes',
        message: 'Quoted field unterminated',
        row: 0,
        index: 3,
      },
    ]);
    expect(actual.data).toEqual([['a', 'b,"c\nd,e,f']]);
  });

  test('Quoted field has invalid trailing quote before delimiter', () => {
    // The input is malformed, opening quotes identified, trailing quote is malformed.
    // Trailing quote should be escaped or followed by valid new line or delimiter to be valid
    const actual = new ParserCore({}).parse('a,"b"c,d\ne,f,g');
    expect(actual.errors).toEqual([
      {
        type: 'Quotes',
        code: 'InvalidQuotes',
        message: 'Trailing quote on quoted field is malformed',
        row: 0,
        index: 3,
      },
      {
        type: 'Quotes',
        code: 'MissingQuotes',
        message: 'Quoted field unterminated',
        row: 0,
        index: 3,
      },
    ]);
    expect(actual.data).toEqual([['a', 'b"c,d\ne,f,g']]);
  });

  test('Quoted field has invalid trailing quote after new line', () => {
    // The input is malformed, opening quotes identified, trailing quote is malformed.
    // Trailing quote should be escaped or followed by valid new line or delimiter to be valid
    const actual = new ParserCore({}).parse('a,"b,c\nd"e,f,g');
    expect(actual.errors).toEqual([
      {
        type: 'Quotes',
        code: 'InvalidQuotes',
        message: 'Trailing quote on quoted field is malformed',
        row: 0,
        index: 3,
      },
      {
        type: 'Quotes',
        code: 'MissingQuotes',
        message: 'Quoted field unterminated',
        row: 0,
        index: 3,
      },
    ]);
    expect(actual.data).toEqual([['a', 'b,c\nd"e,f,g']]);
  });

  test('Quoted field has valid trailing quote via delimiter', () => {
    // Trailing quote is valid due to trailing delimiter
    const actual = new ParserCore({}).parse('a,"b",c\nd,e,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Quoted field has valid trailing quote via \\n', () => {
    // Trailing quote is valid due to trailing new line delimiter
    const actual = new ParserCore({}).parse('a,b,"c"\nd,e,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Quoted field has valid trailing quote via EOF', () => {
    // Trailing quote is valid due to EOF
    const actual = new ParserCore({}).parse('a,b,c\nd,e,"f"');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Quoted field contains delimiters and \\n with valid trailing quote', () => {
    // Trailing quote is valid due to trailing delimiter
    const actual = new ParserCore({}).parse('a,"b,c\nd,e,f"');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', 'b,c\nd,e,f']]);
  });

  test('Line starts with quoted field', () => {
    const actual = new ParserCore({}).parse('a,b,c\n"d",e,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Line starts with unquoted empty field', () => {
    const actual = new ParserCore({}).parse(',b,c\n"d",e,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Line ends with quoted field', () => {
    const actual = new ParserCore({}).parse(
      'a,b,c\nd,e,f\n"g","h","i"\n"j","k","l"',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
      ['g', 'h', 'i'],
      ['j', 'k', 'l'],
    ]);
  });

  test('Line ends with quoted field, first field of next line is empty, \\n', () => {
    const actual = new ParserCore({ newline: '\n' }).parse(
      'a,b,c\n,e,f\n,"h","i"\n,"k","l"',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['', 'e', 'f'],
      ['', 'h', 'i'],
      ['', 'k', 'l'],
    ]);
  });

  test('Quoted field at end of row (but not at EOF) has quotes', () => {
    const actual = new ParserCore({}).parse('a,b,"c""c"""\nd,e,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c"c"'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Empty quoted field at EOF is empty', () => {
    const actual = new ParserCore({}).parse('a,b,""\na,b,""');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', ''],
      ['a', 'b', ''],
    ]);
  });

  test('Multiple consecutive empty fields', () => {
    const actual = new ParserCore({}).parse('a,b,,,c,d\n,,e,,,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', '', '', 'c', 'd'],
      ['', '', 'e', '', '', 'f'],
    ]);
  });

  test('Empty input string', () => {
    const actual = new ParserCore({}).parse('');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([]);
  });

  test('Input is just the delimiter (2 empty fields)', () => {
    const actual = new ParserCore({}).parse(',');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['', '']]);
  });

  test('Input is just empty fields', () => {
    const actual = new ParserCore({}).parse(',,\n,,,');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['', '', ''],
      ['', '', '', ''],
    ]);
  });

  test('Input is just a string (a single field)', () => {
    const actual = new ParserCore({}).parse('Abc def');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['Abc def']]);
  });

  test('Commented line at beginning', () => {
    const actual = new ParserCore({ comments: '#' }).parse('# Comment!\na,b,c');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', 'b', 'c']]);
  });

  test('Commented line in middle', () => {
    const actual = new ParserCore({ comments: '#' }).parse(
      'a,b,c\n# Comment\nd,e,f',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Commented line at end', () => {
    const actual = new ParserCore({ comments: '#' }).parse(
      'a,true,false\n# Comment',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', 'true', 'false']]);
  });

  test('Two comment lines consecutively', () => {
    const actual = new ParserCore({ comments: '#' }).parse(
      'a,b,c\n#comment1\n#comment2\nd,e,f',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Two comment lines consecutively at end of file', () => {
    const actual = new ParserCore({ comments: '#' }).parse(
      'a,b,c\n#comment1\n#comment2',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', 'b', 'c']]);
  });

  test('Three comment lines consecutively at beginning of file', () => {
    const actual = new ParserCore({ comments: '#' }).parse(
      '#comment1\n#comment2\n#comment3\na,b,c',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', 'b', 'c']]);
  });

  test('Entire file is comment lines', () => {
    const actual = new ParserCore({ comments: '#' }).parse(
      '#comment1\n#comment2\n#comment3',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([]);
  });

  test('Comment with non-default character', () => {
    const actual = new ParserCore({ comments: '!' }).parse(
      'a,b,c\n!Comment goes here\nd,e,f',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Multi-character comment string', () => {
    const actual = new ParserCore({ comments: '=N(' }).parse(
      'a,b,c\n=N(Comment)\nd,e,f',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Input with only a commented line', () => {
    const actual = new ParserCore({ comments: '#', delimiter: ',' }).parse(
      '#commented line',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([]);
  });

  test('Input with only a commented line and blank line after', () => {
    const actual = new ParserCore({ comments: '#', delimiter: ',' }).parse(
      '#commented line\n',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['']]);
  });

  test('Input with only a commented line, without comments enabled', () => {
    const actual = new ParserCore({ delimiter: ',' }).parse('#commented line');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['#commented line']]);
  });

  test('Input without comments with line starting with whitespace', () => {
    // " " == false, but " " !== false, so === comparison is required
    const actual = new ParserCore({ delimiter: ',' }).parse('a\n b\nc');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a'], [' b'], ['c']]);
  });

  test('Multiple rows, one column (no delimiter found)', () => {
    const actual = new ParserCore({}).parse('a\nb\nc\nd\ne');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a'], ['b'], ['c'], ['d'], ['e']]);
  });

  test('One column input with empty fields', () => {
    const actual = new ParserCore({}).parse('a\nb\n\n\nc\nd\ne\n');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a'],
      ['b'],
      [''],
      [''],
      ['c'],
      ['d'],
      ['e'],
      [''],
    ]);
  });

  test('Fast mode, basic', () => {
    const actual = new ParserCore({ fast: true }).parse('a,b,c\nd,e,f');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Fast mode with comments', () => {
    const actual = new ParserCore({ fast: true, comments: '//' }).parse(
      '// Commented line\na,b,c',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', 'b', 'c']]);
  });

  test('Fast mode with limit', () => {
    const actual = new ParserCore({ fast: true, limit: 2 }).parse(
      'a,b,c\nd,e,f\nh,j,i\n',
    );
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  test('Fast mode with blank line at end', () => {
    const actual = new ParserCore({ fast: true }).parse('a,b,c\n');
    expect(actual.errors).toEqual([]);
    expect(actual.data).toEqual([['a', 'b', 'c'], ['']]);
  });

  // test('Simple duplicated header names', () => {
  //   const actual = new ParserCore({ header: true }).parse('A,A,A,A\n1,2,3,4');
  //   expect(actual.errors).toEqual([]);
  //   expect(actual.data).toEqual([
  //     ['A', 'A_1', 'A_2', 'A_3'],
  //     ['1', '2', '3', '4'],
  //   ]);
  //   expect(actual.meta).toMatchObject({
  //     renamedHeaders: { A_1: 'A', A_2: 'A', A_3: 'A' },
  //     cursor: 15,
  //   });
  // });

  // test('Duplicated header names with headerTransform', () => {
  //   const actual = new ParserCore({
  //     header: true,
  //     transformHeader: (header: string) => header.toLowerCase(),
  //   }).parse('A,A,A,A\n1,2,3,4');
  //   expect(actual.errors).toEqual([]);
  //   expect(actual.data).toEqual([
  //     ['a', 'a_1', 'a_2', 'a_3'],
  //     ['1', '2', '3', '4'],
  //   ]);
  //   expect(actual.meta).toMatchObject({
  //     renamedHeaders: { a_1: 'a', a_2: 'a', a_3: 'a' },
  //     cursor: 15,
  //   });
  // });

  // test('Duplicated header names existing column', () => {
  //   const actual = new ParserCore({ header: true }).parse('c,c,c,c_1\n1,2,3,4');
  //   expect(actual.errors).toEqual([]);
  //   expect(actual.data).toEqual([
  //     ['c', 'c_2', 'c_3', 'c_1'],
  //     ['1', '2', '3', '4'],
  //   ]);
  //   expect(actual.meta).toMatchObject({
  //     renamedHeaders: { c_2: 'c', c_3: 'c' },
  //     cursor: 17,
  //   });
  // });
});
