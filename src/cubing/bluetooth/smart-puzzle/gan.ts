/* tslint:disable no-bitwise */

import { Vector3, Quaternion } from "three";
import { Move } from "../../alg";
import type { KPuzzle, KStateData } from "../../kpuzzle";
import { KState } from "../../kpuzzle";
import { puzzles } from "../../puzzles";
import {
  importKey,
  unsafeDecryptBlock,
} from "../../vendor/unsafe-raw-aes/unsafe-raw-aes";
import { debugLog } from "../debug";
import { BluetoothConfig, BluetoothPuzzle } from "./bluetooth-puzzle";

// This needs to be short enough to capture 6 moves (OBQTM).
const DEFAULT_INTERVAL_MS = 150;
// Number of latest moves provided by the Gan 356i.
const MAX_LATEST_MOVES = 6;

const ganMoveToBlockMove: { [i: number]: Move } = {
  0x00: new Move("U"),
  0x02: new Move("U", -1),
  0x03: new Move("R"),
  0x05: new Move("R", -1),
  0x06: new Move("F"),
  0x08: new Move("F", -1),
  0x09: new Move("D"),
  0x0b: new Move("D", -1),
  0x0c: new Move("L"),
  0x0e: new Move("L", -1),
  0x0f: new Move("B"),
  0x11: new Move("B", -1),
};
const facings: string[] = [];
const facingToRotationMove: { [k: string]: Move } = {};

let homeQuatInverse: Quaternion | null = null;

function probablyDecodedCorrectly(data: Uint8Array): boolean {
  return (
    data[13] < 0x12 &&
    data[14] < 0x12 &&
    data[15] < 0x12 &&
    data[16] < 0x12 &&
    data[17] < 0x12 &&
    data[18] < 0x12
  );
}

const key10 = new Uint8Array([
  198, 202, 21, 223, 79, 110, 19, 182, 119, 13, 230, 89, 58, 175, 186, 162,
]);
const key11 = new Uint8Array([
  67, 226, 91, 214, 125, 220, 120, 216, 7, 96, 163, 218, 130, 60, 1, 241,
]);

// Clean-room reverse-engineered
async function decryptState(
  data: Uint8Array,
  aesKey: CryptoKey | null,
): Promise<Uint8Array> {
  if (aesKey === null) {
    return data;
  }

  const copy = new Uint8Array(data);
  copy.set(new Uint8Array(await unsafeDecryptBlock(aesKey, copy.slice(3))), 3);
  copy.set(
    new Uint8Array(await unsafeDecryptBlock(aesKey, copy.slice(0, 16))),
    0,
  );

  if (probablyDecodedCorrectly(copy)) {
    return copy;
  }

  throw new Error("Invalid Gan cube state");
}

class PhysicalState {
  public static async read(
    characteristic: BluetoothRemoteGATTCharacteristic,
    aesKey: CryptoKey | null,
  ): Promise<PhysicalState> {
    const value = await decryptState(
      new Uint8Array((await characteristic.readValue()).buffer),
      aesKey,
    );
    const timeStamp = Date.now();
    // console.log(value);
    return new PhysicalState(new DataView(value.buffer), timeStamp);
  }

  private arr: Uint8Array;
  private arrLen = 19;
  private constructor(private dataView: DataView, public timeStamp: number) {
    this.arr = new Uint8Array(dataView.buffer);
    if (this.arr.length !== this.arrLen) {
      throw new Error("Unexpected array length");
    }
  }

  public rotQuat(): Quaternion {
    let x = this.dataView.getInt16(0, true) / 16384;
    let y = this.dataView.getInt16(2, true) / 16384;
    let z = this.dataView.getInt16(4, true) / 16384;
    [x, y, z] = [-y, z, -x];
    const wSquared = 1 - (x * x + y * y + z * z);
    const w = wSquared > 0 ? Math.sqrt(wSquared) : 0;
    const quat = new Quaternion(x, y, z, w);

    if (!homeQuatInverse) {
      homeQuatInverse = quat.clone().invert();
    }

    return quat.clone().multiply(homeQuatInverse.clone());
  }

  // Loops from 255 to 0.
  public moveCounter(): number {
    return this.arr[12];
  }

  public numMovesSince(previousMoveCounter: number): number {
    return (this.moveCounter() - previousMoveCounter) & 0xff;
  }

