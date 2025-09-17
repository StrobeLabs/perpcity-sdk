import type {Hex} from "viem";
import { PerpCityContext } from "../context";

export class Perp {
  private readonly context: PerpCityContext;
  public readonly id: Hex;

  constructor(context: PerpCityContext, id: Hex) {
    this.context = context;
    this.id = id;
  }

  // READS

  
}