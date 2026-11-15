/** Lowercases and strips accents: "María Pérez" → "maria perez". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Builds `clients.searchText` ("first last phone document"). */
export function clientSearchText(client: {
  firstName: string;
  lastName: string;
  phone: string;
  documentNumber?: string;
}): string {
  const phoneDigits = client.phone.replace(/\D/g, "");
  // Keep the local 10-digit number searchable without the +57 prefix.
  const localPhone = phoneDigits.startsWith("57") ? phoneDigits.slice(2) : phoneDigits;
  return normalizeText(
    [client.firstName, client.lastName, localPhone, client.documentNumber ?? ""].join(" "),
  ).replace(/\s+/g, " ");
}
