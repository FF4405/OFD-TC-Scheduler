export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// allowedDomains empty means unrestricted (only ever intended for local
// dev — see .dev.vars.example).
export function isAllowedEmailDomain(email: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1];
  return domain ? allowedDomains.includes(domain.toLowerCase()) : false;
}
