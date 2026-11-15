/**
 * `wa.me` link that opens a chat with a prefilled message.
 * `phone` is E.164 ("+573001234567"); omit it to let the user pick the contact.
 */
export function whatsappLink(phone: string | undefined, text?: string): string {
  const number = phone ? phone.replace(/\D/g, "") : "";
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number}${query}`;
}
