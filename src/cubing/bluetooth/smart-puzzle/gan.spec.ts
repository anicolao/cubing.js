import { expect } from "../../../test/chai-workaround";
import { Move, Alg } from "../../alg";
import { KPuzzle } from "../../kpuzzle";
import { cube3x3x3KPuzzleDefinition } from "../../puzzles/implementations/dynamic/3x3x3/3x3x3.kpuzzle.json";
import { GanCube, PhysicalState } from "./gan";

describe("GanCube", () => {
  const kpuzzle = new KPuzzle(cube3x3x3KPuzzleDefinition);
  const startState = kpuzzle.startState();

  interface TestCase {
    from: Move;
    to: Move;
    afterRotations?: Alg;
  }

  function validateTransform({ from, to, afterRotations }: TestCase) {
    const state = afterRotations
      ? startState.applyAlg(afterRotations)
      : startState;
    const newMove = GanCube.transformMove(from, state.stateData);
    expect(newMove.toString()).to.equal(to.toString());
    expect(newMove.isIdentical(to)).to.be.true;
  }

  function buildGanCube() {
    return new GanCube(
      kpuzzle,
      {} as BluetoothRemoteGATTService,
      {} as BluetoothRemoteGATTServer,
      {} as BluetoothRemoteGATTCharacteristic,
      0,
      null,
    );
  }

  const cubeRotationCases = ["x", "y", "z"];
  for (const cubeRotation of cubeRotationCases) {
    it(`should not touch '${cubeRotation}' moves`, () => {
      validateTransform({
        from: new Move(cubeRotation),
        to: new Move(cubeRotation),
      });
    });

    it(`should not touch '${cubeRotation}' moves with rotation`, () => {
      validateTransform({
        from: new Move(cubeRotation),
        to: new Move(cubeRotation),
        afterRotations: new Alg("x"),
      });
    });
  }

  // after an X rotation , ULFRBD <- FLDRUB
  const faceCases = [
    { face: "F", expectedFace: "U" },
    { face: "L", expectedFace: "L" },
    { face: "D", expectedFace: "F" },
    { face: "R", expectedFace: "R" },
    { face: "U", expectedFace: "B" },
    { face: "B", expectedFace: "D" },
  ];
  for (const { face, expectedFace } of faceCases) {
    it(`should not touch '${face}' moves`, () => {
      validateTransform({ from: new Move(face), to: new Move(face) });
    });

    it(`should modify '${face}' to '${expectedFace}' moves with x rotation`, () => {
      validateTransform({
        from: new Move(face),
        to: new Move(expectedFace),
        afterRotations: new Alg("x"),
      });
    });
  }

  it("should throw an error on unexpected faces", () => {
    expect(() =>
      validateTransform({ from: new Move("M"), to: new Move("M") }),
    ).to.throw("Failed to find face M");
  });

  it("should be created", () => {
    buildGanCube();
  });

  describe("applyMoves", () => {
    it("apply moves", () => {
      const ganCube = buildGanCube();
      // we think this rotation goes from WG -> YG
      const homeState = new Uint8Array([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3,
      ]);
      new PhysicalState(new DataView(homeState.buffer), 0).rotQuat();
      //expect(homeQuatInverse?.toString()).to.equal("foo");
      const array = new Uint8Array([
        0x0, 0x0, 0, 0x40, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3,
      ]);
      const physicalState = new PhysicalState(new DataView(array.buffer), 0);
      ganCube.applyMoves(physicalState, 0);
      expect(ganCube.kpuzzleToFacing(ganCube.state)).to.equal("YG");
    });
  });
});
