import { expect } from "../../../test/chai-workaround";

import { Alg } from "../Alg";
import { setAlgPartTypeMismatchReportingLevel } from "../debug";
import { Example as Ex } from "../example";
import { Commutator, Grouping, Move, QuantumMove, Pause } from "../alg-nodes";

setAlgPartTypeMismatchReportingLevel("error");

const UU = new Alg([new Move("U", 1), new Move("U", 1)]);
const U2 = new Alg([new Move("U", 2)]);

describe("Alg", () => {
  it("allows an empty Alg", () => {
    expect(() => new Alg()).not.to.throw();
    expect(() => new Alg([])).not.to.throw();
    expect(() => new Commutator(new Alg(), new Alg([]))).not.to.throw();
  });

  it("throws an error for a nested Alg", () => {
    expect(() => new Alg([new Alg([new Move("R", 1)])])).to.throw(
      /An alg can only contain alg nodes./,
    );
  });
});

describe("BlockMove", () => {
  it("allows constructing: x, U, u", () => {
    expect(new Move("x", 1).toString()).to.eq("x");
    expect(new Move("U", 1).toString()).to.eq("U");
    expect(new Move("u", 1).toString()).to.eq("u");
  });

  it("allows constructing: 2U, 2u", () => {
    expect(new Move(new QuantumMove("U", 2), 1).toString()).to.eq("2U");
    expect(new Move("2U", 1).toString()).to.eq("2U");
    expect(new Move(new QuantumMove("u", 2), 1).toString()).to.eq("2u");
    expect(new Move("2u", 1).toString()).to.eq("2u");
  });

  it("prevents constructing: [-2]U, [-2]u", () => {
    expect(() => new QuantumMove("U", -2)).to.throw(
      /QuantumMove inner layer must be a positive integer/,
    );
  });

  it("allows constructing: 2-3u", () => {
    expect(new Move(new QuantumMove("u", 3, 2), 1).toString()).to.eq("2-3u");
  });

  it("prevents constructing: 2-3x, 2-3U, [-2]-3u, 4-3u", () => {
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Move(new QuantumMove("x",  3, 2, 1)])),
    // ).to.throwError(/cannot have an outer and inner layer/);
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Move(new QuantumMove("U",  3, 2, 1)])),
    // ).to.throwError(/cannot have an outer and inner layer/);
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Move(new QuantumMove("u", 3, -2), 1)])),
    // ).to.throwError(/Cannot have an outer layer of 0 or less/);
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Move(new QuantumMove("u", 3, 4), 1)])),
    // ).to.throwError(/The outer layer must be less than the inner layer/);
  });

  it("prevents constructing: w, 2T, 2-3q", () => {
    // expect(() =>algPartToStringForTesting(new Move("w", 1))).to.throwError(/Invalid SiGN plain move family: w/);
    // expect(() =>algPartToStringForTesting(new Move(new QuantumMove("T", 2), 1))).to.throwError(/The provided SiGN move family is invalid, or cannot have an inner slice: T/);
    // expect(() =>algPartToStringForTesting(new Move(new QuantumMove("q",  3, 2, 1))).to.throwError(/The provided SiGN move family is invalid, or cannot have an outer and inner layer: q/);
  });

  it("supports a default amount of 1.", () => {
    expect(new Alg([new Move("U")]).isIdentical(new Alg([new Move("U", 1)]))).to
      .be.true;
  });

  it("throws an error for an invalid family", () => {
    // expect(() => new Move("Q", 1)).to.throwError(/Invalid SiGN plain move family/);
  });

  it("has a default amount of 1", () => {
    expect(new Move("x").amount).to.eq(1);
    expect(new Move("R").amount).to.eq(1);
    expect(new Move("u").amount).to.eq(1);
    expect(new Move(new QuantumMove("R", 2)).amount).to.eq(1);
    expect(new Move(new QuantumMove("u", 3)).amount).to.eq(1);
    expect(new Move(new QuantumMove("u", 3, 2)).amount).to.eq(1);
  });

  it("allows different amounts 1", () => {
    expect(new Move("x", 2).amount).to.eq(2);
    expect(new Move("R", 3).amount).to.eq(3);
    expect(new Move("u", -5).amount).to.eq(-5);
    expect(new Move(new QuantumMove("R", 2), 10).amount).to.eq(10);
    expect(new Move(new QuantumMove("L", 3), -13).amount).to.eq(-13);
    expect(new Move(new QuantumMove("u", 12, 2), 15).amount).to.eq(15);
  });

  it("catches invalid moves with parseSiGN().", () => {
    // expect(() => parseSiGN("R")).not.to.throwError();
    // expect(() => parseSiGN("g")).to.throwError(/Invalid SiGN plain move family/);
    // expect(() => parseSiGN("2Ww")).to.throwError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("2-3T")).to.throwError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("2-3UF")).to.throwError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("4TEST_Hello")).to.throwError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("_R")).to.throwError(
    //   /Invalid SiGN plain move family/,
    // );
  });

  it("prevents construction a move quantum with only outer layer", () => {
    expect(() => new QuantumMove("R", undefined, 1)).to.throw();
  });
});

