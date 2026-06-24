import { describe, expect, test } from "bun:test";
import { tokenize } from "./tokenize";

describe("tokenize", () => {
  const cases: Array<{ name: string; line: string; argv: string[] }> = [
    { name: "splits simple tokens", line: "a b c", argv: ["a", "b", "c"] },
    { name: "collapses runs of whitespace", line: "a  \t  b", argv: ["a", "b"] },
    { name: "trims leading and trailing whitespace", line: "  a b  ", argv: ["a", "b"] },
    { name: "groups a double-quoted span", line: 'add "Buy milk"', argv: ["add", "Buy milk"] },
    { name: "groups a single-quoted span", line: "add 'Buy milk'", argv: ["add", "Buy milk"] },
    { name: "concatenates quote adjacent to text", line: '--name="a b"', argv: ["--name=a b"] },
    { name: "concatenates text wrapping a quote", line: 'foo"bar baz"', argv: ["foobar baz"] },
    { name: "treats the other quote as literal", line: `"it's here"`, argv: ["it's here"] },
    { name: "returns nothing for empty input", line: "", argv: [] },
    { name: "returns nothing for whitespace only", line: "  \t ", argv: [] },
    {
      name: "consumes the rest after an unterminated quote",
      line: 'add "Buy milk',
      argv: ["add", "Buy milk"],
    },
  ];

  for (const { name, line, argv } of cases) {
    test(name, () => {
      expect(tokenize(line)).toEqual(argv);
    });
  }
});
