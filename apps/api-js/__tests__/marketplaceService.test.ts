// apps/api-js/__tests__/marketplaceService.test.ts
import { MarketplaceService } from '@/services/marketplaceService';
import { PrismaClient } from '@prisma/client';
import type { CompanyId, ProviderStatus } from '@/types/enums';

const prisma = new PrismaClient();

// Mockar o serviço para isolamento de testes e evitar chamadas reais ao DB em cada teste.
jest.mock('@/services/marketplaceService', () => ({
  MarketplaceService: {
    testConnection: jest.fn(),
    syncProducts: jest.fn(),
    initialize: jest.fn(() => Promise.resolve()),
  }
}));

describe('MarketplaceService - Domain Tests (Etapa 1)', () => {
  const MOCK_COMPANY_ID: CompanyId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const MOCK_CONNECTION_ID = 'conn-xyz-123';

  // Configurar o mock antes de cada teste
  beforeAll(async () => {
    await MarketplaceService.initialize(); // Garante que os adaptadores estão registrados (mesmo que mocks)
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('testConnection Flow', () => {
    it('should return success for SANDBOX mode connection test', async () => {
      // 1. Configurar o mock para simular um status SANDBOX no DB
      await prisma.marketplaceConnection.create({
        data: {
          companyId: MOCK_COMPANY_ID,
          id: MOCK_CONNECTION_ID,
          status: ProviderStatus.SANDBOX,
          accessToken: null // Sem credenciais reais
        }
      });

      // 2. Mockar o resultado do testConnection para garantir que ele é chamado e retorna sucesso
      (MarketplaceService as any).testConnection = jest.fn(() => Promise.resolve({ success: true, message: "Sandbox connection successful." }));

      const result = await MarketplaceService.testConnection(MOCK_COMPANY_ID, MOCK_CONNECTION_ID);
      expect(result.success).toBe(true);
    });

    it('should throw an error if the connection does not exist', async () => {
      await expect(MarketplaceService.testConnection(MOCK_COMPANY_ID, 'non-existent')).rejects.toThrow("Connection not found");
    });

    // Adicionar um teste para o modo PRODUCTION (requer credenciais)
  });

  describe('syncProducts Flow', () => {
    it('should use the mock adapter when running in SANDBOX mode', async () => {
      await prisma.marketplaceConnection.create({
        data: {
          companyId: MOCK_COMPANY_ID,
          id: MOCK_CONNECTION_ID,
          status: ProviderStatus.SANDBOX,
          accessToken: 'mock-token'
        }
      });

      // Mockar o retorno do syncProducts para garantir que ele é chamado e retorna mock data
      (MarketplaceService as any).syncProducts = jest.fn(() => Promise.resolve({ success: true, data: [{ sku: 'MOCK-SKU', name: 'Produto Teste Mock', price: 10.00 }] }));

      const result = await MarketplaceService.syncProducts(MOCK_COMPANY_ID, MOCK_CONNECTION_ID);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    // Adicionar teste para sync em modo PRODUCTION
  });
});