describe("algToString()", () => {
  it("converts all move types correctly", () => {
    expect(new Move("x", 2).toString()).to.eq("x2");
    expect(new Move("R", 3).toString()).to.eq("R3");
    expect(new Move("u", -5).toString()).to.eq("u5'");
    expect(new Move(new QuantumMove("R", 2), 10).toString()).to.eq("2R10");
    expect(new Move(new QuantumMove("L", 3), -13).toString()).to.eq("3L13'");
    expect(new Move(new QuantumMove("u", 12, 2), 15).toString()).to.eq(
      "2-12u15",
    );
  });

  it("distinguishes between 1R and R", () => {
    expect(new Move(new QuantumMove("R", 1)).toString()).to.eq("1R");
    expect(new Move("R").toString()).to.eq("R");
  });

  it("handles empty Algs", () => {
    expect(new Alg().toString()).to.eq("");
    expect(new Alg([]).toString()).to.eq("");
    expect(new Grouping(new Alg([])).toString()).to.eq("()");
    // TODO: Should this be "[,]"
    expect(
      new Alg([new Commutator(new Alg([]), new Alg([]))]).toString(),
    ).to.eq("[, ]");
  });

  it("converts Sune to string", () => {
    expect(Ex.Sune.toString()).to.eq("R U R' U R U2' R'");
  });

  it("converts U U to string", () => {
    expect(UU.toString()).to.eq("U U");
  });

  it("converts E-Perm to string", () => {
    expect(Ex.EPerm.toString()).to.eq("x' [[R: U'], D] [[R: U], D] x");
  });

  it("converts triple pause to . . . (with spaces)", () => {
    expect(Ex.TriplePause.toString()).to.eq(". . .");
  });
});

describe("invert()", () => {
  it("correctly inverts", () => {
    expect(Ex.Sune.invert().isIdentical(Ex.AntiSune)).to.be.true;
    expect(Ex.Sune.invert().invert().isIdentical(Ex.Sune)).to.be.true;
    expect(Ex.Sune.invert().invert().isIdentical(Ex.AntiSune)).to.be.false;
  });
});

describe("expand()", () => {
  it("correctly expands", () => {
    expect(Ex.FURURFCompact.expand().isIdentical(Ex.FURURFMoves)).to.be.true;
    expect(Ex.Sune.expand().isIdentical(Ex.Sune)).to.be.true;
    expect(Ex.SuneCommutator.expand().isIdentical(Ex.Sune)).to.be.false;
    expect(Ex.FURURFCompact.expand().isIdentical(Ex.SuneCommutator)).to.be
      .false;
  });

  it("correctly expands a group with two alg nodes", () => {
    expect(new Alg("(R U)2").expand().isIdentical(new Alg("R U R U"))).to.be
      .true;
  });

  it("correctly expands an E-Perm", () => {
    expect(
      Ex.EPerm.expand().isIdentical(
        new Alg("x' R U' R' D R U R' D' R U R' D R U' R' D' x"),
      ),
    ).to.be.true;
  });
});

describe("toBeIdentical", () => {
  it("correctly compares algs", () => {
    expect(Ex.FURURFCompact.isIdentical(Ex.FURURFMoves)).to.be.false;
    expect(Ex.FURURFMoves.isIdentical(Ex.FURURFCompact)).to.be.false;
    expect(Ex.FURURFMoves.isIdentical(Ex.FURURFMoves)).to.be.true;
    expect(Ex.FURURFCompact.isIdentical(Ex.FURURFCompact)).to.be.true;
  });
});

describe("move collapsing ()", () => {
  it("coalesces U U to U2", () => {
    expect(UU.simplify({ collapseMoves: true }).isIdentical(U2)).to.be.true;
  });

  it("coalesces expanded commutator Sune corectly", () => {
    expect(
      Ex.SuneCommutator.expand()
        .simplify({ collapseMoves: true })
        .isIdentical(Ex.Sune),
    ).to.be.true;
  });
});

describe("JSON", () => {
  // it("round-trips an alg through JSON stringification", () => {
  //   e(
  //     fromJSON(JSON.parse(JSON.stringify(Ex.FURURFCompact))),
  //     Ex.FURURFCompact,
  //   ).to.eq(true);
  // });
});

