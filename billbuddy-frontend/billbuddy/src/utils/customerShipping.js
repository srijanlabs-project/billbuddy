export function createEmptyShippingAddress() {
  return {
    label: "",
    address: "",
    state: "",
    pincode: "",
    gstNumber: ""
  };
}

function normalizeStateKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function applyShippingAddressGstReuse(addresses) {
  const stateGstMap = new Map();

  const staged = (Array.isArray(addresses) ? addresses : []).map((entry) => {
    const nextEntry = {
      ...createEmptyShippingAddress(),
      ...(entry || {})
    };
    const stateKey = normalizeStateKey(nextEntry.state);
    const gstNumber = String(nextEntry.gstNumber || "").trim().toUpperCase();

    if (stateKey && gstNumber) {
      stateGstMap.set(stateKey, gstNumber);
      nextEntry.gstNumber = gstNumber;
    }

    return nextEntry;
  });

  return staged.map((entry) => {
    const stateKey = normalizeStateKey(entry.state);
    if (!stateKey || String(entry.gstNumber || "").trim()) {
      return entry;
    }

    const reusedGst = stateGstMap.get(stateKey);
    return reusedGst
      ? { ...entry, gstNumber: reusedGst }
      : entry;
  });
}

export function updateShippingAddressValue(addresses, index, field, value) {
  const nextAddresses = (Array.isArray(addresses) ? addresses : []).map((entry, entryIndex) => (
    entryIndex === index ? { ...(entry || {}), [field]: value } : entry
  ));
  return applyShippingAddressGstReuse(nextAddresses);
}
