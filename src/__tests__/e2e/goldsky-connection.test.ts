import { describe, it, expect, beforeAll } from 'vitest';
import { GraphQLClient } from 'graphql-request';
import { parse } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

describe('Goldsky API Connection Tests', () => {
  let goldskyClient: GraphQLClient;

  beforeAll(() => {
    if (!process.env.GOLDSKY_BEARER_TOKEN) {
      throw new Error('GOLDSKY_BEARER_TOKEN is required for e2e tests');
    }
    if (!process.env.GOLDSKY_ENDPOINT) {
      throw new Error('GOLDSKY_ENDPOINT is required for e2e tests');
    }

    // Create a direct GraphQL client to test the connection
    goldskyClient = new GraphQLClient(process.env.GOLDSKY_ENDPOINT, {
      headers: {
        authorization: `Bearer ${process.env.GOLDSKY_BEARER_TOKEN}`,
      },
    });
  });

  it('should connect to Goldsky API and fetch perp data', async () => {
    // First, let's try to get any existing perps
    const perpsQuery: TypedDocumentNode<{
      perps: {
        id: string;
      }[];
    }> = parse(`
      query {
        perps(first: 1) {
          id
        }
      }
    `);

    const perpsResponse = await goldskyClient.request(perpsQuery);
    
    if (perpsResponse.perps.length === 0) {
      console.log('No perps found in the subgraph, skipping perp data test');
      return;
    }

    const testPerpId = perpsResponse.perps[0].id;
    
    const query: TypedDocumentNode<{
      perp: {
        beacon: { id: string };
      };
      perpSnapshots: {
        timestamp: BigInt;
        markPrice: string;
        takerLongNotional: string;
        takerShortNotional: string;
        fundingRate: string;
      }[];
    }, { perpId: string }> = parse(`
      query ($perpId: Bytes!) {
        perp(id: $perpId) {
          beacon { id }
        }
        perpSnapshots(
          first: 5
          orderBy: timestamp
          orderDirection: desc
          where: { perp: $perpId }
        ) {
          timestamp
          markPrice
          takerLongNotional
          takerShortNotional
          fundingRate
        }
      }
    `);

    const response = await goldskyClient.request(query, { perpId: testPerpId });

    // Verify the response structure
    expect(response).toBeDefined();
    expect(response.perp).toBeDefined();
    expect(response.perp.beacon).toBeDefined();
    expect(response.perp.beacon.id).toMatch(/^0x[a-fA-F0-9]{40}$/);
    
    expect(Array.isArray(response.perpSnapshots)).toBe(true);
    
    if (response.perpSnapshots.length > 0) {
      const snapshot = response.perpSnapshots[0];
      expect(typeof snapshot.timestamp).toBe('bigint');
      expect(typeof snapshot.markPrice).toBe('string');
      expect(typeof snapshot.takerLongNotional).toBe('string');
      expect(typeof snapshot.takerShortNotional).toBe('string');
      expect(typeof snapshot.fundingRate).toBe('string');
      
      // Verify the values are reasonable
      expect(Number(snapshot.markPrice)).toBeGreaterThan(0);
      expect(Number(snapshot.takerLongNotional)).toBeGreaterThanOrEqual(0);
      expect(Number(snapshot.takerShortNotional)).toBeGreaterThanOrEqual(0);
    }

    console.log(`✅ Successfully connected to Goldsky API and fetched data for perp ${testPerpId}`);
    console.log(`📊 Found ${response.perpSnapshots.length} snapshots`);
    if (response.perpSnapshots.length > 0) {
      console.log(`💰 Latest mark price: ${Number(response.perpSnapshots[0].markPrice) / 1e6}`);
      console.log(`📈 Long notional: ${Number(response.perpSnapshots[0].takerLongNotional) / 1e6}`);
      console.log(`📉 Short notional: ${Number(response.perpSnapshots[0].takerShortNotional) / 1e6}`);
    }
  }, 15000);

  it('should fetch beacon data', async () => {
    const testBeaconId = '0x1234567890123456789012345678901234567890'; // This will be updated with real beacon ID
    
    const query: TypedDocumentNode<{
      beaconSnapshots: {
        timestamp: BigInt;
        indexPrice: string;
      }[];
    }, { beaconAddr: string }> = parse(`
      query ($beaconAddr: Bytes!) {
        beaconSnapshots(
          first: 5
          orderBy: timestamp
          orderDirection: desc
          where: { beacon: $beaconAddr }
        ) {
          timestamp
          indexPrice
        }
      }
    `);

    // First get a real beacon ID from a perp
    const perpQuery: TypedDocumentNode<{
      perp: {
        beacon: { id: string };
      };
    }, { perpId: string }> = parse(`
      query ($perpId: Bytes!) {
        perp(id: $perpId) {
          beacon { id }
        }
      }
    `);

    const perpResponse = await goldskyClient.request(perpQuery, { 
      perpId: '0x7a6f376ed26ed212e84ab8b3bec9df5b9c8d1ca543f0527c48675131a4bf9bae' 
    });

    const realBeaconId = perpResponse.perp.beacon.id;
    
    const response = await goldskyClient.request(query, { beaconAddr: realBeaconId });

    expect(response).toBeDefined();
    expect(Array.isArray(response.beaconSnapshots)).toBe(true);
    
    if (response.beaconSnapshots.length > 0) {
      const snapshot = response.beaconSnapshots[0];
      expect(typeof snapshot.timestamp).toBe('bigint');
      expect(typeof snapshot.indexPrice).toBe('string');
      expect(Number(snapshot.indexPrice)).toBeGreaterThan(0);
    }

    console.log(`✅ Successfully fetched beacon data for ${realBeaconId}`);
    console.log(`📊 Found ${response.beaconSnapshots.length} beacon snapshots`);
  }, 15000);
});
