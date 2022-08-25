import { expect } from "../../../test/chai-workaround";
import { Move, Alg } from "../../alg";
import { KPuzzle } from "../../kpuzzle";
import { cube3x3x3KPuzzleDefinition } from "../../puzzles/implementations/dynamic/3x3x3/3x3x3.kpuzzle.json";

import { GanCube } from "./gan";

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
  const cubeRotationCases = ["x", "y", "z"];
  for (const cubeRotation of cubeRotationCases) {
    it(`should not touch '${cubeRotation}' moves`, () => {
      validateTransform({ from: new Move(cubeRotation), to: new Move(cubeRotation) });
    });

    it(`should not touch '${cubeRotation}' moves with rotation`, () => {
      validateTransform({ from: new Move(cubeRotation), to: new Move(cubeRotation), afterRotations: new Alg('x') });
    });
  }

  // after an X rotation , ULFRBD <- FLDRUB
  const faceCases = [
    {face: "F", expectedFace: "U"}, 
    {face: "L", expectedFace: "L"}, 
    {face: "D", expectedFace: "F"}, 
    {face: "R", expectedFace: "R"}, 
    {face: "U", expectedFace: "B"}, 
    {face: "B", expectedFace: "D"}, 
  ];
  for (const {face, expectedFace} of faceCases) {
    it(`should not touch '${face}' moves`, () => {
      validateTransform({ from: new Move(face), to: new Move(face) });
    });
    
    it(`should modify '${face}' to '${expectedFace}' moves with x rotation`, () => {
      validateTransform({ from: new Move(face), to: new Move(expectedFace), afterRotations: new Alg('x') });
    });
  }
});
