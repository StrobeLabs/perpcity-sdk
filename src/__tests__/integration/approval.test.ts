import { erc20Abi } from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PerpCityContext } from "../../context";
import { approveUsdc } from "../../utils/approve";
import { type AnvilSetup, setupAnvil } from "../helpers/anvil-setup";

describe("USDC Approval Integration Tests", () => {
  let setup: AnvilSetup;
  let context: PerpCityContext;

  beforeAll(async () => {
    setup = await setupAnvil();
    context = setup.context;
  }, 30000);

  afterAll(() => {
    setup?.cleanup();
  });

  describe("approveUsdc", () => {
    it("should approve USDC spending", async () => {
      const amount = 100_000_000n; // 100 USDC (6 decimals)

      await approveUsdc(context, amount, 1);

      const allowance = await setup.publicClient.readContract({
        address: setup.addresses.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [setup.account, setup.addresses.perpManager],
      });

      expect(allowance).toBeGreaterThanOrEqual(amount);
    });

    it("should verify approval was set correctly", async () => {
      const amount = 1000_000_000n; // 1000 USDC

      await approveUsdc(context, amount, 1);

      const allowance = await setup.publicClient.readContract({
        address: setup.addresses.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [setup.account, setup.addresses.perpManager],
      });

      expect(allowance).toBeGreaterThanOrEqual(amount);
    });

    it("should approve with different confirmation counts", async () => {
      const amount = 50_000_000n; // 50 USDC

      await approveUsdc(context, amount, 2);

      const allowance = await setup.publicClient.readContract({
        address: setup.addresses.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [setup.account, setup.addresses.perpManager],
      });

      expect(allowance).toBeGreaterThanOrEqual(amount);
    });

    it("should approve zero amount (revoke approval)", async () => {
      await approveUsdc(context, 0n, 1);

      const allowance = await setup.publicClient.readContract({
        address: setup.addresses.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [setup.account, setup.addresses.perpManager],
      });

      expect(allowance).toBe(0n);
    });

    it("should approve maximum amount", async () => {
      const maxAmount = 2n ** 256n - 1n;

      await approveUsdc(context, maxAmount, 1);

      const allowance = await setup.publicClient.readContract({
        address: setup.addresses.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [setup.account, setup.addresses.perpManager],
      });

      expect(allowance).toBe(maxAmount);
    });
  });

  describe("Multiple Approvals", () => {
    it("should handle multiple sequential approvals", async () => {
      const amounts = [10_000_000n, 20_000_000n, 30_000_000n];

      for (const amount of amounts) {
        await approveUsdc(context, 0n, 1);
        await approveUsdc(context, amount, 1);

        const allowance = await setup.publicClient.readContract({
          address: setup.addresses.usdc,
          abi: erc20Abi,
          functionName: "allowance",
          args: [setup.account, setup.addresses.perpManager],
        });

        expect(allowance).toBeGreaterThanOrEqual(amount);
      }
    });
  });

  describe("Approval State", () => {
    it("should check current approval before test", async () => {
      const currentAllowance = await setup.publicClient.readContract({
        address: setup.addresses.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [setup.account, setup.addresses.perpManager],
      });

      expect(currentAllowance).toBeTypeOf("bigint");
    });

    it("should get USDC balance", async () => {
      const balance = await setup.publicClient.readContract({
        address: setup.addresses.usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [setup.account],
      });

      expect(balance).toBeTypeOf("bigint");
      expect(balance).toBeGreaterThan(0n); // Anvil mints 1M USDC
    });
  });
});
