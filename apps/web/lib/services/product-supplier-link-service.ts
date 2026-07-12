import { getProduct, updateProduct } from "@/lib/services/product-service";
import type { Product, ProductSettings } from "@/lib/product-types";

export async function linkProductSupplier(
  id: string,
  supplier: NonNullable<ProductSettings["supplier"]>,
): Promise<Product> {
  const product = await getProduct(id);
  const fiscalAi = product.fiscalAi ?? ({} as NonNullable<Product["fiscalAi"]>);
  const productSettings = fiscalAi.productSettings ?? {};
  return updateProduct(id, {
    fiscalAi: {
      ...fiscalAi,
      productSettings: {
        ...productSettings,
        supplier: {
          ...supplier,
          status: supplier.status ?? "vinculado",
        },
      },
    },
  });
}
