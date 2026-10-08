"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Whether checkout is opening. While it is, the bag is locked: the order is
// built from the bag as it was when the customer clicked, so later edits
// would silently not apply.
const CheckoutState = createContext<{
  checkingOut: boolean;
  setCheckingOut: (value: boolean) => void;
}>({ checkingOut: false, setCheckingOut: () => {} });

export function CheckoutStateProvider({ children }: { children: ReactNode }) {
  const [checkingOut, setCheckingOut] = useState(false);
  return (
    <CheckoutState.Provider value={{ checkingOut, setCheckingOut }}>{children}</CheckoutState.Provider>
  );
}

export const useCheckoutState = () => useContext(CheckoutState);