  // Due to the design of the Gan356i protocol, it's common to query for the
  // latest physical state and find 0 moves have been performed since the last
  // query. Therefore, it's useful to allow 0 as an argument.
  public latestMoves(n: number, rotation: string): Move[] {
    if (n < 0 || n > MAX_LATEST_MOVES) {
      throw new Error(`Must ask for 0 to 6 latest moves. (Asked for ${n})`);
    }
		const moves = Array.from(this.arr.slice(19 - n, 19)).map((i) => ganMoveToBlockMove[i]);
		const rotationMove = facingToRotationMove[rotation];
		if (rotationMove) {
			moves.push(rotationMove);
		}
    return moves;
  }

  public debugInfo(): { arr: Uint8Array } {
    return {
      arr: this.arr,
    };
  }
}

// TODO: Short IDs
const UUIDs = {
  ganCubeService: "0000fff0-0000-1000-8000-00805f9b34fb",
  physicalStateCharacteristic: "0000fff5-0000-1000-8000-00805f9b34fb",
  actualAngleAndBatteryCharacteristic: "0000fff7-0000-1000-8000-00805f9b34fb",
  faceletStatus1Characteristic: "0000fff2-0000-1000-8000-00805f9b34fb",
  faceletStatus2Characteristic: "0000fff3-0000-1000-8000-00805f9b34fb",
  infoService: "0000180a-0000-1000-8000-00805f9b34fb",
  systemIDCharacteristic: "00002a23-0000-1000-8000-00805f9b34fb",
  versionCharacteristic: "00002a28-0000-1000-8000-00805f9b34fb",
};

const commands: { [cmd: string]: BufferSource } = {
  reset: new Uint8Array([
    0x00, 0x00, 0x24, 0x00, 0x49, 0x92, 0x24, 0x49, 0x6d, 0x92, 0xdb, 0xb6,
    0x49, 0x92, 0xb6, 0x24, 0x6d, 0xdb,
  ]),
};

function buf2hex(buffer: ArrayBuffer): string {
  // buffer is an ArrayBuffer
  return (
    Array.prototype.map.call(new Uint8Array(buffer), (x: number) =>
      ("00" + x.toString(16)).slice(-2),
    ) as string[]
  ).join(" ");
}

const reidEdgeOrder = "UF UR UB UL DF DR DB DL FR FL BR BL".split(" ");
const reidCornerOrder = "UFR URB UBL ULF DRF DFL DLB DBR".split(" ");

interface PieceInfo {
  piece: number;
  orientation: number;
}

function rotateLeft(s: string, i: number): string {
  return s.slice(i) + s.slice(0, i);
}

const pieceMap: { [s: string]: PieceInfo } = {};
// TODO: Condense the for loops.
reidEdgeOrder.forEach((edge, idx) => {
  for (let i = 0; i < 2; i++) {
    pieceMap[rotateLeft(edge, i)] = { piece: idx, orientation: i };
  }
});
reidCornerOrder.forEach((corner, idx) => {
  for (let i = 0; i < 3; i++) {
    pieceMap[rotateLeft(corner, i)] = { piece: idx, orientation: i };
  }
});

const gan356iCornerMappings = [
  [0, 21, 15],
  [5, 13, 47],
  [7, 45, 39],
  [2, 37, 23],
  [29, 10, 16],
  [31, 18, 32],
  [26, 34, 40],
  [24, 42, 8],
];

const gan356iEdgeMappings = [
  [1, 22],
  [3, 14],
  [6, 46],
  [4, 38],
  [30, 17],
  [27, 9],
  [25, 41],
  [28, 33],
  [19, 12],
  [20, 35],
  [44, 11],
  [43, 36],
];
const faceOrder = "URFDLB";

async function getKey(
  server: BluetoothRemoteGATTServer,
): Promise<CryptoKey | null> {
  const infoService = await server.getPrimaryService(UUIDs.infoService);

  const versionCharacteristic = await infoService.getCharacteristic(
    UUIDs.versionCharacteristic,
  );
  const versionBuffer = new Uint8Array(
    (await versionCharacteristic.readValue()).buffer,
  );

  const versionValue =
    (((versionBuffer[0] << 8) + versionBuffer[1]) << 8) + versionBuffer[2];
  if (versionValue < 0x01_00_08) {
    return null;
  }

  const keyXor = versionValue < 0x01_01_00 ? key10 : key11;

  const systemIDCharacteristic = await infoService.getCharacteristic(
    UUIDs.systemIDCharacteristic,
  );
  const systemID = new Uint8Array(
    (await systemIDCharacteristic.readValue()).buffer,
  ).reverse();

  const key = new Uint8Array(keyXor);
  for (let i = 0; i < systemID.length; i++) {
    key[i] = (key[i] + systemID[i]) % 256;
  }

  return importKey(key);
}

