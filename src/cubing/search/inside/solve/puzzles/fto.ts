import { Alg } from "../../../../alg";
import type { KState } from "../../../../kpuzzle/KState";
import { puzzles } from "../../../../puzzles";
import { from } from "../../../../vendor/p-lazy/p-lazy";
import { mustBeInsideWorker } from "../../inside-worker";
import type { SGSCachedData } from "../parseSGS";
import { TrembleSolver } from "../tremble";

const dynamic = from<
  typeof import("./dynamic/unofficial/search-dynamic-unofficial")
>(() => import("./dynamic/unofficial/search-dynamic-unofficial"));

const TREMBLE_DEPTH = 3;

let cachedTrembleSolver: Promise<TrembleSolver> | null = null;
async function getCachedTrembleSolver(): Promise<TrembleSolver> {
  return (
    cachedTrembleSolver ||
    (cachedTrembleSolver = (async (): Promise<TrembleSolver> => {
      const json: SGSCachedData = await (await dynamic).sgsDataFTO();
      return new TrembleSolver(await puzzles["fto"].kpuzzle(), json, [
        "U",
        "R",
        "F",
        "L",
        "D",
        "B",
        "BR",
        "BL",
      ]);
    })())
  );
}

export async function preInitializeFTO(): Promise<void> {
  await getCachedTrembleSolver();
}

// TODO: centers
export async function solveFTO(state: KState): Promise<Alg> {
  mustBeInsideWorker();
  const trembleSolver = await getCachedTrembleSolver();
  const alg = await trembleSolver.solve(
    state,
    TREMBLE_DEPTH,
    () => 3, // TODO: Attach quantum move order lookup to puzzle.
  );
  return alg;
}

export async function randomFTOScramble(): Promise<Alg> {
  mustBeInsideWorker();
  const { randomFTOScrambleString } = await import(
    "../../../../vendor/xyzzy/fto-solver"
  );
  return new Alg(await randomFTOScrambleString());
}
