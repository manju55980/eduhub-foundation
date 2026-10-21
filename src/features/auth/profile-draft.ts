export type ProfileText = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

function blankToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function profileDraft(fullName: string, email: string, phone: string): ProfileText {
  return {
    fullName: blankToNull(fullName),
    email: blankToNull(email),
    phone: blankToNull(phone),
  };
}

export function profileUpdate(profile: ProfileText) {
  return {
    full_name: profile.fullName,
    email: profile.email,
    phone: profile.phone,
  };
}

export function profileEmailError(email: string) {
  const trimmed = email.trim();
  if (!trimmed || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "";
  return "Enter a valid email.";
}

export function profileInitials(fullName: string, email: string) {
  const name = fullName.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const mail = email.trim();
  return mail ? mail.slice(0, 2).toUpperCase() : "";
}