describe("Object Freezing", () => {
  it("freezes all example alg types", () => {
    // // Update this based on the length of AllAlgParts.
    // expect(Ex.AllAlgParts.length).to.eq(8);
    // for (const a of Ex.AllAlgParts) {
    //   expect(Object.isFrozen(a)).to.eq(true);
    // }
  });

  // it("makes it impossible to modify a BaseMove", () => {
  //   const b = new Move("R", 4);
  //   let caughtErr: Error | undefined;
  //   try {
  //     b.effectiveAmount = 2;
  //   } catch (err) {
  //     caughtErr = err;
  //   }
  //   expect(caughtErr instanceof TypeError).to.eq(true);
  // });
});

describe("Parser", () => {
  it("parses an empty Alg", () => {
    expect(new Alg("").isIdentical(new Alg())).to.be.true;
    expect(
      Alg.fromString("()").isIdentical(new Alg([new Grouping(new Alg([]))])),
    ).to.be.true;
    expect(new Alg("").isIdentical(new Alg())).to.be.true;
    expect(
      Alg.fromString("()").isIdentical(new Alg([new Grouping(new Alg([]))])),
    ).to.be.true;
  });

  it("parses a Sune", () => {
    expect(new Alg("R U R' U R U2' R'").isIdentical(Ex.Sune)).to.be.true;
    expect(Alg.fromString("R U R' U R U2' R'").isIdentical(Ex.Sune)).to.be.true;
    expect(
      new Alg("R U R' U R U2' R'").isIdentical(
        Alg.fromString("R U R' U R U2' R'"),
      ),
    ).to.be.true;
  });

  it("parses U u Uw x 2U 2u 2Uw 2-3u 2-3Uw", () => {
    const s = "U u Uw x 2U 2u 2Uw 2-3u 2-3Uw";
    expect(new Alg(s).toString()).to.eq(s);
  });

  it("parses . . .", () => {
    const p = new Pause();
    expect(new Alg(". . .").isIdentical(new Alg([p, p, p]))).to.be.true;
  });

  // TODO: Should these be parsed differently?
  it("parses R and R1 as the same (for now)", () => {
    expect(new Alg("R").isIdentical(new Alg("R1"))).to.be.true;
  });

  it("round-trips algs through a string", () => {
    expect(new Alg(Ex.SuneCommutator.toString()).isIdentical(Ex.SuneCommutator))
      .to.be.true;
    expect(new Alg(Ex.Niklas.toString()).isIdentical(Ex.Niklas)).to.be.true;
    expect(new Alg(Ex.FURURFCompact.toString()).isIdentical(Ex.FURURFCompact))
      .to.be.true;
    expect(new Alg(Ex.APermCompact.toString()).isIdentical(Ex.APermCompact)).to
      .be.true;
    expect(new Alg(Ex.TPerm.toString()).isIdentical(Ex.TPerm)).to.be.true;
    expect(new Alg(Ex.HeadlightSwaps.toString()).isIdentical(Ex.HeadlightSwaps))
      .to.be.true;
    expect(new Alg(Ex.TriplePause.toString()).isIdentical(Ex.TriplePause)).to.be
      .true;
  });

  // it("round-trips all alg types through a string", () => {
  //   // Update this based on the length of AllAlgParts.
  //   for (const a of Ex.AllAlgParts) {
  //     const seq = matchesAlgType(a, "Alg") ? (a as Alg) : new Alg([a]);
  //     expect(new Alg(algToString(seq)).isIdentical(seq)).to.be.true;
  //   }
  // });
});

describe("Validator", () => {
  // it("can validate flat algs", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateFlatAlg] }),
  //   ).to.throwError(/cannot contain a group/); // toThrowError(ValidationError, /cannot contain a group/);
  //   expect(
  //     () => new Alg("Qw", { validators: [validateFlatAlg] }),
  //   ).not.to.throw(); // not.to.throwError();
  //   expect(
  //     () => new Alg("(Qw)", { validators: [validateFlatAlg] }),
  //   ).to.throwError(/cannot contain a group/); // toThrowError(ValidationError, );
  // });
  // it("can validate cube base moves alg", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateSiGNMoves] }),
  //   ).not.to.throwError();
  //   expect(
  //     () => new Alg("Qw", { validators: [validateSiGNMoves] }),
  //   ).to.throwError(/Invalid SiGN plain move family/);
  //   expect(
  //     () => new Alg("(Qw)", { validators: [validateSiGNMoves] }),
  //   ).to.throwError(/Invalid SiGN plain move family/);
  // });
  // it("can validate cube algs", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateSiGNAlg] }),
  //   ).to.throwError(/cannot contain a group/);
  //   expect(() => new Alg("Qw", { validators: [validateSiGNAlg] })).to.throwError(
  //     /Invalid SiGN plain move family/,
  //   );
  //   expect(
  //     () => new Alg("(Qw)", { validators: [validateSiGNAlg] }),
  //   ).to.throwError(ValidationError);
  // });
  // it("throws ValidationError", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateFlatAlg] }),
  //   ).to.throwError(ValidationError);
  // });
});
