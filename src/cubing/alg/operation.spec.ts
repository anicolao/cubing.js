import { expect } from "../../test/chai-workaround";

import { Alg } from "./Alg";
import { experimentalAppendMove } from "./operation";
import { Move } from "./alg-nodes";

function testAppendMoveTransform({ start, move, result, options }) {
  it(`experimentalAppendMove of ${start} + ${move} => ${result}`, () =>
    expect(
      experimentalAppendMove(
      	new Alg(start), new Move(move), options).toString(),
    ).to.equal(result)
	);
}

function tests({ test, options, tests }) {
  tests.map(s => {
    let parts = s.split(/[+=]/);
    expect(parts.length).to.equal(3);
    testAppendMoveTransform({
      test,
      start: parts[0].trim(),
      move: parts[1].trim(),
      result: parts[2].trim(),
      options
    })
  });
}

describe("operation", () => {
  testAppendMoveTransform({
    test: "can append moves",
    start: "R U R'",
    move: "U2",
    result: "R U R' U2"
  });
  tests({ 
    test: "can append moves",
    options: {},
    tests: [
      "R U R' + R2' = R U R' R2'",
      "R U R' + R = R U R' R",
    ],
  });

  it("can coalesce appended moves", () => {
    expect(
      experimentalAppendMove(new Alg("R U R'"), new Move("U2"), {
        coalesce: true,
      }).isIdentical(new Alg("R U R' U2")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("R U R'"), new Move("R", -2), {
        coalesce: true,
      }).isIdentical(new Alg("R U R3'")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("R U R'"), new Move("R"), {
        coalesce: true,
      }).isIdentical(new Alg("R U")),
    ).to.be.true;
  });

  it("computes mod offsets correctly", () => {
    expect(
      experimentalAppendMove(new Alg("L3"), new Move("L"), {
        coalesce: true, mod: 4,
      }).isIdentical(new Alg("")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("L3"), new Move("L3"), {
        coalesce: true, mod: 4,
      }).isIdentical(new Alg("L2")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("L3"), new Move("L6"), {
        coalesce: true, mod: 4,
      }).isIdentical(new Alg("L")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("L"), new Move("L"), {
        coalesce: true, mod: 3,
      }).isIdentical(new Alg("L'")),
    ).to.be.true;
  });

  it("can generate wide moves", () => {
    expect(
      experimentalAppendMove(new Alg("L"), new Move("x"), {
        wideMoves: false,
      }).isIdentical(new Alg("L x")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("L"), new Move("x"), {
        wideMoves: true,
      }).isIdentical(new Alg("r")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("L'"), new Move("x'"), {
        wideMoves: true,
      }).isIdentical(new Alg("r'")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("R'"), new Move("x"), {
        wideMoves: true,
      }).isIdentical(new Alg("l'")),
    ).to.be.true;
    expect(
      experimentalAppendMove(new Alg("R"), new Move("x'"), {
        wideMoves: true,
      }).isIdentical(new Alg("l")),
    ).to.be.true;
  });

	testAppendMoveTransform({
		start: "L3", move: "L", result: "", 
		options: { coalesce: true, mod: 4, }
	});
	testAppendMoveTransform({
		start: "L3", move: "L3", result: "L2", 
		options: { coalesce: true, mod: 4, }
	});
	testAppendMoveTransform({
		start: "L3", move: "L6", result: "L", 
		options: { coalesce: true, mod: 2, }
	});
	testAppendMoveTransform({
		start: "L", move: "L", result: "L'", 
		options: { coalesce: true, mod: 3, }
	});

	testAppendMoveTransform({
		start: "L", move: "x", result: "L x", options: { wideMoves: false, }
	});
	testAppendMoveTransform({
		start: "L", move: "x", result: "r", options: { wideMoves: true, }
	});
	testAppendMoveTransform({
		start: "L'", move: "x'", result: "r'", options: { wideMoves: true, }
	});
	testAppendMoveTransform({
		start: "R", move: "x'", result: "l", options: { wideMoves: true, }
	});
	testAppendMoveTransform({
		start: "R", move: "x", result: "R x", options: { wideMoves: true, }
	});
	testAppendMoveTransform({
		start: "R'", move: "x", result: "l'", options: { wideMoves: true, }
	});
	testAppendMoveTransform({
		start: "R' R", move: "x", result: "R' R x",
		options: { wideMoves: true }
	});
	testAppendMoveTransform({
		start: "R' R", move: "x", result: "R' R x",
		options: { wideMoves: true, sliceMoves: true }
	});
	testAppendMoveTransform({
		start: "L' R", move: "x'", result: "M",
		options: { wideMoves: true, sliceMoves: true }
	});
	testAppendMoveTransform({
		start: "U' D", move: "y", result: "E'",
		options: { wideMoves: true, sliceMoves: true }
	});

  it("can concat algs", () => {
    expect(
      new Alg("R U2").concat(new Alg("F' D")).isIdentical(new Alg("R U2 F' D")),
    ).to.be.true;
    expect(
      Array.from(new Alg("R U2").concat(new Alg("U R'")).childAlgNodes())
        .length,
    ).to.equal(4);
    expect(
      new Alg("R U2").concat(new Alg("U R'")).isIdentical(new Alg("R U2 U R'")),
    ).to.be.true;
  });
});
