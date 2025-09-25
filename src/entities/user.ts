import { Address, Hex } from "viem";
import { OpenPosition } from "./openPosition";
import { erc20Abi } from "viem";
import { scaleFrom6Decimals } from "../utils";
import { PerpCityContext } from "../context";
import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { gql } from "graphql-request";

export type ClosedPosition = {
  perpId: Hex;
  wasMaker: boolean;
  wasLong: boolean;
  pnlAtClose: number;
}

export class User {
  public readonly context: PerpCityContext;
  public readonly walletAddress: Hex;

  constructor(context: PerpCityContext) {
    this.context = context;
    if (!context.walletClient.account) throw new Error("Wallet client account not found");
    this.walletAddress = context.walletClient.account.address as Hex;
  }

  async usdcBalance(): Promise<number> {
    const result = await this.context.walletClient.readContract({
      address: this.context.deployments().usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [this.walletAddress],
    });
    return scaleFrom6Decimals(Number(result));
  }

  async openPositions(): Promise<OpenPosition[]> {
    const query: TypedDocumentNode<{ openPositions: { perp: { id: Hex }, inContractPosId: bigint }[] }, {holder: Address}> = parse(gql`
      query ($holder: Bytes!) {
        openPositions(
          where: { holder: $holder }
        ) {
          perp { id }
          inContractPosId
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { holder: this.walletAddress });
    
    return response.openPositions.map((position) => (new OpenPosition(this.context, position.perp.id, position.inContractPosId)));
  }

  async closedPositions(): Promise<ClosedPosition[]> {
    const query: TypedDocumentNode<{ closedPositions: { perp: { id: Hex }, wasMaker: boolean, wasLong: boolean, pnlAtClose: string }[] }, {holder: Address}> = parse(gql`
      query ($holder: Bytes!) {
        closedPositions(
          where: { holder: $holder }
        ) {
          perp { id }
          wasMaker
          wasLong
          pnlAtClose
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { holder: this.walletAddress });
    
    return response.closedPositions.map((position) => ({
      perpId: position.perp.id,
      wasMaker: position.wasMaker,
      wasLong: position.wasLong,
      pnlAtClose: Number(position.pnlAtClose),
    }));
  }

  async realizedPnl(): Promise<number> {
    return (await this.closedPositions()).reduce((acc, position) => acc + position.pnlAtClose, 0);
  }

  async unrealizedPnl(): Promise<number> {
    const openPositions = await this.openPositions();
    const liveDetails = await Promise.all(openPositions.map((position) => position.liveDetails()));
    return liveDetails.reduce((acc, detail) => acc + detail.pnl - detail.fundingPayment, 0);
  }
}