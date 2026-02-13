/**
 * Dash & Bassingthwaighte SHbO2CO2 Model (EJAP 2016 revision)
 * Computes oxyhemoglobin/carbaminohemoglobin dissociation and
 * O2/CO2 content in whole blood.
 *
 * Reference: Dash & Bassingthwaighte, ABME 38(4):1683-1701, 2010
 * Revised: Dash, 2/29/2016
 *
 * @param {Object} input - { pO2, pCO2, pHrbc, DPGrbc, Temp, Hbrbc, Hct }
 * @returns {Object} computed blood gas values
 */
function SHbO2CO2(input) {
    const { pO2, pCO2, pHrbc, DPGrbc, Temp, Hbrbc, Hct } = input;

    // Fixed parameters
    const Wpl = 0.94;                    // fractional water space of plasma
    const Wrbc = 0.65;                   // fractional water space of RBCs
    const Wbl = (1 - Hct) * Wpl + Hct * Wrbc;
    const K1 = Math.pow(10, -6.12);      // CO2 hydration equilibrium constant
    const K2 = 21.5e-6;                  // CO2 + HbNH2 equilibrium constant
    const K2dp = 1e-6;                   // HbNHCOOH dissociation constant (M)
    const K2p = K2 / K2dp;
    const K3 = 11.3e-6;                  // CO2 + O2HbNH2 equilibrium constant
    const K3dp = 1e-6;                   // O2HbNHCOOH dissociation constant (M)
    const K3p = K3 / K3dp;
    const K5dp = 2.4e-8;                 // HbNH3+ dissociation constant (M)
    const K6dp = 1.2e-8;                 // O2HbNH3+ dissociation constant (M)
    const Rrbc = 0.69;                   // Gibbs-Donnan ratio
    const mol2ml = 22400;                // mol gas → mL gas at STP

    // Standard physiological conditions
    const pO20 = 100;
    const pCO20 = 40;
    const pHrbc0 = 7.24;
    const pHpl0 = pHrbc0 - Math.log10(Rrbc);
    const DPGrbc0 = 4.65e-3;
    const Temp0 = 37;
    const P500 = 26.8;
    const alphaO20 = 1.46e-6;            // O2 solubility at 37C (M/mmHg)
    const alphaCO20 = 32.66e-6;          // CO2 solubility at 37C (M/mmHg)

    // Intermediate variables
    const pHpl = pHrbc - Math.log10(Rrbc);
    const delpHrbc = pHrbc - pHrbc0;
    const delpCO2 = pCO2 - pCO20;
    const delDPGrbc = DPGrbc - DPGrbc0;
    const delTemp = Temp - Temp0;

    // Temperature-corrected solubilities
    const alphaO2 = alphaO20 * (1 - 1e-2 * delTemp + 4.234e-4 * delTemp * delTemp);
    const alphaCO2 = alphaCO20 * (1 - 1.86e-2 * delTemp + 6.515e-4 * delTemp * delTemp);

    // Dissolved gas concentrations
    const O2 = alphaO2 * pO2;
    const CO2 = alphaCO2 * pCO2;
    const Hrbc = Math.pow(10, -pHrbc);
    const Hpl = Math.pow(10, -pHpl);

    // P50 corrections for pH, CO2, DPG, and temperature
    const P501 = P500 + 1.2 * (-21.279 * delpHrbc + 8.872 * delpHrbc * delpHrbc - 1.47 * delpHrbc * delpHrbc * delpHrbc);
    const P502 = P500 + 1.7 * (4.28e-2 * delpCO2 + 3.64e-5 * delpCO2 * delpCO2);
    const P503 = P500 + 1.0 * (795.633533 * delDPGrbc - 19660.8947 * delDPGrbc * delDPGrbc);
    const P504 = P500 + 0.98 * (1.4945 * delTemp + 4.335e-2 * delTemp * delTemp + 7e-4 * delTemp * delTemp * delTemp);
    const P50 = P500 * (P501 / P500) * (P502 / P500) * (P503 / P500) * (P504 / P500);
    const C50 = alphaO2 * P50;

    // pO2-dependent variable Hill coefficient (Roughton et al.)
    const nH = 2.8 - 1.2 * Math.pow(10, -pO2 / 29.2);

    // Binding polynomials
    const BPH1 = 1 + K2dp / Hrbc;
    const BPH2 = 1 + K3dp / Hrbc;
    const BPH3 = 1 + Hrbc / K5dp;
    const BPH4 = 1 + Hrbc / K6dp;

    // Apparent equilibrium constants
    const K4p = (Math.pow(O2, nH - 1) * (K2p * BPH1 * CO2 + BPH3)) /
                (Math.pow(C50, nH) * (K3p * BPH2 * CO2 + BPH4));
    const KHbO2 = K4p * (K3p * BPH2 * CO2 + BPH4) / (K2p * BPH1 * CO2 + BPH3);
    const KHbCO2 = (K2p * BPH1 + K3p * K4p * BPH2 * O2) / (BPH3 + K4p * BPH4 * O2);

    // O2 and CO2 saturations
    const SHbO2 = KHbO2 * O2 / (1 + KHbO2 * O2);
    const SHbCO2 = KHbCO2 * CO2 / (1 + KHbCO2 * CO2);

    // O2 content in blood
    const O2free = Wbl * O2;                          // dissolved
    const O2bound = 4 * Hct * Hbrbc * SHbO2;          // Hb-bound
    const O2tot = O2free + O2bound;                    // total (M)
    const O2cont = mol2ml * O2tot / 10;                // mL O2/100mL blood

    // CO2 content in blood
    const CO2free = Wbl * CO2;                         // dissolved
    const CO2bicarb = ((1 - Hct) * Wpl + Hct * Wrbc * Rrbc) * (K1 * CO2 / Hpl);  // bicarbonate
    const CO2bound = 4 * Hct * Hbrbc * SHbCO2;        // carbamino
    const CO2tot1 = CO2free + CO2bound;                // without bicarbonate
    const CO2cont1 = mol2ml * CO2tot1 / 10;
    const CO2tot2 = CO2free + CO2bicarb + CO2bound;    // with bicarbonate
    const CO2cont2 = mol2ml * CO2tot2 / 10;

    return {
        alphaO2, alphaCO2, P50, K4p, KHbO2, KHbCO2, SHbO2, SHbCO2,
        O2tot, CO2tot1, CO2tot2, O2cont, CO2cont1, CO2cont2,
        O2free, O2bound, CO2free, CO2bicarb, CO2bound,
        nH, C50, Wbl, pHpl
    };
}
