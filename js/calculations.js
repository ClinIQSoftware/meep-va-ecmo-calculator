/**
 * Weir equation for energy expenditure.
 * EE (kcal/d) = (3.9 * VO2 + 1.1 * VCO2) * 1.44
 *
 * @param {number} vo2Total - Total O2 consumption (mL/min)
 * @param {number} vco2Total - Total CO2 elimination (mL/min)
 * @returns {number} Energy expenditure (kcal/day)
 */
function weirEquation(vo2Total, vco2Total) {
    return (3.9 * vo2Total + 1.1 * vco2Total) * 1.44;
}

/**
 * Convert plasma pH to RBC pH using Gibbs-Donnan ratio.
 * pHrbc = pHplasma + log10(Rrbc), where Rrbc = 0.69
 *
 * @param {number} pHplasma - Plasma pH
 * @returns {number} RBC pH
 */
function plasmapHToRBCpH(pHplasma) {
    const Rrbc = 0.69;
    return pHplasma + Math.log10(Rrbc);
}

/**
 * Full MEEP protocol calculation.
 * Combines lung IC measurements with ECMO membrane gas exchange
 * calculated via the Dash & Bassingthwaighte model.
 *
 * @param {Object} params
 * @param {Object} params.pre - Pre-membrane BGA: { pO2, pCO2, pH_plasma }
 * @param {Object} params.post - Post-membrane BGA: { pO2, pCO2, pH_plasma }
 * @param {number} params.ecmoFlow - ECMO blood flow (L/min)
 * @param {number} params.vo2Lung - VO2 from lung IC (mL/min)
 * @param {number} params.vco2Lung - VCO2 from lung IC (mL/min)
 * @param {number} params.Temp - Temperature (C)
 * @param {number} params.Hct - Hematocrit (fraction)
 * @param {number} params.Hbrbc - Hemoglobin in RBCs (M)
 * @param {number} params.DPGrbc - 2,3-DPG (M)
 * @param {number} params.baroPressure - Barometric pressure (mmHg)
 * @returns {Object} Results including VO2/VCO2 totals, RQ, and EE
 */
function calculateMEEP(params) {
    const { pre, post, ecmoFlow, vo2Lung, vco2Lung, Temp, Hct, Hbrbc, DPGrbc } = params;

    // Blood gas content pre-membrane
    const preResult = SHbO2CO2({
        pO2: pre.pO2,
        pCO2: pre.pCO2,
        pHrbc: plasmapHToRBCpH(pre.pH_plasma),
        DPGrbc: DPGrbc,
        Temp: Temp,
        Hbrbc: Hbrbc,
        Hct: Hct
    });

    // Blood gas content post-membrane
    const postResult = SHbO2CO2({
        pO2: post.pO2,
        pCO2: post.pCO2,
        pHrbc: plasmapHToRBCpH(post.pH_plasma),
        DPGrbc: DPGrbc,
        Temp: Temp,
        Hbrbc: Hbrbc,
        Hct: Hct
    });

    // Gas exchange across ECMO membrane
    // O2 content: post - pre (O2 gained), CO2 content: pre - post (CO2 removed)
    // Contents in mL/100mL blood, flow in L/min → multiply by 10 for mL/min
    const vo2ECMO = (postResult.O2cont - preResult.O2cont) * ecmoFlow * 10;
    const vco2ECMO = (preResult.CO2cont2 - postResult.CO2cont2) * ecmoFlow * 10;

    // Total gas exchange (lung + ECMO)
    const vo2Total = vo2Lung + vo2ECMO;
    const vco2Total = vco2Lung + vco2ECMO;

    // Respiratory quotient and energy expenditure
    const rq = vco2Total / vo2Total;
    const ee = weirEquation(vo2Total, vco2Total);

    return {
        preO2cont: preResult.O2cont,
        preCO2cont: preResult.CO2cont2,
        postO2cont: postResult.O2cont,
        postCO2cont: postResult.CO2cont2,
        preSHbO2: preResult.SHbO2,
        postSHbO2: postResult.SHbO2,
        vo2ECMO,
        vco2ECMO,
        vo2Total,
        vco2Total,
        rq,
        ee
    };
}

// --- Bachmann Cardiac Output Estimation (Bachmann et al. 2020) ---

/**
 * Calculate VCO2 at the ECMO from exhaust gas (Bachmann Eq. 1).
 *
 * @param {number} peCO2 - pCO2 in ECMO exhaust gas (mmHg)
 * @param {number} vECMO - Sweep gas flow (L/min)
 * @param {number} baroPressure - Barometric pressure (mmHg)
 * @returns {number} VCO2_ECMO (mL/min)
 */
function bachmannVCO2ECMO(peCO2, vECMO, baroPressure) {
    return (peCO2 / baroPressure) * vECMO * 1000;
}

/**
 * Calculate VCO2 at the lung from end-tidal CO2 (Bachmann Eq. 2-3).
 *
 * @param {number} petCO2 - End-tidal CO2 (mmHg)
 * @param {number} inspTime - Inspiratory time component of I:E ratio
 * @param {number} expTime - Expiratory time component of I:E ratio
 * @param {number} vLung - Minute ventilation (L/min)
 * @param {number} baroPressure - Barometric pressure (mmHg)
 * @returns {number} VCO2_Lung (mL/min)
 */
function bachmannVCO2Lung(petCO2, inspTime, expTime, vLung, baroPressure) {
    const peCO2 = petCO2 * (inspTime + expTime) / expTime;
    return (peCO2 / baroPressure) * vLung * 1000;
}

/**
 * Estimate pulmonary blood flow (Bachmann Eq. 13).
 * Q_lung = Q_ECMO * |VCO2_lung| / |VCO2_ECMO|
 *
 * @param {number} qECMO - ECMO blood flow (mL/min)
 * @param {number} vco2Lung - VCO2 at lung (mL/min)
 * @param {number} vco2ECMO - VCO2 at ECMO (mL/min)
 * @returns {number} Estimated Q_lung (mL/min)
 */
function bachmannQLung(qECMO, vco2Lung, vco2ECMO) {
    return qECMO * Math.abs(vco2Lung) / Math.abs(vco2ECMO);
}

/**
 * Normalization correction factor (Bachmann Eq. A5/A7).
 * f(V,Q) = Q * (V/Q + c) / (V * (1 + c))
 *
 * @param {number} V - Sweep gas flow (L/min)
 * @param {number} Q - Blood flow (L/min)
 * @param {number} c - Empirical constant (1.157)
 * @returns {number} Correction factor f
 */
function bachmannNormFactor(V, Q, c) {
    const VQ = V / Q;
    return Q * (VQ + c) / (V * (1 + c));
}

/**
 * Normalized VCO2_ECMO (Bachmann Eq. 15).
 * VCO2_ECMO_Norm = VCO2_ECMO * f(V,Q)
 *
 * @param {number} vco2ECMO - VCO2 at ECMO (mL/min)
 * @param {number} V - Sweep gas flow (L/min)
 * @param {number} Q - Blood flow (L/min)
 * @returns {number} Normalized VCO2_ECMO (mL/min)
 */
function bachmannVCO2ECMONorm(vco2ECMO, V, Q) {
    const c = 1.157;
    const f = bachmannNormFactor(V, Q, c);
    return vco2ECMO * f;
}
