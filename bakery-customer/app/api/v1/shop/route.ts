import { getShop } from "@/lib/shop";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Name, address, contact numbers, opening hours and whether it is open now. */
export async function GET() {
  return json(await getShop());
}