/** @category Smart Puzzles */
export class GanCube extends BluetoothPuzzle {
  // We have to perform async operations before we call the constructor.
  public static async connect(
    server: BluetoothRemoteGATTServer,
  ): Promise<GanCube> {
    const ganCubeService = await server.getPrimaryService(UUIDs.ganCubeService);
    debugLog("Service:", ganCubeService);

    const physicalStateCharacteristic = await ganCubeService.getCharacteristic(
      UUIDs.physicalStateCharacteristic,
    );
    debugLog("Characteristic:", physicalStateCharacteristic);

    const aesKey = await getKey(server);

    const initialMoveCounter = (
      await PhysicalState.read(physicalStateCharacteristic, aesKey)
    ).moveCounter();
    debugLog("Initial Move Counter:", initialMoveCounter);
    const cube = new GanCube(
      await puzzles["3x3x3"].kpuzzle(),
      ganCubeService,
      server,
      physicalStateCharacteristic,
      initialMoveCounter,
      aesKey,
    );
    return cube;
  }

  public INTERVAL_MS: number = DEFAULT_INTERVAL_MS;
  public facing = "WG";

	private quaternionToOrientationMap: {q: Quaternion, facing: string}[] = [];
	private kpuzzleToFacing = function(state: KState) {
		const colours = "WOGRBY";
		const centers = state.stateData["CENTERS"].pieces;
		const axisToIndex = { "x": 3, "y": 0, "z": 2 };
		const topIndex = centers[axisToIndex["y"]];
		const frontIndex = centers[axisToIndex["z"]];
		const topFace = colours[topIndex];
		const frontFace = colours[frontIndex];
		return topFace + frontFace;
	}
	private initQuaternionToOrientationMap = function(kpuzzle: KPuzzle) {
		const WGOrientation = new Quaternion(0, 0, 0, 1);
		const zMove = new Quaternion();
		const yMove = new Quaternion();
		const xMove = new Quaternion();
		zMove.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI/2);
		yMove.setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI/2);
		xMove.setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI/2);
		const facingStates: { [key: string]: KState } = {};
		let currentOrientation = WGOrientation;
		let state: KState = kpuzzle.startState();
		// centers is in "ULFRBD" order
		let centers = state.stateData["CENTERS"].pieces;
		// so rotations correspond to ULFRDB order
		const rotations = [ yMove, xMove.clone().invert(), zMove, 
			xMove, zMove.clone().invert(), yMove.clone().invert() ]
		function rotateCube(axis: string) {
			const axisToIndex: { [key: string]: number } = { "x": 3, "y": 0, "z": 2 };
			const move = rotations[centers[axisToIndex[axis]]];
			currentOrientation = currentOrientation.clone().multiply(move);
			state = state.applyMove(axis);
			centers = state.stateData["CENTERS"].pieces;
		}
		for (let zxRotation = 0; zxRotation < 6; ++zxRotation) {
			if (zxRotation > 0 && zxRotation < 4) {
				rotateCube("z");
			} else if (zxRotation == 4) {
				rotateCube("z");
				rotateCube("x");
			} else if (zxRotation == 5) {
				rotateCube("x");
				rotateCube("x");
			}
			for (let yRotation = 0; yRotation < 4; ++yRotation) {
				if (yRotation > 0) {
					rotateCube("y");
				}
				const currentFacing = this.kpuzzleToFacing(state);
				facings.push(currentFacing);
				facingStates[currentFacing] = state;
				this.quaternionToOrientationMap.push({
					q: currentOrientation,
					facing: currentFacing
				});
			}
			rotateCube("y");
		}
		// For every facing, generate all the cube rotations from that
		// facing that we want to recognize.
		const recognizableCubeRotations = [
			new Move("x"), new Move("x", -1), new Move("x2"),
			new Move("y"), new Move("y", -1), new Move("y2"),
			new Move("z"), new Move("z", -1)
		];
		facings.map(startFacing => {
			recognizableCubeRotations.map(move => {
				const endState = facingStates[startFacing].applyMove(move);
				const endFacing = this.kpuzzleToFacing(endState);
				const key = `${endFacing}<${startFacing}`;
				facingToRotationMove[key] = move;
			});
		});
	}

  private intervalHandle: number | null = null;
  private state: KState;
  private cachedFaceletStatus1Characteristic: Promise<BluetoothRemoteGATTCharacteristic>;

  private cachedFaceletStatus2Characteristic: Promise<BluetoothRemoteGATTCharacteristic>;

  private cachedActualAngleAndBatteryCharacteristic: Promise<BluetoothRemoteGATTCharacteristic>;

  private constructor(
    private kpuzzle: KPuzzle,
    private service: BluetoothRemoteGATTService,
    private server: BluetoothRemoteGATTServer,
    private physicalStateCharacteristic: BluetoothRemoteGATTCharacteristic,
    private lastMoveCounter: number,
    private aesKey: CryptoKey | null,
  ) {
    super();
    this.state = kpuzzle.startState();
    this.startTrackingMoves();
    this.initQuaternionToOrientationMap(kpuzzle);
  }

  public name(): string | undefined {
    return this.server.device.name;
  }

  disconnect(): void {
    this.server.disconnect();
  }

  public startTrackingMoves(): void {
    // `window.setInterval` instead of `setInterval`:
    // https://github.com/Microsoft/TypeScript/issues/842#issuecomment-252445883
    this.intervalHandle = window.setInterval(
      this.intervalHandler.bind(this),
      this.INTERVAL_MS,
    );
  }

  public stopTrackingMoves(): void {
    if (!this.intervalHandle) {
      throw new Error("Not tracking moves!");
    }
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  // TODO: Can we ever receive async responses out of order?
  public async intervalHandler(): Promise<void> {
    const physicalState = await PhysicalState.read(
      this.physicalStateCharacteristic,
      this.aesKey,
    );
    let numInterveningMoves = physicalState.numMovesSince(this.lastMoveCounter);
    // console.log(numInterveningMoves);
    if (numInterveningMoves > MAX_LATEST_MOVES) {
      debugLog(
        `Too many moves! Dropping ${
          numInterveningMoves - MAX_LATEST_MOVES
        } moves`,
      );
      numInterveningMoves = MAX_LATEST_MOVES;
    }
		const oldFacing = this.kpuzzleToFacing(this.state);
		// put some dead space in so that the orientation doesn't
		// flip back and forth due to sensor noise
    const threshold = Math.PI/4 - 0.15;
		for (let i = 0; i < this.quaternionToOrientationMap.length; ++i) {
			const facingAngle = this.quaternionToOrientationMap[i].q;
			const faces = this.quaternionToOrientationMap[i].facing;
			const offset = physicalState.rotQuat().angleTo(facingAngle);
			if (Math.abs(offset) < threshold) {
				if (faces !== this.facing) {
					debugLog(`Rotated to ${faces} from ${oldFacing} (=? ${this.facing})`);
					this.facing = faces;
				}
			}
		}
		const rotation = this.facing + "<" + oldFacing;
    for (const originalMove of physicalState.latestMoves(numInterveningMoves, rotation)) {
      // console.log(originalMove);
			// TODO: deal with 'x', 'y', 'z' families, and assertion fail or console log
			// an error if we are in an unexpected case
			const faces = "ULFRBD";
			const faceIdx = faces.indexOf(originalMove.family);
			const stateData = this.state.stateData;
			const family = faces[stateData["CENTERS"].pieces.indexOf(faceIdx)];
			const move = originalMove.modified({ family });
      this.state = this.state.applyMove(move);
      this.dispatchAlgLeaf({
        latestAlgLeaf: move,
        timeStamp: physicalState.timeStamp,
        debug: physicalState.debugInfo(),
        state: this.state,
        // quaternion: physicalState.rotQuat(),
      });
    }
    this.dispatchOrientation({
      timeStamp: physicalState.timeStamp,
      quaternion: physicalState.rotQuat(),
    });
    this.lastMoveCounter = physicalState.moveCounter();
  }

  public async getBattery(): Promise<number> {
    return new Uint8Array(
      await this.readActualAngleAndBatteryCharacteristic(),
    )[7];
  }

  public async getState(): Promise<KState> {
    const arr: Uint8Array = await decryptState(
      new Uint8Array(await this.readFaceletStatus1Characteristic()),
      this.aesKey,
    );
    const stickers: number[] = [];
    for (let i = 0; i < 18; i += 3) {
      let v = (((arr[i ^ 1] << 8) + arr[(i + 1) ^ 1]) << 8) + arr[(i + 2) ^ 1];
      for (let j = 0; j < 8; j++) {
        stickers.push(v & 7);
        v >>= 3;
      }
    }

    const stateData: KStateData = {
      CORNERS: {
        pieces: [],
        orientation: [],
      },
      EDGES: {
        pieces: [],
        orientation: [],
      },
      CENTERS: {
        pieces: [0, 1, 2, 3, 4, 5],
        orientation: [0, 0, 0, 0, 0, 0],
      },
    };

    for (const cornerMapping of gan356iCornerMappings) {
      const pieceInfo: PieceInfo =
        pieceMap[cornerMapping.map((i) => faceOrder[stickers[i]]).join("")];
      stateData.CORNERS.pieces.push(pieceInfo.piece);
      stateData.CORNERS.orientation.push(pieceInfo.orientation);
    }

    for (const edgeMapping of gan356iEdgeMappings) {
      const pieceInfo: PieceInfo =
        pieceMap[edgeMapping.map((i) => faceOrder[stickers[i]]).join("")];
      stateData.EDGES.pieces.push(pieceInfo.piece);
      stateData.EDGES.orientation.push(pieceInfo.orientation);
    }

    return new KState(this.kpuzzle, stateData);
  }

  public async faceletStatus1Characteristic(): Promise<BluetoothRemoteGATTCharacteristic> {
    this.cachedFaceletStatus1Characteristic =
      this.cachedFaceletStatus1Characteristic ||
      this.service.getCharacteristic(UUIDs.faceletStatus1Characteristic);
    return this.cachedFaceletStatus1Characteristic;
  }

  public async faceletStatus2Characteristic(): Promise<BluetoothRemoteGATTCharacteristic> {
    this.cachedFaceletStatus2Characteristic =
      this.cachedFaceletStatus2Characteristic ||
      this.service.getCharacteristic(UUIDs.faceletStatus2Characteristic);
    return this.cachedFaceletStatus2Characteristic;
  }

  public async actualAngleAndBatteryCharacteristic(): Promise<BluetoothRemoteGATTCharacteristic> {
    this.cachedActualAngleAndBatteryCharacteristic =
      this.cachedActualAngleAndBatteryCharacteristic ||
      this.service.getCharacteristic(UUIDs.actualAngleAndBatteryCharacteristic);
    return this.cachedActualAngleAndBatteryCharacteristic;
  }

  public async reset(): Promise<void> {
    const faceletStatus1Characteristic =
      await this.faceletStatus1Characteristic();
    await faceletStatus1Characteristic.writeValue(commands.reset);
  }

  public async readFaceletStatus1Characteristic(): Promise<ArrayBuffer> {
    const faceletStatus1Characteristic =
      await this.faceletStatus1Characteristic();
    return (await faceletStatus1Characteristic.readValue()).buffer;
  }

  public async readFaceletStatus2Characteristic(): Promise<string> {
    const faceletStatus2Characteristic =
      await this.faceletStatus2Characteristic();
    return buf2hex((await faceletStatus2Characteristic.readValue()).buffer);
  }

  public async readActualAngleAndBatteryCharacteristic(): Promise<ArrayBuffer> {
    const actualAngleAndBatteryCharacteristic =
      await this.actualAngleAndBatteryCharacteristic();
    return (await actualAngleAndBatteryCharacteristic.readValue()).buffer;
  }

  // TODO
  // private onphysicalStateCharacteristicChanged(event: any): void {
  //   var val = event.target.value;
  //   debugLog(val);
  // }
}

// // TODO: Move this into a factory?
export const ganConfig: BluetoothConfig<BluetoothPuzzle> = {
  connect: GanCube.connect.bind(GanCube),
  prefixes: ["GAN"],
  filters: [{ namePrefix: "GAN" }],
  optionalServices: [UUIDs.ganCubeService, UUIDs.infoService],
};
