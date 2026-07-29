/**
 * @fileoverview Defines the abstract adapter interface and common services for connecting 
 * to external marketplaces (e.g., Mercado Livre, Shopee).
 * This layer enforces the Adapter pattern, ensuring our domain logic is decoupled 
 * from specific marketplace APIs.
 */

import { MarketPlaceConnection, Company } from '@prisma/client';

/**
 * Interface representing a standardized Marketplace Adapter contract.
 * All concrete implementations must adhere to this structure.
 */
export interface IMarketplaceAdapter {
    readonly providerId: string;
    readonly name: string;

    /**
     * Step 1: Initiates the authorization flow and returns the URL for the user to visit.
     * @param company Company context.
     * @returns The full authorization URL.
     */
    getAuthorizationUrl(company: Company): Promise<string>;

    /**
     * Step 2: Exchanges an authorization code received from the callback endpoint for tokens.
     * @param company Company context.
     * @param code The temporary code provided by the marketplace.
     * @param state The cryptographically signed and validated state parameter (for security).
     * @returns The full set of access/refresh tokens.
     */
    exchangeAuthorizationCode(company: Company, code: string, state?: string): Promise<{ accessToken: string; refreshToken: string }>;

    /**
     * Step 3: Uses the stored refresh token to get a new access token without user intervention.
     * @param company Company context.
     * @returns The new set of tokens.
     */
    refreshAccessToken(company: Company): Promise<{ accessToken: string; refreshToken?: string }>;

    /**
     * Fetches the connection details and ensures they are persisted/updated for the company.
     * This is useful after a successful authorization flow.
     * @param connection The market place connection data.
     * @returns Updated connection status.
     */
    saveConnection(company: Company, connection: MarketPlaceConnection): Promise<MarketPlaceConnection>;

    /**
     * Synchronizes a specific resource (e.g., Listings, Orders) using the provided cursor/scope.
     * The concrete implementation handles pagination and rate limits.
     * @param company Company context.
     * @param syncScope Defines what is being synced (LISTINGS, ORDERS, etc.).
     * @param cursor Optional cursor for continuation of synchronization.
     * @returns A list of raw data objects or a summary of changes.
     */
    syncResource(company: Company, syncScope: 'LISTINGS' | 'ORDERS' | 'ACCOUNT', cursor?: string): Promise<any[]>;

    /**
     * Handles webhooks received from the marketplace platform.
     * Must validate signatures and immediately queue processing tasks (e.g., BullMQ).
     * @param company Company context.
     * @param payload The raw JSON body of the webhook.
     * @returns A success status for quick response to the sender.
     */
    handleWebhook(company: Company, payload: any): Promise<{ success: boolean }>;
}

/**
 * Defines available synchronization scopes.
 */
export enum SyncScope {
    ACCOUNT = 'ACCOUNT',
    LISTINGS = 'LISTINGS',
    ORDERS = 'ORDERS',
}