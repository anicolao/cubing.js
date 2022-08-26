import { expect } from "../../test/chai-workaround";

import { Alg } from "./Alg";
import { experimentalAppendMove } from "./operation";
import { Move } from "./alg-nodes";

function testAppendMoveTransform({ start, move, result, options, concat_algs }) {
  if (concat_algs) {
		it(`experimentalAppendMove of ${start} + ${move} => ${result}`, () =>
			 expect((new Alg(start)).concat(new Alg(move)).toString())
			   .to.equal(result)
			);
	} else {
		it(`experimentalAppendMove of ${start} + ${move} => ${result}`, () =>
			 expect(
				 experimentalAppendMove(
					 new Alg(start), new Move(move), options).toString(),
			 ).to.equal(result)
			);
	}
}

function tests({ test, options, tests, concat_algs }) {
  tests.map(s => {
    let parts = s.split(/[+=]/);
    expect(parts.length).to.equal(3);
    testAppendMoveTransform({
      test,
      start: parts[0].trim(),
      move: parts[1].trim(),
      result: parts[2].trim(),
      options,
      concat_algs,
    })
  });
}

describe("operation", () => {
  tests({ 
    test: "can append moves",
    options: {},
    tests: [
			"R U R' + U2 = R U R' U2",
      "R U R' + R2' = R U R' R2'",
      "R U R' + R = R U R' R",
    ],
  });

  tests({
  	test: "can coalesce appended moves",
		options: { coalesce: true, },
		tests: [
			"R U R' + U2 = R U R' U2",
			"R U R' + R2' = R U R3'",
			"R U R' + R = R U",
		],
  });

  tests({
  	test: "mod 4 works as expected",
  	options: { coalesce: true, mod: 4, },
		tests: [
			"L3 + L = ", 
			"L3 + L3 = L2", 
			"L3 + L6 = L", 
		],
	});
  tests({
  	test: "mod 3 works as expected",
  	options: { coalesce: true, mod: 3, },
		tests: [
			"L + L = L'", 
			"L3 + L3 = ", 
			"L3 + L6 = ", 
		],
	});

	tests({
		test: "wide moves not processed by default",
		options: {},
		tests: [ "L + x = L x" ],
	});
	tests({
		test: "wide moves",
		options: { wideMoves: true, },
		tests: [
			"L + x = r",
			"L' + x' = r'",
			"R + x' = l",
			"R + x = R x",
			"R' + x = l'",
			"R' R + x = R' R x",
		],
	});
	tests({
		test: "slice moves",
		options: { wideMoves: true, sliceMoves: true, },
		tests: [
			"R' R + x = R' R x",
			"L' R + x' = M",
			"L R' + x = M'",
			"L' R + x = L' R x",
			"U' D + y = E'",
		],
	});

  tests({
  	test: "can concat algs",
  	options: {},
  	concat_algs: true,
  	tests: [
      "R U2 + F' D = R U2 F' D",
      "R U2 + U R' = R U2 U R'",
		],
  });
	expect(
		Array.from(new Alg("R U2").concat(new Alg("U R'")).childAlgNodes())
			.length,
	).to.equal(4);
});
