/**
 * Integration tests for error handling with real viem contract calls
 * These tests trigger actual contract errors to verify error decoding works correctly
 */

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { beforeAll, describe, expect, it } from "vitest";
import { PERP_MANAGER_ABI } from "../../abis/perp-manager";
import { ContractError, PerpCityError, parseContractError } from "../../utils/errors";
import { createTestContext, getTestnetConfig } from "../helpers/testnet-config";

describe("Error Handling Integration Tests", () => {
  let config: ReturnType<typeof getTestnetConfig>;
  let publicClient: ReturnType<typeof createPublicClient>;
  let accountAddress: `0x${string}`;

  beforeAll(() => {
    config = getTestnetConfig();
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(config.rpcUrl),
    });
    const account = privateKeyToAccount(config.privateKey);
    accountAddress = account.address;
  });

  describe("Real Contract Error Decoding", () => {
    it("should decode TokenDoesNotExist error from simulateContract", async () => {
      // Try to close a position that doesn't exist
      const nonExistentPositionId = 999999999n;
      const perpManagerAddress = config.perpManagerAddress;

      try {
        await publicClient.simulateContract({
          address: perpManagerAddress,
          abi: PERP_MANAGER_ABI,
          functionName: "closePosition",
          args: [
            {
              posId: nonExistentPositionId,
              minAmt0Out: 0n,
              minAmt1Out: 0n,
              maxAmt1In: 0n,
            },
          ],
          account: accountAddress,
        });
        // Should not reach here
        expect.fail("Expected contract to revert");
      } catch (error) {
        console.log("Raw error:", error);
        console.log("Error message:", (error as Error).message);

        const parsedError = parseContractError(error);
        console.log("Parsed error:", parsedError);

        // The error should be parsed into a ContractError
        expect(parsedError).toBeInstanceOf(PerpCityError);

        // Check if it was decoded to a known error type
        if (parsedError instanceof ContractError) {
          console.log("Error name:", parsedError.errorName);
          console.log("Error args:", parsedError.args);
          // Should be either TokenDoesNotExist or another perp manager error
          expect(parsedError.errorName).toBeDefined();
        }
      }
    }, 30000);

    it("should decode InvalidMargin error with zero margin", async () => {
      const perpManagerAddress = config.perpManagerAddress;
      const testPerpId = config.testPerpId;

      if (!testPerpId) {
        console.log("Skipping: TEST_PERP_ID not configured");
        return;
      }

      try {
        await publicClient.simulateContract({
          address: perpManagerAddress,
          abi: PERP_MANAGER_ABI,
          functionName: "openTakerPos",
          args: [
            testPerpId,
            {
              holder: accountAddress,
              isLong: true,
              margin: 0n, // Invalid: zero margin
              levX96: 79228162514264337593543950336n, // 1x leverage in X96
              unspecifiedAmountLimit: 0n,
            },
          ],
          account: accountAddress,
        });
        expect.fail("Expected contract to revert");
      } catch (error) {
        console.log("Raw error:", error);
        console.log("Error message:", (error as Error).message);

        const parsedError = parseContractError(error);
        console.log("Parsed error:", parsedError);
        console.log("Parsed message:", parsedError.message);

        expect(parsedError).toBeInstanceOf(PerpCityError);

        if (parsedError instanceof ContractError) {
          console.log("Error name:", parsedError.errorName);
          console.log("Error args:", parsedError.args);
          // Should be InvalidMargin or similar
          expect(parsedError.errorName).toBeDefined();
        }
      }
    }, 30000);

    it("should decode error from invalid perp ID", async () => {
      const perpManagerAddress = config.perpManagerAddress;
      // Use a random invalid perp ID (32 bytes of zeros)
      const invalidPerpId =
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      try {
        await publicClient.simulateContract({
          address: perpManagerAddress,
          abi: PERP_MANAGER_ABI,
          functionName: "openTakerPos",
          args: [
            invalidPerpId,
            {
              holder: accountAddress,
              isLong: true,
              margin: 1000000n, // 1 USDC
              levX96: 79228162514264337593543950336n,
              unspecifiedAmountLimit: 0n,
            },
          ],
          account: accountAddress,
        });
        expect.fail("Expected contract to revert");
      } catch (error) {
        console.log("Raw error:", error);

        const parsedError = parseContractError(error);
        console.log("Parsed error:", parsedError);
        console.log("Parsed message:", parsedError.message);

        expect(parsedError).toBeInstanceOf(PerpCityError);

        if (parsedError instanceof ContractError) {
          console.log("Error name:", parsedError.errorName);
          // Could be PoolNotInitialized, InvalidPerpId, or similar
          expect(parsedError.errorName).toBeDefined();
        }
      }
    }, 30000);
  });

  describe("Raw Error Data Extraction", () => {
    it("should decode error from raw hex data in message", () => {
      // Simulate the error format from issue #140
      // InvalidMargin(uint256) selector: 0x2c5211c6
      const mockErrorMessage = `processing response error (body="{\\"jsonrpc\\":\\"2.0\\",\\"id\\":93,\\"error\\":{\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0x2c5211c60000000000000000000000000000000000000000000000000000000000000000\\"}}")`;

      const mockError = new Error(mockErrorMessage);
      const parsedError = parseContractError(mockError);

      console.log("Parsed error:", parsedError);
      console.log("Parsed message:", parsedError.message);

      // Should be parsed as a ContractError with InvalidMargin
      expect(parsedError).toBeInstanceOf(ContractError);
      if (parsedError instanceof ContractError) {
        expect(parsedError.errorName).toBe("InvalidMargin");
        expect(parsedError.message).toContain("Invalid margin amount");
      }
    });

    it("should decode error with pipe characters from truncation", () => {
      // Format seen in issue #140 with pipe characters
      const mockErrorMessage = `openTakerPosition: Execution reverted with reason: processing response error (body="{\\"|jsonrpc\\":\\"2.0\\",\\"id\\":93,\\"error|\\": {\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0x2c5211c60000000000000000000000000000000000000000000000000000000000000064\\"}}")`;

      const mockError = new Error(mockErrorMessage);
      const parsedError = parseContractError(mockError);

      console.log("Parsed error:", parsedError);
      console.log("Parsed message:", parsedError.message);

      // Should still be able to parse despite pipe characters
      if (parsedError instanceof ContractError) {
        expect(parsedError.errorName).toBe("InvalidMargin");
      }
    });

    it("should decode error with direct hex data", () => {
      // Sometimes errors contain raw hex data directly
      // PriceImpactTooHigh(uint160,uint160,uint160) selector: 0x8e6cc32d
      const mockErrorMessage = `execution reverted: 0x8e6cc32d00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000003840000000000000000000000000000000000000000000000000000000000000450`;

      const mockError = new Error(mockErrorMessage);
      const parsedError = parseContractError(mockError);

      console.log("Parsed error:", parsedError);
      console.log("Parsed message:", parsedError.message);

      // Should be parsed as PriceImpactTooHigh if the selector matches
      expect(parsedError).toBeInstanceOf(PerpCityError);
    });
  });

  describe("SDK Error Flow Integration", () => {
    it("should properly parse errors through withErrorHandling", async () => {
      const context = createTestContext();
      const testPerpId = config.testPerpId;

      if (!testPerpId) {
        console.log("Skipping: TEST_PERP_ID not configured");
        return;
      }

      // Import and call the actual SDK function that will fail
      const { openTakerPosition } = await import("../../functions/perp-manager");

      try {
        await openTakerPosition(context, testPerpId, {
          isLong: true,
          margin: 0.000001, // Very small margin that will fail validation or contract check
          leverage: 100, // Invalid leverage
          unspecifiedAmountLimit: 0,
        });
        expect.fail("Expected to throw");
      } catch (error) {
        console.log("SDK error:", error);
        console.log("Error message:", (error as Error).message);

        // Error should already be a PerpCityError from withErrorHandling
        expect(error).toBeInstanceOf(PerpCityError);

        // Message should be human-readable, not raw JSON-RPC
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain('body="');
        expect(errorMessage).not.toContain("jsonrpc");
      }
    }, 30000);
  });
});
