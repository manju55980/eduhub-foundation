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
