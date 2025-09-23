import { Hex } from "viem";
import { Perp } from "./perp";
import { Position } from "./position";

export class User {
    async usdcBalance(): Promise<number> {
        return 0;
    }

    async openPositions(): Promise<Position[]> {
        return [];
    }

    async closedPositions(): Promise<Position[]> {
        return [];
    }

    async realizedPnl(): Promise<number> {
        return 0;
    }

    async unrealizedPnl(): Promise<number> {
        return 0;
    }
}