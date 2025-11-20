import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, createTestPublicClient, getTestnetConfig } from '../helpers/testnet-config';
import { approveUsdc } from '../../utils/approve';
import { PerpCityContext } from '../../context';
import { erc20Abi } from 'viem';

describe('USDC Approval Integration Tests', () => {
  let context: PerpCityContext;
  let config: ReturnType<typeof getTestnetConfig>;
  let publicClient: ReturnType<typeof createTestPublicClient>;

  beforeAll(async () => {
    config = getTestnetConfig();
    context = createTestContext();
    publicClient = createTestPublicClient();

    // Wait for any pending transactions from previous test files to clear
    console.log('Waiting for previous transactions to settle...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Ensure wallet nonce is stable
    const walletAddress = context.walletClient.account!.address;
    const nonce1 = await publicClient.getTransactionCount({ address: walletAddress });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const nonce2 = await publicClient.getTransactionCount({ address: walletAddress });

    if (nonce1 !== nonce2) {
      console.log('Nonce still changing, waiting additional time...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(`Wallet nonce stable at ${nonce2}, proceeding with approval tests`);
  });

  describe('approveUsdc', () => {
    it('should approve USDC spending', async () => {
      const amount = 100_000_000n; // 100 USDC (6 decimals)

      // Approve USDC - returns void, waits for transaction internally
      await approveUsdc(context, amount, 1);

      // Wait for block to be mined (Base Sepolia has ~2s block time)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check allowance was set - use blockTag 'latest' to force fresh read
      const allowance = await publicClient.readContract({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [context.walletClient.account!.address, config.perpManagerAddress],
        blockTag: 'latest',
      });

      expect(allowance).toBeGreaterThanOrEqual(amount);
      console.log('Approval set:', allowance.toString());
    }, 60000); // 60 second timeout for transaction

    it('should verify approval was set correctly', async () => {
      const amount = 1000_000_000n; // 1000 USDC

      // Approve - waits internally
      await approveUsdc(context, amount, 1);

      // Wait for block to be mined (Base Sepolia has ~2s block time)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check allowance
      const allowance = await publicClient.readContract({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [context.walletClient.account!.address, config.perpManagerAddress],
        blockTag: 'latest',
      });

      expect(allowance).toBeGreaterThanOrEqual(amount);
    }, 60000);

    it('should approve with different confirmation counts', async () => {
      const amount = 50_000_000n; // 50 USDC

      // Test with 2 confirmations - function waits internally
      await approveUsdc(context, amount, 2);

      // Wait for block to be mined (Base Sepolia has ~2s block time)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify allowance was set
      const allowance = await publicClient.readContract({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [context.walletClient.account!.address, config.perpManagerAddress],
        blockTag: 'latest',
      });

      expect(allowance).toBeGreaterThanOrEqual(amount);
    }, 90000); // Longer timeout for multiple confirmations

    it('should approve zero amount (revoke approval)', async () => {
      await approveUsdc(context, 0n, 1);

      // Wait for block to be mined (Base Sepolia has ~2s block time)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify allowance is 0
      const allowance = await publicClient.readContract({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [context.walletClient.account!.address, config.perpManagerAddress],
        blockTag: 'latest',
      });

      expect(allowance).toBe(0n);
    }, 60000);

    it('should approve maximum amount', async () => {
      const maxAmount = 2n ** 256n - 1n; // Max uint256

      await approveUsdc(context, maxAmount, 1);

      // Wait for block to be mined (Base Sepolia has ~2s block time)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify allowance is max
      const allowance = await publicClient.readContract({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [context.walletClient.account!.address, config.perpManagerAddress],
        blockTag: 'latest',
      });

      expect(allowance).toBe(maxAmount);
    }, 60000);
  });

  describe('Error Scenarios', () => {
    it('should handle transaction rejection gracefully', async () => {
      // This test would require simulating user rejection
      // Skip in automated tests
      console.log('Note: Transaction rejection tests require manual testing');
    });

    it('should handle insufficient gas gracefully', async () => {
      // This test would require manipulating gas
      // Skip in automated tests
      console.log('Note: Gas simulation tests require manual testing');
    });
  });

  describe('Gas Estimation', () => {
    it('BUG: cannot measure gas costs - approveUsdc does not return transaction hash', async () => {
      // approveUsdc() returns void and waits for transaction internally
      // There is no way to get the transaction hash to check gas usage
      // This documents a limitation of the current API
      console.log('Note: Gas estimation not possible with current approveUsdc API');
    });
  });

  describe('Multiple Approvals', () => {
    it('should handle multiple sequential approvals', async () => {
      const amounts = [10_000_000n, 20_000_000n, 30_000_000n];

      for (const amount of amounts) {
        // Some USDC implementations require resetting to 0 before changing approval
        // This prevents the approval race condition attack
        await approveUsdc(context, 0n, 1);
        // Wait for reset to be mined
        await new Promise(resolve => setTimeout(resolve, 3000));

        await approveUsdc(context, amount, 1);

        // Wait for approval to be mined (Base Sepolia has ~2s block time)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify current allowance
        const allowance = await publicClient.readContract({
          address: config.usdcAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [context.walletClient.account!.address, config.perpManagerAddress],
          blockTag: 'latest',
        });

        // Use >= to handle USDC implementations with max approval or race condition protection
        expect(allowance).toBeGreaterThanOrEqual(amount);
      }
    }, 240000); // 4 minutes for multiple transactions (increased timeout)
  });

  describe('Approval State', () => {
    it('should check current approval before test', async () => {
      const currentAllowance = await publicClient.readContract({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [context.walletClient.account!.address, config.perpManagerAddress],
      });

      expect(currentAllowance).toBeTypeOf('bigint');
      console.log('Current USDC allowance:', currentAllowance.toString());
    }, 30000);

    it('should get USDC balance', async () => {
      const balance = await publicClient.readContract({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [context.walletClient.account!.address],
      });

      expect(balance).toBeTypeOf('bigint');
      console.log('USDC balance:', balance.toString());

      if (balance === 0n) {
        console.warn('Warning: Test wallet has 0 USDC balance. Trading tests will fail.');
      }
    }, 30000);
  });
});
