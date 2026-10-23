/**
 * Reconciliação derivada no boot.
 *
 * Migrações podem falhar antes da primeira renderização; quando o próximo boot
 * conclui, o plano ativo precisa reconciliar os status derivados do Ciclo uma
 * única vez, além da rolagem da Reta Final. Função pura de roteamento para
 * manter a ordem de inicialização testável.
 */

export function reconcileDerivedStateOnBoot(
  plan,
  { syncCiclo, syncRetaFinal, recoveryPending = false } = {},
) {
  if (!plan?.ativo) return "none";
  if (recoveryPending) {
    if (typeof syncCiclo === "function") syncCiclo();
    return "recovery";
  }
  if (plan.tipo === "reta_final") {
    if (typeof syncRetaFinal === "function") syncRetaFinal();
    return "reta-final";
  }
  if (typeof syncCiclo === "function") syncCiclo();
  return "ciclo";
}
