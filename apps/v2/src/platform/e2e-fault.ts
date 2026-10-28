export type E2EFault = 'abort' | 'quota' | null;

let activeFault: E2EFault = null;

export function getE2EFault(): E2EFault {
  return activeFault;
}

export function setE2EFault(fault: E2EFault): void {
  activeFault = fault;
}
