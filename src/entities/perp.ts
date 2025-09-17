import type {Hex} from "viem";

export class Perp {
  public readonly id: Hex;

  constructor(id: Hex) {
    this.id = id;
  }

}