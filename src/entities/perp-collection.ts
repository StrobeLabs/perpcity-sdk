import { PerpCityContext } from "../context";
import { Perp } from "./perp";

// In the future, this is where multicalls are used to fetch data across many perps
export class PerpCollection {
  public readonly context: PerpCityContext;
  public readonly perps: Perp[];

  constructor(context: PerpCityContext, perps: Perp[]) {
    this.context = context;
    this.perps = perps;
  }
}