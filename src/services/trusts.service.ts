import "dotenv/config";

export type TrustInfo = {
  userId: string;
  trustId: string;
  status: string;
  balance: number;
  currency: string;
  openedAt: string;
};

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

/**
 * Consulta la información de un fideicomiso por ID de usuario en un servicio externo.
 */
export async function getTrusts(userId: string): Promise<TrustInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/mock/trust/${userId}`, {
      signal: AbortSignal.timeout(3000), // 3 seconds timeout for the request
    });

    if (!response.ok) {
      console.log(
        `[trusts] ${userId}: el endpoint respondió ${response.status}`,
      );
      return null;
    }

    return (await response.json()) as TrustInfo;
  } catch (error) {
    console.log(
      `[trusts] ${userId}: error al consultar el endpoint - ${error}`,
    );
    return null;
  }
}
