type ProfileLeaveGuardState = {
  hasUnsavedChanges: boolean;
  save?: () => Promise<boolean>;
  discard?: () => void;
};

let state: ProfileLeaveGuardState = {
  hasUnsavedChanges: false,
};

export function setProfileLeaveGuard(next: ProfileLeaveGuardState) {
  state = next;
}

export function clearProfileLeaveGuard() {
  state = {
    hasUnsavedChanges: false,
  };
}

export function getProfileLeaveGuard() {
  return state;
}
