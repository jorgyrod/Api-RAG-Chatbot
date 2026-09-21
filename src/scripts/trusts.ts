import { getTrusts } from "../services/trusts.service";

for (const userId of ["USR001", "USR002", "USR999"]) {
  console.log("");
  console.log(`ENTRA: "${userId}"`);
  const info = await getTrusts(userId);
  console.log("SALE :", info);
}

console.log("");
console.log("=== POR QUÉ HACE FALTA ESTE ENDPOINT ===");

const info = await getTrusts("USR001");
if (info) {
  const penalizacion = info.balance * 0.03; // el 3% que dice el contrato (DOC001, chunk 7)
  console.log("");
  console.log(
    `   El DOCUMENTO dice : "pena convencional del tres por ciento del saldo"`,
  );
  console.log(
    `   La API dice       : saldo = ${info.balance.toLocaleString("es-MX")} ${info.currency}`,
  );
  console.log(
    `   Juntando las dos  : ${penalizacion.toLocaleString("es-MX")} ${info.currency} + $5,000 de gastos`,
  );
  console.log("");
  console.log(
    "   Ninguna de las dos fuentes por separado puede responder eso.",
  );
}
